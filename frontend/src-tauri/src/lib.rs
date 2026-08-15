use tauri::webview::DownloadEvent;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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

            let sidecar = app.shell().sidecar("backend-api")?;
            let (mut rx, _child) = sidecar
                .spawn()
                .expect("No se pudo iniciar el sidecar backend-api");
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            let _ = handle.emit(
                                "sidecar://log",
                                String::from_utf8_lossy(&line).to_string(),
                            );
                        }
                        CommandEvent::Error(e) => {
                            let _ = handle.emit("sidecar://error", e.to_string());
                        }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar Bandes desktop");
}