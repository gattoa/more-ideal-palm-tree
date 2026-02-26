import './style.css'

const form = document.querySelector('.todo-app__form')
const input = document.querySelector('#todo-input')
const itemsContainer = document.querySelector('.todo-app__items')

if (!form || !input || !itemsContainer) {
  throw new Error('Todo app markup is missing required elements.')
}

const todos = []
let nextTodoId = 1

function renderTodos() {
  itemsContainer.replaceChildren()

  for (const todo of todos) {
    const item = document.createElement('article')
    item.className = 'todo-item'
    if (todo.completed) {
      item.classList.add('is-completed')
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
    deleteButton.textContent = 'Delete'

    item.append(toggle, text, deleteButton)
    itemsContainer.append(item)
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()

  const text = input.value.trim()
  if (!text) {
    return
  }

  todos.push({
    id: nextTodoId,
    text,
    completed: false,
  })
  nextTodoId += 1

  input.value = ''
  input.focus()
  renderTodos()
})

itemsContainer.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || !target.matches('.todo-item__toggle')) {
    return
  }

  const todoId = Number(target.dataset.todoId)
  const todo = todos.find((entry) => entry.id === todoId)
  if (!todo) {
    return
  }

  todo.completed = target.checked
  renderTodos()
})

itemsContainer.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const deleteButton = target.closest('.todo-item__delete-button')
  if (!deleteButton || !(deleteButton instanceof HTMLButtonElement)) {
    return
  }

  const todoId = Number(deleteButton.dataset.todoId)
  const todoIndex = todos.findIndex((entry) => entry.id === todoId)
  if (todoIndex === -1) {
    return
  }

  todos.splice(todoIndex, 1)
  renderTodos()
})

renderTodos()
