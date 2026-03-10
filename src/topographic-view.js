// ─── Topographic View ───────────────────────────────────────────────────────
// Journey hemisphere: Month-level perspective.
// Milestone cards with Journey color border, progress bar, recent contributing
// steps, and pace estimate. No deadline pressure language.

import { calculateProgress } from './milestones.js'
import { TOPOGRAPHIC_WINDOW_DAYS } from './shared.js'
import copy, { t } from './copy/index.js'

/**
 * Render the Topographic View into a container.
 *
 * @param {HTMLElement} container
 * @param {Object} data - { steps, journeys, milestones, stepPathsMap }
 */
export function renderTopographicView(container, { steps, journeys, milestones, stepPathsMap }) {
  container.replaceChildren()

  // Only show milestones with at least one contributing step in last 90 days
  const now = new Date()
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - TOPOGRAPHIC_WINDOW_DAYS)

  // Group steps by milestone_id
  const stepsByMilestone = new Map()
  for (const step of steps) {
    if (!step.milestone_id) continue
    if (!stepsByMilestone.has(step.milestone_id)) {
      stepsByMilestone.set(step.milestone_id, [])
    }
    stepsByMilestone.get(step.milestone_id).push(step)
  }

  // Filter milestones: active (not completed) with recent contributing steps
  const activeMilestones = milestones.filter((m) => {
    const msSteps = stepsByMilestone.get(m.id) || []
    const hasRecentStep = msSteps.some((s) => new Date(s.created_at) >= ninetyDaysAgo)
    return hasRecentStep
  })

  if (activeMilestones.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'topographic-view__empty'
    empty.textContent = copy.topographic.emptyState
    container.append(empty)
    return
  }

  // Sort by journey sort_order, then by progress percentage descending
  activeMilestones.sort((a, b) => {
    const aJourney = journeys.find((j) => j.id === a.journey_id)
    const bJourney = journeys.find((j) => j.id === b.journey_id)
    const orderDiff = (aJourney?.sort_order ?? 999) - (bJourney?.sort_order ?? 999)
    if (orderDiff !== 0) return orderDiff

    const aSteps = stepsByMilestone.get(a.id) || []
    const bSteps = stepsByMilestone.get(b.id) || []
    const aProgress = calculateProgress(a, aSteps)
    const bProgress = calculateProgress(b, bSteps)
    return (bProgress.percentage ?? 0) - (aProgress.percentage ?? 0)
  })

  for (const milestone of activeMilestones) {
    const journey = journeys.find((j) => j.id === milestone.journey_id)
    const msSteps = stepsByMilestone.get(milestone.id) || []
    const progress = calculateProgress(milestone, msSteps)

    const card = buildMilestoneCard(milestone, journey, msSteps, progress)
    container.append(card)
  }
}

function buildMilestoneCard(milestone, journey, msSteps, progress) {
  const card = document.createElement('article')
  card.className = 'milestone-card'
  if (journey?.slug) card.dataset.journeySlug = journey.slug

  // ── Header: journey dot + milestone name ──
  const header = document.createElement('div')
  header.className = 'milestone-card__header'

  const dot = document.createElement('span')
  dot.className = 'milestone-card__dot'
  if (journey?.slug) dot.dataset.journeySlug = journey.slug

  const nameEl = document.createElement('h3')
  nameEl.className = 'milestone-card__name'
  nameEl.textContent = milestone.name

  const journeyLabel = document.createElement('span')
  journeyLabel.className = 'milestone-card__journey'
  journeyLabel.textContent = journey?.name || ''

  header.append(dot, nameEl, journeyLabel)

  // ── Description (if exists) ──
  let descEl = null
  if (milestone.description) {
    descEl = document.createElement('p')
    descEl.className = 'milestone-card__desc'
    descEl.textContent = milestone.description
  }

  // ── Progress bar ──
  const progressWrap = document.createElement('div')
  progressWrap.className = 'milestone-card__progress'

  const progressBar = document.createElement('div')
  progressBar.className = 'milestone-card__progress-bar'

  if (progress.target) {
    const fill = document.createElement('div')
    fill.className = 'milestone-card__progress-bar__fill'
    fill.style.width = `${Math.round((progress.percentage ?? 0) * 100)}%`
    if (journey?.slug) fill.dataset.journeySlug = journey.slug
    progressBar.append(fill)
  } else {
    // No target — show accumulated count only, no bar fill
    const fill = document.createElement('div')
    fill.className = 'milestone-card__progress-bar__fill milestone-card__progress-bar__fill--unbounded'
    fill.style.width = '100%'
    fill.style.opacity = '0.2'
    if (journey?.slug) fill.dataset.journeySlug = journey.slug
    progressBar.append(fill)
  }

  const progressLabel = document.createElement('span')
  progressLabel.className = 'milestone-card__progress-label'
  if (progress.target) {
    const noun = progress.current === 1
      ? copy.topographic.stepSingular
      : copy.topographic.stepPlural
    progressLabel.textContent = `${progress.current} of ${progress.target} ${noun}`
  } else {
    const noun = progress.current === 1
      ? copy.topographic.stepSingular
      : copy.topographic.stepPlural
    progressLabel.textContent = `${progress.current} ${noun}`
  }

  progressWrap.append(progressBar, progressLabel)

  // ── Recent contributing steps (max 5) ──
  const recentSteps = [...msSteps]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  let recentSection = null
  if (recentSteps.length > 0) {
    recentSection = document.createElement('div')
    recentSection.className = 'milestone-card__recent'

    const recentLabel = document.createElement('span')
    recentLabel.className = 'milestone-card__recent-label'
    recentLabel.textContent = copy.topographic.recentSteps
    recentSection.append(recentLabel)

    for (const step of recentSteps) {
      const stepEl = document.createElement('div')
      stepEl.className = 'milestone-card__recent-step'

      const textEl = document.createElement('span')
      textEl.className = 'milestone-card__recent-step-text'
      textEl.textContent = step.text

      const timeEl = document.createElement('time')
      timeEl.className = 'milestone-card__recent-step-time'
      timeEl.textContent = formatRelativeDate(step.created_at)

      stepEl.append(textEl, timeEl)
      recentSection.append(stepEl)
    }
  }

  // ── Pace estimate ──
  let paceEl = null
  if (progress.target && progress.current > 0 && progress.current < progress.target) {
    const pace = estimatePace(msSteps, progress.current, progress.target)
    if (pace) {
      paceEl = document.createElement('p')
      paceEl.className = 'milestone-card__pace'
      paceEl.textContent = pace
    }
  }

  // Assemble card
  card.append(header)
  if (descEl) card.append(descEl)
  card.append(progressWrap)
  if (recentSection) card.append(recentSection)
  if (paceEl) card.append(paceEl)

  return card
}

/**
 * Estimate pace to completion. Never uses deadline/failure/urgency language.
 *
 * @returns {string|null} e.g. "~2 weeks at current pace"
 */
function estimatePace(msSteps, current, target) {
  // Calculate recent velocity from last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentCompleted = msSteps.filter((s) => {
    if (!s.completed) return false
    const d = new Date(s.completed_at || s.created_at)
    return d >= thirtyDaysAgo
  }).length

  if (recentCompleted === 0) return null

  const remaining = target - current
  if (remaining <= 0) return null

  // Steps per day in last 30 days
  const velocity = recentCompleted / 30
  const daysRemaining = Math.ceil(remaining / velocity)

  if (daysRemaining <= 7) return '~1 week at current pace'
  if (daysRemaining <= 14) return '~2 weeks at current pace'
  if (daysRemaining <= 21) return '~3 weeks at current pace'
  if (daysRemaining <= 35) return '~1 month at current pace'
  if (daysRemaining <= 70) return '~2 months at current pace'
  if (daysRemaining <= 105) return '~3 months at current pace'
  return `~${Math.ceil(daysRemaining / 30)} months at current pace`
}

function formatRelativeDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return '1 week ago'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
