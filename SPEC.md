# Track-All-Tasks — 設計規格 (SPEC)

一個隱私優先、純本地、靠快捷鍵與閒置偵測無痛記錄工時的 macOS 選單列 App。
**任務本身就是 todo item**：可計時、可完成封存、可丟回收桶。資料全部存在本機 SQLite，零雲端、免登入。

本文件是經過逐項確認後的設計定案，作為實作依據。沿用 `../JimiJam` 的工程方式。

---

## 1. 技術棧與架構

| 項目 | 決定 |
| --- | --- |
| 語言 / UI | Swift 5.9+ / SwiftUI（`@Observable` controller 以 `@State` 持有）|
| 專案產生 | XcodeGen `project.yml`，bundleId 前綴 `com.pingyang`，target `Track-All-Tasks` |
| 最低版本 | macOS 14.0 |
| 選單列 | SwiftUI `MenuBarExtra`，`.menuBarExtraStyle(.window)`（popover 面板）|
| 無 Dock | `LSUIElement: true`；`AppDelegate` 視主視窗可見與否動態切 `.regular` / `.accessory` |
| 慣例 | 繁體中文註解、個人工具、不做多語系 |

### 依賴哲學

預設只用 Apple 第一方框架；謹慎引入少量成熟套件。已核可的外部套件：

- **GRDB.swift** — SQLite 存取與 migration
- **KeyboardShortcuts**（sindresorhus）— 全域快捷鍵錄製/持久化

### 資料層抽象（為了未來可換 Postgres / 遠端）

商業邏輯只認得 Repository 協定，不直接碰 GRDB；以後加 `PostgresRecordStore` / `RemoteRecordStore` 時呼叫端不動。

```
View / Controller
      ↓ 只認得協定
protocol TaskStore / RecordStore {   // 領域層方法，不漏 SQL
    func ... async throws ...
}
      ↑ 現在實作
GRDBStore   ← 今天用
PostgresStore / RemoteStore ← 以後加，call site 不變
```

四個現在就遵守的原則：

1. **協定方法一律 `async`**（本地同步實作即可；遠端才不用改呼叫端）
2. 領域模型是**純 Swift struct**，不綁 DB 型別
3. 主鍵用 **`UUID`**，不用自增 rowid
4. 時間存 **epoch 或 ISO8601 字串**，不依賴 SQLite 特有日期函式

### 系統權限

- 全域快捷鍵走 Carbon `RegisterEventHotKey`（KeyboardShortcuts 底層）→ **不需輔助使用權限**
- 閒置偵測走 `CGEventSource` → **不需權限**
- **唯一**會跳的授權：系統通知（第一次閒置自動停止時才請求，見 §6）

---

## 2. 計時引擎

### 基本行為

- 開始計時記下 start、進入「追蹤中」；停止記下 end，時長由 start/end **即時計算（不儲存）**。
- 一次只能有一段計時；已在計時又按開始 → 先停舊的再開新的。
- 計時中時長以秒級跳動更新（顯示在 popover 與選單列）。
- 開始計時時立刻寫入一筆 `end = null` 的紀錄（供當機復原）。

### 閒置偵測

- 每約 10 秒輪詢 `CGEventSource.secondsSinceLastEventType`。
- 閒置 ≥ 門檻 → **當下立即停止**計時，`end` = 停止那一刻。**不修剪、不跳提示**。
- 門檻可調（分鐘，預設 5，最少 1），可在設定裡完全關閉。
- 停止後發系統通知提醒（見 §6）。

### 關閉 / 當機 / 睡眠（心跳機制）

- 計時中每約 1 分鐘寫一次「最後心跳」時間戳。
- **正常關閉**：`applicationWillTerminate` 寫 `end = 當下`，收尾，不接續。
- **當機 / 睡眠**：抓不到關閉事件。重開或喚醒時若偵測到「心跳中斷」（距上次心跳超過一個間隔）或發現 `end = null` 的紀錄 → 把該計時**收尾在最後一次心跳**並停止。當機與睡眠共用此單一機制。

---

## 3. 任務模型（任務 = todo item）

任務是獨立資料表，同時是 todo item 與計時對象。

### 欄位

- `id`（UUID）
- `name`（**唯一**）
- `notes`（備註）
- `state`：`active`（進行中）/ `completed`（已完成）/ `archived`（封存）/ `trashed`（回收桶）
- `sortOrder`（手動排序位置，僅 active 清單使用）
- 時間戳：建立、完成、封存、丟棄時間等（供各清單排序）

### 狀態與生命週期

```
進行中 active ──勾完成──▶ 已完成 completed ──封存──▶ 封存 archived
   │                          │                        │
   └──────────┬───────────────┴────────────┬──────────┘
              ▼ 丟棄                          ▼ 丟棄
          回收桶 trashed ──還原──▶ 回原狀態
                       └──清空回收桶──▶ 永久刪除
```

- **完成與封存是兩步**：勾完成後仍留在進行中清單（劃線顯示），之後再手動封存收起。
- **只有「進行中」能計時**；快選清單與選單列也只認進行中。
- **名稱唯一**：打既有名稱自動對到同一任務。
- 在 popover 打**新名字**按開始 → 自動建一個進行中 todo 並開始計時。

### 編輯與合併

- 編輯紀錄裡的「任務名稱」= **幫該任務改名**，連動所有用到它的紀錄（修正打錯字）。
- 改名若**撞到既有任務名** → **自動合併**到既有任務，空掉的任務自動移除。

### 回收桶與紀錄

- 任務丟回收桶時，**其計時紀錄跟著一起進回收桶**。
- 還原任務 → 紀錄一起回來；清空回收桶 → 任務與紀錄一起永久刪除。

---

## 4. 介面

### 選單列 popover（`.window` style，輕量操作）

- 目前狀態、開始/停止按鈕
- 任務名稱輸入欄（含「進行中」清單快選，依手動排序，多則可捲動）
- 計時中時長（秒級跳動）
- 前往主視窗（紀錄/總覽/設定）的入口
- 點面板外或 Esc 關閉

### 選單列圖示

- 以外觀表示是否在計時
- 計時中顯示：**圖示 + 任務名稱前 3 個字 + 秒級時長**
- 秒級更新用手動 `Timer`（避開 `MenuBarExtra` 用 `TimelineView` 的已知卡死問題）

### 主視窗（側邊欄六區）

1. **進行中** — todo 清單，主畫面；每行可開始計時、可勾完成、**可手動拖曳排序**
2. **已完成** — 依時間排（最近在上）
3. **封存** — 依時間排
4. **回收桶** — 依時間排；可還原、可清空（永久刪）
5. **總覽** — 每日/每週 + 匯出（見 §5）
6. **設定** — 見 §6

主視窗關閉後 App 仍留在選單列。

---

## 5. 總覽與匯出

### 每日 / 每週總覽

- 每日：當天所有紀錄依任務分組，列各任務小計與全天總計；可切換日期。
- 每週：以 7 天彙整，**每週從星期一起算**。
- **跨夜紀錄**（例 23:30–00:30）：在**總覽計算小計時於半夜切開**，分攤到各日（精準計算）。原始紀錄仍存一筆，不拆。
- 時長顯示格式：**`1h 23m`**（時/分）。
- 範圍：含封存任務的歷史工時，**排除回收桶**。

### 匯出

- 在總覽選日期區間 → 匯出 → `NSSavePanel` 選位置 → **CSV 或 JSON**。
- 欄位：任務名稱、起始時間、結束時間、時長。
- **跨夜紀錄匯出保持原始一筆**（不拆，與總覽不同）。
- 時間欄位用 **ISO8601**（如 `2026-06-02T14:30:00+08:00`）。

---

## 6. 設定與系統整合

設定項目與儲存位置：

| 設定 | 儲存於 |
| --- | --- |
| 閒置門檻（分鐘，預設 5，最少 1）、閒置開關 | `settings.json`（App 資料目錄）|
| 全域快捷鍵（開始/停止、任務輸入）| `KeyboardShortcuts` → UserDefaults（套件綁定，無法搬）|
| 開機自動啟動 | `SMAppService`（系統管理，狀態即真相）|

- 快捷鍵：KeyboardShortcuts recorder，改完即時生效、重開保留。
- `settings.json` 用 Codable struct 編碼；SQLite 只存領域資料（task / record），不存設定。

系統整合：

- **通知**：閒置自動停止時發系統通知「因閒置已停止」。第一次需要時才請求通知授權。

---

## 7. 本地儲存

- **紀錄與任務**存在 App 資料目錄下的 SQLite（GRDB）；完全離線可用。
- **App 設定**存成同目錄下的 `settings.json`（不進 SQLite）。快捷鍵與開機啟動則由系統機制保管（見 §6）。
- 免登入、免註冊，首次啟動即可開始。
- schema 版本管理與 migration 用 GRDB `DatabaseMigrator`。

---

## 附錄：資料庫 Schema（定案）

SQLite 只放領域資料兩張表；設定走 `settings.json`。

### `task`（任務 = todo item）
```sql
CREATE TABLE task (
  id           TEXT PRIMARY KEY,          -- UUID
  name         TEXT NOT NULL,
  notes        TEXT,
  state        TEXT NOT NULL DEFAULT 'active'
                 CHECK (state IN ('active','completed','archived','trashed')),
  prev_state   TEXT,                      -- 丟回收桶前的狀態，還原時用
  sort_order   REAL NOT NULL DEFAULT 0,   -- 進行中清單手動排序
  created_at   TEXT NOT NULL,             -- ISO8601
  completed_at TEXT,
  archived_at  TEXT,
  trashed_at   TEXT
);

-- 名稱在「非回收桶」範圍內唯一；回收桶可留同名直到清空
CREATE UNIQUE INDEX idx_task_name_live
  ON task(name COLLATE NOCASE) WHERE state <> 'trashed';
CREATE INDEX idx_task_state_sort ON task(state, sort_order);
```

### `record`（計時紀錄）
```sql
CREATE TABLE record (
  id           TEXT PRIMARY KEY,          -- UUID
  task_id      TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  start_at     TEXT NOT NULL,             -- ISO8601
  end_at       TEXT,                      -- NULL = 計時中
  heartbeat_at TEXT,                      -- 計時中每分鐘更新，當機/睡眠復原用
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_record_task    ON record(task_id);
CREATE INDEX idx_record_start   ON record(start_at);
CREATE INDEX idx_record_running ON record(end_at) WHERE end_at IS NULL;
```

### 常用查詢
| 用途 | 條件 |
| --- | --- |
| 進行中清單 / popover 快選 | `state='active' ORDER BY sort_order` |
| 已完成 / 封存 / 回收桶 | `state=? ORDER BY completed_at / archived_at / trashed_at DESC` |
| 計時中紀錄 | `record.end_at IS NULL` |
| 總覽（排除回收桶）| `record JOIN task ON ... WHERE task.state <> 'trashed' AND start_at IN range` |

### 關鍵操作
- **改名撞名 → 合併**：`UPDATE name` 被唯一索引擋下時，App 改跑交易：`UPDATE record SET task_id=:keep WHERE task_id=:dup; DELETE FROM task WHERE id=:dup;`
- **任務丟回收桶**：`UPDATE task SET prev_state=state, state='trashed', trashed_at=now`。紀錄不動（查詢靠 join 排除）。
- **還原**：`UPDATE task SET state=prev_state, prev_state=NULL, trashed_at=NULL`。
- **清空回收桶**：`DELETE FROM task WHERE state='trashed'` → 紀錄靠 `ON DELETE CASCADE` 一起刪。
- **單筆紀錄刪除**：永久刪除（不進回收桶）。
- **計時收尾（當機/睡眠復原）**：找 `end_at IS NULL` 的紀錄，`UPDATE end_at = COALESCE(heartbeat_at, start_at)`。
- **跨夜分攤**：不入庫；總覽時在 App 端用本地 Calendar 於半夜切開。
- **時長**：由 `start_at`/`end_at` 即時計算，不落地。
