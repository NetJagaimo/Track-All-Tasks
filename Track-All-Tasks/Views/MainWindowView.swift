import SwiftUI

/// 主視窗的側邊欄分區（SPEC §4）。
enum SidebarSection: String, CaseIterable, Identifiable, Hashable {
    case active = "進行中"
    case completed = "已完成"
    case archived = "封存"
    case trash = "回收桶"
    case overview = "總覽"
    case settings = "設定"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .active:    return "list.bullet"
        case .completed: return "checkmark.circle"
        case .archived:  return "archivebox"
        case .trash:     return "trash"
        case .overview:  return "chart.bar"
        case .settings:  return "gearshape"
        }
    }
}

/// 主視窗：側邊欄 + 內容（SPEC §4）。關閉後 App 仍留在選單列。
struct MainWindowView: View {
    let container: AppContainer
    @State private var selection: SidebarSection = .active
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        NavigationSplitView {
            List(SidebarSection.allCases, selection: $selection) { section in
                Label(section.rawValue, systemImage: section.systemImage)
                    .tag(section)
            }
            .navigationSplitViewColumnWidth(min: 160, ideal: 180, max: 220)
        } detail: {
            detail
                .frame(minWidth: 520, minHeight: 420)
        }
        // 讓 AppKit 端（popover「前往主視窗」、Dock 重開）能重新打開這個視窗。
        .onAppear { container.openMainWindow = { openWindow(id: "main") } }
    }

    @ViewBuilder
    private var detail: some View {
        switch selection {
        case .active:
            ActiveListView(controller: container.controller)
        case .completed:
            StateListView(controller: container.controller, state: .completed)
        case .archived:
            StateListView(controller: container.controller, state: .archived)
        case .trash:
            TrashView(controller: container.controller)
        case .overview:
            OverviewView(controller: container.controller)
        case .settings:
            SettingsView(settings: container.settings)
        }
    }
}
