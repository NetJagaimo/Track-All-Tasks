// 托盤功能測試腳本
import { invoke } from "@tauri-apps/api/core";

// 托盤測試類
export class TrayTest {
    constructor() {
        this.testInterval = null;
    }

    // 測試托盤動態更新
    async testTrayUpdates() {
        try {
            console.log("🧪 開始托盤更新測試");
            console.log("📝 請觀察 macOS 狀態列中的應用程式圖示標題變化");

            // 1. 檢查初始狀態
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            console.log(`📊 初始狀態: 計時中=${isActive}, 任務=${taskName || '無'}, 時間=${formattedTime}`);

            // 2. 開始測試任務
            console.log("▶️ 開始測試任務: '托盤功能測試'");
            await invoke("start_task", { name: "托盤功能測試" });

            console.log("⏰ 托盤標題應該會顯示: '⏰ 托盤功能測試 - 00:XX'");
            console.log("⏱️ 每秒會自動更新時間，請觀察狀態列");

            // 3. 定期報告狀態（讓使用者知道測試進行中）
            let seconds = 0;
            this.testInterval = setInterval(async () => {
                seconds++;
                const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
                
                console.log(`📈 ${seconds}秒: 托盤應顯示 '⏰ ${taskName} - ${formattedTime}'`);
                
                if (seconds >= 10) {
                    console.log("⏹️ 10秒測試完成，停止任務");
                    await this.stopTrayTest();
                }
            }, 1000);

        } catch (error) {
            console.error("❌ 托盤測試失敗：", error);
        }
    }

    // 停止托盤測試
    async stopTrayTest() {
        try {
            if (this.testInterval) {
                clearInterval(this.testInterval);
                this.testInterval = null;
            }

            await invoke("stop_task");
            
            console.log("✅ 任務已停止");
            console.log("📊 托盤標題應該恢復為: 'Track All Tasks - 待機中'");
            
            // 顯示最終狀態
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            console.log(`📈 最終狀態: 計時中=${isActive}, 任務=${taskName || '無'}, 時間=${formattedTime}`);

        } catch (error) {
            console.error("❌ 停止測試失敗：", error);
        }
    }

    // 快速托盤狀態檢查
    async checkTrayStatus() {
        try {
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            
            console.log("🔍 目前托盤狀態檢查:");
            console.log(`   計時中: ${isActive ? '是' : '否'}`);
            console.log(`   任務名稱: ${taskName || '無'}`);
            console.log(`   目前時間: ${formattedTime}`);
            
            if (isActive) {
                console.log(`   預期托盤標題: ⏰ ${taskName} - ${formattedTime}`);
            } else {
                console.log(`   預期托盤標題: Track All Tasks - 待機中`);
            }

        } catch (error) {
            console.error("❌ 狀態檢查失敗：", error);
        }
    }

    // 測試托盤標題長度限制
    async testLongTaskName() {
        try {
            console.log("📏 測試長任務名稱的托盤顯示");
            
            const longTaskName = "這是一個很長很長的任務名稱用來測試托盤標題的長度限制功能";
            console.log(`📝 開始長名稱任務: ${longTaskName}`);
            
            await invoke("start_task", { name: longTaskName });
            
            console.log("⏰ 托盤標題應該會自動截斷並加上 '...'");
            console.log("   預期顯示: '⏰ 這是一個很長很長的任務名稱用來測... - 00:XX'");
            
            // 等待 5 秒後停止
            setTimeout(async () => {
                await invoke("stop_task");
                console.log("✅ 長名稱測試完成");
            }, 5000);

        } catch (error) {
            console.error("❌ 長名稱測試失敗：", error);
        }
    }
}

// 全局托盤測試控制
window.trayTest = new TrayTest();

// 提供全局測試函數
window.testTray = () => window.trayTest.testTrayUpdates();
window.stopTrayTest = () => window.trayTest.stopTrayTest();
window.checkTray = () => window.trayTest.checkTrayStatus();
window.testLongName = () => window.trayTest.testLongTaskName();

console.log("🚀 托盤測試已載入！");
console.log("使用方法：");
console.log("  testTray() - 開始托盤動態更新測試（10秒）");
console.log("  stopTrayTest() - 手動停止測試");
console.log("  checkTray() - 檢查目前托盤狀態");
console.log("  testLongName() - 測試長任務名稱顯示");