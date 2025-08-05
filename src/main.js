import { invoke } from "@tauri-apps/api/core";

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
            'recent-history', 'view-all-btn', 'export-btn', 'settings-btn'
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
        
        // 其他按鈕（暫時只記錄點擊）
        this.elements['view-all-btn']?.addEventListener('click', () => {
            console.log('查看全部任務');
        });
        
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
            await this.loadTaskHistory();
            
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