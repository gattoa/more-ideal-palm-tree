// ─── Week View ──────────────────────────────────────────────────────────────
// Renders per-path activity visualization and 8-week sparkline.
// Pure DOM SVG — no external library.

import copy, { t } from './copy/index.js'
import { SVG_NS, getJourneyColor, readToken, buildSparklineSVG, buildActivePathData } from './shared.js'

// ─── Activity SVG ───────────────────────────────────────────────────────────
// Horizontal dot sequence: ● = step, ⚑ = milestone, ○ = current position.

export function buildActivitySVG(pathSteps, pathMilestones, { journeySlug = null } = {}) {
  const width = 240
  const height = 24
  const color = getJourneyColor(journeySlug)
  const mutedColor = readToken('--color-text-muted')

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('week-view__activity-svg')

  // Draw baseline
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', '8')
  line.setAttribute('y1', String(height / 2))
  line.setAttribute('x2', String(width - 8))
  line.setAttribute('y2', String(height / 2))
  line.setAttribute('stroke', mutedColor)
  line.setAttribute('stroke-opacity', '0.25')
  line.setAttribute('stroke-width', '1')
  svg.append(line)

  if (pathSteps.length === 0) return svg

  // Sort steps by date
  const sorted = [...pathSteps].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const total = sorted.length
  const padX = 12
  const usable = width - padX * 2

  // Place step dots evenly
  sorted.forEach((step, i) => {
    const x = total === 1 ? width / 2 : padX + (i / (total - 1)) * usable
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(x))
    circle.setAttribute('cy', String(height / 2))
    circle.setAttribute('r', step.completed ? '3' : '2.5')
    circle.setAttribute('fill', step.completed ? color : 'none')
    circle.setAttribute('stroke', color)
    circle.setAttribute('stroke-width', step.completed ? '0' : '1.5')
    svg.append(circle)
  })

  // Place milestone markers (flag icon as small diamond)
  if (pathMilestones && pathMilestones.length > 0) {
    for (const ms of pathMilestones) {
      // Position milestone at the right edge
      const x = width - padX
      const y = height / 2
      const diamond = document.createElementNS(SVG_NS, 'polygon')
      diamond.setAttribute('points', `${x},${y - 5} ${x + 4},${y} ${x},${y + 5} ${x - 4},${y}`)
      diamond.setAttribute('fill', color)
      diamond.setAttribute('opacity', '0.6')
      svg.append(diamond)
    }
  }

  // Current position indicator (rightmost open circle)
  const lastX = total === 1 ? width / 2 : padX + ((total - 1) / (total - 1)) * usable
  const current = document.createElementNS(SVG_NS, 'circle')
  current.setAttribute('cx', String(lastX + 8))
  current.setAttribute('cy', String(height / 2))
  current.setAttribute('r', '2')
  current.setAttribute('fill', 'none')
  current.setAttribute('stroke', color)
  current.setAttribute('stroke-width', '1.5')
  current.setAttribute('stroke-dasharray', '2 2')
  svg.append(current)

  return svg
}

// ─── Main Renderer ──────────────────────────────────────────────────────────

export function renderWeekView(container, { paths, steps, stepPathsMap, milestones, journeys }) {
  container.replaceChildren()

  const activePaths = buildActivePathData(paths, steps, stepPathsMap, milestones)

  if (activePaths.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'week-view__empty'
    empty.textContent = copy.week.emptyState
    container.append(empty)
    return
  }

  for (const { path, steps: pathSteps, dominantSlug, pathMilestones } of activePaths) {

    // Build path section
    const section = document.createElement('div')
    section.className = 'week-view__path'

    // Header
    const header = document.createElement('div')
    header.className = 'week-view__path-header'

    const dot = document.createElement('span')
    dot.className = 'week-view__path-dot'
    if (dominantSlug) dot.dataset.journeySlug = dominantSlug

    const nameEl = document.createElement('span')
    nameEl.className = 'week-view__path-name'
    nameEl.textContent = path.name

    const countEl = document.createElement('span')
    countEl.className = 'week-view__path-count'
    countEl.textContent = t(copy.week.pathStepCountTemplate, { count: String(pathSteps.length) })

    header.append(dot, nameEl, countEl)

    // Activity line
    const activitySvg = buildActivitySVG(pathSteps, pathMilestones, { journeySlug: dominantSlug })

    // Sparkline
    const sparklineSvg = buildSparklineSVG(pathSteps, { journeySlug: dominantSlug, className: 'week-view__sparkline' })

    section.append(header, activitySvg, sparklineSvg)
    container.append(section)
  }
}
