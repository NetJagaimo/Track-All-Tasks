// 全域快捷鍵管理
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export class GlobalShortcutManager {
    constructor() {
        this.registeredShortcuts = [];
        this.window = getCurrentWebviewWindow();
    }

    // 初始化並註冊所有快捷鍵
    async initialize() {
        try {
            console.log("🔑 初始化全域快捷鍵...");
            
            // 註冊快捷鍵：Ctrl+Shift+T - 切換計時狀態
            await this.registerShortcut('Ctrl+Shift+T', async () => {
                await this.handleToggleTimer();
            });

            // 註冊快捷鍵：Ctrl+Shift+S - 顯示主視窗
            await this.registerShortcut('Ctrl+Shift+S', async () => {
                await this.handleShowWindow();
            });

            // 註冊快捷鍵：Ctrl+Shift+Q - 快速開始任務
            await this.registerShortcut('Ctrl+Shift+Q', async () => {
                await this.handleQuickStart();
            });

            console.log("✅ 全域快捷鍵註冊完成:");
            console.log("   Ctrl+Shift+T - 切換計時狀態（開始/停止）");
            console.log("   Ctrl+Shift+S - 顯示主視窗");
            console.log("   Ctrl+Shift+Q - 快速開始新任務");

        } catch (error) {
            console.error("❌ 全域快捷鍵初始化失敗:", error);
        }
    }

    // 註冊單個快捷鍵
    async registerShortcut(shortcut, handler) {
        try {
            await register(shortcut, (event) => {
                if (event.state === 'Pressed') {
                    console.log(`🔑 快捷鍵觸發: ${shortcut}`);
                    handler();
                }
            });
            
            this.registeredShortcuts.push(shortcut);
            console.log(`✅ 註冊快捷鍵: ${shortcut}`);
            
        } catch (error) {
            console.error(`❌ 註冊快捷鍵失敗 ${shortcut}:`, error);
        }
    }

    // 處理切換計時狀態
    async handleToggleTimer() {
        try {
            console.log("🔄 處理切換計時狀態快捷鍵");
            
            // 檢查目前狀態
            const hasActiveTask = await invoke('has_active_task');
            
            if (hasActiveTask) {
                // 停止目前任務
                await invoke('stop_task');
                console.log("⏹️ 透過快捷鍵停止任務");
            } else {
                // 開始快速任務
                const taskName = "快捷鍵任務";
                await invoke('start_task', { name: taskName });
                console.log(`▶️ 透過快捷鍵開始任務: ${taskName}`);
            }
            
            // 更新 UI（如果應用程式實例存在）
            if (window.taskApp) {
                await window.taskApp.updateDisplay();
            }
            
        } catch (error) {
            console.error("❌ 切換計時狀態失敗:", error);
        }
    }

    // 處理顯示主視窗
    async handleShowWindow() {
        try {
            console.log("📱 處理顯示主視窗快捷鍵");
            
            await this.window.show();
            await this.window.setFocus();
            
            // 短暫置頂確保獲得焦點
            await this.window.setAlwaysOnTop(true);
            setTimeout(async () => {
                try {
                    await this.window.setAlwaysOnTop(false);
                } catch (e) {
                    console.warn("無法取消置頂:", e);
                }
            }, 100);
            
            console.log("✅ 主視窗已顯示並獲得焦點");
            
        } catch (error) {
            console.error("❌ 顯示主視窗失敗:", error);
        }
    }

    // 處理快速開始任務
    async handleQuickStart() {
        try {
            console.log("⚡ 處理快速開始任務快捷鍵");
            
            const taskName = "快速任務";
            await invoke('start_task', { name: taskName });
            console.log(`▶️ 透過快捷鍵快速開始任務: ${taskName}`);
            
            // 更新 UI（如果應用程式實例存在）
            if (window.taskApp) {
                await window.taskApp.updateDisplay();
            }
            
        } catch (error) {
            console.error("❌ 快速開始任務失敗:", error);
        }
    }

    // 取消註冊所有快捷鍵
    async unregisterAll() {
        try {
            console.log("🗑️ 取消註冊所有全域快捷鍵...");
            
            for (const shortcut of this.registeredShortcuts) {
                await unregister(shortcut);
                console.log(`❌ 取消註冊快捷鍵: ${shortcut}`);
            }
            
            this.registeredShortcuts = [];
            console.log("✅ 所有快捷鍵已取消註冊");
            
        } catch (error) {
            console.error("❌ 取消註冊快捷鍵失敗:", error);
        }
    }

    // 取得已註冊的快捷鍵列表
    getRegisteredShortcuts() {
        return [...this.registeredShortcuts];
    }

    // 檢查快捷鍵是否已註冊
    isShortcutRegistered(shortcut) {
        return this.registeredShortcuts.includes(shortcut);
    }
}

// 全域實例
const globalShortcutManager = new GlobalShortcutManager();

// 導出給其他模組使用
export default globalShortcutManager;

// 自動初始化（在頁面載入後）
document.addEventListener('DOMContentLoaded', async () => {
    // 延遲一點初始化，確保 Tauri 完全載入
    setTimeout(async () => {
        await globalShortcutManager.initialize();
    }, 1000);
});

// 在頁面卸載時清理
window.addEventListener('beforeunload', async () => {
    await globalShortcutManager.unregisterAll();
});

console.log("🚀 全域快捷鍵模組已載入");