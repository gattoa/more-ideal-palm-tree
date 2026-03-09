// ─── PERMA Signal Inference ─────────────────────────────────────────────────
// Derives well-being signals entirely from behavioral data.
// No user input beyond logging Steps.
//
// Returns 0–1 floats for each dimension:
//   P — Positive Emotion
//   E — Engagement
//   R — Relationships
//   M — Meaning
//   A — Accomplishment

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Infer PERMA signals from step data.
 *
 * @param {Object[]} steps - steps within the analysis window
 * @param {Object} context - { stepPathsMap, milestones, journeys }
 * @returns {{ P: number, E: number, R: number, M: number, A: number }}
 *          Each value 0–1
 */
export function inferPermaSignals(steps, { stepPathsMap, milestones = [], journeys = [] } = {}) {
  if (!steps || steps.length === 0) {
    return { P: 0, E: 0, R: 0, M: 0, A: 0 }
  }

  // ── Positive Emotion ──
  // Step frequency + journey diversity indicating active life engagement
  const journeySlugsUsed = new Set()
  for (const step of steps) {
    const slug = step.journeys?.slug
    if (slug) journeySlugsUsed.add(slug)
  }

  // Frequency component: steps per day, capped at ~5/day for max signal
  const daySpan = getDaySpan(steps)
  const daysActive = countActiveDays(steps)
  const stepsPerDay = daySpan > 0 ? steps.length / daySpan : steps.length
  const frequencySignal = Math.min(stepsPerDay / 5, 1)

  // Diversity component: how many of 5 journeys are used
  const diversitySignal = journeySlugsUsed.size / 5

  // Blend: 60% frequency, 40% diversity
  const P = clamp(frequencySignal * 0.6 + diversitySignal * 0.4)

  // ── Engagement ──
  // Consistency patterns, session clustering, deep Path investment
  const consistencySignal = daySpan > 0 ? daysActive / daySpan : (steps.length > 0 ? 1 : 0)

  // Path depth: steps associated with paths (deeper investment)
  let stepsWithPaths = 0
  for (const step of steps) {
    const paths = stepPathsMap?.get(step.id)
    if (paths && paths.length > 0) stepsWithPaths++
  }
  const pathDepth = steps.length > 0 ? stepsWithPaths / steps.length : 0

  // Session clustering: multiple steps on the same day indicates deeper sessions
  const stepsPerActiveDay = daysActive > 0 ? steps.length / daysActive : 0
  const clusterSignal = Math.min(stepsPerActiveDay / 4, 1)

  // Blend: 40% consistency, 30% path depth, 30% clustering
  const E = clamp(consistencySignal * 0.4 + pathDepth * 0.3 + clusterSignal * 0.3)

  // ── Relationships ──
  // Proportion of steps in Connections Journey
  const connectionsSteps = steps.filter((s) => s.journeys?.slug === 'connections').length
  const rRatio = steps.length > 0 ? connectionsSteps / steps.length : 0
  // Scale so that 20%+ connections steps = full signal (connections is 1 of 5 journeys)
  const R = clamp(rRatio / 0.2)

  // ── Meaning ──
  // Proportion of steps with a Path association
  const meaningRatio = steps.length > 0 ? stepsWithPaths / steps.length : 0
  // Also consider multi-journey engagement as meaning signal
  const multiJourneySignal = journeySlugsUsed.size >= 3 ? 1 : journeySlugsUsed.size / 3

  // Blend: 65% path association, 35% multi-journey
  const M = clamp(meaningRatio * 0.65 + multiJourneySignal * 0.35)

  // ── Accomplishment ──
  // Completed milestones + step completion frequency
  const completedSteps = steps.filter((s) => s.completed).length
  const completionRate = steps.length > 0 ? completedSteps / steps.length : 0

  // Milestone completion within window
  const completedMilestones = milestones.filter((m) => m.completed_at != null).length
  const milestoneSignal = milestones.length > 0
    ? Math.min(completedMilestones / Math.max(milestones.length, 3), 1)
    : 0

  // Blend: 60% completion rate, 40% milestone progress
  const A = clamp(completionRate * 0.6 + milestoneSignal * 0.4)

  return { P, E, R, M, A }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v) {
  return Math.max(0, Math.min(1, v))
}

function getDaySpan(steps) {
  if (steps.length === 0) return 0
  const dates = steps.map((s) => new Date(s.created_at).getTime())
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  return Math.max(Math.ceil((max - min) / (24 * 60 * 60 * 1000)), 1)
}

function countActiveDays(steps) {
  const days = new Set()
  for (const step of steps) {
    const d = new Date(step.created_at)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  return days.size
}

// ─── PERMA Labels ───────────────────────────────────────────────────────────

export const PERMA_LABELS = {
  P: 'Positive Emotion',
  E: 'Engagement',
  R: 'Relationships',
  M: 'Meaning',
  A: 'Accomplishment',
}

// ─── PERMA Bar Renderer ─────────────────────────────────────────────────────

/**
 * Build the PERMA signal bars as a DOM element.
 *
 * @param {{ P: number, E: number, R: number, M: number, A: number }} signals
 * @returns {HTMLElement}
 */
export function buildPermaBars(signals) {
  const container = document.createElement('div')
  container.className = 'perma-bars'
  container.setAttribute('role', 'group')
  container.setAttribute('aria-label', 'Well-being signals')

  const dimensions = ['P', 'E', 'R', 'M', 'A']

  for (const dim of dimensions) {
    const value = signals[dim] || 0
    const label = PERMA_LABELS[dim]

    const row = document.createElement('div')
    row.className = 'perma-bar-row'

    const labelEl = document.createElement('span')
    labelEl.className = 'perma-bar-row__label'
    labelEl.textContent = label

    const trackEl = document.createElement('div')
    trackEl.className = 'perma-bar-row__track'

    const fillEl = document.createElement('div')
    fillEl.className = 'perma-bar-row__fill'
    fillEl.style.width = `${Math.round(value * 100)}%`
    // Use a unified warm color, not five different colors
    fillEl.setAttribute('aria-valuenow', String(Math.round(value * 100)))
    fillEl.setAttribute('aria-valuemin', '0')
    fillEl.setAttribute('aria-valuemax', '100')
    fillEl.setAttribute('role', 'meter')
    fillEl.setAttribute('aria-label', `${label}: ${Math.round(value * 100)}%`)

    trackEl.append(fillEl)
    row.append(labelEl, trackEl)
    container.append(row)
  }

  return container
}
