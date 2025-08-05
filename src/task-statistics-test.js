// 任務統計功能測試腳本
import { invoke } from "@tauri-apps/api/core";
import taskStatistics from './task-statistics.js';

// 任務統計測試類
export class TaskStatisticsTest {
    constructor() {
        this.testTasks = [
            "程式開發",
            "UI 設計", 
            "文件撰寫",
            "程式開發", // 重複
            "測試除錯",
            "UI 設計",  // 重複
            "會議討論",
            "程式開發", // 重複
            "學習研究"
        ];
    }

    // 建立測試資料
    async createTestData() {
        try {
            console.log("🧪 建立任務統計測試資料...");
            
            for (let i = 0; i < this.testTasks.length; i++) {
                const taskName = this.testTasks[i];
                const duration = Math.floor(Math.random() * 1800) + 300; // 5分鐘到35分鐘
                
                console.log(`   建立任務 ${i + 1}: ${taskName} (${Math.floor(duration / 60)} 分鐘)`);
                
                await invoke("start_task", { name: taskName });
                await this.sleep(100);
                await invoke("stop_task");
                await this.sleep(200);
            }
            
            console.log("✅ 測試資料建立完成");
            
        } catch (error) {
            console.error("❌ 建立測試資料失敗：", error);
        }
    }

    // 測試任務統計功能
    async testTaskStatistics() {
        try {
            console.log("🧪 開始任務統計功能測試");
            
            // 1. 測試載入所有任務統計
            console.log("\n📊 測試 1: 載入所有任務統計");
            const allSummaries = await taskStatistics.loadAllTaskSummaries();
            console.log(`載入結果:`, allSummaries);
            
            if (allSummaries.length > 0) {
                console.log("✅ 成功載入任務統計");
                console.log(`最多計時的任務: ${allSummaries[0].name} (${allSummaries[0].total_duration_formatted})`);
            } else {
                console.log("⚠️ 沒有任務統計資料");
            }
            
            // 2. 測試載入今日任務統計
            console.log("\n📅 測試 2: 載入今日任務統計");
            const todaySummaries = await taskStatistics.loadTodayTaskSummaries();
            console.log(`今日統計:`, todaySummaries);
            
            // 3. 測試載入特定任務記錄
            if (allSummaries.length > 0) {
                const testTaskName = allSummaries[0].name;
                console.log(`\n📋 測試 3: 載入任務「${testTaskName}」的詳細記錄`);
                const records = await taskStatistics.loadTaskRecords(testTaskName);
                console.log(`記錄詳情:`, records);
            }
            
            // 4. 測試渲染功能
            console.log("\n🎨 測試 4: 測試渲染功能");
            this.testRenderFunctions(allSummaries);
            
            console.log("\n✅ 任務統計功能測試完成");
            
        } catch (error) {
            console.error("❌ 任務統計測試失敗：", error);
        }
    }

    // 測試渲染功能
    testRenderFunctions(summaries) {
        // 創建測試容器
        const testContainer = this.createTestContainer();
        
        // 測試任務統計渲染
        console.log("   渲染任務統計到測試容器...");
        taskStatistics.renderTaskSummaries(summaries, 'task-statistics-test-container', {
            showSessionCount: true,
            showAverageTime: true,
            showLastSession: true,
            maxItems: 10,
            allowClick: true
        });
        
        console.log("✅ 渲染測試完成，請檢查頁面上的測試容器");
    }

    // 創建測試容器
    createTestContainer() {
        // 移除舊的測試容器
        const existingContainer = document.getElementById('task-statistics-test-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // 創建新的測試容器
        const container = document.createElement('div');
        container.id = 'task-statistics-test-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-height: 70vh;
            overflow-y: auto;
            background: white;
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            z-index: 1000;
        `;
        
        // 添加標題和關閉按鈕
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0; color: #1f2937;">📊 任務統計測試</h3>
                <button onclick="this.closest('#task-statistics-test-container').remove()" 
                        style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280;">×</button>
            </div>
            <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">
                點擊任務項目可查看詳細記錄
            </div>
        `;
        
        document.body.appendChild(container);
        return container;
    }

    // 測試資料分析功能
    async testDataAnalysis() {
        try {
            console.log("📈 測試資料分析功能...");
            
            const allSummaries = await taskStatistics.loadAllTaskSummaries();
            
            if (allSummaries.length === 0) {
                console.log("⚠️ 沒有資料可供分析");
                return;
            }
            
            // 分析結果
            const analysis = {
                totalTasks: allSummaries.length,
                totalTime: allSummaries.reduce((sum, task) => sum + task.total_duration_seconds, 0),
                totalSessions: allSummaries.reduce((sum, task) => sum + task.session_count, 0),
                averageTimePerTask: 0,
                averageSessionsPerTask: 0,
                mostWorkedTask: allSummaries[0],
                leastWorkedTask: allSummaries[allSummaries.length - 1]
            };
            
            analysis.averageTimePerTask = analysis.totalTime / analysis.totalTasks;
            analysis.averageSessionsPerTask = analysis.totalSessions / analysis.totalTasks;
            
            console.log("📊 資料分析結果:");
            console.log(`   總任務數: ${analysis.totalTasks}`);
            console.log(`   總計時間: ${taskStatistics.formatDuration(analysis.totalTime)}`);
            console.log(`   總計時次數: ${analysis.totalSessions}`);
            console.log(`   平均每個任務時間: ${taskStatistics.formatDuration(Math.floor(analysis.averageTimePerTask))}`);
            console.log(`   平均每個任務計時次數: ${analysis.averageSessionsPerTask.toFixed(1)}`);
            console.log(`   最多計時任務: ${analysis.mostWorkedTask.name} (${analysis.mostWorkedTask.total_duration_formatted})`);
            console.log(`   最少計時任務: ${analysis.leastWorkedTask.name} (${analysis.leastWorkedTask.total_duration_formatted})`);
            
            return analysis;
            
        } catch (error) {
            console.error("❌ 資料分析測試失敗：", error);
        }
    }

    // 測試搜尋功能
    async testSearchFunction() {
        try {
            console.log("🔍 測試搜尋功能...");
            
            const allSummaries = await taskStatistics.loadAllTaskSummaries();
            
            if (allSummaries.length === 0) {
                console.log("⚠️ 沒有資料可供搜尋");
                return;
            }
            
            // 測試不同的搜尋關鍵字
            const searchTerms = ["程式", "設計", "文件", "不存在的任務"];
            
            for (const term of searchTerms) {
                const results = taskStatistics.searchTasks(allSummaries, term);
                console.log(`搜尋「${term}」: 找到 ${results.length} 個結果`);
                results.forEach((task, index) => {
                    console.log(`   ${index + 1}. ${task.name} (${task.total_duration_formatted})`);
                });
            }
            
        } catch (error) {
            console.error("❌ 搜尋功能測試失敗：", error);
        }
    }

    // 測試排行榜功能
    async testRankingFunction() {
        try {
            console.log("🏆 測試排行榜功能...");
            
            const allSummaries = await taskStatistics.loadAllTaskSummaries();
            
            if (allSummaries.length === 0) {
                console.log("⚠️ 沒有資料可供排行");
                return;
            }
            
            const ranking = taskStatistics.getTaskRankingData(allSummaries, 5);
            
            console.log("📊 任務時間排行榜 (前5名):");
            ranking.forEach(task => {
                console.log(`   #${task.rank} ${task.name}`);
                console.log(`       總時間: ${task.totalFormatted}`);
                console.log(`       計時次數: ${task.sessionCount} 次`);
                console.log(`       平均時間: ${task.averageFormatted}`);
                console.log("");
            });
            
        } catch (error) {
            console.error("❌ 排行榜測試失敗：", error);
        }
    }

    // 執行完整測試套件
    async runFullTestSuite() {
        console.log("🚀 開始完整任務統計測試套件");
        console.log("=" .repeat(50));
        
        try {
            // 如果沒有資料，先建立測試資料
            const existingSummaries = await taskStatistics.loadAllTaskSummaries();
            if (existingSummaries.length === 0) {
                console.log("📝 沒有現有資料，建立測試資料...");
                await this.createTestData();
                await this.sleep(1000); // 等待資料寫入
            }
            
            // 執行各項測試
            await this.testTaskStatistics();
            await this.sleep(500);
            
            await this.testDataAnalysis();
            await this.sleep(500);
            
            await this.testSearchFunction();
            await this.sleep(500);
            
            await this.testRankingFunction();
            
            console.log("=" .repeat(50));
            console.log("✅ 完整測試套件執行完成");
            
        } catch (error) {
            console.error("❌ 測試套件執行失敗：", error);
        }
    }

    // 清除測試容器
    clearTestContainer() {
        const container = document.getElementById('task-statistics-test-container');
        if (container) {
            container.remove();
            console.log("🧹 測試容器已清除");
        }
    }

    // 工具方法：延遲
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 全局任務統計測試控制
window.taskStatisticsTest = new TaskStatisticsTest();

// 提供全局測試函數
window.createStatisticsTestData = () => window.taskStatisticsTest.createTestData();
window.testTaskStatistics = () => window.taskStatisticsTest.testTaskStatistics();
window.testDataAnalysis = () => window.taskStatisticsTest.testDataAnalysis();
window.testSearchFunction = () => window.taskStatisticsTest.testSearchFunction();
window.testRankingFunction = () => window.taskStatisticsTest.testRankingFunction();
window.runFullStatisticsTest = () => window.taskStatisticsTest.runFullTestSuite();
window.clearTestContainer = () => window.taskStatisticsTest.clearTestContainer();

console.log("🚀 任務統計測試已載入！");
console.log("使用方法：");
console.log("  createStatisticsTestData() - 建立測試用任務資料");
console.log("  testTaskStatistics() - 測試基本統計功能");
console.log("  testDataAnalysis() - 測試資料分析功能");
console.log("  testSearchFunction() - 測試搜尋功能");
console.log("  testRankingFunction() - 測試排行榜功能");
console.log("  runFullStatisticsTest() - 執行完整測試套件");
console.log("  clearTestContainer() - 清除測試容器");