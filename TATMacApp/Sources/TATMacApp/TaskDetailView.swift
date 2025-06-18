import SwiftUI

struct TaskDetailView: View {
    @EnvironmentObject var vm: TaskViewModel
    var task: TaskSummary

    var body: some View {
        VStack {
            List {
                ForEach(vm.records.filter { $0.taskName == task.name }) { rec in
                    HStack {
                        Text(vm.dateFormatter.string(from: rec.datetime))
                        Spacer()
                        Text(rec.action)
                    }
                    .contextMenu {
                        Button("Delete") {
                            vm.deleteRecord(rec)
                        }
                    }
                }
            }
            .onAppear {
                vm.refreshRecords(for: task.name)
            }
        }
        .frame(minWidth: 400, minHeight: 300)
    }
}
