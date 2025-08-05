import { invoke } from "@tauri-apps/api/core";

/**
 * 手動補登任務管理類
 * 提供手動新增任務記錄的功能
 */
export class ManualTaskEntry {
    constructor() {
        this.isSubmitting = false;
        this.currentForm = null;
    }

    /**
     * 手動補登任務
     * @param {Object} params - 補登參數
     * @param {string} params.name - 任務名稱
     * @param {number} params.startTime - 開始時間（Unix 時間戳）
     * @param {number} params.endTime - 結束時間（Unix 時間戳）
     * @param {string} [params.description] - 任務描述（可選）
     * @returns {Promise<Object>} 補登結果
     */
    async addManualTask(params) {
        if (this.isSubmitting) {
            throw new Error('正在提交中，請稍候...');
        }

        this.isSubmitting = true;

        try {
            const manualParams = {
                name: params.name,
                start_time: params.startTime,
                end_time: params.endTime,
                description: params.description || null,
            };

            console.log('📝 開始手動補登任務：', manualParams);

            const result = await invoke('add_manual_task', { params: manualParams });
            
            console.log('✅ 補登完成：', result);
            return result;

        } catch (error) {
            console.error('❌ 補登失敗：', error);
            throw error;
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * 顯示手動補登表單
     * @param {Function} onSuccess - 成功回調函數
     * @param {Function} onCancel - 取消回調函數
     */
    showManualEntryForm(onSuccess, onCancel) {
        // 創建手動補登表單模態視窗
        const modal = document.createElement('div');
        modal.className = 'manual-entry-modal';
        modal.innerHTML = this.createManualEntryFormHTML();

        // 添加到 DOM
        document.body.appendChild(modal);
        this.currentForm = modal;

        // 綁定事件
        this.bindManualEntryFormEvents(modal, onSuccess, onCancel);

        console.log('📝 顯示手動補登表單');
    }

    /**
     * 創建手動補登表單 HTML
     * @returns {string} 表單 HTML
     */
    createManualEntryFormHTML() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentTime = today.toTimeString().slice(0, 5);
        
        // 預設結束時間為當前時間後1小時
        const oneHourLater = new Date(today.getTime() + 60 * 60 * 1000);
        const oneHourLaterTime = oneHourLater.toTimeString().slice(0, 5);

        return `
            <div class="modal-overlay">
                <div class="modal-content manual-entry-modal-content">
                    <div class="modal-header">
                        <h3>📝 手動補登任務</h3>
                        <button class="modal-close" id="manual-entry-modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <form class="manual-entry-form" id="manual-entry-form">
                            <div class="form-section">
                                <h4>基本資訊</h4>
                                <div class="form-field">
                                    <label for="manual-task-name">任務名稱 *</label>
                                    <input 
                                        type="text" 
                                        id="manual-task-name" 
                                        placeholder="輸入任務名稱..."
                                        maxlength="100"
                                        required
                                        autocomplete="off"
                                    />
                                </div>
                                
                                <div class="form-field">
                                    <label for="manual-task-description">任務描述</label>
                                    <textarea 
                                        id="manual-task-description" 
                                        placeholder="輸入任務描述（可選）..."
                                        maxlength="500"
                                        rows="3"
                                    ></textarea>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>時間設定</h4>
                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="manual-start-date">開始日期 *</label>
                                        <input 
                                            type="date" 
                                            id="manual-start-date"
                                            value="${todayStr}"
                                            required
                                        />
                                    </div>
                                    <div class="form-field">
                                        <label for="manual-start-time">開始時間 *</label>
                                        <input 
                                            type="time" 
                                            id="manual-start-time"
                                            value="${currentTime}"
                                            step="60"
                                            required
                                        />
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="manual-end-date">結束日期 *</label>
                                        <input 
                                            type="date" 
                                            id="manual-end-date"
                                            value="${todayStr}"
                                            required
                                        />
                                    </div>
                                    <div class="form-field">
                                        <label for="manual-end-time">結束時間 *</label>
                                        <input 
                                            type="time" 
                                            id="manual-end-time"
                                            value="${oneHourLaterTime}"
                                            step="60"
                                            required
                                        />
                                    </div>
                                </div>

                                <div class="form-info">
                                    <div class="info-item" id="manual-duration-info">
                                        <span class="info-label">預計持續時間：</span>
                                        <span class="info-value" id="manual-duration-display">01:00:00</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">最大持續時間：</span>
                                        <span class="info-value">24小時</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>快速設定</h4>
                                <div class="quick-duration-buttons">
                                    <button type="button" class="quick-duration-btn" data-minutes="30">30分鐘</button>
                                    <button type="button" class="quick-duration-btn" data-minutes="60">1小時</button>
                                    <button type="button" class="quick-duration-btn" data-minutes="90">1.5小時</button>
                                    <button type="button" class="quick-duration-btn" data-minutes="120">2小時</button>
                                    <button type="button" class="quick-duration-btn" data-minutes="240">4小時</button>
                                    <button type="button" class="quick-duration-btn" data-minutes="480">8小時</button>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="manual-entry-cancel-btn">取消</button>
                                <button type="submit" class="btn btn-primary" id="manual-entry-submit-btn">
                                    <span class="btn-text">新增任務</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 綁定手動補登表單事件
     * @param {HTMLElement} modal - 模態視窗元素
     * @param {Function} onSuccess - 成功回調
     * @param {Function} onCancel - 取消回調
     */
    bindManualEntryFormEvents(modal, onSuccess, onCancel) {
        const form = modal.querySelector('#manual-entry-form');
        const closeBtn = modal.querySelector('#manual-entry-modal-close');
        const cancelBtn = modal.querySelector('#manual-entry-cancel-btn');
        const submitBtn = modal.querySelector('#manual-entry-submit-btn');

        // 時間相關元素
        const startDateInput = modal.querySelector('#manual-start-date');
        const startTimeInput = modal.querySelector('#manual-start-time');
        const endDateInput = modal.querySelector('#manual-end-date');
        const endTimeInput = modal.querySelector('#manual-end-time');
        const durationDisplay = modal.querySelector('#manual-duration-display');
        const quickDurationBtns = modal.querySelectorAll('.quick-duration-btn');

        // 關閉模態視窗
        const closeModal = () => {
            document.body.removeChild(modal);
            this.currentForm = null;
        };

        // 計算並更新持續時間顯示
        const updateDurationDisplay = () => {
            const startDate = startDateInput.value;
            const startTime = startTimeInput.value;
            const endDate = endDateInput.value;
            const endTime = endTimeInput.value;

            if (startDate && startTime && endDate && endTime) {
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);
                
                if (endDateTime > startDateTime) {
                    const durationMs = endDateTime - startDateTime;
                    const durationSeconds = Math.floor(durationMs / 1000);
                    durationDisplay.textContent = this.formatDuration(durationSeconds);
                    durationDisplay.style.color = 'var(--text-primary)';

                    // 檢查是否超過24小時
                    if (durationSeconds > 86400) {
                        durationDisplay.style.color = 'var(--danger-color)';
                        durationDisplay.textContent += ' (超過24小時限制)';
                    }
                } else {
                    durationDisplay.textContent = '無效時間';
                    durationDisplay.style.color = 'var(--danger-color)';
                }
            } else {
                durationDisplay.textContent = '--:--:--';
                durationDisplay.style.color = 'var(--text-muted)';
            }
        };

        // 綁定時間變更事件
        [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach(input => {
            input.addEventListener('change', updateDurationDisplay);
        });

        // 快速設定時間按鈕
        quickDurationBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                const startDate = startDateInput.value;
                const startTime = startTimeInput.value;

                if (startDate && startTime) {
                    const startDateTime = new Date(`${startDate}T${startTime}`);
                    const endDateTime = new Date(startDateTime.getTime() + minutes * 60 * 1000);
                    
                    endDateInput.value = endDateTime.toISOString().split('T')[0];
                    endTimeInput.value = endDateTime.toTimeString().slice(0, 5);
                    
                    updateDurationDisplay();
                }
            });
        });

        // 初始計算持續時間
        updateDurationDisplay();

        // 關閉按鈕
        closeBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        // 取消按鈕
        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        // 點擊外部關閉
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                if (onCancel) onCancel();
            }
        });

        // ESC 鍵關閉
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // 表單提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (this.isSubmitting) {
                return;
            }

            try {
                // 設定提交狀態
                this.isSubmitting = true;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="btn-text">新增中...</span>';
                form.classList.add('form-loading');

                // 收集表單資料
                const taskName = modal.querySelector('#manual-task-name').value.trim();
                const taskDescription = modal.querySelector('#manual-task-description').value.trim();
                const startDate = startDateInput.value;
                const startTime = startTimeInput.value;
                const endDate = endDateInput.value;
                const endTime = endTimeInput.value;

                // 驗證表單
                if (!taskName) {
                    throw new Error('任務名稱不能為空');
                }

                if (!startDate || !startTime || !endDate || !endTime) {
                    throw new Error('請完整填寫開始和結束時間');
                }

                // 計算時間戳
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);

                if (endDateTime <= startDateTime) {
                    throw new Error('結束時間必須晚於開始時間');
                }

                const durationSeconds = Math.floor((endDateTime - startDateTime) / 1000);
                if (durationSeconds > 86400) {
                    throw new Error('任務持續時間不能超過24小時');
                }

                // 準備參數
                const params = {
                    name: taskName,
                    startTime: Math.floor(startDateTime.getTime() / 1000),
                    endTime: Math.floor(endDateTime.getTime() / 1000),
                    description: taskDescription || undefined,
                };

                // 執行補登
                const result = await this.addManualTask(params);
                this.showSuccessMessage(result.message);
                closeModal();
                if (onSuccess) onSuccess(result);

            } catch (error) {
                this.showErrorMessage(`補登失敗：${error.message || error}`);
            } finally {
                // 重置提交狀態
                this.isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-text">新增任務</span>';
                form.classList.remove('form-loading');
            }
        });
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

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 顯示成功訊息
     * @param {string} message - 訊息內容
     */
    showSuccessMessage(message) {
        // 簡單的通知實作，之後可以改為更美觀的通知
        alert(`✅ ${message}`);
    }

    /**
     * 顯示錯誤訊息
     * @param {string} message - 訊息內容
     */
    showErrorMessage(message) {
        // 簡單的通知實作，之後可以改為更美觀的通知
        alert(`❌ ${message}`);
    }

    /**
     * 獲取最近使用的任務名稱以供自動完成
     * @returns {Promise<Array<string>>} 最近任務名稱列表
     */
    async getRecentTaskNames() {
        try {
            return await invoke('get_recent_task_names');
        } catch (error) {
            console.warn('無法獲取最近任務名稱：', error);
            return [];
        }
    }
}

// 創建全局實例
const manualTaskEntry = new ManualTaskEntry();
export default manualTaskEntry;