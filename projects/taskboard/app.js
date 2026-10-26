// Taskboard: kanban board in vanilla JS.
// Shows: HTML5 drag and drop, keyboard alternatives, <dialog>, state → render,
// localStorage persistence, live-region announcements for screen readers.

const STORE_KEY = 'taskboard-v1';
const STATUSES = ['todo', 'doing', 'done'];
const LABELS = { todo: 'To do', doing: 'In progress', done: 'Done' };

const sample = [
  { id: uid(), title: 'Write README for the portfolio', notes: 'Live links, tech used, how to run locally.', priority: 'high', status: 'todo', created: Date.now() },
  { id: uid(), title: 'Run Lighthouse on every page', notes: 'Target 90+ on mobile.', priority: 'medium', status: 'doing', created: Date.now() },
  { id: uid(), title: 'Fix layout shift on hero', notes: 'Set width/height on media.', priority: 'low', status: 'done', created: Date.now() },
  { id: uid(), title: 'Add dark mode', notes: '', priority: 'low', status: 'todo', created: Date.now() },
];

let tasks = load() || sample;
let query = '';
let editingId = null;

const board = document.getElementById('board');
const dialog = document.getElementById('dialog');
const form = document.getElementById('task-form');
const fields = form.elements; // form.title would be the form's own title attribute, not the input
const announcer = document.getElementById('announcer');

// ----- Render: the DOM is always rebuilt from `tasks` -----
function render(focusId) {
  STATUSES.forEach((status) => {
    const column = board.querySelector(`[data-status="${status}"]`);
    const all = tasks.filter((t) => t.status === status);
    const shown = all.filter((t) => matches(t));
    column.querySelector('.count').textContent = query ? `${shown.length}/${all.length}` : all.length;

    const ul = column.querySelector('.cards');
    ul.innerHTML = shown.length ? '' : `<li class="empty">${query ? 'No matches' : 'Drop tasks here'}</li>`;
    shown.forEach((t) => ul.append(cardEl(t)));
  });
  if (focusId) board.querySelector(`[data-id="${focusId}"]`)?.focus();
}

function matches(t) {
  const q = query.toLowerCase();
  return !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
}

function cardEl(t) {
  const li = document.createElement('li');
  li.className = 'card';
  li.draggable = true;
  li.tabIndex = 0;
  li.dataset.id = t.id;
  li.dataset.priority = t.priority;
  li.setAttribute('aria-label', `${t.title}, ${t.priority} priority, in ${LABELS[t.status]}`);

  const i = STATUSES.indexOf(t.status);
  // textContent (not innerHTML) for user-typed text, so it can't inject HTML
  li.innerHTML = `
    <h3></h3>
    <p></p>
    <div class="meta">
      <span class="tag">${t.priority}</span>
      <span class="move">
        <button data-move="-1" aria-label="Move left" ${i === 0 ? 'disabled' : ''}>←</button>
        <button data-move="1" aria-label="Move right" ${i === STATUSES.length - 1 ? 'disabled' : ''}>→</button>
      </span>
    </div>
    <div class="card-actions">
      <button data-action="edit" aria-label="Edit task">✎</button>
      <button data-action="delete" aria-label="Delete task">✕</button>
    </div>`;
  li.querySelector('h3').textContent = t.title;
  li.querySelector('p').textContent = t.notes;
  return li;
}

// ----- Actions -----
function move(id, delta) {
  const t = tasks.find((x) => x.id === id);
  const next = STATUSES[STATUSES.indexOf(t.status) + delta];
  if (!next) return;
  setStatus(id, next);
}

function setStatus(id, status) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.status === status) return;
  t.status = status;
  save();
  render(id);
  announce(`Moved "${t.title}" to ${LABELS[status]}`);
}

function remove(id) {
  const t = tasks.find((x) => x.id === id);
  if (!confirm(`Delete "${t.title}"?`)) return;
  tasks = tasks.filter((x) => x.id !== id);
  save();
  render();
  announce(`Deleted "${t.title}"`);
}

function openDialog(id = null) {
  editingId = id;
  const t = tasks.find((x) => x.id === id);
  document.getElementById('dialog-title').textContent = t ? 'Edit task' : 'New task';
  fields.title.value = t?.title || '';
  fields.notes.value = t?.notes || '';
  fields.priority.value = t?.priority || 'medium';
  dialog.showModal();
  fields.title.focus();
}

form.addEventListener('submit', (e) => {
  const title = fields.title.value.trim();
  if (!title) { e.preventDefault(); fields.title.focus(); return; }

  const values = { title, notes: fields.notes.value.trim(), priority: fields.priority.value };
  let id = editingId;
  if (id) {
    Object.assign(tasks.find((x) => x.id === id), values);
    announce(`Updated "${title}"`);
  } else {
    id = uid();
    tasks.push({ id, ...values, status: 'todo', created: Date.now() });
    announce(`Added "${title}" to To do`);
  }
  save();
  query = '';
  document.getElementById('filter').value = '';
  render(id);
});

document.getElementById('cancel').addEventListener('click', () => dialog.close());
document.getElementById('new-task').addEventListener('click', () => openDialog());

// ----- Event delegation: one set of listeners for every card -----
board.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'edit') openDialog(id);
  if (btn.dataset.action === 'delete') remove(id);
  if (btn.dataset.move) move(id, Number(btn.dataset.move));
});

board.addEventListener('keydown', (e) => {
  const card = e.target.closest('.card');
  if (!card || e.target !== card) return; // ignore keys pressed on the card's buttons
  const id = card.dataset.id;
  if (e.key === 'ArrowRight') { e.preventDefault(); move(id, 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); move(id, -1); }
  if (e.key === 'Enter') { e.preventDefault(); openDialog(id); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(id); }
});

// ----- Drag and drop -----
board.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.dataTransfer.setData('text/plain', card.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});

board.addEventListener('dragend', (e) => {
  e.target.closest('.card')?.classList.remove('dragging');
  board.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
});

board.addEventListener('dragover', (e) => {
  const column = e.target.closest('.column');
  if (!column) return;
  e.preventDefault(); // required, or the drop event never fires
  board.querySelectorAll('.drag-over').forEach((c) => c !== column && c.classList.remove('drag-over'));
  column.classList.add('drag-over');
});

board.addEventListener('drop', (e) => {
  const column = e.target.closest('.column');
  if (!column) return;
  e.preventDefault();
  column.classList.remove('drag-over');
  setStatus(e.dataTransfer.getData('text/plain'), column.dataset.status);
});

// ----- Search -----
document.getElementById('filter').addEventListener('input', (e) => {
  query = e.target.value.trim();
  render();
});

// ----- Helpers -----
function announce(msg) {
  announcer.textContent = '';
  setTimeout(() => { announcer.textContent = msg; }, 50); // reset so repeated messages are read again
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch {}
}

render();
