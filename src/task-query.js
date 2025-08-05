import { invoke } from "@tauri-apps/api/core";
import taskEdit from './task-edit.js';

/**
 * 任務查詢管理類
 * 提供任務記錄查詢、日期統計等功能
 */
export class TaskQuery {
    constructor() {
        this.currentQuery = null;
        this.currentResult = null;
    }

    /**
     * 查詢任務記錄
     * @param {Object} params - 查詢參數
     * @param {string} [params.task_name] - 任務名稱過濾器
     * @param {string} [params.start_date] - 開始日期 (YYYY-MM-DD)
     * @param {string} [params.end_date] - 結束日期 (YYYY-MM-DD)
     * @param {number} [params.page] - 頁碼（從 1 開始）
     * @param {number} [params.page_size] - 每頁記錄數
     * @returns {Promise<Object>} 查詢結果
     */
    async queryTaskRecords(params = {}) {
        try {
            this.currentQuery = params;
            this.currentResult = await invoke('query_task_records', { params });
            return this.currentResult;
        } catch (error) {
            console.error('❌ 查詢任務記錄失敗：', error);
            throw error;
        }
    }

    /**
     * 獲取日期統計
     * @param {string} [startDate] - 開始日期 (YYYY-MM-DD)
     * @param {string} [endDate] - 結束日期 (YYYY-MM-DD)
     * @returns {Promise<Array>} 日期統計列表
     */
    async getDateStats(startDate = null, endDate = null) {
        try {
            return await invoke('get_date_stats', { 
                startDate, 
                endDate 
            });
        } catch (error) {
            console.error('❌ 獲取日期統計失敗：', error);
            throw error;
        }
    }

    /**
     * 搜索任務記錄
     * @param {string} searchTerm - 搜索關鍵字
     * @param {Object} options - 搜索選項
     * @returns {Promise<Object>} 搜索結果
     */
    async searchTasks(searchTerm, options = {}) {
        const params = {
            task_name: searchTerm,
            page: options.page || 1,
            page_size: options.page_size || 20,
            ...options
        };

        return await this.queryTaskRecords(params);
    }

    /**
     * 獲取最近的任務記錄
     * @param {number} [limit=10] - 記錄數量限制
     * @returns {Promise<Object>} 最近的任務記錄
     */
    async getRecentTasks(limit = 10) {
        return await this.queryTaskRecords({
            page: 1,
            page_size: limit
        });
    }

    /**
     * 獲取今日任務記錄
     * @returns {Promise<Object>} 今日任務記錄
     */
    async getTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        return await this.queryTaskRecords({
            start_date: today,
            end_date: today
        });
    }

    /**
     * 獲取本週任務記錄
     * @returns {Promise<Object>} 本週任務記錄
     */
    async getWeekTasks() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return await this.queryTaskRecords({
            start_date: startOfWeek.toISOString().split('T')[0],
            end_date: endOfWeek.toISOString().split('T')[0]
        });
    }

    /**
     * 獲取本月任務記錄
     * @returns {Promise<Object>} 本月任務記錄
     */
    async getMonthTasks() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        return await this.queryTaskRecords({
            start_date: startOfMonth.toISOString().split('T')[0],
            end_date: endOfMonth.toISOString().split('T')[0]
        });
    }

    /**
     * 渲染查詢結果
     * @param {Object} result - 查詢結果
     * @param {string} containerId - 容器 DOM ID
     * @param {Object} options - 渲染選項
     */
    renderQueryResult(result, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`⚠️ 找不到容器：${containerId}`);
            return;
        }

        // 清空容器
        container.innerHTML = '';

        if (!result.records || result.records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">沒有找到符合條件的記錄</div>
                </div>
            `;
            return;
        }

        // 創建結果容器
        const resultContainer = document.createElement('div');
        resultContainer.className = 'query-result-container';

        // 添加統計資訊
        if (options.showStats !== false) {
            const statsHTML = `
                <div class="query-stats">
                    <div class="stats-summary">
                        <span class="stats-item">
                            <strong>${result.total_count}</strong> 筆記錄
                        </span>
                        <span class="stats-item">
                            總時長：<strong>${result.total_duration_formatted}</strong>
                        </span>
                        <span class="stats-item">
                            第 ${result.current_page} / ${result.total_pages} 頁
                        </span>
                    </div>
                </div>
            `;
            resultContainer.innerHTML += statsHTML;
        }

        // 添加記錄列表
        const recordsHTML = result.records.map((record, index) => {
            const startTime = new Date(record.start_time * 1000);
            const endTime = record.end_time ? new Date(record.end_time * 1000) : null;
            const duration = record.duration_seconds || 0;
            
            return `
                <div class="task-record-item ${!record.end_time ? 'active' : 'completed'}" data-record-id="${record.id}">
                    <div class="record-index">${(result.current_page - 1) * result.page_size + index + 1}</div>
                    <div class="record-details">
                        <div class="record-time-info">
                            <div class="task-name" title="${this.escapeHtml(record.name)}">${this.escapeHtml(record.name)}</div>
                            <div class="record-duration">${this.formatDuration(duration)}</div>
                            <div class="record-time-range">
                                ${startTime.toLocaleString('zh-TW')}
                                ${endTime ? ' ~ ' + endTime.toLocaleString('zh-TW') : ' (進行中)'}
                            </div>
                        </div>
                        <div class="record-actions">
                            <button class="edit-task-btn" data-task-id="${record.id}" title="編輯任務">✏️</button>
                            <div class="record-id">${record.id}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        resultContainer.innerHTML += `<div class="records-list">${recordsHTML}</div>`;

        // 添加分頁控制
        if (result.total_pages > 1) {
            const paginationHTML = this.createPaginationHTML(result);
            resultContainer.innerHTML += paginationHTML;
        }

        container.appendChild(resultContainer);

        // 綁定分頁事件
        this.bindPaginationEvents(container, result);

        // 綁定編輯按鈕事件
        this.bindEditButtonEvents(container);
    }

    /**
     * 創建分頁 HTML
     * @param {Object} result - 查詢結果
     * @returns {string} 分頁 HTML
     */
    createPaginationHTML(result) {
        const { current_page, total_pages } = result;
        let paginationHTML = '<div class="pagination">';

        // 上一頁按鈕
        if (current_page > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="${current_page - 1}">上一頁</button>`;
        }

        // 頁碼按鈕
        const startPage = Math.max(1, current_page - 2);
        const endPage = Math.min(total_pages, current_page + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === current_page ? 'active' : '';
            paginationHTML += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }

        if (endPage < total_pages) {
            if (endPage < total_pages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" data-page="${total_pages}">${total_pages}</button>`;
        }

        // 下一頁按鈕
        if (current_page < total_pages) {
            paginationHTML += `<button class="pagination-btn" data-page="${current_page + 1}">下一頁</button>`;
        }

        paginationHTML += '</div>';
        return paginationHTML;
    }

    /**
     * 綁定分頁事件
     * @param {HTMLElement} container - 容器元素
     * @param {Object} result - 查詢結果
     */
    bindPaginationEvents(container, result) {
        const paginationBtns = container.querySelectorAll('.pagination-btn');
        paginationBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page && this.currentQuery) {
                    const newParams = { ...this.currentQuery, page };
                    const newResult = await this.queryTaskRecords(newParams);
                    this.renderQueryResult(newResult, container.id);
                }
            });
        });
    }

    /**
     * 渲染日期統計
     * @param {Array} dateStats - 日期統計數據
     * @param {string} containerId - 容器 DOM ID
     * @param {Object} options - 渲染選項
     */
    renderDateStats(dateStats, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`⚠️ 找不到容器：${containerId}`);
            return;
        }

        container.innerHTML = '';

        if (!dateStats || dateStats.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <div class="empty-text">沒有統計資料</div>
                </div>
            `;
            return;
        }

        const dateStatsHTML = dateStats.map(dateStat => {
            return `
                <div class="date-stat-item" data-date="${dateStat.date}">
                    <div class="date-stat-header">
                        <h4 class="stat-date">${this.formatDate(dateStat.date)}</h4>
                        <div class="stat-summary">
                            <span class="stat-value">${dateStat.task_count}</span> 個任務
                            <span class="stat-divider">•</span>
                            <span class="stat-value">${dateStat.total_duration_formatted}</span>
                        </div>
                    </div>
                    <div class="date-tasks">
                        ${dateStat.tasks.map(task => `
                            <div class="date-task-item">
                                <span class="task-name">${this.escapeHtml(task.name)}</span>
                                <span class="task-duration">${task.total_duration_formatted}</span>
                                <span class="task-sessions">${task.session_count} 次</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="date-stats-list">${dateStatsHTML}</div>`;
    }

    /**
     * 格式化日期
     * @param {string} dateStr - 日期字符串 (YYYY-MM-DD)
     * @returns {string} 格式化後的日期
     */
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const dateOnly = dateStr === today.toISOString().split('T')[0];
        const isYesterday = dateStr === yesterday.toISOString().split('T')[0];

        if (dateOnly) {
            return '今日 ' + date.toLocaleDateString('zh-TW', { weekday: 'short' });
        } else if (isYesterday) {
            return '昨日 ' + date.toLocaleDateString('zh-TW', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('zh-TW', { 
                month: 'short', 
                day: 'numeric', 
                weekday: 'short' 
            });
        }
    }

    /**
     * 格式化持續時間
     * @param {number} seconds - 秒數
     * @returns {string} 格式化時間
     */
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

    /**
     * 綁定編輯按鈕事件
     * @param {HTMLElement} container - 容器元素
     */
    bindEditButtonEvents(container) {
        const editBtns = container.querySelectorAll('.edit-task-btn');
        editBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = e.target.dataset.taskId;
                if (taskId) {
                    await this.handleEditTask(taskId);
                }
            });
        });
    }

    /**
     * 處理編輯任務
     * @param {string} taskId - 任務 ID
     */
    async handleEditTask(taskId) {
        try {
            // 獲取任務詳細資訊
            const taskRecords = await invoke('get_task_history');
            const task = taskRecords.find(t => t.id === taskId);
            
            if (!task) {
                throw new Error('找不到指定的任務記錄');
            }

            // 顯示編輯表單
            taskEdit.showEditForm(task, (action, result) => {
                // 成功後重新載入當前查詢結果
                console.log(`任務${action === 'edit' ? '編輯' : '刪除'}成功`);
                
                // 觸發統計資料更新
                if (window.taskApp && window.taskApp.updateStatistics) {
                    window.taskApp.updateStatistics();
                }
                
                // 重新執行當前查詢
                if (this.currentQuery) {
                    this.queryTaskRecords(this.currentQuery).then(newResult => {
                        const activeContainer = document.querySelector('.statistics-list.active .query-result-container');
                        if (activeContainer) {
                            const containerId = activeContainer.closest('[id]')?.id;
                            if (containerId) {
                                this.renderQueryResult(newResult, containerId);
                            }
                        }
                    });
                }
            });

        } catch (error) {
            console.error('❌ 載入任務資料失敗：', error);
            alert(`載入任務資料失敗：${error.message || error}`);
        }
    }

    /**
     * HTML 轉義
     * @param {string} text - 原始文本
     * @returns {string} 轉義後的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 創建全局實例
const taskQuery = new TaskQuery();
export default taskQuery;