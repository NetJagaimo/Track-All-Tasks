use chrono::{Local, NaiveDateTime};
use rusqlite::{params, Connection};
use std::{sync::{Arc, Mutex}, thread, time::Duration};
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};

struct AppState {
    db: Mutex<Connection>,
    current: Mutex<Option<(String, NaiveDateTime)>>,
}

#[tauri::command]
fn start_task(state: tauri::State<'_, AppState>, name: String) {
    let now = Local::now().naive_local();
    {
        let conn = state.db.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'start')",
            params![now.to_string(), name],
        );
    }
    *state.current.lock().unwrap() = Some((name, now));
}

#[tauri::command]
fn stop_task(state: tauri::State<'_, AppState>) {
    if let Some((name, _)) = state.current.lock().unwrap().take() {
        let now = Local::now().naive_local();
        let conn = state.db.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'end')",
            params![now.to_string(), name],
        );
    }
}

#[tauri::command]
fn list_tasks(state: tauri::State<'_, AppState>) -> Vec<(String, i64)> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT datetime, task_name, action FROM tasks ORDER BY datetime ASC")
        .unwrap();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })
        .unwrap();
    use std::collections::HashMap;
    let mut start_times: HashMap<String, NaiveDateTime> = HashMap::new();
    let mut totals: HashMap<String, chrono::Duration> = HashMap::new();
    for row in rows {
        let (dt_str, name, action) = row.unwrap();
        let dt = NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M:%S%.f").unwrap();
        if action == "start" {
            start_times.insert(name.clone(), dt);
        } else if action == "end" {
            if let Some(start) = start_times.remove(&name) {
                let diff = dt - start;
                let entry = totals.entry(name.clone()).or_default();
                *entry = *entry + diff;
            }
        }
    }
    totals.into_iter().map(|(n, d)| (n, d.num_seconds())).collect()
}

fn init_db() -> Connection {
    let conn = Connection::open("tasks.db").unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            datetime TEXT NOT NULL,
            task_name TEXT NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('start', 'end'))
        )",
        [],
    )
    .unwrap();
    conn
}

fn build_tray() -> SystemTray {
    let item = CustomMenuItem::new("noop", "Initializing");
    let menu = SystemTrayMenu::new().add_item(item);
    SystemTray::new().with_menu(menu)
}

fn main() {
    let state = AppState {
        db: Mutex::new(init_db()),
        current: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(state)
        .system_tray(build_tray())
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                if id.as_str() == "noop" {
                    // no-op
                }
            }
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle();
            thread::spawn(move || loop {
                let state: tauri::State<AppState> = handle.state();
                let mut tray = handle.tray_handle();
                if let Some((name, start)) = state.current.lock().unwrap().clone() {
                    let elapsed = Local::now().naive_local() - start;
                    let label = format!("{} - {}s", name, elapsed.num_seconds());
                    tray.get_item("noop").set_title(label).unwrap();
                } else {
                    tray.get_item("noop").set_title("No task").unwrap();
                }
                thread::sleep(Duration::from_secs(1));
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_task, stop_task, list_tasks])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
