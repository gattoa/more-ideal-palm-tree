import './style.css'
import { createIcons, Plus, X } from 'lucide'

// ─── DOM ────────────────────────────────────────────────────────────────────

const form = document.querySelector('.todo-app__form')
const input = document.querySelector('#todo-input')
const itemsContainer = document.querySelector('.todo-app__items')
const eyebrow = document.querySelector('.todo-app__eyebrow')
const progressEl = document.querySelector('.todo-app__progress')

if (!form || !input || !itemsContainer) {
  throw new Error('Todo app markup is missing required elements.')
}

// Set date in eyebrow
if (eyebrow) {
  eyebrow.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// ─── State ──────────────────────────────────────────────────────────────────

const todos = []
let nextTodoId = 1
const renderedIds = new Set()

// ─── Icons ──────────────────────────────────────────────────────────────────

function hydrateIcons() {
  createIcons({
    icons: { Plus, X },
    attrs: { 'aria-hidden': 'true' },
  })
}

// ─── Progress ───────────────────────────────────────────────────────────────

function updateProgress() {
  if (!progressEl) return
  const total = todos.length
  const done = todos.filter((t) => t.completed).length
  if (total === 0 || done === 0) {
    progressEl.textContent = ''
    return
  }
  if (done === total) {
    progressEl.textContent = `All ${total} step${total === 1 ? '' : 's'} done`
    return
  }
  progressEl.textContent = `${done} of ${total} step${total === 1 ? '' : 's'} done`
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderTodos() {
  itemsContainer.replaceChildren()

  if (todos.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'todo-empty'
    empty.textContent = 'What will you do today? Add your first step above.'
    itemsContainer.append(empty)
    updateProgress()
    return
  }

  for (const todo of todos) {
    const item = document.createElement('article')
    item.className = 'todo-item'
    if (todo.completed) {
      item.classList.add('is-completed')
    }

    const isNew = !renderedIds.has(todo.id)
    if (isNew) {
      item.classList.add('is-new')
      renderedIds.add(todo.id)
    }

    const toggle = document.createElement('input')
    toggle.className = 'todo-item__toggle'
    toggle.type = 'checkbox'
    toggle.checked = todo.completed
    toggle.dataset.todoId = String(todo.id)
    toggle.setAttribute('aria-label', `Mark "${todo.text}" as complete`)

    const text = document.createElement('p')
    text.className = 'todo-item__text'
    text.textContent = todo.text

    const deleteButton = document.createElement('button')
    deleteButton.className = 'todo-item__delete-button'
    deleteButton.type = 'button'
    deleteButton.dataset.todoId = String(todo.id)
    deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)

    // Lucide icon placeholder — replaced by hydrateIcons() below
    const icon = document.createElement('i')
    icon.dataset.lucide = 'x'
    deleteButton.append(icon)

    item.append(toggle, text, deleteButton)
    itemsContainer.append(item)
  }

  // Replace all data-lucide placeholders with real SVGs
  hydrateIcons()
  updateProgress()
}

// ─── Events ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text) return
  todos.push({ id: nextTodoId, text, completed: false })
  nextTodoId += 1
  input.value = ''
  input.focus()
  renderTodos()
})

itemsContainer.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || !target.matches('.todo-item__toggle')) return

  const todoId = Number(target.dataset.todoId)
  const todo = todos.find((entry) => entry.id === todoId)
  if (!todo) return

  todo.completed = target.checked
  renderTodos()
})

itemsContainer.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  const deleteButton = target.closest('.todo-item__delete-button')
  if (!deleteButton || !(deleteButton instanceof HTMLButtonElement)) return

  const todoId = Number(deleteButton.dataset.todoId)
  const todoIndex = todos.findIndex((entry) => entry.id === todoId)
  if (todoIndex === -1) return

  const itemEl = deleteButton.closest('.todo-item')
  renderedIds.delete(todoId)

  if (itemEl) {
    itemEl.classList.add('is-removing')
    deleteButton.disabled = true
    setTimeout(() => {
      todos.splice(todoIndex, 1)
      renderTodos()
    }, 210)
  } else {
    todos.splice(todoIndex, 1)
    renderTodos()
  }
})

// ─── Init ───────────────────────────────────────────────────────────────────

hydrateIcons()
renderTodos()
