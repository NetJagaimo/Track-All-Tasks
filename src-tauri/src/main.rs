// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

// 任務記錄資料結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: String,                    // 唯一識別碼
    pub name: String,                  // 任務名稱
    pub start_time: u64,              // 開始時間 (Unix timestamp)
    pub end_time: Option<u64>,        // 結束時間 (None 表示進行中)
    pub duration_seconds: Option<u64>, // 總花費時間（秒）
    pub created_at: u64,              // 建立時間
}

impl TaskRecord {
    // 建立新任務記錄
    pub fn new(name: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            id: format!("{}-{}", now, uuid::Uuid::new_v4().to_string()[..8].to_string()),
            name,
            start_time: now,
            end_time: None,
            duration_seconds: None,
            created_at: now,
        }
    }

    // 結束任務並計算持續時間
    pub fn finish(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        self.end_time = Some(now);
        self.duration_seconds = Some(now - self.start_time);
    }

    // 檢查任務是否進行中
    pub fn is_active(&self) -> bool {
        self.end_time.is_none()
    }

    // 取得持續時間（秒）
    pub fn get_duration(&self) -> u64 {
        match self.duration_seconds {
            Some(duration) => duration,
            None => {
                // 如果任務仍在進行中，計算目前已經過的時間
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                now - self.start_time
            }
        }
    }

    // 取得格式化的持續時間字串
    pub fn get_duration_formatted(&self) -> String {
        let duration = self.get_duration();
        Self::format_duration(duration)
    }

    // 格式化時間（靜態方法）
    pub fn format_duration(seconds: u64) -> String {
        let hours = seconds / 3600;
        let minutes = (seconds % 3600) / 60;
        let secs = seconds % 60;

        if hours > 0 {
            format!("{:02}:{:02}:{:02}", hours, minutes, secs)
        } else {
            format!("{:02}:{:02}", minutes, secs)
        }
    }

    // 取得開始時間的格式化字串
    pub fn get_start_time_formatted(&self) -> String {
        Self::format_timestamp(self.start_time)
    }

    // 取得結束時間的格式化字串
    pub fn get_end_time_formatted(&self) -> Option<String> {
        self.end_time.map(Self::format_timestamp)
    }

    // 格式化時間戳記為可讀字串
    fn format_timestamp(timestamp: u64) -> String {
        use std::time::{Duration, UNIX_EPOCH};
        
        let datetime = UNIX_EPOCH + Duration::from_secs(timestamp);
        // 簡單格式化，實際可以使用 chrono 庫做更複雜的格式化
        format!("{:?}", datetime)
    }
}

// 應用程式狀態
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub current_task: Option<TaskRecord>, // 目前進行中的任務
    pub task_history: Vec<TaskRecord>,    // 任務歷史記錄
    pub recent_task_names: Vec<String>,   // 最近使用的任務名稱
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_task: None,
            task_history: Vec::new(),
            recent_task_names: Vec::new(),
        }
    }
}

impl AppState {
    // 取得資料檔案路徑
    fn get_data_file_path() -> Result<PathBuf, String> {
        // 使用用戶主目錄下的 .track-all-tasks 目錄
        let home_dir = dirs::home_dir()
            .ok_or("無法取得用戶主目錄")?;
        
        let app_data_dir = home_dir.join(".track-all-tasks");
        
        // 確保目錄存在
        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("無法建立資料目錄: {}", e))?;
        }
        
        Ok(app_data_dir.join("tasks.json"))
    }

    // 從檔案載入資料
    pub fn load_from_file() -> Self {
        match Self::get_data_file_path() {
            Ok(file_path) => {
                if file_path.exists() {
                    match fs::read_to_string(&file_path) {
                        Ok(content) => {
                            match serde_json::from_str::<AppState>(&content) {
                                Ok(mut state) => {
                                    // 如果有進行中的任務但程式被關閉，自動結束該任務
                                    if let Some(mut current_task) = state.current_task.take() {
                                        current_task.finish();
                                        state.task_history.push(current_task);
                                        // 立即儲存更新後的狀態
                                        let _ = state.save_to_file();
                                    }
                                    return state;
                                }
                                Err(e) => {
                                    eprintln!("解析資料檔案失敗: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("讀取資料檔案失敗: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("取得資料檔案路徑失敗: {}", e);
            }
        }
        
        // 如果載入失敗，回傳預設狀態
        Self::default()
    }

    // 儲存資料到檔案
    pub fn save_to_file(&self) -> Result<(), String> {
        let file_path = Self::get_data_file_path()?;
        
        let json_content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("序列化資料失敗: {}", e))?;
        
        fs::write(&file_path, json_content)
            .map_err(|e| format!("寫入資料檔案失敗: {}", e))?;
        
        Ok(())
    }

    // 開始新任務
    pub fn start_task(&mut self, name: String) -> Result<(), String> {
        // 如果有進行中的任務，先結束它
        if let Some(mut current) = self.current_task.take() {
            current.finish();
            self.task_history.push(current);
        }

        // 開始新任務
        let new_task = TaskRecord::new(name.clone());
        self.current_task = Some(new_task);

        // 更新最近任務名稱
        self.update_recent_task_names(name);

        // 儲存到檔案
        self.save_to_file()?;

        Ok(())
    }

    // 停止目前任務
    pub fn stop_current_task(&mut self) -> Result<(), String> {
        match self.current_task.take() {
            Some(mut task) => {
                task.finish();
                self.task_history.push(task);
                
                // 儲存到檔案
                self.save_to_file()?;
                
                Ok(())
            }
            None => Err("沒有進行中的任務".to_string()),
        }
    }

    // 更新最近任務名稱列表
    fn update_recent_task_names(&mut self, name: String) {
        // 移除重複的名稱
        self.recent_task_names.retain(|n| n != &name);
        // 插入到前面
        self.recent_task_names.insert(0, name);
        // 只保留最近 10 個
        self.recent_task_names.truncate(10);
    }

    // 取得目前任務狀態（詳細版本）
    pub fn get_current_status(&self) -> (bool, Option<String>, u64) {
        match &self.current_task {
            Some(task) => (true, Some(task.name.clone()), task.get_duration()),
            None => (false, None, 0),
        }
    }

    // 取得格式化的目前任務狀態
    pub fn get_current_status_formatted(&self) -> (bool, Option<String>, String) {
        match &self.current_task {
            Some(task) => (
                true, 
                Some(task.name.clone()), 
                task.get_duration_formatted()
            ),
            None => (false, None, "00:00".to_string()),
        }
    }

    // 取得今日任務統計
    pub fn get_today_stats(&self) -> (u64, u64, String) {
        let today_start = Self::get_today_start_timestamp();
        
        // 篩選今日的任務
        let today_tasks: Vec<&TaskRecord> = self.task_history
            .iter()
            .filter(|task| task.start_time >= today_start)
            .collect();

        let task_count = today_tasks.len() as u64;
        let total_seconds: u64 = today_tasks
            .iter()
            .map(|task| task.get_duration())
            .sum();

        // 加上目前進行中的任務時間
        let total_with_current = if let Some(current) = &self.current_task {
            if current.start_time >= today_start {
                total_seconds + current.get_duration()
            } else {
                total_seconds
            }
        } else {
            total_seconds
        };

        (
            task_count,
            total_with_current,
            TaskRecord::format_duration(total_with_current)
        )
    }

    // 取得今日 00:00:00 的時間戳記
    fn get_today_start_timestamp() -> u64 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // 簡單計算：今日 00:00:00 (這裡簡化處理，實際應該考慮時區)
        let seconds_in_day = 24 * 60 * 60;
        let days_since_epoch = now / seconds_in_day;
        days_since_epoch * seconds_in_day
    }

    // 檢查是否有進行中的任務
    pub fn has_active_task(&self) -> bool {
        self.current_task.is_some()
    }

    // 取得目前任務的 ID（如果有的話）
    pub fn get_current_task_id(&self) -> Option<String> {
        self.current_task.as_ref().map(|task| task.id.clone())
    }
}

// Tauri 命令：開始任務
#[tauri::command]
fn start_task(name: String, state: tauri::State<Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.start_task(name)
}

// Tauri 命令：停止目前任務
#[tauri::command]
fn stop_task(state: tauri::State<Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.stop_current_task()
}

// Tauri 命令：取得目前狀態
#[tauri::command]
fn get_current_status(state: tauri::State<Mutex<AppState>>) -> Result<(bool, Option<String>, u64), String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_current_status())
}

// Tauri 命令：取得最近任務名稱
#[tauri::command]
fn get_recent_task_names(state: tauri::State<Mutex<AppState>>) -> Result<Vec<String>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.recent_task_names.clone())
}

// Tauri 命令：取得任務歷史
#[tauri::command]
fn get_task_history(state: tauri::State<Mutex<AppState>>) -> Result<Vec<TaskRecord>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.task_history.clone())
}

// Tauri 命令：取得格式化的目前狀態
#[tauri::command]
fn get_current_status_formatted(state: tauri::State<Mutex<AppState>>) -> Result<(bool, Option<String>, String), String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_current_status_formatted())
}

// Tauri 命令：取得今日統計
#[tauri::command]
fn get_today_stats(state: tauri::State<Mutex<AppState>>) -> Result<(u64, u64, String), String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_today_stats())
}

// Tauri 命令：檢查是否有進行中的任務
#[tauri::command]
fn has_active_task(state: tauri::State<Mutex<AppState>>) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.has_active_task())
}

// Tauri 命令：格式化時間（工具函數）
#[tauri::command]
fn format_duration(seconds: u64) -> String {
    TaskRecord::format_duration(seconds)
}

// Tauri 命令：取得目前時間戳記
#[tauri::command]
fn get_current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// 保留原有的 greet 命令（之後會移除）
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化應用程式狀態
            let app_state = AppState::load_from_file();
            app.manage(Mutex::new(app_state));

            // 創建系統托盤菜單
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&quit]).build()?;

            // 創建系統托盤圖標
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .title("Track All Tasks - Menu Bar Display")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        // 在退出前確保資料已儲存
                        if let Some(state) = app.try_state::<Mutex<AppState>>() {
                            if let Ok(mut app_state) = state.lock() {
                                // 如果有進行中的任務，先結束它
                                if app_state.current_task.is_some() {
                                    let _ = app_state.stop_current_task();
                                }
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: _,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_task,
            stop_task,
            get_current_status,
            get_current_status_formatted,
            get_today_stats,
            has_active_task,
            format_duration,
            get_current_timestamp,
            get_recent_task_names,
            get_task_history,
            greet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}