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
    duration_seconds: Option<f64>,
}

// 應用程式狀態
struct AppState {
    db: Arc<Mutex<Connection>>,
}

// Tauri 命令
#[tauri::command]
fn start_task(task_name: String, state: State<AppState>) -> Result<(), String> {
    println!("開始任務: {}", task_name);
    let start_time = Local::now().naive_local();
    println!("開始時間: {}", start_time);
    
    let conn = state.db.lock().unwrap();
    match conn.execute(
        "INSERT INTO tasks (task_name, start_time, end_time) VALUES (?1, ?2, NULL)",
        params![task_name, start_time.to_string()],
    ) {
        Ok(_) => {
            println!("任務 '{}' 成功記錄到數據庫", task_name);
            Ok(())
        }
        Err(e) => {
            eprintln!("記錄任務失敗: {}", e);
            Err(format!("Failed to start task: {}", e))
        }
    }
}

#[tauri::command]
fn end_task(task_name: String, state: State<AppState>) -> Result<(), String> {
    println!("結束任務: {}", task_name);
    let end_time = Local::now().naive_local();
    println!("結束時間: {}", end_time);
    
    let conn = state.db.lock().unwrap();
    match conn.execute(
        "UPDATE tasks SET end_time = ?1 WHERE task_name = ?2 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
        params![end_time.to_string(), task_name],
    ) {
        Ok(rows_affected) => {
            if rows_affected > 0 {
                println!("任務 '{}' 結束成功記錄到數據庫", task_name);
                Ok(())
            } else {
                eprintln!("沒有找到正在進行的任務 '{}' 來結束", task_name);
                Err(format!("No ongoing task '{}' found to end", task_name))
            }
        }
        Err(e) => {
            eprintln!("記錄任務結束失敗: {}", e);
            Err(format!("Failed to end task: {}", e))
        }
    }
}

#[tauri::command]
fn get_task_history(state: State<AppState>) -> Result<HashMap<String, Vec<TaskSummary>>, String> {
    println!("獲取任務歷史");
    match get_task_summaries(&state.db) {
        Ok(history) => {
            println!("成功獲取 {} 個任務組", history.len());
            Ok(history)
        }
        Err(e) => {
            eprintln!("獲取任務歷史失敗: {}", e);
            Err(format!("Failed to get task history: {}", e))
        }
    }
}

fn main() -> Result<()> {
    println!("正在啟動 Track All Tasks 應用程式...");
    
    // 初始化數據庫
    println!("正在初始化數據庫...");
    let db_conn = Arc::new(Mutex::new(init_db()?));
    println!("數據庫初始化完成");
    
    // 啟動 Tauri 應用程式
    println!("正在啟動 Tauri 應用程式...");
    tauri::Builder::default()
        .manage(AppState { db: db_conn })
        .invoke_handler(tauri::generate_handler![start_task, end_task, get_task_history])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}

fn init_db() -> Result<Connection> {
    println!("正在打開數據庫連接...");
    let conn = Connection::open("tasks.db")?;
    println!("數據庫連接成功，正在創建表格...");
    
    // 刪除舊表（如果存在），這會清除所有現有數據
    conn.execute("DROP TABLE IF EXISTS tasks", [])?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT
        )",
        [],
    )?;
    
    println!("數據庫表格創建完成");
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

fn get_task_summaries(conn: &Arc<Mutex<Connection>>) -> Result<HashMap<String, Vec<TaskSummary>>> {
    let conn = conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT task_name, start_time, end_time FROM tasks ORDER BY start_time DESC",
    )?;
    let task_rows = stmt.query_map([], |row| {
        let task_name: String = row.get(0)?;
        let start_time_str: String = row.get(1)?;
        let end_time_str: Option<String> = row.get(2)?;

        let start_time = NaiveDateTime::parse_from_str(&start_time_str, "%Y-%m-%d %H:%M:%S%.f")
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;

        let mut duration_seconds: Option<f64> = None;
        let mut end_time_formatted: Option<String> = None;

        if let Some(end_str) = end_time_str {
            let end_time = NaiveDateTime::parse_from_str(&end_str, "%Y-%m-%d %H:%M:%S%.f")
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                ))?;
            let duration = end_time - start_time;
            duration_seconds = Some(duration.num_seconds() as f64);
            end_time_formatted = Some(end_time.format("%Y-%m-%d %H:%M:%S").to_string());
        }

        Ok(TaskSummary {
            task_name,
            start_time: start_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            end_time: end_time_formatted,
            duration_seconds,
        })
    })?;

    let mut grouped_summaries: HashMap<String, Vec<TaskSummary>> = HashMap::new();
    for summary_result in task_rows {
        let summary = summary_result?;
        grouped_summaries.entry(summary.task_name.clone()).or_insert_with(Vec::new).push(summary);
    }

    Ok(grouped_summaries)
}
