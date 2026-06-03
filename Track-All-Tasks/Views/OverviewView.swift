import SwiftUI
import AppKit
import UniformTypeIdentifiers

/// 總覽（SPEC §5）：每日 / 每週小計與全天 / 整週總計，跨夜於半夜切開；含匯出。
struct OverviewView: View {
    let controller: TimerController

    private enum Mode: String, CaseIterable, Identifiable { case day = "每日", week = "每週"; var id: String { rawValue } }

    @State private var mode: Mode = .day
    @State private var anchor: Date = Date()
    @State private var day: DayOverview?
    @State private var week: WeekOverview?

    // 匯出
    @State private var showExport = false
    @State private var exportFrom: Date = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
    @State private var exportTo: Date = Date()
    @State private var exportFormat: ExportFormat = .csv

    private let calendar = Calendar.current

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            controls
            Divider()
            ScrollView {
                if mode == .day { dayContent } else { weekContent }
            }
        }
        .padding(16)
        .navigationTitle("總覽")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showExport = true } label: { Label("匯出", systemImage: "square.and.arrow.up") }
            }
        }
        .sheet(isPresented: $showExport) { exportSheet }
        .task(id: reloadKey) { await reload() }
    }

    private var reloadKey: String { "\(mode.rawValue)-\(anchor.timeIntervalSince1970)" }

    // MARK: 控制列

    private var controls: some View {
        HStack {
            Picker("", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .fixedSize()

            Spacer()

            Button { shift(-1) } label: { Image(systemName: "chevron.left") }
            DatePicker("", selection: $anchor, displayedComponents: .date)
                .labelsHidden()
            Button { shift(1) } label: { Image(systemName: "chevron.right") }
            Button("今天") { anchor = Date() }
        }
    }

    // MARK: 每日

    @ViewBuilder
    private var dayContent: some View {
        if let day {
            sectionHeader(RecordsView.dateText(day.date).prefix(10).description, total: day.total)
            if day.tasks.isEmpty {
                Text("這天沒有紀錄").foregroundStyle(.secondary)
            } else {
                ForEach(day.tasks) { taskDurationRow($0) }
            }
        } else {
            ProgressView()
        }
    }

    // MARK: 每週

    @ViewBuilder
    private var weekContent: some View {
        if let week {
            sectionHeader("本週（\(RecordsView.dateText(week.weekStart).prefix(10)) 起）", total: week.total)

            Text("各任務小計").font(.subheadline).padding(.top, 4)
            if week.weeklyTasks.isEmpty {
                Text("這週沒有紀錄").foregroundStyle(.secondary)
            } else {
                ForEach(week.weeklyTasks) { taskDurationRow($0) }
            }

            Text("每日總計").font(.subheadline).padding(.top, 8)
            ForEach(week.days) { d in
                HStack {
                    Text(weekdayLabel(d.date))
                    Spacer()
                    Text(Formatting.hm(d.total)).font(.system(.callout, design: .monospaced))
                        .foregroundStyle(d.total > 0 ? .primary : .secondary)
                }
                .padding(.vertical, 1)
            }
        } else {
            ProgressView()
        }
    }

    private func sectionHeader(_ title: String, total: TimeInterval) -> some View {
        HStack {
            Text(title).font(.headline)
            Spacer()
            Text("總計 \(Formatting.hm(total))").font(.headline).foregroundStyle(.tint)
        }
    }

    private func taskDurationRow(_ t: TaskDuration) -> some View {
        HStack {
            Text(t.name).lineLimit(1)
            Spacer()
            Text(Formatting.hm(t.seconds)).font(.system(.callout, design: .monospaced))
        }
        .padding(.vertical, 1)
    }

    // MARK: 匯出面板

    private var exportSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("匯出紀錄").font(.headline)
            DatePicker("從", selection: $exportFrom, displayedComponents: .date)
            DatePicker("到", selection: $exportTo, displayedComponents: .date)
            Picker("格式", selection: $exportFormat) {
                ForEach(ExportFormat.allCases) { Text($0.displayName).tag($0) }
            }
            .pickerStyle(.segmented)
            Text("跨夜紀錄保持原始一筆；時間為 ISO8601。")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                Spacer()
                Button("取消") { showExport = false }
                Button("匯出…") { Task { await runExport() } }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(16)
        .frame(width: 340)
    }

    // MARK: 邏輯

    private func shift(_ direction: Int) {
        let component: Calendar.Component = (mode == .day) ? .day : .weekOfYear
        let amount = (mode == .day) ? direction : direction
        if let d = calendar.date(byAdding: component, value: amount, to: anchor) {
            anchor = d
        }
    }

    private func reload() async {
        if mode == .day {
            let start = calendar.startOfDay(for: anchor)
            let end = calendar.date(byAdding: .day, value: 1, to: start) ?? start
            let records = await controller.recordsExcludingTrash(from: start, to: end)
            day = OverviewCalculator.day(for: anchor, records: records, calendar: calendar)
        } else {
            let cal = OverviewCalculator.mondayCalendar(calendar)
            let comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: anchor)
            let weekStart = cal.date(from: comps) ?? cal.startOfDay(for: anchor)
            let weekEnd = cal.date(byAdding: .day, value: 7, to: weekStart) ?? weekStart
            let records = await controller.recordsExcludingTrash(from: weekStart, to: weekEnd)
            week = OverviewCalculator.week(containing: anchor, records: records, calendar: calendar)
        }
    }

    private func runExport() async {
        let from = calendar.startOfDay(for: exportFrom)
        let to = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: exportTo)) ?? exportTo
        let records = await controller.recordsExcludingTrash(from: from, to: to)
        let data = Exporter.data(for: records, from: from, to: to, format: exportFormat)

        let panel = NSSavePanel()
        panel.nameFieldStringValue = "tracks-export.\(exportFormat.fileExtension)"
        if exportFormat == .csv {
            panel.allowedContentTypes = [UTType.commaSeparatedText]
        } else {
            panel.allowedContentTypes = [UTType.json]
        }
        showExport = false
        if panel.runModal() == .OK, let url = panel.url {
            try? data.write(to: url, options: .atomic)
        }
    }

    private func weekdayLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_Hant")
        f.dateFormat = "MM/dd (EEE)"
        return f.string(from: date)
    }
}
