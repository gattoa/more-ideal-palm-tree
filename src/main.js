import './style.css'
import { createIcons, Plus, X } from 'lucide'
import { supabase } from './supabase.js'

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

let todos = []
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
    toggle.dataset.todoId = todo.id
    toggle.setAttribute('aria-label', `Mark "${todo.text}" as complete`)

    const text = document.createElement('p')
    text.className = 'todo-item__text'
    text.textContent = todo.text

    const deleteButton = document.createElement('button')
    deleteButton.className = 'todo-item__delete-button'
    deleteButton.type = 'button'
    deleteButton.dataset.todoId = todo.id
    deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)

    const icon = document.createElement('i')
    icon.dataset.lucide = 'x'
    deleteButton.append(icon)

    item.append(toggle, text, deleteButton)
    itemsContainer.append(item)
  }

  hydrateIcons()
  updateProgress()
}

// ─── Supabase ────────────────────────────────────────────────────────────────

async function loadTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load todos:', error.message)
    return
  }

  todos = data
  // Mark all initially-loaded todos as already rendered (no entry animation)
  for (const todo of todos) {
    renderedIds.add(todo.id)
  }
  renderTodos()
}

async function addTodo(text) {
  const { data, error } = await supabase
    .from('todos')
    .insert({ text, completed: false })
    .select()
    .single()

  if (error) {
    console.error('Failed to add todo:', error.message)
    return
  }

  todos.push(data)
  renderTodos()
}

async function toggleTodo(id, completed) {
  const { error } = await supabase
    .from('todos')
    .update({ completed })
    .eq('id', id)

  if (error) {
    console.error('Failed to update todo:', error.message)
    // Revert optimistic update
    const todo = todos.find((t) => t.id === id)
    if (todo) todo.completed = !completed
    renderTodos()
    return
  }

  const todo = todos.find((t) => t.id === id)
  if (todo) todo.completed = completed
  renderTodos()
}

async function deleteTodo(id, itemEl, deleteButton) {
  deleteButton.disabled = true

  const { error } = await supabase.from('todos').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete todo:', error.message)
    deleteButton.disabled = false
    return
  }

  renderedIds.delete(id)

  if (itemEl) {
    itemEl.classList.add('is-removing')
    setTimeout(() => {
      todos = todos.filter((t) => t.id !== id)
      renderTodos()
    }, 210)
  } else {
    todos = todos.filter((t) => t.id !== id)
    renderTodos()
  }
}

// ─── Events ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  input.focus()
  addTodo(text)
})

itemsContainer.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || !target.matches('.todo-item__toggle')) return

  const id = target.dataset.todoId
  // Optimistic update
  const todo = todos.find((t) => t.id === id)
  if (!todo) return
  todo.completed = target.checked
  renderTodos()
  toggleTodo(id, target.checked)
})

itemsContainer.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  const deleteButton = target.closest('.todo-item__delete-button')
  if (!deleteButton || !(deleteButton instanceof HTMLButtonElement)) return

  const id = deleteButton.dataset.todoId
  const itemEl = deleteButton.closest('.todo-item')
  deleteTodo(id, itemEl, deleteButton)
})

// ─── Init ───────────────────────────────────────────────────────────────────

hydrateIcons()
loadTodos()
