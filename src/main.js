import './style.css'
import { createIcons, Plus, X, User } from 'lucide'
import { supabase } from './supabase.js'
import {
  signInAnonymously,
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  claimAnonymousTodos,
} from './auth.js'

// ─── DOM ────────────────────────────────────────────────────────────────────

const form = document.querySelector('.todo-app__form')
const input = document.querySelector('#todo-input')
const itemsContainer = document.querySelector('.todo-app__items')
const eyebrow = document.querySelector('.todo-app__eyebrow')
const progressEl = document.querySelector('.todo-app__progress')

const authDialog = document.querySelector('.auth-dialog')
const authAuthView = document.querySelector('.auth-dialog__auth-view')
const authUserView = document.querySelector('.auth-dialog__user-view')
const authForm = document.querySelector('.auth-dialog__form')
const authEmailInput = document.querySelector('#auth-email')
const authPasswordInput = document.querySelector('#auth-password')
const authErrorEl = document.querySelector('.auth-dialog__error')
const authSubmitButton = document.querySelector('.auth-dialog__submit')
const authSubmitLabel = document.querySelector('.auth-dialog__submit-label')
const authTabs = document.querySelectorAll('.auth-dialog__tab')
// Close buttons are inside <form method="dialog"> — native HTML closes the dialog.

const accountButton = document.querySelector('.todo-app__account-button')
const authDialogUserEmail = document.querySelector('.auth-dialog__user-email')
const authDialogSignOut = document.querySelector('.auth-dialog__sign-out')

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
let authMode = 'signup' // 'signup' | 'signin'

// ─── Icons ──────────────────────────────────────────────────────────────────

function hydrateIcons() {
  createIcons({
    icons: { Plus, X, User },
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

// ─── Supabase CRUD ───────────────────────────────────────────────────────────

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

// ─── Auth UI ─────────────────────────────────────────────────────────────────

function setAuthMode(mode) {
  authMode = mode
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode
    tab.classList.toggle('is-active', isActive)
    tab.setAttribute('aria-selected', String(isActive))
  })
  if (authSubmitLabel) authSubmitLabel.textContent = mode === 'signup' ? 'Create account' : 'Sign in'
  if (authPasswordInput) {
    authPasswordInput.setAttribute(
      'autocomplete',
      mode === 'signup' ? 'new-password' : 'current-password',
    )
  }
  clearAuthError()
}

function showAuthError(message) {
  if (!authErrorEl) return
  authErrorEl.textContent = message
  authErrorEl.hidden = false
}

function clearAuthError() {
  if (!authErrorEl) return
  authErrorEl.textContent = ''
  authErrorEl.hidden = true
}

function updateHeaderForUser(user) {
  const isAnonymous = !user?.email

  if (accountButton) {
    accountButton.classList.toggle('is-signed-in', !isAnonymous)
    if (!isAnonymous) {
      accountButton.dataset.initial = (user.email[0] ?? '?').toUpperCase()
    } else {
      delete accountButton.dataset.initial
    }
  }

  if (authAuthView) authAuthView.hidden = !isAnonymous
  if (authUserView) authUserView.hidden = isAnonymous
  if (!isAnonymous && authDialogUserEmail) {
    authDialogUserEmail.textContent = user.email ?? ''
  }
}

function openAuthDialog() {
  authDialog?.showModal()
  authEmailInput?.focus()
}

function closeAuthDialog() {
  authDialog?.close()
  // Cleanup runs in the dialog 'close' event below.
}

// Reset form state whenever the dialog is closed (by any means).
authDialog?.addEventListener('close', () => {
  clearAuthError()
  authForm?.reset()
  setAuthMode('signup')
  if (authSubmitButton) authSubmitButton.disabled = false
})

// ─── Auth Events ─────────────────────────────────────────────────────────────

accountButton?.addEventListener('click', () => {
  openAuthDialog()
})

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setAuthMode(tab.dataset.mode)
  })
})

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const email = authEmailInput?.value.trim() ?? ''
  const password = authPasswordInput?.value ?? ''

  if (!email || !password) {
    showAuthError('Please enter your email and password.')
    return
  }

  authSubmitButton.disabled = true
  clearAuthError()

  if (authMode === 'signup') {
    const { error } = await signUp(email, password)
    if (error) {
      showAuthError(error.message)
      authSubmitButton.disabled = false
      return
    }
    // updateUser promotes the anonymous user in-place — no migration needed.
    // onAuthStateChange will fire and reload todos.
    closeAuthDialog()
  } else {
    // Capture anonymous user ID before signing in so we can migrate their todos.
    const { data: sessionData } = await getSession()
    const anonUserId = sessionData.session?.user?.id ?? null
    const wasAnonymous = sessionData.session?.user?.is_anonymous ?? false

    const { error } = await signIn(email, password)
    if (error) {
      showAuthError(error.message)
      authSubmitButton.disabled = false
      return
    }

    if (wasAnonymous && anonUserId) {
      const { error: rpcError } = await claimAnonymousTodos(anonUserId)
      if (rpcError) {
        console.error('Failed to migrate anonymous todos:', rpcError.message)
      }
    }

    // onAuthStateChange will fire and reload todos.
    closeAuthDialog()
  }

  authSubmitButton.disabled = false
})

authDialogSignOut?.addEventListener('click', async () => {
  closeAuthDialog()
  await signOut()
  // Sign back in anonymously so the app stays usable immediately.
  await signInAnonymously()
  // onAuthStateChange will fire and reload todos (empty list for new anon user).
})

// ─── Todo Events ─────────────────────────────────────────────────────────────

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

// React to auth state changes (sign-in, sign-up, sign-out).
onAuthStateChange((_event, session) => {
  updateHeaderForUser(session?.user ?? null)
  // Clear local state and reload from Supabase whenever the session changes.
  todos = []
  renderedIds.clear()
  loadTodos()
})

// Ensure there's always an active session — create an anonymous one if needed.
async function init() {
  const { data } = await getSession()
  if (!data.session) {
    await signInAnonymously()
    // onAuthStateChange will fire and call loadTodos.
  } else {
    updateHeaderForUser(data.session.user)
    loadTodos()
  }
}

init()
