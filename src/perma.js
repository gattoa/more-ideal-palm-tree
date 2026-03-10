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

  // ── Single-pass accumulator ──
  const journeySlugsUsed = new Set()
  const activeDays = new Set()
  let stepsWithPaths = 0
  let connectionsCount = 0
  let completedCount = 0
  let minTime = Infinity
  let maxTime = -Infinity

  for (const step of steps) {
    const slug = step.journeys?.slug
    if (slug) {
      journeySlugsUsed.add(slug)
      if (slug === 'connections') connectionsCount++
    }

    const ts = new Date(step.created_at)
    const time = ts.getTime()
    if (time < minTime) minTime = time
    if (time > maxTime) maxTime = time
    activeDays.add(`${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`)

    if (stepPathsMap?.get(step.id)?.length > 0) stepsWithPaths++
    if (step.completed) completedCount++
  }

  const MS_PER_DAY = 86_400_000
  const daySpan = Math.max(Math.ceil((maxTime - minTime) / MS_PER_DAY), 1)
  const daysActive = activeDays.size

  // ── Positive Emotion ──
  const stepsPerDay = daySpan > 0 ? steps.length / daySpan : steps.length
  const frequencySignal = Math.min(stepsPerDay / 5, 1)
  const diversitySignal = journeySlugsUsed.size / 5
  const P = clamp(frequencySignal * 0.6 + diversitySignal * 0.4)

  // ── Engagement ──
  const consistencySignal = daySpan > 0 ? daysActive / daySpan : 1
  const pathDepth = stepsWithPaths / steps.length
  const stepsPerActiveDay = daysActive > 0 ? steps.length / daysActive : 0
  const clusterSignal = Math.min(stepsPerActiveDay / 4, 1)
  const E = clamp(consistencySignal * 0.4 + pathDepth * 0.3 + clusterSignal * 0.3)

  // ── Relationships ──
  const rRatio = connectionsCount / steps.length
  const R = clamp(rRatio / 0.2)

  // ── Meaning ──
  const meaningRatio = stepsWithPaths / steps.length
  const multiJourneySignal = journeySlugsUsed.size >= 3 ? 1 : journeySlugsUsed.size / 3
  const M = clamp(meaningRatio * 0.65 + multiJourneySignal * 0.35)

  // ── Accomplishment ──
  const completionRate = completedCount / steps.length
  const completedMilestones = milestones.filter((m) => m.completed_at != null).length
  const milestoneSignal = milestones.length > 0
    ? Math.min(completedMilestones / Math.max(milestones.length, 3), 1)
    : 0
  const A = clamp(completionRate * 0.6 + milestoneSignal * 0.4)

  return { P, E, R, M, A }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v) {
  return Math.max(0, Math.min(1, v))
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
