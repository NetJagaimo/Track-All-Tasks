import Foundation
import GRDB

/// 建立 `DatabaseQueue` 並套用 migration（SPEC §7、附錄 schema）。
enum AppDatabase {
    /// 開啟（或建立）資料庫，套用所有 migration 後回傳 queue。
    static func makeQueue() throws -> DatabaseQueue {
        let url = try AppPaths.databaseURL()
        var config = Configuration()
        config.foreignKeysEnabled = true   // record.task_id ON DELETE CASCADE 需要開啟
        let queue = try DatabaseQueue(path: url.path, configuration: config)
        try migrator.migrate(queue)
        return queue
    }

    /// 正常關閉時同步收尾：把所有未結束紀錄的 end 設為現在（SPEC §2「正常關閉」）。
    /// `applicationWillTerminate` 無法 await，故用獨立連線同步寫入。
    static func closeRunningRecordsNow() {
        guard let queue = try? makeQueue() else { return }
        let nowStr = DateCodec.string(from: Date())
        try? queue.write { db in
            try db.execute(
                sql: "UPDATE record SET end_at=?, updated_at=? WHERE end_at IS NULL",
                arguments: [nowStr, nowStr]
            )
        }
    }

    /// schema 版本管理（GRDB DatabaseMigrator）。
    static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()

        // v1：任務與紀錄兩張表（對應 SPEC 附錄）。
        migrator.registerMigration("v1") { db in
            try db.execute(sql: """
                CREATE TABLE task (
                  id           TEXT PRIMARY KEY,
                  name         TEXT NOT NULL,
                  notes        TEXT,
                  state        TEXT NOT NULL DEFAULT 'active'
                                 CHECK (state IN ('active','completed','archived','trashed')),
                  prev_state   TEXT,
                  sort_order   REAL NOT NULL DEFAULT 0,
                  created_at   TEXT NOT NULL,
                  completed_at TEXT,
                  archived_at  TEXT,
                  trashed_at   TEXT
                );
                """)
            // 名稱在「非回收桶」範圍內唯一；回收桶可留同名直到清空。
            try db.execute(sql: """
                CREATE UNIQUE INDEX idx_task_name_live
                  ON task(name COLLATE NOCASE) WHERE state <> 'trashed';
                """)
            try db.execute(sql: "CREATE INDEX idx_task_state_sort ON task(state, sort_order);")

            try db.execute(sql: """
                CREATE TABLE record (
                  id           TEXT PRIMARY KEY,
                  task_id      TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
                  start_at     TEXT NOT NULL,
                  end_at       TEXT,
                  heartbeat_at TEXT,
                  created_at   TEXT NOT NULL,
                  updated_at   TEXT NOT NULL
                );
                """)
            try db.execute(sql: "CREATE INDEX idx_record_task    ON record(task_id);")
            try db.execute(sql: "CREATE INDEX idx_record_start   ON record(start_at);")
            try db.execute(sql: "CREATE INDEX idx_record_running ON record(end_at) WHERE end_at IS NULL;")
        }

        return migrator
    }
}
