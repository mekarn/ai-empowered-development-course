import { VibeKanbanWebCompanion } from 'vibe-kanban-web-companion';
import { format, isPast, isSameDay, parseISO, startOfDay } from 'date-fns';

// Todos array (Feature 1)
let todos = [];
let nextId = 1;

// Current filter (Feature 2)
let currentFilter = 'all';

// Current sort option
let currentSort = 'none'; // 'none' or 'dueDate'

// localStorage keys
const TODOS_KEY = 'todos';
const NEXT_ID_KEY = 'nextId';
const CHANGELOG_KEY = 'changelog';

// Changelog array
let changelog = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
    initVibeKanban();
});

function init() {
    // Load todos and changelog from localStorage
    loadTodos();
    loadChangelog();

    // Wire up add button
    const addBtn = document.getElementById('addBtn');
    const todoInput = document.getElementById('todoInput');

    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    // Wire up filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    // Wire up sort button
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        sortBtn.addEventListener('click', toggleSort);
    }

    // Wire up changelog button
    const changelogBtn = document.getElementById('changelogBtn');
    const changelogCloseBtn = document.getElementById('changelogCloseBtn');
    const changelogBackdrop = document.getElementById('changelogBackdrop');

    changelogBtn.addEventListener('click', openChangelog);
    changelogCloseBtn.addEventListener('click', closeChangelog);
    changelogBackdrop.addEventListener('click', closeChangelog);

    renderTodos();
    renderChangelog();
}

function initVibeKanban() {
    const companion = new VibeKanbanWebCompanion();
    companion.render(document.body);
}

// Feature 1: Add, toggle, delete todos
function addTodo() {
    const input = document.getElementById('todoInput');
    const dateInput = document.getElementById('dueDateInput');
    const text = input.value.trim();

    if (text === '') return;

    const dueDate = dateInput.value ? new Date(dateInput.value).toISOString() : null;

    todos.push({
        id: nextId++,
        text: text,
        completed: false,
        dueDate: dueDate
    });

    input.value = '';
    dateInput.value = '';
    addToChangelog('created', text);
    saveTodos();
    renderTodos();
    renderChangelog();
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        addToChangelog('completed', todo.text);
        saveTodos();
        renderTodos();
        renderChangelog();
    }
}

function deleteTodo(id) {
    const todo = todos.find(t => t.id === id);
    todos = todos.filter(t => t.id !== id);
    if (todo) {
        addToChangelog('deleted', todo.text);
    }
    saveTodos();
    renderTodos();
    renderChangelog();
}

// Feature 1: Render todos
function renderTodos() {
    const todoList = document.getElementById('todoList');
    let filteredTodos = getFilteredTodos();

    // Apply sorting if enabled
    if (currentSort === 'dueDate') {
        filteredTodos = sortTodosByDueDate(filteredTodos);
    }

    todoList.innerHTML = '';

    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        if (todo.completed) li.classList.add('completed');
        if (todo.dueDate && isOverdue(todo.dueDate)) {
            li.classList.add('overdue');
        }

        let dueDateHtml = '';
        if (todo.dueDate) {
            const dueDateStr = formatDueDate(todo.dueDate);
            dueDateHtml = `<span class="todo-due-date">${dueDateStr}</span>`;
        }

        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                ${dueDateHtml}
            </div>
            <button class="todo-delete">Delete</button>
        `;

        li.querySelector('.todo-checkbox').addEventListener('change', () => toggleTodo(todo.id));
        li.querySelector('.todo-delete').addEventListener('click', () => deleteTodo(todo.id));

        todoList.appendChild(li);
    });
}

// Feature 2: Filter todos based on current filter
function getFilteredTodos() {
    if (currentFilter === 'active') {
        return todos.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        return todos.filter(t => t.completed);
    }
    return todos; // 'all'
}

// Feature 2: Set filter and update UI
function setFilter(filter) {
    currentFilter = filter;

    // Update button styling
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });

    renderTodos();
}

// Feature 3: Sort by due date
function toggleSort() {
    currentSort = currentSort === 'dueDate' ? 'none' : 'dueDate';

    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        sortBtn.classList.toggle('active', currentSort === 'dueDate');
    }

    renderTodos();
}

function sortTodosByDueDate(todosToSort) {
    return [...todosToSort].sort((a, b) => {
        // Todos with no due date go to the end
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        // Compare dates - upcoming first
        const dateA = parseISO(a.dueDate);
        const dateB = parseISO(b.dueDate);
        return dateA - dateB;
    });
}

function formatDueDate(dateString) {
    try {
        const date = parseISO(dateString);
        const today = startOfDay(new Date());
        const dueDateDay = startOfDay(date);
        const timeDiff = dueDateDay - today;
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            return `Today, ${format(date, 'HH:mm')}`;
        } else if (daysDiff === 1) {
            return `Tomorrow, ${format(date, 'HH:mm')}`;
        } else if (daysDiff > 1 && daysDiff < 7) {
            return `${format(date, 'EEEE, HH:mm')}`;
        } else {
            return format(date, 'MMM d, yyyy HH:mm');
        }
    } catch (error) {
        return 'Invalid date';
    }
}

function isOverdue(dateString) {
    try {
        const date = parseISO(dateString);
        return isPast(date) && !isSameDay(date, new Date());
    } catch (error) {
        return false;
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// localStorage persistence
function saveTodos() {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    localStorage.setItem(NEXT_ID_KEY, nextId.toString());
}

function loadTodos() {
    const savedTodos = localStorage.getItem(TODOS_KEY);
    const savedNextId = localStorage.getItem(NEXT_ID_KEY);

    if (savedTodos) {
        todos = JSON.parse(savedTodos);
    }
    if (savedNextId) {
        nextId = parseInt(savedNextId, 10);
    }
}

// Changelog functions
function addToChangelog(type, text) {
    changelog.push({
        type: type,
        text: text,
        timestamp: new Date().toISOString()
    });
    saveChangelog();
}

function saveChangelog() {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(changelog));
}

function loadChangelog() {
    const savedChangelog = localStorage.getItem(CHANGELOG_KEY);
    if (savedChangelog) {
        changelog = JSON.parse(savedChangelog);
    }
}

function renderChangelog() {
    const changelogList = document.getElementById('changelogList');
    changelogList.innerHTML = '';

    changelog.forEach(entry => {
        const li = document.createElement('li');
        li.className = `changelog-entry ${entry.type}`;

        const date = new Date(entry.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString();

        li.innerHTML = `
            <div class="changelog-entry-type">${entry.type}</div>
            <div class="changelog-entry-text">"${escapeHtml(entry.text)}"</div>
            <div class="changelog-entry-time">${dateString} ${timeString}</div>
        `;

        changelogList.appendChild(li);
    });
}

function openChangelog() {
    const drawer = document.getElementById('changelogDrawer');
    const backdrop = document.getElementById('changelogBackdrop');
    drawer.classList.add('open');
    backdrop.classList.add('active');
}

function closeChangelog() {
    const drawer = document.getElementById('changelogDrawer');
    const backdrop = document.getElementById('changelogBackdrop');
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
}
