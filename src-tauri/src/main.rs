#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app
                .path()
                .app_data_dir()
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            std::fs::create_dir_all(&directory)?;
            let store = store::Store::open(directory.join("port-guard.sqlite3"))
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_state,
            commands::save_state,
            commands::reset_state,
            commands::preview_policy,
            commands::app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Port Guard");
}
