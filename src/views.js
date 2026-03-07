// ─── View State ─────────────────────────────────────────────────────────────
// Simple state machine: 'today' | 'trails'

let currentView = 'today'

export function getView() {
  return currentView
}

export function setView(view) {
  if (view === currentView) return
  currentView = view
  document.dispatchEvent(new CustomEvent('viewchange', { detail: { view } }))
}

// ─── Breadcrumb Builder ─────────────────────────────────────────────────────
// Returns a DOM fragment: Journey › Path › Milestone (with tappable segments)

export function buildBreadcrumb(step, { journeys, paths, milestones, stepPathsMap }) {
  const parts = []

  // Journey
  const journey = step.journeys
  if (journey) {
    parts.push({ label: journey.name, type: 'journey' })
  }

  // Path (first associated path, if any)
  const stepPaths = stepPathsMap.get(step.id)
  if (stepPaths && stepPaths.length > 0) {
    parts.push({ label: stepPaths[0].name, type: 'path' })
  }

  // Milestone
  const milestone = step.milestones
  if (milestone) {
    parts.push({ label: milestone.name, type: 'milestone' })
  }

  // Only render if there are at least 2 segments (journey alone isn't a breadcrumb)
  if (parts.length < 2) return null

  const fragment = document.createDocumentFragment()
  const wrapper = document.createElement('nav')
  wrapper.className = 'todo-item__breadcrumb'
  wrapper.setAttribute('aria-label', 'Step context')

  parts.forEach((part, i) => {
    const span = document.createElement('span')
    span.className = `todo-item__breadcrumb-segment todo-item__breadcrumb-segment--${part.type}`
    span.textContent = part.label

    wrapper.append(span)

    if (i < parts.length - 1) {
      const sep = document.createElement('span')
      sep.className = 'todo-item__breadcrumb-sep'
      sep.textContent = ' › '
      sep.setAttribute('aria-hidden', 'true')
      wrapper.append(sep)
    }
  })

  fragment.append(wrapper)
  return fragment
}
