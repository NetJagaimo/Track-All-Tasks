import { invoke } from "@tauri-apps/api/core";

/**
 * 任務匯出管理類
 * 提供 CSV 和 JSON 格式的資料匯出功能
 */
export class TaskExport {
    constructor() {
        this.isExporting = false;
    }

    /**
     * 匯出任務記錄
     * @param {Object} options - 匯出選項
     * @param {string} options.format - 匯出格式：'csv' 或 'json'
     * @param {string} options.exportType - 匯出類型：'records' 或 'summaries'
     * @param {string} [options.taskName] - 任務名稱過濾器
     * @param {string} [options.startDate] - 開始日期 (YYYY-MM-DD)
     * @param {string} [options.endDate] - 結束日期 (YYYY-MM-DD)
     * @returns {Promise<Object>} 匯出結果
     */
    async exportData(options) {
        if (this.isExporting) {
            throw new Error('正在匯出中，請稍候...');
        }

        this.isExporting = true;

        try {
            const params = {
                format: options.format,
                export_type: options.exportType,
                task_name: options.taskName || null,
                start_date: options.startDate || null,
                end_date: options.endDate || null,
            };

            console.log('📤 開始匯出資料：', params);

            const result = await invoke('export_data', { params });
            
            console.log('✅ 匯出完成：', result);
            return result;

        } catch (error) {
            console.error('❌ 匯出失敗：', error);
            throw error;
        } finally {
            this.isExporting = false;
        }
    }

    /**
     * 匯出任務記錄為 CSV
     * @param {Object} filters - 篩選條件
     * @returns {Promise<Object>} 匯出結果
     */
    async exportRecordsToCSV(filters = {}) {
        return await this.exportData({
            format: 'csv',
            exportType: 'records',
            ...filters
        });
    }

    /**
     * 匯出任務記錄為 JSON
     * @param {Object} filters - 篩選條件
     * @returns {Promise<Object>} 匯出結果
     */
    async exportRecordsToJSON(filters = {}) {
        return await this.exportData({
            format: 'json',
            exportType: 'records',
            ...filters
        });
    }

    /**
     * 匯出任務統計為 CSV
     * @param {Object} filters - 篩選條件
     * @returns {Promise<Object>} 匯出結果
     */
    async exportSummariesToCSV(filters = {}) {
        return await this.exportData({
            format: 'csv',
            exportType: 'summaries',
            ...filters
        });
    }

    /**
     * 匯出任務統計為 JSON
     * @param {Object} filters - 篩選條件
     * @returns {Promise<Object>} 匯出結果
     */
    async exportSummariesToJSON(filters = {}) {
        return await this.exportData({
            format: 'json',
            exportType: 'summaries',
            ...filters
        });
    }

    /**
     * 快速匯出功能
     */

    /**
     * 匯出今日記錄
     * @param {string} format - 匯出格式
     * @returns {Promise<Object>} 匯出結果
     */
    async exportTodayRecords(format = 'csv') {
        const today = new Date().toISOString().split('T')[0];
        return await this.exportData({
            format,
            exportType: 'records',
            startDate: today,
            endDate: today
        });
    }

    /**
     * 匯出本週記錄
     * @param {string} format - 匯出格式
     * @returns {Promise<Object>} 匯出結果
     */
    async exportWeekRecords(format = 'csv') {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return await this.exportData({
            format,
            exportType: 'records',
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: endOfWeek.toISOString().split('T')[0]
        });
    }

    /**
     * 匯出本月記錄
     * @param {string} format - 匯出格式
     * @returns {Promise<Object>} 匯出結果
     */
    async exportMonthRecords(format = 'csv') {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        return await this.exportData({
            format,
            exportType: 'records',
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
        });
    }

    /**
     * 匯出全部記錄
     * @param {string} format - 匯出格式
     * @returns {Promise<Object>} 匯出結果
     */
    async exportAllRecords(format = 'csv') {
        return await this.exportData({
            format,
            exportType: 'records'
        });
    }

    /**
     * 匯出全部統計
     * @param {string} format - 匯出格式
     * @returns {Promise<Object>} 匯出結果
     */
    async exportAllSummaries(format = 'csv') {
        return await this.exportData({
            format,
            exportType: 'summaries'
        });
    }

    /**
     * 顯示匯出成功訊息
     * @param {Object} result - 匯出結果
     */
    showExportSuccess(result) {
        const message = `${result.message}`;
        
        // 創建成功通知
        this.showNotification(message, 'success');
        
        console.log('📁 檔案已儲存至：', result.file_path);
    }

    /**
     * 顯示匯出錯誤訊息
     * @param {Error} error - 錯誤物件
     */
    showExportError(error) {
        const message = `匯出失敗：${error.message || error}`;
        
        // 創建錯誤通知
        this.showNotification(message, 'error');
        
        console.error('❌ 匯出錯誤：', error);
    }

    /**
     * 顯示通知訊息
     * @param {string} message - 訊息內容
     * @param {string} type - 訊息類型：'success' 或 'error'
     */
    showNotification(message, type = 'info') {
        // 簡單的通知實作，之後可以改為更美觀的通知系統
        if (type === 'success') {
            alert(`✅ ${message}`);
        } else if (type === 'error') {
            alert(`❌ ${message}`);
        } else {
            alert(`ℹ️ ${message}`);
        }
    }

    /**
     * 建立匯出選項介面
     * @param {string} containerId - 容器 DOM ID
     */
    createExportUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`⚠️ 找不到容器：${containerId}`);
            return;
        }

        const exportHTML = `
            <div class="export-container">
                <div class="export-header">
                    <h3>📤 匯出資料</h3>
                    <p class="export-description">選擇要匯出的資料類型和格式</p>
                </div>
                
                <div class="export-options">
                    <div class="export-row">
                        <div class="export-field">
                            <label for="export-type">資料類型</label>
                            <select id="export-type">
                                <option value="records">任務記錄</option>
                                <option value="summaries">任務統計</option>
                            </select>
                        </div>
                        
                        <div class="export-field">
                            <label for="export-format">匯出格式</label>
                            <select id="export-format">
                                <option value="csv">CSV</option>
                                <option value="json">JSON</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="export-row">
                        <div class="export-field">
                            <label for="export-task-name">任務名稱（可選）</label>
                            <input type="text" id="export-task-name" placeholder="篩選特定任務..." />
                        </div>
                    </div>
                    
                    <div class="export-row">
                        <div class="export-field">
                            <label for="export-start-date">開始日期</label>
                            <input type="date" id="export-start-date" />
                        </div>
                        
                        <div class="export-field">
                            <label for="export-end-date">結束日期</label>
                            <input type="date" id="export-end-date" />
                        </div>
                    </div>
                    
                    <div class="export-actions">
                        <button id="export-custom-btn" class="export-btn primary">
                            <span class="btn-icon">📤</span>
                            自訂匯出
                        </button>
                        <button id="export-all-btn" class="export-btn secondary">
                            <span class="btn-icon">📊</span>
                            匯出全部
                        </button>
                    </div>
                    
                    <div class="quick-export">
                        <h4>快速匯出</h4>
                        <div class="quick-export-buttons">
                            <button class="quick-export-btn" data-period="today">今日</button>
                            <button class="quick-export-btn" data-period="week">本週</button>
                            <button class="quick-export-btn" data-period="month">本月</button>
                            <button class="quick-export-btn" data-period="all">全部統計</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = exportHTML;

        // 綁定事件
        this.bindExportEvents();
    }

    /**
     * 綁定匯出介面事件
     */
    bindExportEvents() {
        const customExportBtn = document.getElementById('export-custom-btn');
        const exportAllBtn = document.getElementById('export-all-btn');
        const quickExportBtns = document.querySelectorAll('.quick-export-btn');

        // 自訂匯出
        customExportBtn?.addEventListener('click', async () => {
            await this.handleCustomExport();
        });

        // 匯出全部
        exportAllBtn?.addEventListener('click', async () => {
            await this.handleExportAll();
        });

        // 快速匯出
        quickExportBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const period = e.target.dataset.period;
                await this.handleQuickExport(period);
            });
        });
    }

    /**
     * 處理自訂匯出
     */
    async handleCustomExport() {
        try {
            const exportType = document.getElementById('export-type')?.value;
            const format = document.getElementById('export-format')?.value;
            const taskName = document.getElementById('export-task-name')?.value.trim();
            const startDate = document.getElementById('export-start-date')?.value;
            const endDate = document.getElementById('export-end-date')?.value;

            const options = {
                format,
                exportType,
                taskName: taskName || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };

            const result = await this.exportData(options);
            this.showExportSuccess(result);

        } catch (error) {
            this.showExportError(error);
        }
    }

    /**
     * 處理匯出全部
     */
    async handleExportAll() {
        try {
            const exportType = document.getElementById('export-type')?.value;
            const format = document.getElementById('export-format')?.value;

            const result = await this.exportData({
                format,
                exportType
            });
            
            this.showExportSuccess(result);

        } catch (error) {
            this.showExportError(error);
        }
    }

    /**
     * 處理快速匯出
     * @param {string} period - 時間週期
     */
    async handleQuickExport(period) {
        try {
            const format = document.getElementById('export-format')?.value || 'csv';
            let result;

            switch (period) {
                case 'today':
                    result = await this.exportTodayRecords(format);
                    break;
                case 'week':
                    result = await this.exportWeekRecords(format);
                    break;
                case 'month':
                    result = await this.exportMonthRecords(format);
                    break;
                case 'all':
                    result = await this.exportAllSummaries(format);
                    break;
                default:
                    throw new Error('不支援的匯出週期');
            }

            this.showExportSuccess(result);

        } catch (error) {
            this.showExportError(error);
        }
    }
}

// 創建全局實例
const taskExport = new TaskExport();
export default taskExport;