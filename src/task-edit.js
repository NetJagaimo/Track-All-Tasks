import { invoke } from "@tauri-apps/api/core";

/**
 * 任務編輯管理類
 * 提供任務記錄的編輯和刪除功能
 */
export class TaskEdit {
    constructor() {
        this.isEditing = false;
        this.currentEditingTask = null;
    }

    /**
     * 編輯任務記錄
     * @param {Object} params - 編輯參數
     * @param {string} params.taskId - 任務 ID
     * @param {string} [params.newName] - 新任務名稱
     * @param {number} [params.newStartTime] - 新開始時間（Unix 時間戳）
     * @param {number} [params.newEndTime] - 新結束時間（Unix 時間戳）
     * @returns {Promise<Object>} 編輯結果
     */
    async editTask(params) {
        if (this.isEditing) {
            throw new Error('正在編輯中，請稍候...');
        }

        this.isEditing = true;

        try {
            const editParams = {
                task_id: params.taskId,
                new_name: params.newName || null,
                new_start_time: params.newStartTime || null,
                new_end_time: params.newEndTime || null,
            };

            console.log('✏️ 開始編輯任務：', editParams);

            const result = await invoke('edit_task', { params: editParams });
            
            console.log('✅ 編輯完成：', result);
            return result;

        } catch (error) {
            console.error('❌ 編輯失敗：', error);
            throw error;
        } finally {
            this.isEditing = false;
        }
    }

    /**
     * 刪除任務記錄
     * @param {string} taskId - 任務 ID
     * @returns {Promise<string>} 刪除結果訊息
     */
    async deleteTask(taskId) {
        try {
            console.log('🗑️ 刪除任務：', taskId);

            const result = await invoke('delete_task', { taskId });
            
            console.log('✅ 刪除完成：', result);
            return result;

        } catch (error) {
            console.error('❌ 刪除失敗：', error);
            throw error;
        }
    }

    /**
     * 編輯任務名稱
     * @param {string} taskId - 任務 ID
     * @param {string} newName - 新名稱
     * @returns {Promise<Object>} 編輯結果
     */
    async editTaskName(taskId, newName) {
        return await this.editTask({
            taskId,
            newName
        });
    }

    /**
     * 編輯任務時間
     * @param {string} taskId - 任務 ID
     * @param {number} [newStartTime] - 新開始時間
     * @param {number} [newEndTime] - 新結束時間
     * @returns {Promise<Object>} 編輯結果
     */
    async editTaskTime(taskId, newStartTime, newEndTime) {
        return await this.editTask({
            taskId,
            newStartTime,
            newEndTime
        });
    }

    /**
     * 顯示任務編輯表單
     * @param {Object} task - 要編輯的任務記錄
     * @param {Function} onSuccess - 成功回調函數
     * @param {Function} onCancel - 取消回調函數
     */
    showEditForm(task, onSuccess, onCancel) {
        this.currentEditingTask = task;

        // 創建編輯表單模態視窗
        const modal = document.createElement('div');
        modal.className = 'task-edit-modal';
        modal.innerHTML = this.createEditFormHTML(task);

        // 添加到 DOM
        document.body.appendChild(modal);

        // 綁定事件
        this.bindEditFormEvents(modal, task, onSuccess, onCancel);

        console.log('📝 顯示任務編輯表單：', task.name);
    }

    /**
     * 創建編輯表單 HTML
     * @param {Object} task - 任務記錄
     * @returns {string} 表單 HTML
     */
    createEditFormHTML(task) {
        const startTime = new Date(task.start_time * 1000);
        const endTime = task.end_time ? new Date(task.end_time * 1000) : null;

        return `
            <div class="modal-overlay">
                <div class="modal-content task-edit-modal-content">
                    <div class="modal-header">
                        <h3>✏️ 編輯任務記錄</h3>
                        <button class="modal-close" id="edit-modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <form class="task-edit-form" id="task-edit-form">
                            <div class="form-section">
                                <h4>基本資訊</h4>
                                <div class="form-field">
                                    <label for="edit-task-name">任務名稱</label>
                                    <input 
                                        type="text" 
                                        id="edit-task-name" 
                                        value="${this.escapeHtml(task.name)}"
                                        maxlength="100"
                                        required
                                    />
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>時間設定</h4>
                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="edit-start-date">開始日期</label>
                                        <input 
                                            type="date" 
                                            id="edit-start-date"
                                            value="${startTime.toISOString().split('T')[0]}"
                                            required
                                        />
                                    </div>
                                    <div class="form-field">
                                        <label for="edit-start-time">開始時間</label>
                                        <input 
                                            type="time" 
                                            id="edit-start-time"
                                            value="${startTime.toTimeString().slice(0, 5)}"
                                            step="60"
                                            required
                                        />
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="edit-end-date">結束日期</label>
                                        <input 
                                            type="date" 
                                            id="edit-end-date"
                                            value="${endTime ? endTime.toISOString().split('T')[0] : ''}"
                                            ${!endTime ? '' : 'required'}
                                        />
                                    </div>
                                    <div class="form-field">
                                        <label for="edit-end-time">結束時間</label>
                                        <input 
                                            type="time" 
                                            id="edit-end-time"
                                            value="${endTime ? endTime.toTimeString().slice(0, 5) : ''}"
                                            step="60"
                                            ${!endTime ? '' : 'required'}
                                        />
                                    </div>
                                </div>

                                <div class="form-info">
                                    <div class="info-item">
                                        <span class="info-label">原始持續時間：</span>
                                        <span class="info-value">${this.formatDuration(task.duration_seconds || 0)}</span>
                                    </div>
                                    <div class="info-item" id="calculated-duration">
                                        <span class="info-label">計算持續時間：</span>
                                        <span class="info-value" id="duration-display">--:--</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="edit-cancel-btn">取消</button>
                                <button type="button" class="btn btn-danger" id="edit-delete-btn">刪除</button>
                                <button type="submit" class="btn btn-primary" id="edit-save-btn">儲存變更</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 綁定編輯表單事件
     * @param {HTMLElement} modal - 模態視窗元素
     * @param {Object} task - 任務記錄
     * @param {Function} onSuccess - 成功回調
     * @param {Function} onCancel - 取消回調
     */
    bindEditFormEvents(modal, task, onSuccess, onCancel) {
        const form = modal.querySelector('#task-edit-form');
        const closeBtn = modal.querySelector('#edit-modal-close');
        const cancelBtn = modal.querySelector('#edit-cancel-btn');
        const deleteBtn = modal.querySelector('#edit-delete-btn');
        const saveBtn = modal.querySelector('#edit-save-btn');

        // 時間相關元素
        const startDateInput = modal.querySelector('#edit-start-date');
        const startTimeInput = modal.querySelector('#edit-start-time');
        const endDateInput = modal.querySelector('#edit-end-date');
        const endTimeInput = modal.querySelector('#edit-end-time');
        const durationDisplay = modal.querySelector('#duration-display');

        // 關閉模態視窗
        const closeModal = () => {
            document.body.removeChild(modal);
            this.currentEditingTask = null;
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
                    const durationSeconds = Math.floor((endDateTime - startDateTime) / 1000);
                    durationDisplay.textContent = this.formatDuration(durationSeconds);
                    durationDisplay.style.color = 'var(--text-primary)';
                } else {
                    durationDisplay.textContent = '無效時間';
                    durationDisplay.style.color = 'var(--danger-color)';
                }
            } else {
                durationDisplay.textContent = '--:--';
                durationDisplay.style.color = 'var(--text-muted)';
            }
        };

        // 綁定時間變更事件
        [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach(input => {
            input.addEventListener('change', updateDurationDisplay);
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

        // 刪除按鈕
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`確定要刪除任務「${task.name}」嗎？此操作無法復原。`)) {
                try {
                    const result = await this.deleteTask(task.id);
                    this.showSuccessMessage(result);
                    closeModal();
                    if (onSuccess) onSuccess('delete', result);
                } catch (error) {
                    this.showErrorMessage(`刪除失敗：${error.message || error}`);
                }
            }
        });

        // 表單提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(form);
                const taskName = modal.querySelector('#edit-task-name').value.trim();
                const startDate = startDateInput.value;
                const startTime = startTimeInput.value;
                const endDate = endDateInput.value;
                const endTime = endTimeInput.value;

                // 驗證表單
                if (!taskName) {
                    throw new Error('任務名稱不能為空');
                }

                if (!startDate || !startTime) {
                    throw new Error('開始日期和時間不能為空');
                }

                // 計算時間戳
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const newStartTime = Math.floor(startDateTime.getTime() / 1000);
                
                let newEndTime = null;
                if (endDate && endTime) {
                    const endDateTime = new Date(`${endDate}T${endTime}`);
                    newEndTime = Math.floor(endDateTime.getTime() / 1000);
                    
                    if (newEndTime <= newStartTime) {
                        throw new Error('結束時間必須晚於開始時間');
                    }
                }

                // 準備編輯參數
                const editParams = {
                    taskId: task.id,
                    newName: taskName !== task.name ? taskName : null,
                    newStartTime: newStartTime !== task.start_time ? newStartTime : null,
                    newEndTime: newEndTime !== task.end_time ? newEndTime : null,
                };

                // 檢查是否有變更
                if (!editParams.newName && !editParams.newStartTime && !editParams.newEndTime) {
                    throw new Error('沒有任何變更需要儲存');
                }

                // 執行編輯
                const result = await this.editTask(editParams);
                this.showSuccessMessage(result.message);
                closeModal();
                if (onSuccess) onSuccess('edit', result);

            } catch (error) {
                this.showErrorMessage(`儲存失敗：${error.message || error}`);
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

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
     * 為任務記錄列表添加編輯按鈕
     * @param {string} containerId - 容器 DOM ID
     */
    addEditButtonsToRecords(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const recordItems = container.querySelectorAll('.task-record-item');
        recordItems.forEach(item => {
            const taskId = item.dataset.recordId;
            if (!taskId) return;

            // 檢查是否已經有編輯按鈕
            if (item.querySelector('.edit-task-btn')) return;

            // 創建編輯按鈕
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-task-btn';
            editBtn.innerHTML = '✏️';
            editBtn.title = '編輯任務';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.handleEditClick(taskId);
            };

            // 添加到記錄項目
            const recordDetails = item.querySelector('.record-details');
            if (recordDetails) {
                recordDetails.appendChild(editBtn);
            }
        });
    }

    /**
     * 處理編輯按鈕點擊
     * @param {string} taskId - 任務 ID
     */
    async handleEditClick(taskId) {
        try {
            // 獲取任務詳細資訊
            const taskRecords = await invoke('get_task_history');
            const task = taskRecords.find(t => t.id === taskId);
            
            if (!task) {
                throw new Error('找不到指定的任務記錄');
            }

            this.showEditForm(task, (action, result) => {
                // 成功後重新載入數據
                console.log(`任務${action === 'edit' ? '編輯' : '刪除'}成功`);
                // 觸發頁面重新載入統計數據
                window.location.reload();
            });

        } catch (error) {
            this.showErrorMessage(`載入任務資料失敗：${error.message || error}`);
        }
    }
}

// 創建全局實例
const taskEdit = new TaskEdit();
export default taskEdit;