// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::collections::HashMap;
use chrono::{DateTime, Local, NaiveDateTime, TimeZone, Datelike, Duration as ChronoDuration};

// 查詢參數結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskQueryParams {
    pub task_name: Option<String>,          // 任務名稱過濾器（可選）
    pub start_date: Option<String>,         // 開始日期 (YYYY-MM-DD)
    pub end_date: Option<String>,           // 結束日期 (YYYY-MM-DD)
    pub page: Option<usize>,                // 分頁頁碼（從 1 開始）
    pub page_size: Option<usize>,           // 每頁記錄數量
}

// 查詢結果結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskQueryResult {
    pub records: Vec<TaskRecord>,           // 查詢到的記錄
    pub total_count: usize,                 // 總記錄數
    pub total_pages: usize,                 // 總頁數
    pub current_page: usize,                // 當前頁碼
    pub page_size: usize,                   // 每頁記錄數
    pub total_duration_seconds: u64,        // 總時長（秒）
    pub total_duration_formatted: String,   // 格式化總時長
}

// 日期統計結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateStats {
    pub date: String,                       // 日期 (YYYY-MM-DD)
    pub task_count: usize,                  // 任務數量
    pub total_duration_seconds: u64,        // 總時長（秒）
    pub total_duration_formatted: String,   // 格式化總時長
    pub tasks: Vec<TaskSummary>,            // 該日期的任務統計
}

// 匯出參數結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportParams {
    pub format: String,                     // 匯出格式：csv 或 json
    pub export_type: String,                // 匯出類型：records 或 summaries
    pub task_name: Option<String>,          // 任務名稱過濾器（可選）
    pub start_date: Option<String>,         // 開始日期 (YYYY-MM-DD)
    pub end_date: Option<String>,           // 結束日期 (YYYY-MM-DD)
}

// 匯出結果結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,                      // 匯出是否成功
    pub file_path: Option<String>,          // 匯出檔案路徑
    pub record_count: usize,                // 匯出的記錄數量
    pub message: String,                    // 結果訊息
}

// 任務編輯參數結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEditParams {
    pub task_id: String,                    // 任務 ID
    pub new_name: Option<String>,           // 新任務名稱（可選）
    pub new_start_time: Option<u64>,        // 新開始時間（可選）
    pub new_end_time: Option<u64>,          // 新結束時間（可選）
}

// 任務編輯結果結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEditResult {
    pub success: bool,                      // 編輯是否成功
    pub updated_task: Option<TaskRecord>,   // 更新後的任務記錄
    pub message: String,                    // 結果訊息
}

// 手動補登任務參數結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualTaskParams {
    pub name: String,                       // 任務名稱
    pub start_time: u64,                    // 開始時間（Unix 時間戳）
    pub end_time: u64,                      // 結束時間（Unix 時間戳）
    pub description: Option<String>,        // 任務描述（可選）
}

// 手動補登任務結果結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualTaskResult {
    pub success: bool,                      // 補登是否成功
    pub created_task: Option<TaskRecord>,   // 創建的任務記錄
    pub message: String,                    // 結果訊息
}

// 任務統計資料結構
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSummary {
    pub name: String,                     // 任務名稱
    pub total_duration_seconds: u64,      // 總計時間（秒）
    pub session_count: u32,               // 計時次數
    pub total_duration_formatted: String, // 格式化的總計時間
    pub first_session_time: u64,          // 第一次開始時間
    pub last_session_time: u64,           // 最後一次開始時間
    pub average_duration_seconds: u64,    // 平均計時時間（秒）
}

impl TaskSummary {
    pub fn new(name: String, records: &[&TaskRecord]) -> Self {
        let total_duration: u64 = records.iter().map(|r| r.get_duration()).sum();
        let session_count = records.len() as u32;
        let average_duration = if session_count > 0 { total_duration / session_count as u64 } else { 0 };
        
        let first_session_time = records.iter().map(|r| r.start_time).min().unwrap_or(0);
        let last_session_time = records.iter().map(|r| r.start_time).max().unwrap_or(0);

        Self {
            name: name.clone(),
            total_duration_seconds: total_duration,
            session_count,
            total_duration_formatted: TaskRecord::format_duration(total_duration),
            first_session_time,
            last_session_time,
            average_duration_seconds: average_duration,
        }
    }

    // 取得第一次開始時間的格式化字串
    pub fn get_first_session_formatted(&self) -> String {
        TaskRecord::format_timestamp(self.first_session_time)
    }

    // 取得最後一次開始時間的格式化字串
    pub fn get_last_session_formatted(&self) -> String {
        TaskRecord::format_timestamp(self.last_session_time)
    }

    // 取得平均時間的格式化字串
    pub fn get_average_duration_formatted(&self) -> String {
        TaskRecord::format_duration(self.average_duration_seconds)
    }
}

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

    // 建立手動補登的任務記錄
    pub fn new_manual(name: String, start_time: u64, end_time: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let duration_seconds = if end_time > start_time {
            Some(end_time - start_time)
        } else {
            None
        };
        
        Self {
            id: format!("manual-{}-{}", now, uuid::Uuid::new_v4().to_string()[..8].to_string()),
            name,
            start_time,
            end_time: Some(end_time),
            duration_seconds,
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

    // 按任務名稱分組統計所有歷史記錄
    pub fn get_task_summaries(&self) -> Vec<TaskSummary> {
        let mut task_groups: HashMap<String, Vec<&TaskRecord>> = HashMap::new();
        
        // 將所有完成的任務按名稱分組
        for task in &self.task_history {
            task_groups.entry(task.name.clone())
                .or_insert_with(Vec::new)
                .push(task);
        }

        // 生成統計摘要並按總時間排序
        let mut summaries: Vec<TaskSummary> = task_groups
            .into_iter()
            .map(|(name, records)| TaskSummary::new(name, &records))
            .collect();

        // 按總計時間降序排列
        summaries.sort_by(|a, b| b.total_duration_seconds.cmp(&a.total_duration_seconds));
        
        summaries
    }

    // 按任務名稱分組統計今日記錄
    pub fn get_today_task_summaries(&self) -> Vec<TaskSummary> {
        let today_start = Self::get_today_start_timestamp();
        let mut task_groups: HashMap<String, Vec<&TaskRecord>> = HashMap::new();
        
        // 篩選今日的任務並按名稱分組
        for task in &self.task_history {
            if task.start_time >= today_start {
                task_groups.entry(task.name.clone())
                    .or_insert_with(Vec::new)
                    .push(task);
            }
        }

        // 檢查是否有進行中的今日任務
        if let Some(current) = &self.current_task {
            if current.start_time >= today_start {
                task_groups.entry(current.name.clone())
                    .or_insert_with(Vec::new)
                    .push(current);
            }
        }

        // 生成統計摘要並按總時間排序
        let mut summaries: Vec<TaskSummary> = task_groups
            .into_iter()
            .map(|(name, records)| TaskSummary::new(name, &records))
            .collect();

        // 按總計時間降序排列
        summaries.sort_by(|a, b| b.total_duration_seconds.cmp(&a.total_duration_seconds));
        
        summaries
    }

    // 取得指定任務名稱的詳細記錄
    pub fn get_task_records_by_name(&self, task_name: &str) -> Vec<TaskRecord> {
        let mut records: Vec<TaskRecord> = self.task_history
            .iter()
            .filter(|task| task.name == task_name)
            .cloned()
            .collect();

        // 如果目前任務名稱匹配，也加入
        if let Some(current) = &self.current_task {
            if current.name == task_name {
                records.push(current.clone());
            }
        }

        // 按開始時間排序（最新的在前）
        records.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        
        records
    }

    // 生成托盤標題
    pub fn get_tray_title(&self) -> String {
        match &self.current_task {
            Some(task) => {
                let duration = task.get_duration_formatted();
                let task_name = if task.name.len() > 20 {
                    format!("{}...", &task.name[..17])
                } else {
                    task.name.clone()
                };
                format!("⏰ {} - {}", task_name, duration)
            }
            None => "Track All Tasks - 待機中".to_string(),
        }
    }

    // 查詢任務記錄
    pub fn query_task_records(&self, params: &TaskQueryParams) -> TaskQueryResult {
        let mut filtered_records = Vec::new();
        
        // 收集所有已完成的任務記錄
        for record in &self.task_history {
            let mut include_record = true;
            
            // 任務名稱過濾
            if let Some(ref filter_name) = params.task_name {
                if !record.name.to_lowercase().contains(&filter_name.to_lowercase()) {
                    include_record = false;
                }
            }
            
            // 日期範圍過濾
            if include_record {
                let record_timestamp = record.start_time;
                let record_datetime = match UNIX_EPOCH.checked_add(Duration::from_secs(record_timestamp)) {
                    Some(time) => match SystemTime::try_from(time) {
                        Ok(system_time) => {
                            let datetime: DateTime<Local> = system_time.into();
                            Some(datetime)
                        }
                        Err(_) => None,
                    },
                    None => None,
                };
                
                if let Some(datetime) = record_datetime {
                    let record_date = datetime.format("%Y-%m-%d").to_string();
                    
                    // 檢查開始日期
                    if let Some(ref start_date) = params.start_date {
                        if record_date < *start_date {
                            include_record = false;
                        }
                    }
                    
                    // 檢查結束日期
                    if let Some(ref end_date) = params.end_date {
                        if record_date > *end_date {
                            include_record = false;
                        }
                    }
                }
            }
            
            if include_record {
                filtered_records.push(record.clone());
            }
        }
        
        // 按開始時間排序（最新的在前）
        filtered_records.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        
        // 計算總時長
        let total_duration_seconds: u64 = filtered_records
            .iter()
            .map(|r| r.duration_seconds.unwrap_or(0))
            .sum();
        
        // 分頁處理
        let page = params.page.unwrap_or(1).max(1);
        let page_size = params.page_size.unwrap_or(20).max(1).min(100);
        let total_count = filtered_records.len();
        let total_pages = (total_count + page_size - 1) / page_size;
        
        let start_index = (page - 1) * page_size;
        let end_index = (start_index + page_size).min(total_count);
        
        let paginated_records = if start_index < total_count {
            filtered_records[start_index..end_index].to_vec()
        } else {
            Vec::new()
        };
        
        TaskQueryResult {
            records: paginated_records,
            total_count,
            total_pages,
            current_page: page,
            page_size,
            total_duration_seconds,
            total_duration_formatted: TaskRecord::format_duration(total_duration_seconds),
        }
    }
    
    // 獲取日期統計列表
    pub fn get_date_stats(&self, start_date: Option<String>, end_date: Option<String>) -> Vec<DateStats> {
        let mut date_map: HashMap<String, Vec<&TaskRecord>> = HashMap::new();
        
        // 按日期分組任務記錄
        for record in &self.task_history {
            let record_timestamp = record.start_time;
            if let Some(time) = UNIX_EPOCH.checked_add(Duration::from_secs(record_timestamp)) {
                if let Ok(system_time) = SystemTime::try_from(time) {
                    let datetime: DateTime<Local> = system_time.into();
                    let date_str = datetime.format("%Y-%m-%d").to_string();
                    
                    // 檢查日期範圍
                    let mut include_date = true;
                    if let Some(ref start) = start_date {
                        if date_str < *start {
                            include_date = false;
                        }
                    }
                    if let Some(ref end) = end_date {
                        if date_str > *end {
                            include_date = false;
                        }
                    }
                    
                    if include_date {
                        date_map.entry(date_str).or_insert_with(Vec::new).push(record);
                    }
                }
            }
        }
        
        // 轉換為 DateStats
        let mut date_stats: Vec<DateStats> = date_map
            .into_iter()
            .map(|(date, records)| {
                // 按任務名稱分組
                let mut task_groups: HashMap<String, Vec<&TaskRecord>> = HashMap::new();
                for record in &records {
                    task_groups.entry(record.name.clone()).or_insert_with(Vec::new).push(record);
                }
                
                // 生成任務統計
                let tasks: Vec<TaskSummary> = task_groups
                    .into_iter()
                    .map(|(name, task_records)| {
                        let total_duration_seconds: u64 = task_records
                            .iter()
                            .map(|r| r.duration_seconds.unwrap_or(0))
                            .sum();
                        
                        let session_count = task_records.len() as u32;
                        let average_duration_seconds = if session_count > 0 {
                            total_duration_seconds / session_count as u64
                        } else {
                            0
                        };
                        
                        let first_session_time = task_records
                            .iter()
                            .map(|r| r.start_time)
                            .min()
                            .unwrap_or(0);
                        
                        let last_session_time = task_records
                            .iter()
                            .map(|r| r.start_time)
                            .max()
                            .unwrap_or(0);
                        
                        TaskSummary {
                            name,
                            total_duration_seconds,
                            session_count,
                            total_duration_formatted: TaskRecord::format_duration(total_duration_seconds),
                            first_session_time,
                            last_session_time,
                            average_duration_seconds,
                        }
                    })
                    .collect();
                
                let total_duration_seconds: u64 = records
                    .iter()
                    .map(|r| r.duration_seconds.unwrap_or(0))
                    .sum();
                
                DateStats {
                    date,
                    task_count: records.len(),
                    total_duration_seconds,
                    total_duration_formatted: TaskRecord::format_duration(total_duration_seconds),
                    tasks,
                }
            })
            .collect();
        
        // 按日期排序（最新的在前）
        date_stats.sort_by(|a, b| b.date.cmp(&a.date));
        
        date_stats
    }

    // 匯出資料
    pub fn export_data(&self, params: &ExportParams) -> Result<ExportResult, String> {
        // 產生檔案名稱
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        let datetime = match UNIX_EPOCH.checked_add(Duration::from_secs(timestamp)) {
            Some(time) => match SystemTime::try_from(time) {
                Ok(system_time) => {
                    let datetime: DateTime<Local> = system_time.into();
                    datetime.format("%Y%m%d_%H%M%S").to_string()
                }
                Err(_) => timestamp.to_string(),
            },
            None => timestamp.to_string(),
        };

        let file_extension = match params.format.as_str() {
            "csv" => "csv",
            "json" => "json",
            _ => return Err("不支援的匯出格式".to_string()),
        };

        let export_type_name = match params.export_type.as_str() {
            "records" => "records",
            "summaries" => "summaries",
            _ => return Err("不支援的匯出類型".to_string()),
        };

        let base_filename = format!("track-all-tasks-{}-{}.{}", export_type_name, datetime, file_extension);
        
        // 獲取桌面路徑
        let desktop_path = dirs::desktop_dir()
            .ok_or_else(|| "無法取得桌面路徑".to_string())?;
        
        let file_path = desktop_path.join(&base_filename);

        match params.export_type.as_str() {
            "records" => {
                // 匯出任務記錄
                let query_params = TaskQueryParams {
                    task_name: params.task_name.clone(),
                    start_date: params.start_date.clone(),
                    end_date: params.end_date.clone(),
                    page: None,
                    page_size: None,
                };
                
                let query_result = self.query_task_records(&query_params);
                
                match params.format.as_str() {
                    "csv" => {
                        self.export_records_to_csv(&query_result.records, &file_path)?;
                    }
                    "json" => {
                        self.export_records_to_json(&query_result.records, &file_path)?;
                    }
                    _ => return Err("不支援的匯出格式".to_string()),
                }

                Ok(ExportResult {
                    success: true,
                    file_path: Some(file_path.to_string_lossy().to_string()),
                    record_count: query_result.records.len(),
                    message: format!("成功匯出 {} 筆記錄到 {}", query_result.records.len(), base_filename),
                })
            }
            "summaries" => {
                // 匯出任務統計
                let summaries = if params.start_date.is_some() || params.end_date.is_some() || params.task_name.is_some() {
                    // 如果有篩選條件，使用查詢結果來生成統計
                    let query_params = TaskQueryParams {
                        task_name: params.task_name.clone(),
                        start_date: params.start_date.clone(),
                        end_date: params.end_date.clone(),
                        page: None,
                        page_size: None,
                    };
                    
                    let query_result = self.query_task_records(&query_params);
                    self.records_to_summaries(&query_result.records)
                } else {
                    // 否則使用全部統計
                    self.get_task_summaries()
                };

                match params.format.as_str() {
                    "csv" => {
                        self.export_summaries_to_csv(&summaries, &file_path)?;
                    }
                    "json" => {
                        self.export_summaries_to_json(&summaries, &file_path)?;
                    }
                    _ => return Err("不支援的匯出格式".to_string()),
                }

                Ok(ExportResult {
                    success: true,
                    file_path: Some(file_path.to_string_lossy().to_string()),
                    record_count: summaries.len(),
                    message: format!("成功匯出 {} 項統計到 {}", summaries.len(), base_filename),
                })
            }
            _ => Err("不支援的匯出類型".to_string()),
        }
    }

    // 將記錄列表轉換為統計
    fn records_to_summaries(&self, records: &[TaskRecord]) -> Vec<TaskSummary> {
        let mut task_groups: HashMap<String, Vec<&TaskRecord>> = HashMap::new();
        
        for record in records {
            task_groups.entry(record.name.clone())
                .or_insert_with(Vec::new)
                .push(record);
        }

        let mut summaries: Vec<TaskSummary> = task_groups
            .into_iter()
            .map(|(name, task_records)| {
                let total_duration_seconds: u64 = task_records
                    .iter()
                    .map(|r| r.duration_seconds.unwrap_or(0))
                    .sum();
                
                let session_count = task_records.len() as u32;
                let average_duration_seconds = if session_count > 0 {
                    total_duration_seconds / session_count as u64
                } else {
                    0
                };
                
                let first_session_time = task_records
                    .iter()
                    .map(|r| r.start_time)
                    .min()
                    .unwrap_or(0);
                
                let last_session_time = task_records
                    .iter()
                    .map(|r| r.start_time)
                    .max()
                    .unwrap_or(0);
                
                TaskSummary {
                    name,
                    total_duration_seconds,
                    session_count,
                    total_duration_formatted: TaskRecord::format_duration(total_duration_seconds),
                    first_session_time,
                    last_session_time,
                    average_duration_seconds,
                }
            })
            .collect();

        // 按總時長排序（降冪）
        summaries.sort_by(|a, b| b.total_duration_seconds.cmp(&a.total_duration_seconds));
        
        summaries
    }

    // 匯出記錄到 CSV
    fn export_records_to_csv(&self, records: &[TaskRecord], file_path: &PathBuf) -> Result<(), String> {
        let mut csv_content = String::new();
        
        // CSV 標題行
        csv_content.push_str("任務名稱,開始時間,結束時間,持續時間(秒),格式化時間,任務ID\n");
        
        for record in records {
            let start_time_str = self.timestamp_to_string(record.start_time);
            let end_time_str = record.end_time
                .map(|t| self.timestamp_to_string(t))
                .unwrap_or_else(|| "進行中".to_string());
            let duration = record.duration_seconds.unwrap_or(0);
            let formatted_duration = TaskRecord::format_duration(duration);
            
            // 轉義 CSV 欄位中的引號和逗號
            let escaped_name = self.escape_csv_field(&record.name);
            
            csv_content.push_str(&format!(
                "{},{},{},{},{},{}\n",
                escaped_name,
                start_time_str,
                end_time_str,
                duration,
                formatted_duration,
                record.id
            ));
        }
        
        fs::write(file_path, csv_content)
            .map_err(|e| format!("寫入 CSV 檔案失敗: {}", e))?;
        
        Ok(())
    }

    // 匯出記錄到 JSON
    fn export_records_to_json(&self, records: &[TaskRecord], file_path: &PathBuf) -> Result<(), String> {
        let json_content = serde_json::to_string_pretty(records)
            .map_err(|e| format!("序列化 JSON 失敗: {}", e))?;
        
        fs::write(file_path, json_content)
            .map_err(|e| format!("寫入 JSON 檔案失敗: {}", e))?;
        
        Ok(())
    }

    // 匯出統計到 CSV
    fn export_summaries_to_csv(&self, summaries: &[TaskSummary], file_path: &PathBuf) -> Result<(), String> {
        let mut csv_content = String::new();
        
        // CSV 標題行
        csv_content.push_str("任務名稱,總時長(秒),格式化總時長,工作階段數,平均時長(秒),首次記錄時間,最後記錄時間\n");
        
        for summary in summaries {
            let first_time_str = self.timestamp_to_string(summary.first_session_time);
            let last_time_str = self.timestamp_to_string(summary.last_session_time);
            let escaped_name = self.escape_csv_field(&summary.name);
            
            csv_content.push_str(&format!(
                "{},{},{},{},{},{},{}\n",
                escaped_name,
                summary.total_duration_seconds,
                summary.total_duration_formatted,
                summary.session_count,
                summary.average_duration_seconds,
                first_time_str,
                last_time_str
            ));
        }
        
        fs::write(file_path, csv_content)
            .map_err(|e| format!("寫入 CSV 檔案失敗: {}", e))?;
        
        Ok(())
    }

    // 匯出統計到 JSON
    fn export_summaries_to_json(&self, summaries: &[TaskSummary], file_path: &PathBuf) -> Result<(), String> {
        let json_content = serde_json::to_string_pretty(summaries)
            .map_err(|e| format!("序列化 JSON 失敗: {}", e))?;
        
        fs::write(file_path, json_content)
            .map_err(|e| format!("寫入 JSON 檔案失敗: {}", e))?;
        
        Ok(())
    }

    // 時間戳轉換為字串
    fn timestamp_to_string(&self, timestamp: u64) -> String {
        match UNIX_EPOCH.checked_add(Duration::from_secs(timestamp)) {
            Some(time) => match SystemTime::try_from(time) {
                Ok(system_time) => {
                    let datetime: DateTime<Local> = system_time.into();
                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                }
                Err(_) => timestamp.to_string(),
            },
            None => timestamp.to_string(),
        }
    }

    // 轉義 CSV 欄位
    fn escape_csv_field(&self, field: &str) -> String {
        if field.contains(',') || field.contains('"') || field.contains('\n') {
            format!("\"{}\"", field.replace('"', "\"\""))
        } else {
            field.to_string()
        }
    }

    // 編輯任務記錄
    pub fn edit_task(&mut self, params: &TaskEditParams) -> Result<TaskEditResult, String> {
        // 尋找要編輯的任務
        let task_index = self.task_history
            .iter()
            .position(|task| task.id == params.task_id);

        if let Some(index) = task_index {
            let mut task = self.task_history[index].clone();
            let mut changes_made = false;
            let mut change_summary = Vec::new();

            // 更新任務名稱
            if let Some(ref new_name) = params.new_name {
                if new_name.trim().is_empty() {
                    return Err("任務名稱不能為空".to_string());
                }
                if new_name.len() > 100 {
                    return Err("任務名稱不能超過 100 個字元".to_string());
                }
                let old_name = task.name.clone();
                task.name = new_name.trim().to_string();
                change_summary.push(format!("名稱: {} → {}", old_name, task.name));
                changes_made = true;
            }

            // 更新開始時間
            if let Some(new_start_time) = params.new_start_time {
                let old_start_time = task.start_time;
                task.start_time = new_start_time;
                change_summary.push(format!(
                    "開始時間: {} → {}", 
                    self.timestamp_to_string(old_start_time),
                    self.timestamp_to_string(new_start_time)
                ));
                changes_made = true;

                // 如果有結束時間，重新計算持續時間
                if let Some(end_time) = task.end_time {
                    if new_start_time >= end_time {
                        return Err("開始時間不能晚於或等於結束時間".to_string());
                    }
                    task.duration_seconds = Some(end_time - new_start_time);
                } else if task.duration_seconds.is_some() {
                    // 如果任務有持續時間但沒有結束時間，這是個異常情況，修正它
                    task.end_time = Some(new_start_time + task.duration_seconds.unwrap_or(0));
                    task.duration_seconds = Some(task.end_time.unwrap() - new_start_time);
                }
            }

            // 更新結束時間
            if let Some(new_end_time) = params.new_end_time {
                if new_end_time <= task.start_time {
                    return Err("結束時間必須晚於開始時間".to_string());
                }
                
                let old_end_time = task.end_time;
                task.end_time = Some(new_end_time);
                task.duration_seconds = Some(new_end_time - task.start_time);
                
                let old_time_str = old_end_time
                    .map(|t| self.timestamp_to_string(t))
                    .unwrap_or_else(|| "無".to_string());
                change_summary.push(format!(
                    "結束時間: {} → {}", 
                    old_time_str,
                    self.timestamp_to_string(new_end_time)
                ));
                changes_made = true;
            }

            if !changes_made {
                return Err("沒有提供任何要更新的欄位".to_string());
            }

            // 驗證最終的任務記錄
            if let Some(end_time) = task.end_time {
                if task.start_time >= end_time {
                    return Err("任務的開始時間不能晚於或等於結束時間".to_string());
                }
            }

            // 更新任務記錄
            self.task_history[index] = task.clone();

            // 儲存更改
            if let Err(e) = self.save_to_file() {
                return Err(format!("儲存變更失敗: {}", e));
            }

            let message = format!("成功更新任務 - {}", change_summary.join(", "));

            Ok(TaskEditResult {
                success: true,
                updated_task: Some(task),
                message,
            })
        } else {
            Err("找不到指定的任務記錄".to_string())
        }
    }

    // 刪除任務記錄
    pub fn delete_task(&mut self, task_id: &str) -> Result<String, String> {
        let task_index = self.task_history
            .iter()
            .position(|task| task.id == task_id);

        if let Some(index) = task_index {
            let removed_task = self.task_history.remove(index);
            
            // 儲存更改
            if let Err(e) = self.save_to_file() {
                // 如果儲存失敗，還原刪除操作
                self.task_history.insert(index, removed_task);
                return Err(format!("儲存變更失敗: {}", e));
            }

            Ok(format!("成功刪除任務「{}」", removed_task.name))
        } else {
            Err("找不到指定的任務記錄".to_string())
        }
    }

    // 手動補登任務記錄
    pub fn add_manual_task(&mut self, params: &ManualTaskParams) -> Result<ManualTaskResult, String> {
        // 驗證任務名稱
        if params.name.trim().is_empty() {
            return Err("任務名稱不能為空".to_string());
        }
        if params.name.len() > 100 {
            return Err("任務名稱不能超過 100 個字元".to_string());
        }

        // 驗證時間戳
        self.validate_timestamp(params.start_time)?;
        self.validate_timestamp(params.end_time)?;

        // 驗證時間邏輯
        if params.end_time <= params.start_time {
            return Err("結束時間必須晚於開始時間".to_string());
        }

        // 檢查持續時間是否合理（不超過24小時）
        let duration_seconds = params.end_time - params.start_time;
        if duration_seconds > 86400 {
            return Err("單次任務持續時間不能超過24小時".to_string());
        }

        // 檢查是否與現有任務時間重疊
        for existing_task in &self.task_history {
            if let Some(existing_end) = existing_task.end_time {
                // 檢查時間重疊
                let overlap = !(params.end_time <= existing_task.start_time || 
                               params.start_time >= existing_end);
                if overlap {
                    return Err(format!(
                        "時間與現有任務「{}」重疊（{} ~ {}）", 
                        existing_task.name,
                        self.timestamp_to_string(existing_task.start_time),
                        self.timestamp_to_string(existing_end)
                    ));
                }
            }
        }

        // 創建手動任務記錄
        let manual_task = TaskRecord::new_manual(
            params.name.trim().to_string(),
            params.start_time,
            params.end_time
        );

        // 添加到任務歷史並按時間排序
        self.task_history.push(manual_task.clone());
        self.task_history.sort_by(|a, b| b.start_time.cmp(&a.start_time));

        // 儲存到檔案
        if let Err(e) = self.save_to_file() {
            // 如果儲存失敗，移除剛新增的任務
            self.task_history.retain(|t| t.id != manual_task.id);
            return Err(format!("儲存任務失敗: {}", e));
        }

        let message = format!(
            "成功補登任務「{}」，時間：{} ~ {}，持續時間：{}",
            manual_task.name,
            self.timestamp_to_string(manual_task.start_time),
            self.timestamp_to_string(manual_task.end_time.unwrap()),
            TaskRecord::format_duration(duration_seconds)
        );

        Ok(ManualTaskResult {
            success: true,
            created_task: Some(manual_task),
            message,
        })
    }

    // 驗證時間戳是否合理
    fn validate_timestamp(&self, timestamp: u64) -> Result<(), String> {
        // 檢查時間戳是否在合理範圍內（2020年到2050年）
        let min_timestamp = 1577836800; // 2020-01-01 00:00:00 UTC
        let max_timestamp = 2524608000; // 2050-01-01 00:00:00 UTC
        
        if timestamp < min_timestamp || timestamp > max_timestamp {
            return Err("時間戳超出合理範圍（2020-2050年）".to_string());
        }
        
        Ok(())
    }
}

// Tauri 命令：開始任務
#[tauri::command]
fn start_task(name: String, state: tauri::State<Mutex<AppState>>, app_handle: AppHandle) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    let result = app_state.start_task(name);
    
    // 狀態改變後更新托盤選單
    if result.is_ok() {
        drop(app_state); // 釋放鎖定
        update_tray_menu(&app_handle);
    }
    
    result
}

// Tauri 命令：停止目前任務
#[tauri::command]
fn stop_task(state: tauri::State<Mutex<AppState>>, app_handle: AppHandle) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    let result = app_state.stop_current_task();
    
    // 狀態改變後更新托盤選單
    if result.is_ok() {
        drop(app_state); // 釋放鎖定
        update_tray_menu(&app_handle);
    }
    
    result
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

// Tauri 命令：取得所有任務統計摘要
#[tauri::command]
fn get_task_summaries(state: tauri::State<Mutex<AppState>>) -> Result<Vec<TaskSummary>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_task_summaries())
}

// Tauri 命令：取得今日任務統計摘要
#[tauri::command]
fn get_today_task_summaries(state: tauri::State<Mutex<AppState>>) -> Result<Vec<TaskSummary>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_today_task_summaries())
}

// Tauri 命令：取得指定任務名稱的詳細記錄
#[tauri::command]
fn get_task_records_by_name(task_name: String, state: tauri::State<Mutex<AppState>>) -> Result<Vec<TaskRecord>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_task_records_by_name(&task_name))
}

// Tauri 命令：查詢任務記錄
#[tauri::command]
fn query_task_records(params: TaskQueryParams, state: tauri::State<Mutex<AppState>>) -> Result<TaskQueryResult, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.query_task_records(&params))
}

// Tauri 命令：獲取日期統計
#[tauri::command]
fn get_date_stats(start_date: Option<String>, end_date: Option<String>, state: tauri::State<Mutex<AppState>>) -> Result<Vec<DateStats>, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    Ok(app_state.get_date_stats(start_date, end_date))
}

// Tauri 命令：匯出資料
#[tauri::command]
fn export_data(params: ExportParams, state: tauri::State<Mutex<AppState>>) -> Result<ExportResult, String> {
    let app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.export_data(&params)
}

// Tauri 命令：編輯任務
#[tauri::command]
fn edit_task(params: TaskEditParams, state: tauri::State<Mutex<AppState>>) -> Result<TaskEditResult, String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.edit_task(&params)
}

// Tauri 命令：刪除任務
#[tauri::command]
fn delete_task(task_id: String, state: tauri::State<Mutex<AppState>>) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.delete_task(&task_id)
}

// Tauri 命令：手動補登任務
#[tauri::command]
fn add_manual_task(params: ManualTaskParams, state: tauri::State<Mutex<AppState>>) -> Result<ManualTaskResult, String> {
    let mut app_state = state.lock().map_err(|_| "無法取得應用程式狀態")?;
    app_state.add_manual_task(&params)
}

// 更新托盤標題（不更新選單以避免選單消失）
fn update_tray_title(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<Mutex<AppState>>() {
        if let Ok(app_state) = state.lock() {
            let title = app_state.get_tray_title();
            
            // 只更新標題，不重建選單
            if let Some(tray) = app_handle.tray_by_id("main") {
                let _ = tray.set_title(Some(&title));
            }
        }
    }
}

// 更新托盤選單（僅在狀態改變時調用）
fn update_tray_menu(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<Mutex<AppState>>() {
        if let Ok(app_state) = state.lock() {
            let has_active = app_state.has_active_task();
            
            // 重建選單
            if let Some(tray) = app_handle.tray_by_id("main") {
                if let Ok(new_menu) = build_tray_menu(app_handle, has_active) {
                    let _ = tray.set_menu(Some(new_menu));
                }
            }
        }
    }
}

// 建立托盤選單
fn build_tray_menu(app_handle: &AppHandle, has_active_task: bool) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    if has_active_task {
        // 有進行中的任務時顯示「停止計時」
        let stop_task = MenuItemBuilder::with_id("stop_task", "⏹️ 停止計時").build(app_handle)?;
        let separator = tauri::menu::PredefinedMenuItem::separator(app_handle)?;
        let show_window = MenuItemBuilder::with_id("show_window", "📱 顯示主視窗").build(app_handle)?;
        let quit = MenuItemBuilder::with_id("quit", "❌ 結束應用程式").build(app_handle)?;
        
        MenuBuilder::new(app_handle)
            .items(&[&stop_task, &separator, &show_window, &quit])
            .build()
    } else {
        // 無進行中任務時顯示「快速開始」
        let quick_start = MenuItemBuilder::with_id("quick_start", "▶️ 快速開始計時").build(app_handle)?;
        let separator = tauri::menu::PredefinedMenuItem::separator(app_handle)?;
        let show_window = MenuItemBuilder::with_id("show_window", "📱 顯示主視窗").build(app_handle)?;
        let quit = MenuItemBuilder::with_id("quit", "❌ 結束應用程式").build(app_handle)?;
        
        MenuBuilder::new(app_handle)
            .items(&[&quick_start, &separator, &show_window, &quit])
            .build()
    }
}

// 啟動托盤更新定時器
fn start_tray_updater(app_handle: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(1));
            // 只更新標題，不更新選單（避免選單消失）
            update_tray_title(&app_handle);
        }
    });
}

// 設定全域快捷鍵（簡化版本）
fn setup_global_shortcuts(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 先註冊插件
    app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
    
    println!("✅ 全域快捷鍵插件已初始化");
    println!("   快捷鍵將在 JavaScript 端註冊:");
    println!("   Ctrl+Shift+T - 切換計時狀態（開始/停止）");
    println!("   Ctrl+Shift+S - 顯示主視窗");
    println!("   Ctrl+Shift+Q - 快速開始新任務");

    Ok(())
}

// 處理切換計時狀態快捷鍵
async fn handle_toggle_shortcut(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<Mutex<AppState>>() {
        if let Ok(mut app_state) = state.lock() {
            let has_active = app_state.has_active_task();
            
            if has_active {
                // 有進行中任務，停止它
                if let Err(e) = app_state.stop_current_task() {
                    eprintln!("快捷鍵停止任務失敗: {}", e);
                } else {
                    println!("✅ 透過快捷鍵停止任務");
                    drop(app_state);
                    update_tray_menu(app_handle);
                }
            } else {
                // 沒有進行中任務，開始快速任務
                let task_name = "快捷鍵任務".to_string();
                if let Err(e) = app_state.start_task(task_name.clone()) {
                    eprintln!("快捷鍵開始任務失敗: {}", e);
                } else {
                    println!("✅ 透過快捷鍵開始任務: {}", task_name);
                    drop(app_state);
                    update_tray_menu(app_handle);
                }
            }
        }
    }
}

// 處理快速開始任務快捷鍵
async fn handle_quick_start_shortcut(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<Mutex<AppState>>() {
        if let Ok(mut app_state) = state.lock() {
            // 總是開始新的快速任務（如果有進行中的會自動結束）
            let task_name = "快速任務".to_string();
            if let Err(e) = app_state.start_task(task_name.clone()) {
                eprintln!("快速開始快捷鍵失敗: {}", e);
            } else {
                println!("✅ 透過快捷鍵快速開始任務: {}", task_name);
                drop(app_state);
                update_tray_menu(app_handle);
            }
        }
    }
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
            let initial_title = app_state.get_tray_title();
            let has_initial_active = app_state.has_active_task();
            app.manage(Mutex::new(app_state));

            // 創建初始系統托盤菜單
            let menu = build_tray_menu(&app.handle(), has_initial_active)?;

            // 創建系統托盤圖標
            let _tray = TrayIconBuilder::with_id("main")  // 設置托盤 ID
                .menu(&menu)
                .title(&initial_title)  // 使用動態標題
                .on_menu_event(move |app, event| {
                    let event_id = event.id.as_ref();
                    match event_id {
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
                        "show_window" => {
                            // 顯示主視窗
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "stop_task" => {
                            // 停止目前任務
                            if let Some(state) = app.try_state::<Mutex<AppState>>() {
                                if let Ok(mut app_state) = state.lock() {
                                    if let Err(e) = app_state.stop_current_task() {
                                        eprintln!("托盤停止任務失敗: {}", e);
                                    } else {
                                        println!("✅ 透過托盤停止任務");
                                        // 狀態改變後更新選單
                                        drop(app_state); // 釋放鎖定
                                        update_tray_menu(app);
                                    }
                                } else {
                                    eprintln!("❌ 無法取得應用程式狀態鎖定");
                                }
                            }
                        }
                        "quick_start" => {
                            // 快速開始計時（預設任務名稱）
                            if let Some(state) = app.try_state::<Mutex<AppState>>() {
                                if let Ok(mut app_state) = state.lock() {
                                    let task_name = "快速任務".to_string();
                                    if let Err(e) = app_state.start_task(task_name.clone()) {
                                        eprintln!("托盤開始任務失敗: {}", e);
                                    } else {
                                        println!("✅ 透過托盤開始任務: {}", task_name);
                                        // 狀態改變後更新選單
                                        drop(app_state); // 釋放鎖定
                                        update_tray_menu(app);
                                    }
                                } else {
                                    eprintln!("❌ 無法取得應用程式狀態鎖定");
                                }
                            }
                        }
                        _ => {}
                    }
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

            // 啟動托盤更新定時器
            let app_handle = app.handle().clone();
            start_tray_updater(app_handle);

            // 註冊全域快捷鍵
            if let Err(e) = setup_global_shortcuts(app) {
                eprintln!("❌ 設定全域快捷鍵失敗: {}", e);
            }

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
            get_task_summaries,
            get_today_task_summaries,
            get_task_records_by_name,
            query_task_records,
            get_date_stats,
            export_data,
            edit_task,
            delete_task,
            add_manual_task,
            greet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}