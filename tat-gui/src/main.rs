use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};
use std::{sync::{Arc, Mutex}, thread, time::Duration};
use chrono::{Local, NaiveDateTime};
use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};

#[derive(Default)]
struct TaskState {
    active_task: Option<String>,
    start_time: Option<NaiveDateTime>,
}

type SharedState = Arc<Mutex<TaskState>>;

#[derive(Serialize)]
struct TaskTotal {
    name: String,
    seconds: i64,
}

#[derive(Serialize, Deserialize)]
struct Record {
    id: i64,
    datetime: String,
    action: String,
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
    ).unwrap();
    conn
}

#[tauri::command]
fn start_task(state: tauri::State<'_, SharedState>, task: String) {
    let mut st = state.lock().unwrap();
    let now = Local::now().naive_local();
    st.active_task = Some(task.clone());
    st.start_time = Some(now);
    let conn = init_db();
    conn.execute(
        "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'start')",
        params![now.to_string(), task],
    ).unwrap();
}

#[tauri::command]
fn stop_task(state: tauri::State<'_, SharedState>) {
    let mut st = state.lock().unwrap();
    if let Some(task) = st.active_task.take() {
        let now = Local::now().naive_local();
        let conn = init_db();
        conn.execute(
            "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'end')",
            params![now.to_string(), task],
        ).unwrap();
    }
    st.start_time = None;
}

#[tauri::command]
fn list_tasks() -> Vec<TaskTotal> {
    let conn = init_db();
    let mut stmt = conn.prepare("SELECT datetime, task_name, action FROM tasks ORDER BY datetime ASC").unwrap();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    }).unwrap();
    use std::collections::HashMap;
    let mut start_times = HashMap::new();
    let mut totals: HashMap<String, chrono::Duration> = HashMap::new();
    for row in rows {
        let (dt, name, action) = row.unwrap();
        let dt = NaiveDateTime::parse_from_str(&dt, "%Y-%m-%d %H:%M:%S%.f").unwrap();
        if action == "start" { start_times.insert(name.clone(), dt); } else if let Some(start) = start_times.remove(&name) { let diff = dt - start; let entry = totals.entry(name.clone()).or_insert_with(|| chrono::Duration::zero()); *entry = *entry + diff; }
    }
    totals.into_iter().map(|(n,d)| TaskTotal{name:n, seconds:d.num_seconds()}).collect()
}

#[tauri::command]
fn records(task: String) -> Vec<Record> {
    let conn = init_db();
    let mut stmt = conn.prepare("SELECT id, datetime, action FROM tasks WHERE task_name = ? ORDER BY datetime ASC").unwrap();
    let rows = stmt.query_map([task], |row| {
        Ok(Record { id: row.get(0)?, datetime: row.get(1)?, action: row.get(2)? })
    }).unwrap();
    rows.map(|r| r.unwrap()).collect()
}

#[tauri::command]
fn delete_record(id: i64) {
    let conn = init_db();
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id]).unwrap();
}

fn main() {
    let state: SharedState = Arc::new(Mutex::new(TaskState::default()));
    let tray_menu = SystemTrayMenu::new();
    let tray = SystemTray::new().with_menu(tray_menu);
    tauri::Builder::default()
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![start_task, stop_task, list_tasks, records, delete_record])
        .system_tray(tray)
        .on_system_tray_event(move |app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            _ => {}
        })
        .setup(move |app| {
            let tray_handle = app.tray_handle();
            let state = state.clone();
            thread::spawn(move || {
                loop {
                    {
                        let st = state.lock().unwrap();
                        if let Some(ref task) = st.active_task {
                            if let Some(start) = st.start_time {
                                let elapsed = Local::now().naive_local() - start;
                                let title = format!("{} - {}s", task, elapsed.num_seconds());
                                tray_handle.set_title(&title).ok();
                            }
                        } else {
                            tray_handle.set_title("Idle").ok();
                        }
                    }
                    thread::sleep(Duration::from_secs(1));
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

