// 任務統計功能模組
import { invoke } from '@tauri-apps/api/core';

export class TaskStatistics {
    constructor() {
        this.allTaskSummaries = [];
        this.todayTaskSummaries = [];
        this.selectedTaskRecords = [];
        this.selectedTaskName = null;
    }

    // 載入所有任務統計
    async loadAllTaskSummaries() {
        try {
            console.log("📊 載入所有任務統計...");
            this.allTaskSummaries = await invoke('get_task_summaries');
            console.log(`✅ 載入了 ${this.allTaskSummaries.length} 個任務統計`);
            return this.allTaskSummaries;
        } catch (error) {
            console.error("❌ 載入任務統計失敗:", error);
            throw error;
        }
    }

    // 載入今日任務統計
    async loadTodayTaskSummaries() {
        try {
            console.log("📊 載入今日任務統計...");
            this.todayTaskSummaries = await invoke('get_today_task_summaries');
            console.log(`✅ 載入了 ${this.todayTaskSummaries.length} 個今日任務統計`);
            return this.todayTaskSummaries;
        } catch (error) {
            console.error("❌ 載入今日任務統計失敗:", error);
            throw error;
        }
    }

    // 載入指定任務的詳細記錄
    async loadTaskRecords(taskName) {
        try {
            console.log(`📋 載入任務「${taskName}」的詳細記錄...`);
            this.selectedTaskRecords = await invoke('get_task_records_by_name', { taskName });
            this.selectedTaskName = taskName;
            console.log(`✅ 載入了 ${this.selectedTaskRecords.length} 個記錄`);
            return this.selectedTaskRecords;
        } catch (error) {
            console.error(`❌ 載入任務記錄失敗:`, error);
            throw error;
        }
    }

    // 渲染任務統計摘要到指定容器
    renderTaskSummaries(summaries, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`找不到容器: ${containerId}`);
            return;
        }

        const {
            showSessionCount = true,
            showAverageTime = true,
            showLastSession = true,
            maxItems = 50,
            allowClick = true
        } = options;

        if (summaries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">尚無任務記錄</div>
                </div>
            `;
            return;
        }

        const html = summaries.slice(0, maxItems).map((summary, index) => `
            <div class="task-summary-item ${allowClick ? 'clickable' : ''}" data-task-name="${summary.name}">
                <div class="task-summary-header">
                    <div class="task-rank">#${index + 1}</div>
                    <div class="task-name-section">
                        <div class="task-name" title="${summary.name}">${summary.name}</div>
                        <div class="task-duration">${summary.total_duration_formatted}</div>
                    </div>
                </div>
                <div class="task-summary-details">
                    ${showSessionCount ? `<div class="detail-item">
                        <span class="detail-label">計時次數:</span>
                        <span class="detail-value">${summary.session_count} 次</span>
                    </div>` : ''}
                    ${showAverageTime ? `<div class="detail-item">
                        <span class="detail-label">平均時長:</span>
                        <span class="detail-value">${this.formatDuration(summary.average_duration_seconds)}</span>
                    </div>` : ''}
                    ${showLastSession ? `<div class="detail-item">
                        <span class="detail-label">最後計時:</span>
                        <span class="detail-value">${this.formatRelativeTime(summary.last_session_time)}</span>
                    </div>` : ''}
                </div>
                ${allowClick ? '<div class="click-hint">點擊查看詳細記錄 →</div>' : ''}
            </div>
        `).join('');

        container.innerHTML = html;

        // 添加點擊事件處理
        if (allowClick) {
            container.querySelectorAll('.task-summary-item.clickable').forEach(item => {
                item.addEventListener('click', async (e) => {
                    const taskName = e.currentTarget.dataset.taskName;
                    await this.showTaskDetails(taskName);
                });
            });
        }
    }

    // 渲染任務詳細記錄
    renderTaskRecords(records, containerId, taskName) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`找不到容器: ${containerId}`);
            return;
        }

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-text">該任務暫無記錄</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="task-records-header">
                <h3>任務「${taskName}」的計時記錄</h3>
                <div class="records-summary">
                    總共 ${records.length} 次計時，
                    總時長 ${this.formatDuration(records.reduce((sum, r) => sum + this.getDuration(r), 0))}
                </div>
            </div>
            <div class="task-records-list">
                ${records.map((record, index) => `
                    <div class="task-record-item ${record.end_time ? 'completed' : 'active'}">
                        <div class="record-index">#${index + 1}</div>
                        <div class="record-details">
                            <div class="record-time-info">
                                <div class="record-duration">
                                    ${this.formatDuration(this.getDuration(record))}
                                    ${!record.end_time ? ' (進行中)' : ''}
                                </div>
                                <div class="record-time-range">
                                    ${this.formatDateTime(record.start_time)}
                                    ${record.end_time ? ` → ${this.formatDateTime(record.end_time)}` : ' → 現在'}
                                </div>
                            </div>
                            <div class="record-id">${record.id}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    // 顯示任務詳細記錄（會觸發載入和渲染）
    async showTaskDetails(taskName) {
        try {
            console.log(`🔍 顯示任務「${taskName}」的詳細記錄`);
            
            // 載入記錄
            const records = await this.loadTaskRecords(taskName);
            
            // 創建或更新詳細視窗
            this.createTaskDetailsModal(taskName, records);
            
        } catch (error) {
            console.error("顯示任務詳細記錄失敗:", error);
            alert(`載入任務記錄失敗: ${error}`);
        }
    }

    // 創建任務詳細記錄模態視窗
    createTaskDetailsModal(taskName, records) {
        // 移除舊的模態視窗
        const existingModal = document.getElementById('task-details-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 創建新的模態視窗
        const modal = document.createElement('div');
        modal.id = 'task-details-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content task-details-modal">
                <div class="modal-header">
                    <h2>任務詳細記錄</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div id="task-details-container"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // 渲染記錄到模態視窗中
        this.renderTaskRecords(records, 'task-details-container', taskName);

        // 點擊背景關閉模態視窗
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 工具方法：格式化時間長度
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

    // 工具方法：格式化相對時間
    formatRelativeTime(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diffSeconds = now - timestamp;

        if (diffSeconds < 60) {
            return '剛才';
        } else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            return `${minutes} 分鐘前`;
        } else if (diffSeconds < 86400) {
            const hours = Math.floor(diffSeconds / 3600);
            return `${hours} 小時前`;
        } else {
            const days = Math.floor(diffSeconds / 86400);
            return `${days} 天前`;
        }
    }

    // 工具方法：格式化日期時間
    formatDateTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // 工具方法：計算任務持續時間
    getDuration(record) {
        if (record.duration_seconds !== null && record.duration_seconds !== undefined) {
            return record.duration_seconds;
        } else {
            // 如果任務仍在進行中，計算目前已經過的時間
            const now = Math.floor(Date.now() / 1000);
            return now - record.start_time;
        }
    }

    // 取得任務排行榜數據（用於圖表）
    getTaskRankingData(summaries, limit = 10) {
        return summaries.slice(0, limit).map((summary, index) => ({
            rank: index + 1,
            name: summary.name,
            totalSeconds: summary.total_duration_seconds,
            totalFormatted: summary.total_duration_formatted,
            sessionCount: summary.session_count,
            averageSeconds: summary.average_duration_seconds,
            averageFormatted: this.formatDuration(summary.average_duration_seconds)
        }));
    }

    // 搜尋任務
    searchTasks(summaries, keyword) {
        if (!keyword || keyword.trim() === '') {
            return summaries;
        }

        const searchTerm = keyword.toLowerCase().trim();
        return summaries.filter(summary => 
            summary.name.toLowerCase().includes(searchTerm)
        );
    }
}

// 全域實例
const taskStatistics = new TaskStatistics();

// 導出給其他模組使用
export default taskStatistics;

console.log("📊 任務統計模組已載入");