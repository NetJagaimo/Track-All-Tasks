// 任務輸入功能測試腳本
import { invoke } from "@tauri-apps/api/core";

// 任務輸入測試類
export class TaskInputTest {
    constructor() {
        this.testData = [
            "設計 UI 介面",
            "實作 API 端點", 
            "撰寫單元測試",
            "修復登入錯誤",
            "優化資料庫查詢",
            "更新文件",
            "程式碼審查",
            "部署到測試環境"
        ];
    }

    // 建立測試資料
    async createTestData() {
        try {
            console.log("🧪 建立測試用的最近任務資料");
            
            for (const taskName of this.testData) {
                console.log(`   建立任務: ${taskName}`);
                await invoke("start_task", { name: taskName });
                await this.sleep(100); // 短暫等待
                await invoke("stop_task");
                await this.sleep(100);
            }
            
            console.log("✅ 測試資料建立完成");
            
        } catch (error) {
            console.error("❌ 建立測試資料失敗：", error);
        }
    }

    // 測試任務輸入功能
    async testTaskInput() {
        try {
            console.log("🧪 開始任務輸入功能測試");
            
            // 1. 檢查最近任務載入
            const recentTasks = await invoke("get_recent_task_names");
            console.log(`📋 載入了 ${recentTasks.length} 個最近任務:`, recentTasks);
            
            // 2. 測試輸入驗證
            console.log("\n📝 測試輸入驗證功能:");
            this.testInputValidation();
            
            // 3. 測試鍵盤導航
            console.log("\n⌨️ 測試鍵盤導航功能:");
            this.testKeyboardNavigation();
            
            // 4. 測試搜尋過濾
            console.log("\n🔍 測試搜尋過濾功能:");
            this.testSearchFiltering();
            
        } catch (error) {
            console.error("❌ 任務輸入測試失敗：", error);
        }
    }

    // 測試輸入驗證
    testInputValidation() {
        const app = window.taskApp;
        if (!app) {
            console.log("❌ 找不到應用程式實例");
            return;
        }

        console.log("   測試空輸入：", app.validateTaskName(""));
        console.log("   測試正常輸入：", app.validateTaskName("正常任務名稱"));
        console.log("   測試過長輸入：", app.validateTaskName("a".repeat(101)));
        console.log("   測試特殊字元：", app.validateTaskName("任務<>名稱"));
    }

    // 測試鍵盤導航
    testKeyboardNavigation() {
        console.log("   📌 手動測試步驟：");
        console.log("   1. 點擊任務輸入框");
        console.log("   2. 使用 ↑ ↓ 箭頭鍵導航最近任務");
        console.log("   3. 按 Enter 鍵選擇高亮的任務");
        console.log("   4. 按 Tab 鍵快速選擇第一個任務");
        console.log("   5. 按 ESC 鍵取消選擇");
    }

    // 測試搜尋過濾
    testSearchFiltering() {
        console.log("   📌 手動測試步驟：");
        console.log("   1. 在任務輸入框中輸入 '設計'");
        console.log("   2. 觀察下拉選單只顯示包含 '設計' 的任務");
        console.log("   3. 輸入 'API' 觀察過濾結果");
        console.log("   4. 清空輸入框觀察所有任務重新顯示");
        console.log("   5. 輸入不存在的關鍵字觀察 '沒有符合...' 訊息");
    }

    // 測試任務輸入完整流程
    async testCompleteFlow() {
        try {
            console.log("🚀 開始完整流程測試");
            
            const taskInput = document.getElementById('task-input');
            if (!taskInput) {
                console.log("❌ 找不到任務輸入框");
                return;
            }

            // 1. 模擬輸入
            console.log("📝 步驟 1: 模擬任務輸入");
            taskInput.focus();
            taskInput.value = "測試";
            taskInput.dispatchEvent(new Event('input'));
            
            await this.sleep(500);
            
            // 2. 檢查過濾結果
            const app = window.taskApp;
            if (app) {
                console.log(`🔍 過濾結果: ${app.filteredRecentTasks.length} 個匹配項目`);
                console.log("   匹配的任務:", app.filteredRecentTasks);
            }
            
            // 3. 模擬鍵盤導航
            console.log("⌨️ 步驟 2: 模擬鍵盤導航");
            taskInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            
            await this.sleep(300);
            
            if (app) {
                console.log(`📌 目前選擇索引: ${app.selectedTaskIndex}`);
            }
            
            console.log("✅ 完整流程測試完成");
            console.log("📋 請手動測試鍵盤操作和滑鼠點擊功能");
            
        } catch (error) {
            console.error("❌ 完整流程測試失敗：", error);
        }
    }

    // 清除測試資料
    async clearTestData() {
        try {
            console.log("🧹 清除測試資料...");
            // 這裡暫時不實作，因為需要新的 Tauri 命令
            console.log("⚠️ 清除功能需要實作額外的 Tauri 命令");
            
        } catch (error) {
            console.error("❌ 清除測試資料失敗：", error);
        }
    }

    // 工具方法：延遲
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 全局任務輸入測試控制
window.taskInputTest = new TaskInputTest();

// 提供全局測試函數
window.createTestData = () => window.taskInputTest.createTestData();
window.testTaskInput = () => window.taskInputTest.testTaskInput();
window.testCompleteFlow = () => window.taskInputTest.testCompleteFlow();
window.clearTestData = () => window.taskInputTest.clearTestData();

console.log("🚀 任務輸入測試已載入！");
console.log("使用方法：");
console.log("  createTestData() - 建立測試用的最近任務資料");
console.log("  testTaskInput() - 測試任務輸入功能");
console.log("  testCompleteFlow() - 測試完整操作流程");
console.log("  clearTestData() - 清除測試資料");