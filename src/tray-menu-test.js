// 托盤選單測試腳本
import { invoke } from "@tauri-apps/api/core";

// 托盤選單測試類
export class TrayMenuTest {
    constructor() {
        this.testRunning = false;
    }

    // 測試托盤選單動態變化
    async testTrayMenuUpdates() {
        if (this.testRunning) {
            console.log("⚠️ 測試已在進行中");
            return;
        }

        try {
            this.testRunning = true;
            console.log("🧪 開始托盤選單測試");
            console.log("📝 請觀察 macOS 狀態列中的應用程式右鍵選單變化");

            // 1. 檢查初始狀態
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            console.log(`📊 初始狀態: 計時中=${isActive}, 任務=${taskName || '無'}, 時間=${formattedTime}`);
            
            if (isActive) {
                console.log("📋 托盤選單應顯示: '⏹️ 停止計時' + '📱 顯示主視窗' + '❌ 結束應用程式'");
            } else {
                console.log("📋 托盤選單應顯示: '▶️ 快速開始計時' + '📱 顯示主視窗' + '❌ 結束應用程式'");
            }

            // 2. 如果沒有進行中的任務，開始一個測試任務
            if (!isActive) {
                console.log("▶️ 開始測試任務: '托盤選單測試'");
                await invoke("start_task", { name: "托盤選單測試" });
                
                console.log("⏰ 等待 2 秒讓托盤選單更新...");
                await this.sleep(2000);
                
                console.log("📋 托盤選單現在應該顯示: '⏹️ 停止計時' 選項");
                console.log("🔍 請右鍵點擊托盤圖示確認選單已更新");
            }

            // 3. 等待 5 秒讓使用者觀察
            console.log("⏱️ 測試進行中... 請試著右鍵點擊托盤圖示");
            console.log("   - 如果有進行中任務：應該看到 '⏹️ 停止計時' 選項");
            console.log("   - 如果沒有任務：應該看到 '▶️ 快速開始計時' 選項");
            
            let countdown = 10;
            const countdownInterval = setInterval(async () => {
                countdown--;
                const [currentActive, currentTask] = await invoke("get_current_status_formatted");
                console.log(`⏳ 剩餘 ${countdown} 秒 | 目前狀態: ${currentActive ? '計時中' : '待機'} ${currentTask ? `(${currentTask})` : ''}`);
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    await this.completeTrayMenuTest();
                }
            }, 1000);

        } catch (error) {
            console.error("❌ 托盤選單測試失敗：", error);
            this.testRunning = false;
        }
    }

    // 完成托盤選單測試
    async completeTrayMenuTest() {
        try {
            // 停止任何進行中的任務
            const [isActive] = await invoke("get_current_status_formatted");
            if (isActive) {
                console.log("⏹️ 停止測試任務");
                await invoke("stop_task");
                
                console.log("⏱️ 等待 2 秒讓托盤選單更新...");
                await this.sleep(2000);
                
                console.log("📋 托盤選單現在應該顯示: '▶️ 快速開始計時' 選項");
            }

            console.log("✅ 托盤選單測試完成");
            console.log("📝 測試結果應該是：");
            console.log("   1. 有任務時顯示 '⏹️ 停止計時' 選項");
            console.log("   2. 無任務時顯示 '▶️ 快速開始計時' 選項");
            console.log("   3. 始終顯示 '📱 顯示主視窗' 和 '❌ 結束應用程式' 選項");

        } catch (error) {
            console.error("❌ 完成測試時發生錯誤：", error);
        } finally {
            this.testRunning = false;
        }
    }

    // 測試托盤選單快速開始功能
    async testQuickStart() {
        try {
            console.log("🚀 測試托盤快速開始功能");
            
            // 確保目前沒有進行中的任務
            const [isActive] = await invoke("get_current_status_formatted");
            if (isActive) {
                console.log("⏹️ 先停止目前任務");
                await invoke("stop_task");
                await this.sleep(1000);
            }

            console.log("📋 現在右鍵點擊托盤圖示，應該看到 '▶️ 快速開始計時' 選項");
            console.log("🖱️ 請手動點擊該選項來測試功能");
            console.log("⏰ 系統應該會自動開始一個名為 '快速任務' 的計時任務");

            // 監控狀態變化
            let attempts = 0;
            const maxAttempts = 30; // 30 秒超時
            
            const checkInterval = setInterval(async () => {
                attempts++;
                const [currentActive, currentTask] = await invoke("get_current_status_formatted");
                
                if (currentActive && currentTask === "快速任務") {
                    clearInterval(checkInterval);
                    console.log("✅ 快速開始功能測試成功！");
                    console.log(`📊 目前任務: ${currentTask}`);
                    console.log("📋 托盤選單現在應該顯示 '⏹️ 停止計時' 選項");
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.log("⏱️ 測試超時，請手動確認功能是否正常");
                }
            }, 1000);

        } catch (error) {
            console.error("❌ 快速開始測試失敗：", error);
        }
    }

    // 檢查目前托盤選單狀態
    async checkTrayMenuStatus() {
        try {
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            
            console.log("🔍 目前托盤選單狀態檢查:");
            console.log(`   計時中: ${isActive ? '是' : '否'}`);
            console.log(`   任務名稱: ${taskName || '無'}`);
            console.log(`   目前時間: ${formattedTime}`);
            
            if (isActive) {
                console.log("📋 托盤選單應顯示:");
                console.log("   ⏹️ 停止計時");
                console.log("   📱 顯示主視窗");
                console.log("   ❌ 結束應用程式");
                console.log(`   托盤標題: ⏰ ${taskName} - ${formattedTime}`);
            } else {
                console.log("📋 托盤選單應顯示:");
                console.log("   ▶️ 快速開始計時");
                console.log("   📱 顯示主視窗");
                console.log("   ❌ 結束應用程式");
                console.log("   托盤標題: Track All Tasks - 待機中");
            }

        } catch (error) {
            console.error("❌ 狀態檢查失敗：", error);
        }
    }

    // 工具方法：延遲
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 全局托盤選單測試控制
window.trayMenuTest = new TrayMenuTest();

// 提供全局測試函數
window.testTrayMenu = () => window.trayMenuTest.testTrayMenuUpdates();
window.testQuickStart = () => window.trayMenuTest.testQuickStart();
window.checkTrayMenu = () => window.trayMenuTest.checkTrayMenuStatus();

console.log("🚀 托盤選單測試已載入！");
console.log("使用方法：");
console.log("  testTrayMenu() - 測試托盤選單動態更新");
console.log("  testQuickStart() - 測試快速開始功能");
console.log("  checkTrayMenu() - 檢查目前托盤選單狀態");