// 計時器功能測試文件
import { invoke } from "@tauri-apps/api/core";

// 測試計時器功能
export class TimerTest {
    constructor() {
        this.testInterval = null;
    }

    // 開始計時測試
    async startTimerTest() {
        try {
            console.log("🧪 開始計時器測試");
            
            // 1. 測試開始任務
            console.log("📝 開始任務：測試任務");
            await invoke("start_task", { name: "測試任務" });
            
            // 2. 測試取得目前狀態
            let status = await invoke("get_current_status_formatted");
            console.log("⏰ 目前狀態：", status);
            
            // 3. 開始即時更新測試（每秒更新一次）
            this.testInterval = setInterval(async () => {
                try {
                    const [isActive, taskName, formattedTime] = await invoke("get_current_status_formatted");
                    const todayStats = await invoke("get_today_stats");
                    
                    console.log(`⏲️  進行中：${isActive ? '是' : '否'}`);
                    console.log(`📋 任務名稱：${taskName || '無'}`);
                    console.log(`⏱️  目前時間：${formattedTime}`);
                    console.log(`📊 今日統計：${todayStats[0]} 個任務，總時長 ${todayStats[2]}`);
                    console.log("---");
                } catch (error) {
                    console.error("❌ 即時更新錯誤：", error);
                }
            }, 1000);
            
            console.log("✅ 計時器測試已開始，查看控制台輸出");
            
        } catch (error) {
            console.error("❌ 計時器測試失敗：", error);
        }
    }

    // 停止計時測試
    async stopTimerTest() {
        try {
            console.log("🛑 停止計時器測試");
            
            // 停止即時更新
            if (this.testInterval) {
                clearInterval(this.testInterval);
                this.testInterval = null;
            }
            
            // 停止任務
            await invoke("stop_task");
            
            // 顯示最終狀態
            const status = await invoke("get_current_status_formatted");
            const todayStats = await invoke("get_today_stats");
            
            console.log("🏁 最終狀態：", status);
            console.log("📊 今日統計：", todayStats);
            console.log("✅ 計時器測試已停止");
            
        } catch (error) {
            console.error("❌ 停止測試失敗：", error);
        }
    }

    // 測試時間格式化
    async testTimeFormatting() {
        try {
            console.log("🕐 測試時間格式化");
            
            const testCases = [65, 3661, 7323, 86401]; // 1:05, 1:01:01, 2:02:03, 24:00:01
            
            for (const seconds of testCases) {
                const formatted = await invoke("format_duration", { seconds });
                console.log(`${seconds} 秒 = ${formatted}`);
            }
            
            console.log("✅ 時間格式化測試完成");
            
        } catch (error) {
            console.error("❌ 時間格式化測試失敗：", error);
        }
    }
}

// 全局測試控制
window.timerTest = new TimerTest();

// 提供全局測試函數
window.startTest = () => window.timerTest.startTimerTest();
window.stopTest = () => window.timerTest.stopTimerTest();
window.testFormat = () => window.timerTest.testTimeFormatting();

console.log("🚀 計時器測試已載入！");
console.log("使用方法：");
console.log("  startTest() - 開始計時測試");
console.log("  stopTest() - 停止計時測試"); 
console.log("  testFormat() - 測試時間格式化");