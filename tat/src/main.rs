use chrono::{Local, NaiveDateTime};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::{Arc, Mutex}};
use tauri::State;

// 數據結構
#[derive(Debug, Serialize, Deserialize)]
struct TaskSummary {
    task_name: String,
    start_time: String,
    end_time: Option<String>,
    duration_minutes: Option<f64>,
}

// 應用程式狀態
struct AppState {
    db: Arc<Mutex<Connection>>,
}

// Tauri 命令
#[tauri::command]
fn start_task(task_name: String, state: State<AppState>) -> Result<(), String> {
    let start_time = Local::now().naive_local();
    log_task(&state.db, &task_name, &start_time, "start")
        .map_err(|e| format!("Failed to start task: {}", e))
}

#[tauri::command]
fn end_task(task_name: String, state: State<AppState>) -> Result<(), String> {
    let end_time = Local::now().naive_local();
    log_task(&state.db, &task_name, &end_time, "end")
        .map_err(|e| format!("Failed to end task: {}", e))
}

#[tauri::command]
fn get_task_history(state: State<AppState>) -> Result<Vec<TaskSummary>, String> {
    get_task_summaries(&state.db)
        .map_err(|e| format!("Failed to get task history: {}", e))
}

fn main() -> Result<()> {
    // 初始化數據庫
    let db_conn = Arc::new(Mutex::new(init_db()?));
    
    // 啟動 Tauri 應用程式
    tauri::Builder::default()
        .manage(AppState { db: db_conn })
        .invoke_handler(tauri::generate_handler![start_task, end_task, get_task_history])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}

fn init_db() -> Result<Connection> {
    let conn = Connection::open("tasks.db")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            datetime TEXT NOT NULL,
            task_name TEXT NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('start', 'end'))
        )",
        [],
    )?;
    Ok(conn)
}

fn log_task(conn: &Arc<Mutex<Connection>>, task_name: &str, datetime: &NaiveDateTime, action: &str) -> Result<()> {
    let conn = conn.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (datetime, task_name, action) VALUES (?1, ?2, ?3)",
        params![datetime.to_string(), task_name, action],
    )?;
    Ok(())
}

fn get_task_summaries(conn: &Arc<Mutex<Connection>>) -> Result<Vec<TaskSummary>> {
    let conn = conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT datetime, task_name, action FROM tasks ORDER BY datetime DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut task_sessions: Vec<TaskSummary> = Vec::new();
    let mut start_times: HashMap<String, NaiveDateTime> = HashMap::new();

    for row in rows {
        let (dt_str, name, action) = row?;
        let dt = NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M:%S%.f")
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;

        if action == "start" {
            start_times.insert(name.clone(), dt);
        } else if action == "end" {
            if let Some(start) = start_times.remove(&name) {
                let duration = dt - start;
                let duration_minutes = duration.num_minutes() as f64;
                
                task_sessions.push(TaskSummary {
                    task_name: name,
                    start_time: start.format("%Y-%m-%d %H:%M:%S").to_string(),
                    end_time: Some(dt.format("%Y-%m-%d %H:%M:%S").to_string()),
                    duration_minutes: Some(duration_minutes),
                });
            }
        }
    }

    // 處理還在進行中的任務
    for (name, start_time) in start_times {
        task_sessions.push(TaskSummary {
            task_name: name,
            start_time: start_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            end_time: None,
            duration_minutes: None,
        });
    }

    // 按開始時間倒序排列
    task_sessions.sort_by(|a, b| b.start_time.cmp(&a.start_time));

    Ok(task_sessions)
}

fn list_tasks(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT datetime, task_name, action FROM tasks ORDER BY datetime ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut start_times: HashMap<String, NaiveDateTime> = HashMap::new();
    let mut totals: HashMap<String, chrono::Duration> = HashMap::new();

    for row in rows {
        let (dt_str, name, action) = row?;
        let dt = NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M:%S%.f")
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;
        if action == "start" {
            start_times.insert(name.clone(), dt);
        } else if action == "end" {
            if let Some(start) = start_times.remove(&name) {
                let diff = dt - start;
                let entry = totals.entry(name.clone()).or_insert_with(|| chrono::Duration::zero());
                *entry = *entry + diff;
            }
        }
    }

    for (name, duration) in totals {
        println!("Task '{}' total time: {} seconds", name, duration.num_seconds());
    }

    Ok(())
}
