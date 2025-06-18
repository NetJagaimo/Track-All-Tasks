use chrono::{Local, NaiveDateTime};
use rusqlite::{params, Connection, Result};
use std::{collections::HashMap, sync::{Arc, Mutex}, thread, time::Duration};


fn main() -> Result<()> {
    let db_conn = Arc::new(Mutex::new(init_db()?));
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: tat [start|end] [task_name]\n       tat list");
        return Ok(());
    }

    let action = args[1].clone();

    if action == "list" {
        let conn = db_conn.lock().unwrap();
        list_tasks(&conn)?;
        return Ok(());
    }

    if args.len() < 3 {
        eprintln!("Usage: tat [start|end] [task_name]");
        return Ok(());
    }

    let task_name = args[2].clone(); // 使用 .clone() 以確保數據被移動到閉包中

    if action == "start" {
        let start_time = Local::now().naive_local();
        log_task(&db_conn, &task_name, &start_time, "start")?;

        let db_conn_clone = Arc::clone(&db_conn);
        let task_name_clone = task_name.clone(); // 再次複製以用於閉包
        ctrlc::set_handler(move || {
            let end_time = Local::now().naive_local();
            log_task(&db_conn_clone, &task_name_clone, &end_time, "end").unwrap();
            println!("\nTask '{}' stopped.", task_name_clone);
            std::process::exit(0);
        }).expect("Failed to set Ctrl+C handler");

        loop {
            let elapsed = Local::now().naive_local() - start_time;
            print!("\rTask '{}' running for {} seconds", task_name, elapsed.num_seconds());
            std::io::Write::flush(&mut std::io::stdout()).unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    } else {
        let end_time = Local::now().naive_local();
        log_task(&db_conn, &task_name, &end_time, "end")?;
        println!("Task '{}' stopped.", task_name);
    }

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
