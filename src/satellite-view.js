// ─── Satellite View ─────────────────────────────────────────────────────────
// Journey hemisphere: Satellite-level perspective.
// Assembles the Journey Balance Wheel, PERMA signal bars, and activity summary.
// This is the highest zoom level — a quiet overview, not a dashboard of demands.

import { buildWheelSVG, countStepsByJourney, getPeriodWindows } from './wheel.js'
import { inferPermaSignals, buildPermaBars } from './perma.js'
import { JOURNEY_SLUGS } from './shared.js'
import copy, { t } from './copy/index.js'

/**
 * Render the Satellite View into a container.
 *
 * @param {HTMLElement} container
 * @param {Object} data - { steps, journeys, paths, milestones, stepPathsMap }
 * @param {Object} options - { period: 'week' | 'month' | 'quarter' }
 */
export function renderSatelliteView(container, { steps, journeys, paths, milestones, stepPathsMap }, { period = 'quarter' } = {}) {
  container.replaceChildren()

  const windows = getPeriodWindows(period)

  // Filter steps for current and previous periods
  const currentSteps = steps.filter((s) => {
    const d = new Date(s.created_at)
    return d >= windows.current.start && d <= windows.current.end
  })

  const previousSteps = steps.filter((s) => {
    const d = new Date(s.created_at)
    return d >= windows.previous.start && d <= windows.previous.end
  })

  const currentCounts = countStepsByJourney(steps, windows.current.start, windows.current.end)
  const previousCounts = countStepsByJourney(steps, windows.previous.start, windows.previous.end)

  // ── Empty state ──
  if (currentSteps.length === 0 && previousSteps.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'satellite-view__empty'
    empty.textContent = copy.satellite.emptyState
    container.append(empty)
    return
  }

  // ── Observational intro ──
  const intro = document.createElement('p')
  intro.className = 'satellite-view__intro'
  intro.textContent = copy.satellite.intro
  container.append(intro)

  // ── Period selector ──
  const periodSelector = document.createElement('div')
  periodSelector.className = 'period-selector'
  periodSelector.setAttribute('role', 'group')
  periodSelector.setAttribute('aria-label', copy.satellite.periodSelectorAria)

  const periods = [
    { key: 'week', label: copy.satellite.periodWeek },
    { key: 'month', label: copy.satellite.periodMonth },
    { key: 'quarter', label: copy.satellite.periodQuarter },
  ]

  for (const p of periods) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'period-selector__option'
    btn.dataset.period = p.key
    btn.textContent = p.label
    if (p.key === period) btn.classList.add('is-active')
    periodSelector.append(btn)
  }

  container.append(periodSelector)

  // ── Balance Wheel ──
  const wheelWrap = document.createElement('div')
  wheelWrap.className = 'balance-wheel'

  const wheelSVG = buildWheelSVG(currentCounts, previousCounts, journeys)
  wheelWrap.append(wheelSVG)
  container.append(wheelWrap)

  // ── Activity Summary per Journey ──
  const summarySection = document.createElement('div')
  summarySection.className = 'journey-activity-summary'

  const totalSteps = Object.values(currentCounts).reduce((a, b) => a + b, 0)
  const lowThreshold = totalSteps * 0.15

  for (const slug of JOURNEY_SLUGS) {
    const journey = journeys.find((j) => j.slug === slug)
    if (!journey) continue

    const count = currentCounts[slug] || 0

    const row = document.createElement('div')
    row.className = 'journey-activity-summary__row'
    row.dataset.journeySlug = slug

    const nameEl = document.createElement('span')
    nameEl.className = 'journey-activity-summary__name'
    nameEl.textContent = journey.name

    const countEl = document.createElement('span')
    countEl.className = 'journey-activity-summary__count'
    const noun = count === 1
      ? copy.satellite.stepSingular
      : copy.satellite.stepPlural
    countEl.textContent = `${count} ${noun}`

    row.append(nameEl, countEl)

    // Low activity flag — observational, not judgmental
    if (totalSteps > 0 && count < lowThreshold && count > 0) {
      const flag = document.createElement('span')
      flag.className = 'journey-activity-summary__flag'
      flag.textContent = t(copy.satellite.lowActivityFlag, { journey: journey.name, period: getPeriodLabel(period) })
      row.append(flag)
    } else if (count === 0) {
      const flag = document.createElement('span')
      flag.className = 'journey-activity-summary__flag'
      flag.textContent = t(copy.satellite.noActivityFlag, { journey: journey.name })
      row.append(flag)
    }

    summarySection.append(row)
  }

  container.append(summarySection)

  // ── PERMA Signal Bars ──
  const permaSection = document.createElement('div')
  permaSection.className = 'satellite-view__perma'

  const permaHeading = document.createElement('h3')
  permaHeading.className = 'satellite-view__section-heading'
  permaHeading.textContent = copy.satellite.permaHeading

  const permaDesc = document.createElement('p')
  permaDesc.className = 'satellite-view__section-desc'
  permaDesc.textContent = copy.satellite.permaDesc

  const signals = inferPermaSignals(currentSteps, { stepPathsMap, milestones, journeys })
  const permaBars = buildPermaBars(signals)

  permaSection.append(permaHeading, permaDesc, permaBars)
  container.append(permaSection)
}

function getPeriodLabel(period) {
  switch (period) {
    case 'week': return 'this week'
    case 'month': return 'this month'
    case 'quarter': return 'this quarter'
    default: return 'recently'
  }
}
