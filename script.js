// Simple, robust to-do with persistence, filters, editing, drag-drop, theme, and PWA hooks

const STORAGE_KEY = "advanced_todos_v1";
const THEME_KEY = "advanced_theme";

/** @typedef {{ id:string, text:string, completed:boolean, createdAt:number, due?:string, priority:'low'|'normal'|'high', tags:string[] }} Todo */

/** @type {Todo[]} */
let todos = [];
let currentFilter = "all"; // all | active | completed | today | overdue
let searchQuery = "";

const elements = {
  addBtn: document.getElementById("addBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  clearCompletedBtn: document.getElementById("clearCompletedBtn"),
  taskInput: document.getElementById("taskInput"),
  dueInput: document.getElementById("dueInput"),
  priorityInput: document.getElementById("priorityInput"),
  tagsInput: document.getElementById("tagsInput"),
  taskList: document.getElementById("taskList"),
  filters: document.querySelectorAll(".filter"),
  counts: document.getElementById("counts"),
  searchInput: document.getElementById("searchInput"),
  themeToggle: document.getElementById("themeToggle"),
  installBtn: document.getElementById("installBtn"),
};

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    todos = raw ? JSON.parse(raw) : [];
  } catch (e) {
    todos = [];
  }
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseTags(input) {
  if (!input) return [];
  return input
    .split(/[,\s]+/)
    .map(t => t.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

function addTask() {
  const text = elements.taskInput.value.trim();
  if (text === "") return;

  /** @type {Todo} */
  const todo = {
    id: generateId(),
    text,
    completed: false,
    createdAt: Date.now(),
    due: elements.dueInput.value || undefined,
    priority: /** @type any */ (elements.priorityInput.value || "normal"),
    tags: parseTags(elements.tagsInput.value),
  };
  todos.unshift(todo);
  elements.taskInput.value = "";
  elements.dueInput.value = "";
  elements.tagsInput.value = "";
  elements.priorityInput.value = "normal";
  saveTodos();
  render();
}

function removeTask(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  render();
}

function toggleCompleted(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderCounts();
  }
}

function editTask(id, newText) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.text = newText.trim() || todo.text;
    saveTodos();
    render();
  }
}

function clearAll() {
  if (!confirm("Delete all tasks?")) return;
  todos = [];
  saveTodos();
  render();
}

function clearCompleted() {
  todos = todos.filter(t => !t.completed);
  saveTodos();
  render();
}

function isDueToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isOverdue(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  d.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return d < today;
}

function applyFilterAndSearch(list) {
  let filtered = list;
  if (currentFilter === "active") filtered = filtered.filter(t => !t.completed);
  if (currentFilter === "completed") filtered = filtered.filter(t => t.completed);
  if (currentFilter === "today") filtered = filtered.filter(t => isDueToday(t.due));
  if (currentFilter === "overdue") filtered = filtered.filter(t => isOverdue(t.due));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }
  return filtered;
}

function renderCounts() {
  const total = todos.length;
  const active = todos.filter(t => !t.completed).length;
  const completed = total - active;
  elements.counts.textContent = `${total} items • ${active} active • ${completed} done`;
}

function createTaskItem(todo) {
  const li = document.createElement("li");
  li.setAttribute("draggable", "true");
  li.dataset.id = todo.id;
  li.dataset.priority = todo.priority;
  if (todo.completed) li.classList.add("completed");

  // Drag events
  li.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", todo.id);
  });
  li.addEventListener("dragover", e => {
    e.preventDefault();
  });
  li.addEventListener("drop", e => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === todo.id) return;
    const fromIndex = todos.findIndex(t => t.id === sourceId);
    const toIndex = todos.findIndex(t => t.id === todo.id);
    if (fromIndex >= 0 && toIndex >= 0) {
      const [moved] = todos.splice(fromIndex, 1);
      todos.splice(toIndex, 0, moved);
      saveTodos();
      render();
    }
  });

  const left = document.createElement("div");
  left.className = "left";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", () => toggleCompleted(todo.id));

  const text = document.createElement("span");
  text.textContent = todo.text;
  text.title = todo.text;
  text.addEventListener("dblclick", () => beginEdit(text, todo));

  left.appendChild(checkbox);
  left.appendChild(text);

  const right = document.createElement("div");
  right.className = "right";

  const meta = document.createElement("div");
  meta.className = "meta";
  if (todo.due) {
    const due = document.createElement("span");
    const overdue = isOverdue(todo.due) && !todo.completed;
    due.textContent = `📅 ${todo.due}${overdue ? " (overdue)" : isDueToday(todo.due) ? " (today)" : ""}`;
    due.style.color = overdue ? "#e11d48" : "inherit";
    meta.appendChild(due);
  }
  const pr = document.createElement("span");
  pr.textContent = todo.priority === "high" ? "⬆️ High" : todo.priority === "low" ? "⬇️ Low" : "↔️ Normal";
  meta.appendChild(pr);

  const tags = document.createElement("div");
  tags.className = "tags";
  todo.tags.forEach(t => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `#${t}`;
    tags.appendChild(tag);
  });

  const actions = document.createElement("div");
  actions.className = "actions";
  const editBtn = document.createElement("button");
  editBtn.className = "secondary";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => beginEdit(text, todo));
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => removeTask(todo.id));
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  right.appendChild(meta);
  if (todo.tags.length) right.appendChild(tags);
  right.appendChild(actions);

  li.appendChild(left);
  li.appendChild(right);
  return li;
}

function beginEdit(textElement, todo) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = todo.text;
  input.style.minWidth = "200px";
  textElement.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => editTask(todo.id, input.value);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") render();
  });
  input.addEventListener("blur", commit);
}

function render() {
  elements.taskList.innerHTML = "";
  const list = applyFilterAndSearch(todos);
  list.forEach(t => elements.taskList.appendChild(createTaskItem(t)));
  renderCounts();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter").forEach(btn => btn.classList.toggle("active", btn.dataset.filter === filter));
  render();
}

function restoreTheme() {
  const t = localStorage.getItem(THEME_KEY);
  if (t === "dark") document.body.classList.add("dark");
  elements.themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  elements.themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

function setupPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elements.installBtn.hidden = false;
  });
  elements.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    elements.installBtn.hidden = true;
    deferredPrompt = null;
  });
}

function bindEvents() {
  elements.addBtn.addEventListener("click", addTask);
  elements.taskInput.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
  elements.dueInput.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
  elements.tagsInput.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
  elements.clearAllBtn.addEventListener("click", clearAll);
  elements.clearCompletedBtn.addEventListener("click", clearCompleted);
  elements.filters.forEach(btn => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));
  elements.searchInput.addEventListener("input", () => { searchQuery = elements.searchInput.value; render(); });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }
  });
  elements.themeToggle.addEventListener("click", toggleTheme);
}

function init() {
  restoreTheme();
  loadTodos();
  bindEvents();
  setupPWA();
  render();
}

init();

