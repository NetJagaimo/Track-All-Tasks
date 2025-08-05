import { invoke } from "@tauri-apps/api/core";
import taskStatistics from './task-statistics.js';
import taskQuery from './task-query.js';

// 應用程式主類
class TaskTrackerApp {
    constructor() {
        this.currentTask = null;
        this.updateInterval = null;
        this.isInitialized = false;
        
        // DOM 元素引用
        this.elements = {};
        
        // 最近任務相關狀態
        this.allRecentTasks = [];
        this.filteredRecentTasks = [];
        this.selectedTaskIndex = -1;
        
        // 綁定方法的 this 上下文
        this.updateDisplay = this.updateDisplay.bind(this);
        this.handleStartTask = this.handleStartTask.bind(this);
        this.handleStopTask = this.handleStopTask.bind(this);
        this.handleTaskInputFocus = this.handleTaskInputFocus.bind(this);
        this.handleTaskInputBlur = this.handleTaskInputBlur.bind(this);
        this.handleTaskInputKeydown = this.handleTaskInputKeydown.bind(this);
        this.handleTaskInputInput = this.handleTaskInputInput.bind(this);
    }

    // 初始化應用程式
    async init() {
        if (this.isInitialized) return;
        
        try {
            // 獲取 DOM 元素引用
            this.initDOMElements();
            
            // 綁定事件監聽器
            this.bindEventListeners();
            
            // 載入初始資料
            await this.loadInitialData();
            
            // 初始化統計功能
            await this.initStatistics();
            
            // 開始定期更新
            this.startPeriodicUpdate();
            
            this.isInitialized = true;
            console.log("✅ TaskTrackerApp 初始化完成");
            
        } catch (error) {
            console.error("❌ 應用程式初始化失敗：", error);
        }
    }

    // 獲取 DOM 元素引用
    initDOMElements() {
        const elements = [
            'timer-display', 'current-task-name', 'status-indicator', 'status-text',
            'task-input', 'recent-tasks-dropdown', 'recent-tasks-list',
            'start-btn', 'stop-btn',
            'today-tasks-count', 'today-total-time',
            'today-stats-tab', 'all-stats-tab', 'history-tab', 'search-tab',
            'today-statistics', 'all-statistics', 'history-statistics', 'search-statistics',
            'date-stats-container', 'search-results-container',
            'search-task-name', 'search-start-date', 'search-end-date', 'search-btn', 'clear-search-btn',
            'export-btn', 'settings-btn'
        ];

        elements.forEach(id => {
            this.elements[id] = document.getElementById(id);
            if (!this.elements[id]) {
                console.warn(`⚠️ 找不到元素：${id}`);
            }
        });
    }

    // 綁定事件監聽器
    bindEventListeners() {
        // 任務控制按鈕
        this.elements['start-btn']?.addEventListener('click', this.handleStartTask);
        this.elements['stop-btn']?.addEventListener('click', this.handleStopTask);
        
        // 任務輸入框
        this.elements['task-input']?.addEventListener('focus', this.handleTaskInputFocus);
        this.elements['task-input']?.addEventListener('blur', this.handleTaskInputBlur);
        this.elements['task-input']?.addEventListener('keydown', this.handleTaskInputKeydown);
        this.elements['task-input']?.addEventListener('input', this.handleTaskInputInput);
        
        // 統計標籤頁切換
        this.elements['today-stats-tab']?.addEventListener('click', () => {
            this.switchStatisticsTab('today');
        });
        
        this.elements['all-stats-tab']?.addEventListener('click', () => {
            this.switchStatisticsTab('all');
        });

        this.elements['history-tab']?.addEventListener('click', () => {
            this.switchStatisticsTab('history');
        });

        this.elements['search-tab']?.addEventListener('click', () => {
            this.switchStatisticsTab('search');
        });

        // 搜尋功能
        this.elements['search-btn']?.addEventListener('click', () => {
            this.performSearch();
        });

        this.elements['clear-search-btn']?.addEventListener('click', () => {
            this.clearSearch();
        });

        // 歷史統計快速篩選
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleHistoryFilter(e.target.dataset.period);
            });
        });
        
        // 其他按鈕（暫時只記錄點擊）
        this.elements['export-btn']?.addEventListener('click', () => {
            console.log('匯出功能');
        });
        
        this.elements['settings-btn']?.addEventListener('click', () => {
            console.log('設定功能');
        });
    }

    // 載入初始資料
    async loadInitialData() {
        try {
            await this.updateDisplay();
            await this.loadRecentTaskNames();
            await this.loadTaskHistory();
            
        } catch (error) {
            console.error("❌ 載入初始資料失敗：", error);
            this.showError("載入資料失敗，請重新整理頁面");
        }
    }

    // 開始定期更新（每秒更新一次）
    startPeriodicUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(async () => {
            try {
                await this.updateDisplay();
            } catch (error) {
                console.error("❌ 定期更新失敗：", error);
            }
        }, 1000);
    }

    // 停止定期更新
    stopPeriodicUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // 更新顯示內容
    async updateDisplay() {
        try {
            // 更新目前任務狀態
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            
            this.updateTimerDisplay(isActive, taskName, formattedTime);
            this.updateControlButtons(isActive);
            
            // 更新今日統計
            const [taskCount, totalSeconds, totalFormatted] = await invoke("get_today_stats");
            this.updateTodayStats(taskCount, totalFormatted);
            
        } catch (error) {
            console.error("❌ 更新顯示失敗：", error);
        }
    }

    // 更新計時器顯示
    updateTimerDisplay(isActive, taskName, formattedTime) {
        const timerElement = this.elements['timer-display'];
        const taskNameElement = this.elements['current-task-name'];
        const statusIndicator = this.elements['status-indicator'];
        const statusText = this.elements['status-text'];
        const currentTaskSection = document.querySelector('.current-task');

        if (timerElement) timerElement.textContent = formattedTime;
        
        if (taskNameElement) {
            taskNameElement.textContent = taskName || '無進行中的任務';
        }

        if (isActive) {
            if (statusIndicator) statusIndicator.textContent = '⏰';
            if (statusText) statusText.textContent = '進行中';
            currentTaskSection?.classList.add('timer-active');
        } else {
            if (statusIndicator) statusIndicator.textContent = '⏸️';
            if (statusText) statusText.textContent = '待機中';
            currentTaskSection?.classList.remove('timer-active');
        }
    }

    // 更新控制按鈕狀態
    updateControlButtons(isActive) {
        const startBtn = this.elements['start-btn'];
        const stopBtn = this.elements['stop-btn'];

        if (startBtn) {
            startBtn.disabled = isActive;
        }
        
        if (stopBtn) {
            stopBtn.disabled = !isActive;
        }
    }

    // 更新今日統計
    updateTodayStats(taskCount, totalFormatted) {
        const countElement = this.elements['today-tasks-count'];
        const timeElement = this.elements['today-total-time'];

        if (countElement) countElement.textContent = taskCount.toString();
        if (timeElement) timeElement.textContent = totalFormatted;
    }

    // 處理開始任務
    async handleStartTask() {
        const taskInput = this.elements['task-input'];
        const taskName = taskInput?.value.trim();

        // 輸入驗證
        const validationResult = this.validateTaskName(taskName);
        if (!validationResult.isValid) {
            this.showError(validationResult.message);
            taskInput?.focus();
            return;
        }

        try {
            await invoke("start_task", { name: taskName });
            
            // 清空輸入框
            if (taskInput) taskInput.value = '';
            
            // 隱藏最近任務下拉選單
            this.hideRecentTasksDropdown();
            this.resetSelection();
            
            // 立即更新顯示
            await this.updateDisplay();
            await this.loadRecentTaskNames();
            
            // 更新統計
            await this.updateStatistics();
            
            console.log(`✅ 任務開始：${taskName}`);
            this.showSuccess(`任務「${taskName}」已開始`);
            
        } catch (error) {
            console.error("❌ 開始任務失敗：", error);
            this.showError('開始任務失敗：' + error);
        }
    }

    // 驗證任務名稱
    validateTaskName(taskName) {
        if (!taskName) {
            return { isValid: false, message: '請輸入任務名稱' };
        }
        
        if (taskName.length < 1) {
            return { isValid: false, message: '任務名稱不能為空' };
        }
        
        if (taskName.length > 100) {
            return { isValid: false, message: '任務名稱不能超過 100 個字元' };
        }
        
        // 檢查特殊字元（可選）
        const invalidChars = /[<>:"\/\\|?*]/;
        if (invalidChars.test(taskName)) {
            return { isValid: false, message: '任務名稱不能包含特殊字元 < > : " / \\ | ? *' };
        }
        
        return { isValid: true, message: '' };
    }

    // 顯示成功訊息
    showSuccess(message) {
        console.log("✅ 成功：", message);
        // 可以之後改為更美觀的通知
    }

    // 處理停止任務
    async handleStopTask() {
        try {
            await invoke("stop_task");
            
            // 立即更新顯示
            await this.updateDisplay();
            
            // 更新統計
            await this.updateStatistics();
            
            console.log("✅ 任務已停止");
            
        } catch (error) {
            console.error("❌ 停止任務失敗：", error);
            this.showError('停止任務失敗：' + error);
        }
    }

    // 處理任務輸入框獲得焦點
    async handleTaskInputFocus() {
        await this.loadRecentTaskNames();
        this.showRecentTasksDropdown();
    }

    // 處理任務輸入框失去焦點
    handleTaskInputBlur() {
        // 延遲隱藏，允許點擊下拉選單項目
        setTimeout(() => {
            this.hideRecentTasksDropdown();
        }, 200);
    }

    // 處理任務輸入框按鍵
    handleTaskInputKeydown(event) {
        const dropdown = this.elements['recent-tasks-dropdown'];
        const isDropdownVisible = dropdown && dropdown.style.display === 'block';
        
        if (event.key === 'Enter') {
            // 如果有選中的任務，使用選中的任務
            if (isDropdownVisible && this.selectedTaskIndex >= 0 && this.selectedTaskIndex < this.filteredRecentTasks.length) {
                const selectedTask = this.filteredRecentTasks[this.selectedTaskIndex];
                const taskInput = this.elements['task-input'];
                if (taskInput) {
                    taskInput.value = selectedTask;
                }
                this.hideRecentTasksDropdown();
                this.resetSelection();
            }
            this.handleStartTask();
        } else if (event.key === 'Escape') {
            this.hideRecentTasksDropdown();
            this.resetSelection();
            event.target.blur();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (isDropdownVisible && this.filteredRecentTasks.length > 0) {
                this.selectedTaskIndex = Math.min(this.selectedTaskIndex + 1, this.filteredRecentTasks.length - 1);
                this.updateTaskSelection();
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (isDropdownVisible && this.filteredRecentTasks.length > 0) {
                this.selectedTaskIndex = Math.max(this.selectedTaskIndex - 1, -1);
                this.updateTaskSelection();
            }
        } else if (event.key === 'Tab') {
            // Tab 鍵選擇第一個建議項目
            if (isDropdownVisible && this.filteredRecentTasks.length > 0 && this.selectedTaskIndex === -1) {
                event.preventDefault();
                this.selectedTaskIndex = 0;
                this.updateTaskSelection();
                const taskInput = this.elements['task-input'];
                if (taskInput) {
                    taskInput.value = this.filteredRecentTasks[0];
                }
                this.hideRecentTasksDropdown();
                this.resetSelection();
            }
        }
    }

    // 處理任務輸入框內容變更
    handleTaskInputInput(event) {
        const inputValue = event.target.value.trim();
        this.filterRecentTasks(inputValue);
        this.resetSelection();
    }

    // 載入最近任務名稱
    async loadRecentTaskNames() {
        try {
            const recentNames = await invoke("get_recent_task_names");
            this.allRecentTasks = recentNames;
            this.filteredRecentTasks = [...recentNames];
            this.displayRecentTaskNames(this.filteredRecentTasks);
            
        } catch (error) {
            console.error("❌ 載入最近任務失敗：", error);
        }
    }

    // 過濾最近任務
    filterRecentTasks(inputValue) {
        if (!inputValue) {
            this.filteredRecentTasks = [...this.allRecentTasks];
        } else {
            // 模糊搜尋：包含輸入字串的任務
            this.filteredRecentTasks = this.allRecentTasks.filter(task => 
                task.toLowerCase().includes(inputValue.toLowerCase())
            );
        }
        
        this.displayRecentTaskNames(this.filteredRecentTasks);
        
        // 如果有過濾結果且下拉選單隱藏，則顯示它
        if (this.filteredRecentTasks.length > 0) {
            this.showRecentTasksDropdown();
        }
    }

    // 重置選擇狀態
    resetSelection() {
        this.selectedTaskIndex = -1;
        this.updateTaskSelection();
    }

    // 更新任務選擇高亮
    updateTaskSelection() {
        const listElement = this.elements['recent-tasks-list'];
        if (!listElement) return;

        // 移除所有高亮
        const items = listElement.querySelectorAll('.recent-item');
        items.forEach((item, index) => {
            if (index === this.selectedTaskIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // 顯示最近任務名稱
    displayRecentTaskNames(names) {
        const listElement = this.elements['recent-tasks-list'];
        if (!listElement) return;

        listElement.innerHTML = '';

        if (names.length === 0) {
            const inputValue = this.elements['task-input']?.value.trim();
            const emptyMessage = inputValue ? 
                `沒有符合 "${inputValue}" 的最近任務` : 
                '尚無最近任務';
            listElement.innerHTML = `<div class="recent-item empty-item" style="color: var(--text-muted); cursor: default;">${emptyMessage}</div>`;
            return;
        }

        names.forEach((name, index) => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.textContent = name;
            
            // 高亮搜尋關鍵字
            const inputValue = this.elements['task-input']?.value.trim();
            if (inputValue) {
                const highlightedText = this.highlightText(name, inputValue);
                item.innerHTML = highlightedText;
            }
            
            item.addEventListener('click', () => {
                this.selectTask(name);
            });
            
            // 滑鼠懸停時更新選擇索引
            item.addEventListener('mouseenter', () => {
                this.selectedTaskIndex = index;
                this.updateTaskSelection();
            });
            
            listElement.appendChild(item);
        });
        
        // 更新選擇狀態
        this.updateTaskSelection();
    }

    // 選擇任務
    selectTask(taskName) {
        const taskInput = this.elements['task-input'];
        if (taskInput) {
            taskInput.value = taskName;
            taskInput.focus();
        }
        this.hideRecentTasksDropdown();
        this.resetSelection();
    }

    // 高亮文字中的搜尋關鍵字
    highlightText(text, keyword) {
        if (!keyword) return this.escapeHtml(text);
        
        const escapedText = this.escapeHtml(text);
        const escapedKeyword = this.escapeHtml(keyword);
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        
        return escapedText.replace(regex, '<mark class="highlight">$1</mark>');
    }

    // 顯示最近任務下拉選單
    showRecentTasksDropdown() {
        const dropdown = this.elements['recent-tasks-dropdown'];
        if (dropdown) {
            dropdown.style.display = 'block';
        }
    }

    // 隱藏最近任務下拉選單
    hideRecentTasksDropdown() {
        const dropdown = this.elements['recent-tasks-dropdown'];
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // 載入任務歷史
    async loadTaskHistory() {
        try {
            const history = await invoke("get_task_history");
            this.displayTaskHistory(history.slice(-5)); // 只顯示最近 5 個
            
        } catch (error) {
            console.error("❌ 載入任務歷史失敗：", error);
        }
    }

    // 顯示任務歷史
    displayTaskHistory(tasks) {
        const historyElement = this.elements['recent-history'];
        if (!historyElement) return;

        if (tasks.length === 0) {
            historyElement.innerHTML = '<div class="empty-state">尚無任務記錄</div>';
            return;
        }

        const historyHTML = tasks
            .reverse() // 最新的在前面
            .map(task => `
                <div class="history-item">
                    <span class="history-task-name">${this.escapeHtml(task.name)}</span>
                    <span class="history-duration">${this.formatDuration(task.duration_seconds || 0)}</span>
                </div>
            `).join('');

        historyElement.innerHTML = historyHTML;
    }

    // 格式化持續時間
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // HTML 轉義
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 顯示錯誤訊息
    showError(message) {
        // 簡單的錯誤提示，之後可以改為更美觀的通知
        console.error("🚨 錯誤：", message);
        alert(message);
    }

    // 清理資源
    destroy() {
        this.stopPeriodicUpdate();
        this.isInitialized = false;
    }

    // 初始化統計功能
    async initStatistics() {
        try {
            console.log("📊 初始化統計功能...");
            
            // 載入統計資料
            await this.loadStatistics();
            
            console.log("✅ 統計功能初始化完成");
            
        } catch (error) {
            console.error("❌ 統計功能初始化失敗：", error);
        }
    }

    // 載入統計資料
    async loadStatistics() {
        try {
            // 載入今日統計
            const todaySummaries = await taskStatistics.loadTodayTaskSummaries();
            taskStatistics.renderTaskSummaries(
                todaySummaries, 
                'today-statistics', 
                {
                    showSessionCount: true,
                    showAverageTime: false,
                    showLastSession: true,
                    maxItems: 5,
                    allowClick: true
                }
            );

            // 載入全部統計
            const allSummaries = await taskStatistics.loadAllTaskSummaries();
            taskStatistics.renderTaskSummaries(
                allSummaries, 
                'all-statistics', 
                {
                    showSessionCount: true,
                    showAverageTime: true,
                    showLastSession: true,
                    maxItems: 10,
                    allowClick: true
                }
            );
            
        } catch (error) {
            console.error("❌ 載入統計資料失敗：", error);
        }
    }

    // 切換統計標籤頁
    switchStatisticsTab(tabName) {
        // 移除所有標籤的 active 類
        this.elements['today-stats-tab']?.classList.remove('active');
        this.elements['all-stats-tab']?.classList.remove('active');
        this.elements['history-tab']?.classList.remove('active');
        this.elements['search-tab']?.classList.remove('active');
        this.elements['today-statistics']?.classList.remove('active');
        this.elements['all-statistics']?.classList.remove('active');
        this.elements['history-statistics']?.classList.remove('active');
        this.elements['search-statistics']?.classList.remove('active');

        // 啟用選中的標籤
        if (tabName === 'today') {
            this.elements['today-stats-tab']?.classList.add('active');
            this.elements['today-statistics']?.classList.add('active');
        } else if (tabName === 'all') {
            this.elements['all-stats-tab']?.classList.add('active');
            this.elements['all-statistics']?.classList.add('active');
        } else if (tabName === 'history') {
            this.elements['history-tab']?.classList.add('active');
            this.elements['history-statistics']?.classList.add('active');
            // 載入歷史統計
            this.loadHistoryStats();
        } else if (tabName === 'search') {
            this.elements['search-tab']?.classList.add('active');
            this.elements['search-statistics']?.classList.add('active');
        }

        const tabLabels = {
            'today': '今日',
            'all': '全部',
            'history': '歷史',
            'search': '搜尋'
        };
        console.log(`📊 切換到${tabLabels[tabName]}統計`);
    }

    // 更新統計資料（在任務狀態改變時調用）
    async updateStatistics() {
        if (!this.isInitialized) return;
        
        try {
            await this.loadStatistics();
        } catch (error) {
            console.error("❌ 更新統計資料失敗：", error);
        }
    }

    // 載入歷史統計
    async loadHistoryStats(period = 'week') {
        try {
            let startDate = null;
            let endDate = null;

            const today = new Date();
            
            if (period === 'week') {
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                startDate = startOfWeek.toISOString().split('T')[0];
                
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endDate = endOfWeek.toISOString().split('T')[0];
            } else if (period === 'month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate = startOfMonth.toISOString().split('T')[0];
                
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                endDate = endOfMonth.toISOString().split('T')[0];
            }
            // period === 'all' 時不設定日期範圍

            const dateStats = await taskQuery.getDateStats(startDate, endDate);
            taskQuery.renderDateStats(dateStats, 'date-stats-container');

        } catch (error) {
            console.error("❌ 載入歷史統計失敗：", error);
            this.elements['date-stats-container'].innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <div class="empty-text">載入歷史統計失敗</div>
                </div>
            `;
        }
    }

    // 處理歷史統計篩選
    handleHistoryFilter(period) {
        // 更新按鈕狀態
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });

        // 重新載入統計資料
        this.loadHistoryStats(period);
    }

    // 執行搜尋
    async performSearch() {
        try {
            const taskName = this.elements['search-task-name']?.value.trim();
            const startDate = this.elements['search-start-date']?.value;
            const endDate = this.elements['search-end-date']?.value;

            const params = {};
            if (taskName) params.task_name = taskName;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const result = await taskQuery.queryTaskRecords(params);
            taskQuery.renderQueryResult(result, 'search-results-container');

            console.log(`🔍 搜尋完成，找到 ${result.total_count} 筆記錄`);

        } catch (error) {
            console.error("❌ 搜尋失敗：", error);
            this.elements['search-results-container'].innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <div class="empty-text">搜尋失敗，請重試</div>
                </div>
            `;
        }
    }

    // 清除搜尋
    clearSearch() {
        this.elements['search-task-name'].value = '';
        this.elements['search-start-date'].value = '';
        this.elements['search-end-date'].value = '';
        
        this.elements['search-results-container'].innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">輸入搜尋條件開始查詢</div>
            </div>
        `;
    }
}

// 全局應用程式實例
let app = null;

// DOM 載入完成後初始化應用程式
document.addEventListener("DOMContentLoaded", async () => {
    try {
        app = new TaskTrackerApp();
        await app.init();
        
        // 將應用程式實例暴露到全局，方便測試
        window.taskApp = app;
        
    } catch (error) {
        console.error("❌ 應用程式啟動失敗：", error);
    }
});

// 頁面卸載時清理資源
window.addEventListener("beforeunload", () => {
    if (app) {
        app.destroy();
    }
});