// 全域快捷鍵測試腳本
import { invoke } from "@tauri-apps/api/core";

// 快捷鍵測試類
export class ShortcutTest {
    constructor() {
        this.monitoringActive = false;
        this.monitorInterval = null;
    }

    // 開始監控快捷鍵效果
    startMonitoring() {
        if (this.monitoringActive) {
            console.log("⚠️ 監控已在進行中");
            return;
        }

        console.log("🎯 開始監控全域快捷鍵效果");
        console.log("📝 註冊的快捷鍵：");
        console.log("   Ctrl+Shift+T - 切換計時狀態（開始/停止）");
        console.log("   Ctrl+Shift+S - 顯示主視窗");
        console.log("   Ctrl+Shift+Q - 快速開始新任務");
        console.log("");
        console.log("🧪 測試步驟：");
        console.log("   1. 將視窗最小化或切換到其他應用程式");
        console.log("   2. 按 Ctrl+Shift+T 測試切換計時功能");
        console.log("   3. 按 Ctrl+Shift+S 測試顯示視窗功能");
        console.log("   4. 按 Ctrl+Shift+Q 測試快速開始功能");
        console.log("");

        this.monitoringActive = true;
        let changeCount = 0;

        this.monitorInterval = setInterval(async () => {
            try {
                const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
                const currentState = `${isActive ? '計時中' : '待機'} | ${taskName || '無任務'} | ${formattedTime}`;
                
                // 只在狀態改變時顯示
                if (this.lastState !== currentState) {
                    changeCount++;
                    console.log(`📊 [${changeCount}] 狀態變更: ${currentState}`);
                    
                    if (isActive) {
                        console.log(`   ⏰ 任務「${taskName}」正在計時`);
                        console.log(`   🔑 按 Ctrl+Shift+T 可停止計時`);
                    } else {
                        console.log(`   ⏸️ 目前待機中`);
                        console.log(`   🔑 按 Ctrl+Shift+T 開始快捷鍵任務`);
                        console.log(`   🔑 按 Ctrl+Shift+Q 開始快速任務`);
                    }
                    
                    this.lastState = currentState;
                }
                
            } catch (error) {
                console.error("❌ 監控狀態失敗：", error);
            }
        }, 1000);

        console.log("⏱️ 監控已開始，按任意快捷鍵測試功能...");
    }

    // 停止監控
    stopMonitoring() {
        if (!this.monitoringActive) {
            console.log("⚠️ 監控未在進行中");
            return;
        }

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        this.monitoringActive = false;
        console.log("✅ 快捷鍵監控已停止");
    }

    // 檢查目前狀態
    async checkCurrentState() {
        try {
            const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
            
            console.log("🔍 目前應用程式狀態：");
            console.log(`   計時狀態: ${isActive ? '進行中' : '待機'}`);
            console.log(`   任務名稱: ${taskName || '無'}`);
            console.log(`   計時時間: ${formattedTime}`);
            
            console.log("\n🔑 可用的快捷鍵操作：");
            if (isActive) {
                console.log("   Ctrl+Shift+T - 停止目前任務");
            } else {
                console.log("   Ctrl+Shift+T - 開始快捷鍵任務");
            }
            console.log("   Ctrl+Shift+S - 顯示主視窗");
            console.log("   Ctrl+Shift+Q - 快速開始新任務");

        } catch (error) {
            console.error("❌ 檢查狀態失敗：", error);
        }
    }

    // 測試快捷鍵功能說明
    showTestInstructions() {
        console.log("📖 全域快捷鍵測試說明");
        console.log("=" .repeat(50));
        console.log("");
        console.log("🎯 測試目標：");
        console.log("   驗證全域快捷鍵在任何應用程式中都能正常工作");
        console.log("");
        console.log("🔑 快捷鍵列表：");
        console.log("   Ctrl+Shift+T - 智慧切換計時（停止進行中任務或開始新任務）");
        console.log("   Ctrl+Shift+S - 顯示並聚焦主視窗");
        console.log("   Ctrl+Shift+Q - 快速開始預設任務");
        console.log("");
        console.log("📋 測試步驟：");
        console.log("   1. 先執行 startMonitoring() 開始監控");
        console.log("   2. 最小化或切換到其他應用程式");
        console.log("   3. 依序測試各個快捷鍵");
        console.log("   4. 觀察控制台輸出確認功能正常");
        console.log("   5. 執行 stopMonitoring() 結束測試");
        console.log("");
        console.log("✨ 預期結果：");
        console.log("   - 快捷鍵在任何應用程式中都能觸發");
        console.log("   - 托盤標題會即時更新");
        console.log("   - 主視窗能正確顯示並獲得焦點");
        console.log("   - 狀態變更會在控制台顯示");
    }

    // 快速示範所有快捷鍵
    async demonstrateShortcuts() {
        console.log("🎬 快捷鍵功能示範");
        
        try {
            // 檢查初始狀態
            await this.checkCurrentState();
            
            console.log("\n📢 示範提示：");
            console.log("   請手動按下各個快捷鍵來測試功能");
            console.log("   建議先將視窗最小化再測試全域快捷鍵效果");
            
            // 開始監控
            this.startMonitoring();
            
        } catch (error) {
            console.error("❌ 示範失敗：", error);
        }
    }
}

// 全局快捷鍵測試控制
window.shortcutTest = new ShortcutTest();

// 提供全局測試函數
window.startShortcutMonitoring = () => window.shortcutTest.startMonitoring();
window.stopShortcutMonitoring = () => window.shortcutTest.stopMonitoring();
window.checkShortcutState = () => window.shortcutTest.checkCurrentState();
window.showShortcutInstructions = () => window.shortcutTest.showTestInstructions();
window.demonstrateShortcuts = () => window.shortcutTest.demonstrateShortcuts();

console.log("🚀 全域快捷鍵測試已載入！");
console.log("使用方法：");
console.log("  showShortcutInstructions() - 顯示測試說明");
console.log("  demonstrateShortcuts() - 開始快捷鍵示範");
console.log("  startShortcutMonitoring() - 開始監控快捷鍵效果");
console.log("  stopShortcutMonitoring() - 停止監控");
console.log("  checkShortcutState() - 檢查目前狀態");