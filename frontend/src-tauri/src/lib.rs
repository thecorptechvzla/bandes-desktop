use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
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