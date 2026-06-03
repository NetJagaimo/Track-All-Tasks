import Foundation

/// 匯出格式（SPEC §5）。
enum ExportFormat: String, CaseIterable, Identifiable {
    case csv
    case json
    var id: String { rawValue }
    var fileExtension: String { rawValue }
    var displayName: String { rawValue.uppercased() }
}

/// 紀錄匯出（SPEC §5）。
/// - 欄位：任務名稱、起始時間、結束時間、時長（秒）。
/// - 時間用 ISO8601；跨夜紀錄保持原始一筆（不拆，與總覽不同）。
/// - 只匯出已結束的紀錄，依起始時間在選定區間內。
enum Exporter {
    /// 篩出區間內、依起始時間排序、已結束的紀錄。
    static func selectRecords(_ records: [RecordWithTask], from: Date, to: Date) -> [RecordWithTask] {
        records
            .filter { item in
                guard let end = item.record.endAt else { return false }   // 跳過計時中
                _ = end
                let start = item.record.startAt
                return start >= from && start < to
            }
            .sorted { $0.record.startAt < $1.record.startAt }
    }

    static func data(for records: [RecordWithTask], from: Date, to: Date, format: ExportFormat) -> Data {
        let selected = selectRecords(records, from: from, to: to)
        switch format {
        case .csv:  return Data(csv(selected).utf8)
        case .json: return json(selected)
        }
    }

    // MARK: - CSV

    private static func csv(_ items: [RecordWithTask]) -> String {
        var lines = ["任務名稱,起始時間,結束時間,時長秒數"]
        for item in items {
            let r = item.record
            let start = DateCodec.string(from: r.startAt)
            let end = r.endAt.map(DateCodec.string(from:)) ?? ""
            let seconds = Int(r.duration().rounded())
            let cols = [item.taskName, start, end, String(seconds)].map(escapeCSV)
            lines.append(cols.joined(separator: ","))
        }
        return lines.joined(separator: "\n") + "\n"
    }

    private static func escapeCSV(_ field: String) -> String {
        if field.contains(",") || field.contains("\"") || field.contains("\n") {
            return "\"" + field.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return field
    }

    // MARK: - JSON

    private struct ExportRecord: Encodable {
        let taskName: String
        let start: String
        let end: String?
        let durationSeconds: Int
    }

    private static func json(_ items: [RecordWithTask]) -> Data {
        let payload = items.map { item -> ExportRecord in
            let r = item.record
            return ExportRecord(
                taskName: item.taskName,
                start: DateCodec.string(from: r.startAt),
                end: r.endAt.map(DateCodec.string(from:)),
                durationSeconds: Int(r.duration().rounded())
            )
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        return (try? encoder.encode(payload)) ?? Data("[]".utf8)
    }
}
