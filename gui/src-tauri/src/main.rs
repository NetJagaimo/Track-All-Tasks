#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{params, Connection};
use chrono::{Local, NaiveDateTime};
use std::collections::HashMap;
use tauri::{command, State};
use std::sync::Mutex;

struct Db(Mutex<Connection>);

#[command]
fn start_task(db: State<Db>, name: String) {
    let dt = Local::now().naive_local();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'start')",
        params![dt.to_string(), name],
    ).unwrap();
}

#[command]
fn stop_task(db: State<Db>, name: String) {
    let dt = Local::now().naive_local();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, 'end')",
        params![dt.to_string(), name],
    ).unwrap();
}

#[derive(serde::Serialize)]
struct TaskTotal { name: String, total: i64 }

#[command]
fn list_tasks(db: State<Db>) -> Vec<TaskTotal> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT datetime, task_name, action FROM tasks ORDER BY datetime ASC").unwrap();
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))).unwrap();
    let mut start_times: HashMap<String, NaiveDateTime> = HashMap::new();
    let mut totals: HashMap<String, chrono::Duration> = HashMap::new();
    for r in rows {
        let (dt_str, name, action) = r.unwrap();
        let dt = NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M:%S%.f").unwrap();
        if action == "start" { start_times.insert(name.clone(), dt); }
        else if let Some(start) = start_times.remove(&name) {
            let diff = dt - start; *totals.entry(name.clone()).or_default() += diff;
        }
    }
    totals.into_iter().map(|(n,d)| TaskTotal{name:n,total:d.num_seconds()}).collect()
}

#[derive(serde::Serialize)]
struct Record { datetime: String, action: String }

#[command]
fn get_records(db: State<Db>, name: String) -> Vec<Record> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT datetime, action FROM tasks WHERE task_name=? ORDER BY datetime ASC").unwrap();
    stmt.query_map(params![name], |row| Ok(Record{ datetime: row.get(0)?, action: row.get(1)? })).unwrap().map(|r| r.unwrap()).collect()
}

fn init_db() -> Connection {
    let conn = Connection::open("tasks.db").unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, datetime TEXT NOT NULL, task_name TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('start','end')))",
        [],
    ).unwrap();
    conn
}

fn main() {
    tauri::Builder::default()
        .manage(Db(Mutex::new(init_db())))
        .invoke_handler(tauri::generate_handler![start_task, stop_task, list_tasks, get_records])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
