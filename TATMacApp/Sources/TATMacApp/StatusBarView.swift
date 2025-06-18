import SwiftUI

struct StatusBarView: View {
    @EnvironmentObject var vm: TaskViewModel

    var body: some View {
        HStack {
            if vm.isRunning {
                Text("Running: \(vm.currentTaskName)")
                Spacer()
                Text(vm.elapsedTimeString)
            } else {
                Text("No task running")
            }
        }
        .padding()
    }
}
