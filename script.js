// ─── State ──────────────────────────────────────────────────────────────────
const STATE_KEY = 'taskflow_v2';

let state = {
  lists: [
    { id: 'inbox', name: 'Inbox' },
    { id: 'personal', name: 'Personal' },
    { id: 'work', name: 'Work' }
  ],
  tasks: [],
  activeList: 'inbox',
  filter: 'all',
  editingTaskId: null
};

// ─── Persistence ────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STATE_KEY);
  if (raw) {
    try { Object.assign(state, JSON.parse(raw)); }
    catch (e) { console.warn('Could not load saved state.'); }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function isOverdue(task) {
  if (!task.datetime || task.completed) return false;
  return new Date(task.datetime) < new Date();
}

function isToday(task) {
  if (!task.datetime) return false;
  const d = new Date(task.datetime);
  const n = new Date();
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate();
}

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const now = new Date();
  const diffMs = d - now;
  const diffDays = Math.ceil(diffMs / 86400000);

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  return `${date}, ${time}`;
}

function getListName(listId) {
  const l = state.lists.find(l => l.id === listId);
  return l ? l.name : '—';
}

function getFilteredTasks() {
  const listTasks = state.tasks.filter(t => t.listId === state.activeList);
  switch (state.filter) {
    case 'pending':   return listTasks.filter(t => !t.completed);
    case 'completed': return listTasks.filter(t => t.completed);
    case 'overdue':   return listTasks.filter(t => isOverdue(t));
    default:          return listTasks;
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────
function render() {
  renderSidebar();
  renderTaskList();
  renderStats();
}

function renderSidebar() {
  const nav = document.getElementById('listNav');
  nav.innerHTML = '';

  state.lists.forEach(list => {
    const pendingCount = state.tasks.filter(t => t.listId === list.id && !t.completed).length;
    const li = document.createElement('li');
    li.className = 'list-nav-item' + (list.id === state.activeList ? ' active' : '');
    li.dataset.id = list.id;
    li.innerHTML = `
      <span class="list-name">${escHtml(list.name)}</span>
      ${pendingCount > 0 ? `<span class="list-badge">${pendingCount}</span>` : ''}
    `;
    li.addEventListener('click', () => {
      state.activeList = list.id;
      state.filter = 'all';
      document.getElementById('filterSelect').value = 'all';
      render();
    });
    nav.appendChild(li);
  });

  // Update header title
  document.getElementById('listTitle').textContent = getListName(state.activeList);

  // Hide delete for built-in lists
  const builtIn = ['inbox', 'personal', 'work'];
  document.getElementById('btnDeleteList').style.display =
    builtIn.includes(state.activeList) ? 'none' : '';
}

function renderTaskList() {
  const ul = document.getElementById('taskList');
  const empty = document.getElementById('emptyState');
  const tasks = getFilteredTasks();

  // Sort: incomplete first, then by datetime, then by creation
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.datetime && b.datetime) return new Date(a.datetime) - new Date(b.datetime);
    if (a.datetime) return -1;
    if (b.datetime) return 1;
    return a.createdAt - b.createdAt;
  });

  ul.innerHTML = '';

  tasks.forEach(task => {
    const li = document.createElement('li');
    const overdue = isOverdue(task);
    const today  = isToday(task);
    li.className = 'task-item' + (task.completed ? ' completed' : overdue ? ' overdue' : '');
    li.dataset.id = task.id;

    const dateClass = overdue ? 'task-date overdue' : today ? 'task-date today' : 'task-date';
    const dateIcon  = overdue ? '⚠' : '🕐';

    li.innerHTML = `
      <div class="task-check" title="${task.completed ? 'Mark pending' : 'Mark complete'}">
        ${task.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-name">${escHtml(task.name)}</div>
        <div class="task-meta">
          ${task.datetime ? `<span class="${dateClass}">${dateIcon} ${formatDateTime(task.datetime)}</span>` : ''}
          ${task.listId !== state.activeList ? `<span class="task-list-tag">${escHtml(getListName(task.listId))}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" data-action="edit" title="Edit task">✎</button>
        <button class="btn-icon danger" data-action="delete" title="Delete task">✕</button>
      </div>
    `;

    // Events
    li.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
    li.querySelector('[data-action="edit"]').addEventListener('click', () => openEdit(task.id));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));

    ul.appendChild(li);
  });

  empty.classList.toggle('visible', tasks.length === 0);
  document.getElementById('taskCount').textContent =
    tasks.length ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''}` : '';
}

function renderStats() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.completed).length;
  document.getElementById('statTotal').textContent = `${total} task${total !== 1 ? 's' : ''}`;
  document.getElementById('statDone').textContent  = `${done} done`;
}

function populateListSelect(selectEl, currentListId) {
  selectEl.innerHTML = '';
  state.lists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    if (l.id === currentListId) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

// ─── Task Actions ────────────────────────────────────────────────────────────
function addTask(name, datetime) {
  if (!name.trim()) return;
  state.tasks.push({
    id: genId(),
    name: name.trim(),
    datetime: datetime || '',
    listId: state.activeList,
    completed: false,
    createdAt: Date.now()
  });
  save();
  render();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) { task.completed = !task.completed; save(); render(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  render();
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────
function openEdit(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingTaskId = id;

  document.getElementById('editTaskInput').value = task.name;
  document.getElementById('editTaskDate').value  = task.datetime || '';
  populateListSelect(document.getElementById('editTaskList'), task.listId);

  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('editTaskInput').focus();
}

function closeEdit() {
  state.editingTaskId = null;
  document.getElementById('modalOverlay').classList.remove('open');
}

function saveEdit() {
  const task = state.tasks.find(t => t.id === state.editingTaskId);
  if (!task) return;

  const name = document.getElementById('editTaskInput').value.trim();
  if (!name) return;

  task.name     = name;
  task.datetime = document.getElementById('editTaskDate').value || '';
  task.listId   = document.getElementById('editTaskList').value;

  save();
  closeEdit();
  render();
}

// ─── New List Modal ───────────────────────────────────────────────────────────
function openNewList() {
  document.getElementById('newListInput').value = '';
  document.getElementById('newListOverlay').classList.add('open');
  document.getElementById('newListInput').focus();
}

function closeNewList() {
  document.getElementById('newListOverlay').classList.remove('open');
}

function saveNewList() {
  const name = document.getElementById('newListInput').value.trim();
  if (!name) return;
  const id = genId();
  state.lists.push({ id, name });
  state.activeList = id;
  save();
  closeNewList();
  render();
}

function deleteActiveList() {
  const builtIn = ['inbox', 'personal', 'work'];
  if (builtIn.includes(state.activeList)) return;

  // Move tasks to inbox
  state.tasks.forEach(t => { if (t.listId === state.activeList) t.listId = 'inbox'; });
  state.lists = state.lists.filter(l => l.id !== state.activeList);
  state.activeList = 'inbox';
  save();
  render();
}

// ─── Security ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Bind Events ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Add task
  document.getElementById('btnAddTask').addEventListener('click', () => {
    addTask(
      document.getElementById('newTaskInput').value,
      document.getElementById('newTaskDate').value
    );
    document.getElementById('newTaskInput').value = '';
    document.getElementById('newTaskDate').value  = '';
    document.getElementById('newTaskInput').focus();
  });

  document.getElementById('newTaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnAddTask').click();
  });

  // Filter
  document.getElementById('filterSelect').addEventListener('change', e => {
    state.filter = e.target.value;
    render();
  });

  // Delete list
  document.getElementById('btnDeleteList').addEventListener('click', deleteActiveList);

  // New list
  document.getElementById('btnNewList').addEventListener('click', openNewList);
  document.getElementById('btnCancelList').addEventListener('click', closeNewList);
  document.getElementById('btnSaveList').addEventListener('click', saveNewList);
  document.getElementById('newListInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNewList();
  });

  // Edit modal
  document.getElementById('btnCancelEdit').addEventListener('click', closeEdit);
  document.getElementById('btnSaveEdit').addEventListener('click', saveEdit);
  document.getElementById('editTaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
  });

  // Close modals on overlay click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEdit();
  });
  document.getElementById('newListOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewList();
  });

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeEdit(); closeNewList(); }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
load();
bindEvents();
render();

// Refresh overdue status every minute
setInterval(() => render(), 60_000);