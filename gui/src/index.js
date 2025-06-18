const { invoke } = window.__TAURI__.tauri;
let running = false;
let currentTask = null;
const btn = document.getElementById('toggleBtn');
const input = document.getElementById('taskInput');
const tasksEl = document.getElementById('tasks');
const recordsEl = document.getElementById('records');
const taskTitleEl = document.getElementById('taskTitle');
const recordListEl = document.getElementById('recordList');

async function refreshTasks() {
  const tasks = await invoke('list_tasks');
  tasksEl.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.name} - ${t.total}s`;
    li.onclick = () => showRecords(t.name);
    tasksEl.appendChild(li);
  });
}

async function showRecords(name) {
  const recs = await invoke('get_records', { name });
  taskTitleEl.textContent = name;
  recordsEl.style.display = 'block';
  recordListEl.innerHTML = '';
  recs.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.action} at ${r.datetime}`;
    recordListEl.appendChild(li);
  });
}

btn.addEventListener('click', async () => {
  if (!running) {
    currentTask = input.value;
    await invoke('start_task', { name: currentTask });
    btn.textContent = 'Stop';
    running = true;
  } else {
    await invoke('stop_task', { name: currentTask });
    btn.textContent = 'Start';
    running = false;
    await refreshTasks();
  }
});

window.addEventListener('DOMContentLoaded', refreshTasks);
