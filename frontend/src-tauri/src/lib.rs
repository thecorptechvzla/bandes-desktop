use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::webview::DownloadEvent;
use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Sidecar backend-api que queda registrado para matarlo al salir (evita
/// procesos huérfanos que dejan el puerto 3001 ocupado en la siguiente apertura).
static SIDECAR_CHILD: Mutex<Option<CommandChild>> = Mutex::new(None);

/// Convierte días desde la época UNIX a fecha civil (algoritmo de Howard Hinnant).
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Fecha y hora local (año, mes, día, hora, min, seg).
fn now_parts() -> (i64, u32, u32, u32, u32, u32) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs.div_euclid(86_400);
    let tod = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    (
        y,
        m,
        d,
        (tod / 3600) as u32,
        ((tod / 60) % 60) as u32,
        (tod % 60) as u32,
    )
}

/// Ruta del log diario en la carpeta de datos de la app (rotación por fecha).
fn log_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("logs");
    fs::create_dir_all(&dir).ok()?;
    let (y, m, d, _, _, _) = now_parts();
    Some(dir.join(format!("bandes-{y:04}-{m:02}-{d:02}.log")))
}

fn append_line(path: &Path, text: &str) {
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let (_, _, _, h, mi, s) = now_parts();
    let _ = writeln!(file, "[{h:02}:{mi:02}:{s:02}] {text}");
}

/// Comando invocado desde el frontend para registrar errores de UI/API.
#[tauri::command]
fn log_error(app: tauri::AppHandle, level: String, message: String) {
    let Some(path) = log_file(&app) else { return };
    let clean = message.replace(['\r', '\n'], " ");
    append_line(&path, &format!("[{level}] {clean}"));
}

/// Abre la carpeta de logs en el explorador de Windows.
#[tauri::command]
fn open_logs_folder(app: tauri::AppHandle) {
    let Some(file) = log_file(&app) else { return };
    let Some(dir) = file.parent() else { return };
    #[cfg(target_os = "windows")]
    {
        let _ = StdCommand::new("explorer").arg(dir).spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = dir;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![log_error, open_logs_folder])
        .setup(|app| {
            // La ventana se crea aquí (no desde tauri.conf.json) para poder
            // adjuntar el manejador de descargas: WebView2 cancela toda
            // descarga (PDF/Excel generados en el frontend) si no se registra.
            let download_dir = app
                .path()
                .download_dir()
                .ok()
                .unwrap_or_else(std::env::temp_dir);

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Bandes - Control Mining")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 680.0)
                .resizable(true)
                .on_download(move |_webview, event| match event {
                    DownloadEvent::Requested { destination, .. } => {
                        if let Some(file_name) = destination.file_name().map(|s| s.to_owned()) {
                            *destination = download_dir.join(file_name);
                        }
                        true
                    }
                    DownloadEvent::Finished { url, path, success } => {
                        println!("Descarga finalizada: {} -> {:?} (success: {})", url, path, success);
                        true
                    }
                    _ => true,
                })
                .build()?;

            // Auto-sanación: si el puerto del sidecar quedó ocupado por un proceso
            // huérfano de una versión anterior, liberarlo antes de arrancar el nuevo.
            if TcpStream::connect(("127.0.0.1", 3001)).is_ok() {
                #[cfg(target_os = "windows")]
                {
                    let _ = StdCommand::new("taskkill")
                        .args(["/F", "/IM", "backend-api.exe"])
                        .status();
                }
                std::thread::sleep(std::time::Duration::from_millis(400));
            }

            let sidecar = app.shell().sidecar("backend-api")?;
            let (mut rx, child) = sidecar
                .spawn()
                .expect("No se pudo iniciar el sidecar backend-api");

            *SIDECAR_CHILD.lock().unwrap() = Some(child);

            let handle = app.handle().clone();
            let log_path = log_file(&handle);
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            let text = String::from_utf8_lossy(&line).to_string();
                            let _ = handle.emit("sidecar://log", text.clone());
                            if let Some(p) = &log_path {
                                append_line(p, &format!("[BACKEND] {}", text.trim_end()));
                            }
                        }
                        CommandEvent::Error(e) => {
                            let _ = handle.emit("sidecar://error", e.clone());
                            if let Some(p) = &log_path {
                                append_line(p, &format!("[SIDECAR] {}", e.trim_end()));
                            }
                        }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al crear Bandes desktop")
        .run(|_app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = SIDECAR_CHILD.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}