import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vm: TaskViewModel
    @State private var taskName: String = ""

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                TextField("Task name", text: $taskName)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                Button(vm.isRunning ? "Stop" : "Start") {
                    if vm.isRunning {
                        vm.stopCurrentTask()
                    } else {
                        vm.startTask(name: taskName)
                    }
                }
                .disabled(taskName.isEmpty && !vm.isRunning)
            }
            .padding()

            List {
                ForEach(vm.summaries) { summary in
                    NavigationLink(destination: TaskDetailView(task: summary)) {
                        HStack {
                            Text(summary.name)
                            Spacer()
                            Text(vm.format(duration: summary.total))
                        }
                    }
                }
            }
        }
        .onAppear {
            vm.refreshSummaries()
        }
        .frame(minWidth: 400, minHeight: 300)
    }
}
