import './style.css'
import { createIcons, Plus, X, User, ChevronDown, Check } from 'lucide'
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
import { loadPaths, createPath, addStepToPath, removeStepFromPath, loadStepPathsMap } from './paths.js'
import { loadMilestones, createMilestone } from './milestones.js'
import { renderTrailView } from './trail-view.js'
import { getView, setView } from './views.js'
import copy, { t } from './copy/index.js'

// ─── DOM ────────────────────────────────────────────────────────────────────

const form = document.querySelector('.todo-app__form')
const input = document.querySelector('#todo-input')
const itemsContainer = document.querySelector('.todo-app__items')
const eyebrow = document.querySelector('.todo-app__eyebrow')
const progressEl = document.querySelector('.todo-app__progress')

const journeyContextBtn = document.querySelector('.journey-context')
const journeyContextName = document.querySelector('.journey-context__name')

const trailViewContainer = document.querySelector('.trail-view')
const viewNavTabs = document.querySelectorAll('.todo-app__title-link')

const sortBar = document.querySelector('.todo-app__sort-bar')
const sortChips = document.querySelectorAll('.todo-app__sort-chip')

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
const authPasswordToggle = document.querySelector('.auth-dialog__password-toggle')

const confirmDialog = document.querySelector('.confirm-dialog')
const confirmDialogDetail = document.querySelector('.confirm-dialog__detail')
const confirmDialogCancel = document.querySelector('.confirm-dialog__cancel')
const confirmDialogConfirm = document.querySelector('.confirm-dialog__confirm')

const accountButton = document.querySelector('.todo-app__account-button')
const authDialogUserEmail = document.querySelector('.auth-dialog__user-email')
const authDialogSignOut = document.querySelector('.auth-dialog__sign-out')

if (!form || !input || !itemsContainer) {
  throw new Error('Todo app markup is missing required elements.')
}

/** Resolve a dot-path (e.g. "dialogs.confirmDeleteTitle") into a value from the copy object. */
function getCopyValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

/** Apply copy from JSON to all elements with data-copy. Runs once after DOM is ready. */
function applyCopyToDom() {
  document.querySelectorAll('[data-copy]').forEach((el) => {
    const key = el.getAttribute('data-copy')
    const attr = el.getAttribute('data-copy-attr')
    const value = getCopyValue(copy, key)
    if (value == null || value === '') return
    if (attr === 'placeholder') el.placeholder = value
    else if (attr === 'aria-label') el.setAttribute('aria-label', value)
    else el.textContent = value
  })
  document.title = copy.today.pageTitle
}

// ─── Eyebrow ────────────────────────────────────────────────────────────────

function updateEyebrow(view) {
  if (!eyebrow) return

  if (view === 'trails') {
    const now = new Date()
    const eightWeeksAgo = new Date(now)
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 55) // ~8 weeks back
    const fmt = { month: 'short', day: 'numeric' }
    const start = eightWeeksAgo.toLocaleDateString('en-US', fmt)
    const end = now.toLocaleDateString('en-US', fmt)
    eyebrow.textContent = `${start} – ${end}`
  } else {
    eyebrow.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }
}

updateEyebrow('today')

// ─── State ──────────────────────────────────────────────────────────────────

let steps = []
let journeys = []
let paths = []
let milestones = []
let stepPathsMap = new Map()
let activeJourneyId = localStorage.getItem('activeJourneyId') || null
let currentUserId = null
let isAnonymousUser = true
const renderedIds = new Set()
let authMode = 'signup' // 'signup' | 'signin'
let savedScrollTop = 0
let sortMode = localStorage.getItem('sortMode') || 'time-asc'

// ─── Icons ──────────────────────────────────────────────────────────────────

function hydrateIcons() {
  createIcons({
    icons: { Plus, X, User, ChevronDown, Check },
    attrs: { 'aria-hidden': 'true' },
  })
}

// ─── Progress (Momentum Line) ───────────────────────────────────────────────

function updateProgress() {
  if (!progressEl) return

  const view = getView()

  if (view === 'trails') {
    // Count completed steps across all paths in the 8-week window
    const now = new Date()
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() - 55)

    let completedCount = 0
    const activePathIds = new Set()

    for (const step of steps) {
      if (!step.completed) continue
      const created = new Date(step.created_at)
      if (created < windowStart) continue
      completedCount++
      const stepPaths = stepPathsMap.get(step.id)
      if (stepPaths) {
        for (const sp of stepPaths) activePathIds.add(sp.id)
      }
    }

    if (completedCount === 0) {
      progressEl.textContent = ''
      return
    }

    const pathCount = activePathIds.size
    const noun = completedCount === 1 ? copy.trail.stepSingular : copy.trail.stepPlural
    const pathNoun = pathCount === 1 ? copy.trail.pathSingular : copy.trail.pathPlural

    progressEl.textContent = t(copy.trail.progressTemplate, {
      count: String(completedCount),
      noun,
      paths: String(pathCount),
      pathNoun,
    })
    return
  }

  // Today: count steps completed today
  const now = new Date()
  const total = steps.filter((s) => {
    if (!s.completed || !s.completed_at) return false
    const d = new Date(s.completed_at)
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  }).length

  if (total === 0) {
    progressEl.textContent = ''
    return
  }

  const noun = total === 1 ? copy.today.stepSingular : copy.today.stepPlural
  progressEl.textContent = t(copy.today.progressTemplate, { count: String(total), noun })
}

// ─── Sticky Journey Context ─────────────────────────────────────────────────

function updateJourneyContext() {
  if (!activeJourneyId && journeys.length > 0) {
    activeJourneyId = journeys[0].id
    localStorage.setItem('activeJourneyId', activeJourneyId)
  }
  const journey = journeys.find((j) => j.id === activeJourneyId)
  if (journeyContextBtn) {
    journeyContextBtn.dataset.journeySlug = journey?.slug ?? ''
  }
  if (journeyContextName) {
    journeyContextName.textContent = journey?.name ?? copy.today.journeyDefault
  }
}

journeyContextBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  const currentIdx = journeys.findIndex((j) => j.id === activeJourneyId)
  const nextIdx = (currentIdx + 1) % journeys.length
  activeJourneyId = journeys[nextIdx].id
  localStorage.setItem('activeJourneyId', activeJourneyId)
  updateJourneyContext()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatStepTime(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Visibility Filter ──────────────────────────────────────────────────────

/**
 * A step belongs in the Today view if:
 *   - it is incomplete (show indefinitely until the user completes it), OR
 *   - it was completed today in local time (stays until midnight, then archives).
 *
 * Legacy rows completed before this column existed have completed_at = null;
 * the backfill migration sets them to created_at, so this guard is a safety net.
 */
function isVisibleToday(step) {
  if (!step.completed) return true
  if (!step.completed_at) return true // safety net for any un-backfilled rows
  const completedDate = new Date(step.completed_at)
  const now = new Date()
  return (
    completedDate.getFullYear() === now.getFullYear() &&
    completedDate.getMonth() === now.getMonth() &&
    completedDate.getDate() === now.getDate()
  )
}

// ─── Sort ────────────────────────────────────────────────────────────────────

function getSortedSteps() {
  const sorted = [...steps]
  switch (sortMode) {
    case 'time-desc':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'journey':
      return sorted.sort((a, b) => {
        const aOrder = a.journeys?.sort_order ?? 999
        const bOrder = b.journeys?.sort_order ?? 999
        if (aOrder !== bOrder) return aOrder - bOrder
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    case 'status':
      return sorted.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        const aOrder = a.journeys?.sort_order ?? 999
        const bOrder = b.journeys?.sort_order ?? 999
        if (aOrder !== bOrder) return aOrder - bOrder
        return new Date(a.created_at) - new Date(b.created_at)
      })
    default: // 'time-asc'
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }
}

function updateSortChips() {
  sortChips.forEach((chip) => {
    const isActive = chip.dataset.sort === sortMode
    chip.classList.toggle('is-active', isActive)
  })
}

sortChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    sortMode = chip.dataset.sort
    localStorage.setItem('sortMode', sortMode)
    updateSortChips()
    renderSteps()
  })
})

// ─── Step Detail View ────────────────────────────────────────────────────────

function buildStepDetailView(step) {
  const detail = document.createElement('div')
  detail.className = 'step-detail'
  detail.dataset.stepId = step.id
  detail.hidden = true

  // ── Journey section ──
  const journeySection = document.createElement('div')
  journeySection.className = 'step-detail__section'

  const journeyLabel = document.createElement('span')
  journeyLabel.className = 'step-detail__label'
  journeyLabel.textContent = copy.steps.journey

  const journeyList = document.createElement('div')
  journeyList.className = 'step-detail__journey-list'

  for (const j of journeys) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'step-detail__journey-option'
    btn.dataset.journeyId = j.id
    btn.dataset.stepId = step.id
    btn.textContent = j.name
    if (j.id === step.journey_id) btn.classList.add('is-active')
    journeyList.append(btn)
  }

  journeySection.append(journeyLabel, journeyList)

  // ── Path section (labels) ──
  const pathSection = document.createElement('div')
  pathSection.className = 'step-detail__section'

  const pathLabel = document.createElement('span')
  pathLabel.className = 'step-detail__label'
  pathLabel.textContent = copy.steps.paths

  const pathPicker = buildPathPicker(step.id)

  const pathChips = document.createElement('div')
  pathChips.className = 'step-detail__path-chips'

  const stepPaths = stepPathsMap.get(step.id) || []
  for (const p of stepPaths) {
    pathChips.append(buildPathChip(step.id, p))
  }

  pathSection.append(pathLabel, pathPicker, pathChips)

  // ── Milestone section (epic linking) ──
  const msSection = document.createElement('div')
  msSection.className = 'step-detail__section'

  const msLabel = document.createElement('span')
  msLabel.className = 'step-detail__label'
  msLabel.textContent = copy.steps.milestone

  const msSelect = document.createElement('select')
  msSelect.className = 'step-detail__milestone-select'
  msSelect.dataset.stepId = step.id

  const noneOpt = document.createElement('option')
  noneOpt.value = ''
  noneOpt.textContent = copy.steps.milestoneNone
  msSelect.append(noneOpt)

  const journeyMilestones = milestones.filter((m) => m.journey_id === step.journey_id)
  for (const m of journeyMilestones) {
    const opt = document.createElement('option')
    opt.value = m.id
    opt.textContent = m.name
    if (step.milestone_id === m.id) opt.selected = true
    msSelect.append(opt)
  }

  // Inline milestone creation
  const msCreateInput = document.createElement('input')
  msCreateInput.className = 'step-detail__add-milestone'
  msCreateInput.type = 'text'
  msCreateInput.placeholder = copy.steps.addMilestonePlaceholder
  msCreateInput.setAttribute('aria-label', copy.steps.addMilestoneAria)
  msCreateInput.dataset.stepId = step.id

  msSection.append(msLabel, msSelect, msCreateInput)

  detail.append(journeySection, pathSection, msSection)
  return detail
}

function buildPathChip(stepId, path) {
  const chip = document.createElement('span')
  chip.className = 'step-detail__path-chip'
  chip.dataset.pathId = path.id
  chip.dataset.stepId = stepId

  const name = document.createElement('span')
  name.textContent = path.name

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'step-detail__path-remove'
  removeBtn.setAttribute('aria-label', t(copy.steps.removePathAria, { pathName: path.name }))
  removeBtn.textContent = '\u00d7'

  chip.append(name, removeBtn)
  return chip
}

function buildPathPicker(stepId) {
  const wrapper = document.createElement('div')
  wrapper.className = 'step-detail__path-picker'

  const input = document.createElement('input')
  input.className = 'step-detail__path-input'
  input.type = 'text'
  input.placeholder = copy.steps.addPathPlaceholder
  input.setAttribute('aria-label', copy.steps.addPathAria)
  input.setAttribute('autocomplete', 'off')

  const dropdown = document.createElement('ul')
  dropdown.className = 'step-detail__path-dropdown'
  dropdown.hidden = true

  wrapper.append(input, dropdown)

  let highlightIdx = -1

  function getFilteredPaths(query) {
    const assigned = (stepPathsMap.get(stepId) || []).map((p) => p.id)
    return paths.filter(
      (p) =>
        !assigned.includes(p.id) &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    )
  }

  function renderDropdown(query) {
    dropdown.replaceChildren()
    highlightIdx = -1

    const filtered = getFilteredPaths(query)
    const trimmed = query.trim()
    const exactMatch = filtered.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())

    if (filtered.length === 0 && !trimmed) {
      const li = document.createElement('li')
      li.className = 'step-detail__path-option is-empty'
      li.textContent = copy.steps.noPathsMatch
      dropdown.append(li)
      dropdown.hidden = false
      return
    }

    for (const p of filtered) {
      const li = document.createElement('li')
      li.className = 'step-detail__path-option'
      li.textContent = p.name
      li.dataset.pathId = p.id
      dropdown.append(li)
    }

    if (trimmed && !exactMatch) {
      const li = document.createElement('li')
      li.className = 'step-detail__path-option is-create'
      li.textContent = t(copy.steps.pathCreateOption, { name: trimmed })
      li.dataset.createName = trimmed
      dropdown.append(li)
    }

    if (filtered.length === 0 && !trimmed) {
      dropdown.hidden = true
    } else {
      dropdown.hidden = false
    }
  }

  async function selectPath(pathId, createName) {
    let path
    if (createName) {
      path = paths.find((p) => p.name.toLowerCase() === createName.toLowerCase())
      if (!path) {
        path = await createPath(createName, currentUserId)
        if (path) paths.push(path)
      }
    } else {
      path = paths.find((p) => p.id === pathId)
    }
    if (!path) return

    const ok = await addStepToPath(stepId, path.id)
    if (ok) {
      const existing = stepPathsMap.get(stepId) || []
      existing.push({ id: path.id, name: path.name })
      stepPathsMap.set(stepId, existing)

      const chip = buildPathChip(stepId, path)
      const chipsContainer = wrapper.closest('.step-detail__section')?.querySelector('.step-detail__path-chips')
      if (chipsContainer) chipsContainer.append(chip)
      input.value = ''
      dropdown.hidden = true
      rebuildStepMeta(stepId)
    }
  }

  input.addEventListener('focus', () => {
    renderDropdown(input.value)
  })

  input.addEventListener('input', () => {
    renderDropdown(input.value)
  })

  input.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.hidden = true
      highlightIdx = -1
    }, 200)
  })

  input.addEventListener('keydown', (e) => {
    if (dropdown.hidden) return

    const options = dropdown.querySelectorAll('.step-detail__path-option:not(.is-empty)')

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightIdx = Math.min(highlightIdx + 1, options.length - 1)
      updateHighlight(options)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightIdx = Math.max(highlightIdx - 1, 0)
      updateHighlight(options)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && highlightIdx < options.length) {
        const opt = options[highlightIdx]
        selectPath(opt.dataset.pathId, opt.dataset.createName)
      } else if (options.length > 0) {
        const first = options[0]
        selectPath(first.dataset.pathId, first.dataset.createName)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dropdown.hidden = true
      highlightIdx = -1
      input.blur()
    }
  })

  function updateHighlight(options) {
    options.forEach((o, i) => {
      o.classList.toggle('is-highlighted', i === highlightIdx)
    })
    if (highlightIdx >= 0 && options[highlightIdx]) {
      options[highlightIdx].scrollIntoView({ block: 'nearest' })
    }
  }

  dropdown.addEventListener('mousedown', (e) => {
    e.preventDefault() // prevent input blur before click registers
    const li = e.target.closest('.step-detail__path-option:not(.is-empty)')
    if (li) {
      selectPath(li.dataset.pathId, li.dataset.createName)
    }
  })

  return wrapper
}

// ─── Step Element Builder ────────────────────────────────────────────────────

function buildStepElement(step, journey, isNew) {
  const item = document.createElement('article')
  item.className = 'todo-item'
  if (step.completed) item.classList.add('is-completed')
  item.dataset.stepId = step.id
  if (journey?.slug) item.dataset.journeySlug = journey.slug

  if (isNew) {
    item.classList.add('is-new')
    renderedIds.add(step.id)
  }

  // Completion indicator
  const indicator = document.createElement('button')
  indicator.type = 'button'
  indicator.className = 'todo-item__indicator'
  indicator.setAttribute('role', 'switch')
  indicator.setAttribute('aria-checked', String(!!step.completed))
  indicator.setAttribute('aria-label', copy.steps.markComplete)
  const checkIcon = document.createElement('i')
  checkIcon.dataset.lucide = 'check'
  indicator.append(checkIcon)

  const content = document.createElement('div')
  content.className = 'todo-item__content'

  const text = document.createElement('p')
  text.className = 'todo-item__text'
  text.textContent = step.text
  content.append(text)

  // Subtle metadata line (paths + milestone only — journey is conveyed by color)
  const metaParts = []
  const stepPaths = stepPathsMap.get(step.id)
  if (stepPaths && stepPaths.length > 0) {
    metaParts.push(...stepPaths.map((p) => p.name))
  }
  if (step.milestones?.name) metaParts.push(step.milestones.name)

  if (metaParts.length > 0) {
    const metaEl = document.createElement('p')
    metaEl.className = 'todo-item__meta'
    metaEl.textContent = metaParts.join(' · ')
    content.append(metaEl)
  }

  const timestamp = document.createElement('time')
  timestamp.className = 'todo-item__timestamp'
  timestamp.textContent = formatStepTime(step.created_at)
  if (step.created_at) timestamp.setAttribute('datetime', step.created_at)

  const actions = document.createElement('div')
  actions.className = 'todo-item__actions'

  // Expand button for detail view
  if (!isAnonymousUser) {
    const expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.className = 'todo-item__expand'
    expandBtn.setAttribute('aria-label', copy.steps.stepDetails)
    expandBtn.textContent = '···'
    actions.append(expandBtn)
  }

  const deleteButton = document.createElement('button')
  deleteButton.className = 'todo-item__delete-button'
  deleteButton.type = 'button'
  deleteButton.dataset.todoId = step.id
  deleteButton.setAttribute('aria-label', t(copy.steps.deleteStepAria, { stepText: step.text }))

  const icon = document.createElement('i')
  icon.dataset.lucide = 'x'
  deleteButton.append(icon)

  actions.append(deleteButton)
  item.append(indicator, content, timestamp, actions)

  // Detail view (hidden by default, for authenticated users)
  if (!isAnonymousUser) {
    item.append(buildStepDetailView(step))
  }

  return item
}

function rebuildStepMeta(stepId) {
  const step = steps.find((s) => s.id === stepId)
  if (!step) return
  const tile = itemsContainer.querySelector(`.todo-item[data-step-id="${stepId}"]`)
  if (!tile) return

  // Update meta line
  const oldMeta = tile.querySelector('.todo-item__meta')
  const metaParts = []
  const stepPaths = stepPathsMap.get(step.id)
  if (stepPaths && stepPaths.length > 0) {
    metaParts.push(...stepPaths.map((p) => p.name))
  }
  if (step.milestones?.name) metaParts.push(step.milestones.name)

  const contentEl = tile.querySelector('.todo-item__content')
  if (metaParts.length > 0) {
    if (oldMeta) {
      oldMeta.textContent = metaParts.join(' · ')
    } else {
      const metaEl = document.createElement('p')
      metaEl.className = 'todo-item__meta'
      metaEl.textContent = metaParts.join(' · ')
      contentEl?.append(metaEl)
    }
  } else if (oldMeta) {
    oldMeta.remove()
  }
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderSteps() {
  itemsContainer.replaceChildren()

  // Show chips only when there are steps to sort
  if (sortBar) sortBar.hidden = steps.length === 0

  if (steps.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'todo-empty'
    empty.textContent = copy.today.emptyState
    itemsContainer.append(empty)
    updateProgress()
    return
  }

  for (const step of getSortedSteps()) {
    const isNew = !renderedIds.has(step.id)
    itemsContainer.append(buildStepElement(step, step.journeys, isNew))
  }

  hydrateIcons()
  updateProgress()
  refreshTrailView()
}

// ─── Trail View ─────────────────────────────────────────────────────────────

function refreshTrailView() {
  if (!trailViewContainer || trailViewContainer.hidden) return
  renderTrailView(trailViewContainer, { paths, steps, stepPathsMap, milestones, journeys })
}

// ─── View Navigation ────────────────────────────────────────────────────────

viewNavTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setView(tab.dataset.view)
  })
})

document.addEventListener('viewchange', (event) => {
  const view = event.detail.view

  // Update tab active states
  viewNavTabs.forEach((tab) => {
    const isActive = tab.dataset.view === view
    tab.classList.toggle('is-active', isActive)
    tab.setAttribute('aria-pressed', String(isActive))
  })

  updateEyebrow(view)

  if (view === 'today') {
    if (trailViewContainer) trailViewContainer.hidden = true
    itemsContainer.hidden = false
    form.hidden = false
    if (sortBar) sortBar.hidden = steps.length === 0
    updateProgress()
    window.scrollTo(0, savedScrollTop)
  } else if (view === 'trails') {
    savedScrollTop = window.scrollY
    // Hide all Today hemisphere elements
    itemsContainer.hidden = true
    form.hidden = true
    if (sortBar) sortBar.hidden = true
    if (trailViewContainer) {
      trailViewContainer.hidden = false
      refreshTrailView()
    }
    updateProgress()
  }
})

// ─── Supabase CRUD ───────────────────────────────────────────────────────────

async function loadJourneys() {
  const { data, error } = await supabase
    .from('journeys')
    .select('id, name, slug, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to load journeys:', error.message)
    return
  }

  journeys = data
  updateJourneyContext()
}

async function loadAllPaths() {
  paths = await loadPaths()
}

async function loadAllMilestones() {
  milestones = await loadMilestones()
}

async function loadSteps() {
  const { data, error } = await supabase
    .from('steps')
    .select('*, journeys(id, name, slug, sort_order), milestones(id, name, target_count)')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load steps:', error.message)
    return
  }

  // Only surface steps that belong in Today: incomplete ones (always),
  // and completed ones that were finished today in local time.
  steps = data.filter(isVisibleToday)
  stepPathsMap = await loadStepPathsMap()
  for (const step of steps) {
    renderedIds.add(step.id)
  }
  renderSteps()
}

async function addStep(text, journeyId) {
  if (!currentUserId) {
    console.warn('Cannot add step without an authenticated session.')
    return
  }
  const insertPayload = { text, completed: false, journey_id: journeyId, user_id: currentUserId }

  const { data, error } = await supabase
    .from('steps')
    .insert(insertPayload)
    .select('*, journeys(id, name, slug, sort_order), milestones(id, name, target_count)')
    .single()

  if (error) {
    console.error('Failed to add step:', error.message)
    return
  }

  steps.push(data)
  renderSteps()
}

async function toggleStep(id, completed) {
  // Record the exact moment of completion; clear it when uncompleting.
  const completedAt = completed ? new Date().toISOString() : null

  const { error } = await supabase
    .from('steps')
    .update({ completed, completed_at: completedAt })
    .eq('id', id)

  if (error) {
    console.error('Failed to update step:', error.message)
    // Roll back the optimistic UI update applied in the click handler.
    const step = steps.find((s) => s.id === id)
    if (step) step.completed = !completed
    const itemEl = itemsContainer.querySelector(`.todo-item[data-step-id="${id}"]`)
    if (itemEl) {
      itemEl.classList.toggle('is-completed', !completed)
      const ind = itemEl.querySelector('.todo-item__indicator')
      if (ind) ind.setAttribute('aria-checked', String(!completed))
    }
    return
  }

  // Persist completed_at in memory so isVisibleToday() stays accurate.
  const step = steps.find((s) => s.id === id)
  if (step) step.completed_at = completedAt

  updateProgress()
}

function confirmDelete(step, itemEl, deleteButton) {
  if (!confirmDialog) {
    deleteStep(step?.id, itemEl, deleteButton)
    return
  }

  const stepText = step?.text || copy.steps.thisStep
  confirmDialogDetail.textContent = stepText

  confirmDialog.showModal()

  const cleanup = () => {
    confirmDialogConfirm.removeEventListener('click', onConfirm)
    confirmDialogCancel.removeEventListener('click', onCancel)
    confirmDialog.removeEventListener('close', onCancel)
  }

  const onConfirm = () => {
    cleanup()
    confirmDialog.close()
    deleteStep(step.id, itemEl, deleteButton)
  }

  const onCancel = () => {
    cleanup()
    if (confirmDialog.open) confirmDialog.close()
  }

  confirmDialogConfirm.addEventListener('click', onConfirm)
  confirmDialogCancel.addEventListener('click', onCancel)
  confirmDialog.addEventListener('close', onCancel)
}

async function deleteStep(id, itemEl, deleteButton) {
  deleteButton.disabled = true

  const { error } = await supabase.from('steps').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete step:', error.message)
    deleteButton.disabled = false
    return
  }

  renderedIds.delete(id)

  const removeFromDom = () => {
    steps = steps.filter((s) => s.id !== id)
    if (itemEl) itemEl.remove()

    if (steps.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'todo-empty'
      empty.textContent = copy.today.emptyState
      itemsContainer.append(empty)
    }

    updateProgress()
    refreshTrailView()
  }

  if (itemEl) {
    itemEl.classList.add('is-removing')
    setTimeout(removeFromDom, 210)
  } else {
    removeFromDom()
  }
}

async function updateStepJourney(id, journeyId) {
  const { data, error } = await supabase
    .from('steps')
    .update({ journey_id: journeyId })
    .eq('id', id)
    .select('*, journeys(id, name, slug, sort_order)')
    .single()

  if (error) {
    console.error('Failed to update step journey:', error.message)
    return
  }

  const idx = steps.findIndex((s) => s.id === id)
  if (idx !== -1) steps[idx] = data

  rebuildStepMeta(id)

  // Update slug + detail view journey buttons
  const tile = itemsContainer.querySelector(`.todo-item[data-step-id="${id}"]`)
  if (tile) {
    if (data.journeys?.slug) tile.dataset.journeySlug = data.journeys.slug
    tile.querySelectorAll('.step-detail__journey-option').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.journeyId === journeyId)
    })
  }

  refreshTrailView()
}

async function updateStepMilestone(stepId, milestoneId) {
  const { error } = await supabase
    .from('steps')
    .update({ milestone_id: milestoneId || null })
    .eq('id', stepId)

  if (error) {
    console.error('Failed to update step milestone:', error.message)
    return
  }

  const step = steps.find((s) => s.id === stepId)
  if (step) {
    step.milestone_id = milestoneId || null
    step.milestones = milestoneId ? milestones.find((m) => m.id === milestoneId) || null : null
    rebuildStepMeta(stepId)
  }
}

async function updateStepText(id, text) {
  const { error } = await supabase
    .from('steps')
    .update({ text })
    .eq('id', id)

  if (error) {
    console.error('Failed to update step text:', error.message)
    return false
  }

  const step = steps.find((s) => s.id === id)
  if (step) step.text = text
  return true
}

function enterEditMode(tile, stepId) {
  if (tile.classList.contains('is-editing')) return

  const step = steps.find((s) => s.id === stepId)
  if (!step) return

  const textEl = tile.querySelector('.todo-item__text')
  if (!textEl) return

  tile.classList.add('is-editing')

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'todo-item__edit-input'
  input.value = step.text
  input.setAttribute('aria-label', copy.steps.editStepAria)

  const contentEl = tile.querySelector('.todo-item__content')
  contentEl.insertBefore(input, textEl)
  input.focus()
  input.select()

  let settled = false

  const save = async () => {
    if (settled) return
    settled = true
    const newText = input.value.trim()
    if (newText && newText !== step.text) {
      const ok = await updateStepText(stepId, newText)
      if (ok) {
        textEl.textContent = newText
        const delBtn = tile.querySelector('.todo-item__delete-button')
        if (delBtn) delBtn.setAttribute('aria-label', t(copy.steps.deleteStepAria, { stepText: newText }))
      }
    }
    exitEditMode(tile)
  }

  const cancel = () => {
    if (settled) return
    settled = true
    exitEditMode(tile)
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
  })

  input.addEventListener('blur', () => {
    setTimeout(save, 0)
  })
}

function exitEditMode(tile) {
  tile.classList.remove('is-editing')
  const input = tile.querySelector('.todo-item__edit-input')
  if (input) input.remove()
}

// ─── Auth UI ─────────────────────────────────────────────────────────────────

function setAuthMode(mode) {
  authMode = mode
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode
    tab.classList.toggle('is-active', isActive)
    tab.setAttribute('aria-selected', String(isActive))
  })
  if (authSubmitLabel) authSubmitLabel.textContent = mode === 'signup' ? copy.auth.submitSignUp : copy.auth.submitSignIn
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
  isAnonymousUser = isAnonymous

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
}

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

authPasswordToggle?.addEventListener('click', () => {
  if (!authPasswordInput) return
  const isHidden = authPasswordInput.type === 'password'
  authPasswordInput.type = isHidden ? 'text' : 'password'
  authPasswordToggle.classList.toggle('is-visible', isHidden)
  authPasswordToggle.setAttribute('aria-pressed', String(isHidden))
  authPasswordToggle.setAttribute('aria-label', isHidden ? copy.auth.hidePassword : copy.auth.showPassword)
})

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const email = authEmailInput?.value.trim() ?? ''
  const password = authPasswordInput?.value ?? ''

  if (!email || !password) {
    showAuthError(copy.auth.errorEmailPassword)
    return
  }

  authSubmitButton.disabled = true
  clearAuthError()

  if (authMode === 'signup') {
    const { data: sessionData } = await getSession()
    const anonUserId = sessionData.session?.user?.id ?? null
    const wasAnonymous = sessionData.session?.user?.is_anonymous ?? false

    const { data: signUpData, error } = await signUp(email, password)
    if (error) {
      showAuthError(error.message)
      authSubmitButton.disabled = false
      return
    }
    if (signUpData?.user?.email && !signUpData?.user?.email_confirmed_at) {
      showAuthError(copy.auth.errorCheckEmail)
      authSubmitButton.disabled = false
      return
    }

    if (wasAnonymous && anonUserId && signUpData?.session) {
      const { error: rpcError } = await claimAnonymousTodos(anonUserId)
      if (rpcError) {
        console.error('Failed to migrate anonymous steps on signup:', rpcError.message)
      }
    }

    closeAuthDialog()
  } else {
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
        console.error('Failed to migrate anonymous steps:', rpcError.message)
      }
    }

    closeAuthDialog()
  }

  authSubmitButton.disabled = false
})

authDialogSignOut?.addEventListener('click', async () => {
  closeAuthDialog()
  await signOut()
  await signInAnonymously()
})

// ─── Step Events ─────────────────────────────────────────────────────────────

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text || !activeJourneyId) return
  input.value = ''
  input.focus()
  localStorage.setItem('activeJourneyId', activeJourneyId)
  addStep(text, activeJourneyId)
})

// Unified click handler for items container
itemsContainer.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  // Delete button → show confirmation
  const deleteButton = target.closest('.todo-item__delete-button')
  if (deleteButton instanceof HTMLButtonElement) {
    const id = deleteButton.dataset.todoId
    const itemEl = deleteButton.closest('.todo-item')
    const step = steps.find((s) => s.id === id)
    confirmDelete(step, itemEl, deleteButton)
    return
  }

  // Expand button → toggle detail view
  const expandBtn = target.closest('.todo-item__expand')
  if (expandBtn instanceof HTMLButtonElement) {
    const tile = expandBtn.closest('.todo-item')
    const detail = tile?.querySelector('.step-detail')
    if (detail) {
      // Collapse any other open details first
      itemsContainer.querySelectorAll('.step-detail:not([hidden])').forEach((d) => {
        if (d !== detail) {
          d.hidden = true
          d.closest('.todo-item')?.classList.remove('is-expanded')
        }
      })
      detail.hidden = !detail.hidden
      tile.classList.toggle('is-expanded', !detail.hidden)
    }
    return
  }

  // Journey change in detail view
  const journeyOption = target.closest('.step-detail__journey-option')
  if (journeyOption instanceof HTMLButtonElement) {
    const journeyId = journeyOption.dataset.journeyId
    const stepId = journeyOption.dataset.stepId
    if (journeyId && stepId) {
      updateStepJourney(stepId, journeyId)
    }
    return
  }

  // Path chip removal
  const pathRemove = target.closest('.step-detail__path-remove')
  if (pathRemove) {
    const chip = pathRemove.closest('.step-detail__path-chip')
    if (chip) {
      const stepId = chip.dataset.stepId
      const pathId = chip.dataset.pathId
      removeStepFromPath(stepId, pathId).then((ok) => {
        if (ok) {
          const existing = stepPathsMap.get(stepId) || []
          stepPathsMap.set(stepId, existing.filter((p) => p.id !== pathId))
          chip.remove()
          rebuildStepMeta(stepId)
        }
      })
    }
    return
  }

  // Completion indicator toggle
  const indicator = target.closest('.todo-item__indicator')
  if (indicator instanceof HTMLButtonElement) {
    const tile = indicator.closest('.todo-item')
    if (!tile || tile.classList.contains('is-editing')) return
    const id = tile.dataset.stepId
    const step = steps.find((s) => s.id === id)
    if (!step) return

    step.completed = !step.completed
    tile.classList.toggle('is-completed', step.completed)
    indicator.setAttribute('aria-checked', String(step.completed))
    toggleStep(id, step.completed)
    return
  }

  // Text click → enter inline edit mode
  const textEl = target.closest('.todo-item__text')
  if (textEl) {
    const tile = textEl.closest('.todo-item')
    if (!tile) return
    const stepId = tile.dataset.stepId
    enterEditMode(tile, stepId)
    return
  }

  // Ignore clicks inside detail view or actions
  if (target.closest('.step-detail')) return
  if (target.closest('.todo-item__actions')) return
})

// Milestone creation via inline input in detail view
itemsContainer.addEventListener('keydown', async (event) => {
  const addMsInput = event.target.closest('.step-detail__add-milestone')
  if (addMsInput && event.key === 'Enter') {
    event.preventDefault()
    const name = addMsInput.value.trim()
    const stepId = addMsInput.dataset.stepId
    if (!name || !currentUserId || isAnonymousUser) return

    const step = steps.find((s) => s.id === stepId)
    if (!step) return

    addMsInput.disabled = true
    const newMs = await createMilestone(step.journey_id, name, currentUserId)
    addMsInput.disabled = false
    addMsInput.value = ''

    if (newMs) {
      milestones.push(newMs)

      // Add to the select dropdown
      const msSelect = addMsInput.closest('.step-detail__section')?.querySelector('.step-detail__milestone-select')
      if (msSelect) {
        const opt = document.createElement('option')
        opt.value = newMs.id
        opt.textContent = newMs.name
        opt.selected = true
        msSelect.append(opt)
      }

      // Link the step to the new milestone
      await updateStepMilestone(stepId, newMs.id)
    }
    return
  }
})

// Milestone select change in detail view
itemsContainer.addEventListener('change', (event) => {
  const select = event.target.closest('.step-detail__milestone-select')
  if (!select) return

  const stepId = select.dataset.stepId
  const milestoneId = select.value || null
  updateStepMilestone(stepId, milestoneId)
})

// Close expanded detail views on Escape
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  itemsContainer.querySelectorAll('.step-detail:not([hidden])').forEach((d) => {
    d.hidden = true
    d.closest('.todo-item')?.classList.remove('is-expanded')
  })
})

// ─── Midnight Archive ───────────────────────────────────────────────────────

/**
 * At the stroke of midnight (local time), remove any completed steps whose
 * completed_at is now yesterday and re-render the Today view.  Reschedules
 * itself so it stays accurate across sessions that span multiple days.
 */
function scheduleMidnightArchive() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0) // next local midnight
  const msUntilMidnight = midnight - now

  setTimeout(() => {
    const before = steps.length
    steps = steps.filter(isVisibleToday)
    if (steps.length !== before) {
      renderSteps()
      refreshTrailView()
    }
    scheduleMidnightArchive() // reschedule for the following midnight
  }, msUntilMidnight)
}

// ─── Init ───────────────────────────────────────────────────────────────────

hydrateIcons()
updateSortChips()

onAuthStateChange((_event, session) => {
  currentUserId = session?.user?.id ?? null
  updateHeaderForUser(session?.user ?? null)
  steps = []
  paths = []
  milestones = []
  stepPathsMap = new Map()
  renderedIds.clear()
  loadAllPaths()
  loadAllMilestones()
  loadSteps()
})

async function init() {
  applyCopyToDom()
  scheduleMidnightArchive()

  const { data } = await getSession()
  if (!data.session) {
    const { error } = await signInAnonymously()
    if (error) {
      console.error('Failed to sign in anonymously:', error.message)
    }
  } else {
    currentUserId = data.session.user.id
    updateHeaderForUser(data.session.user)
  }

  await Promise.all([loadJourneys(), loadAllPaths(), loadAllMilestones()])

  if (data.session) {
    loadSteps()
  }
}

init()
