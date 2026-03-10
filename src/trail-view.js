// ─── Trail View ─────────────────────────────────────────────────────────────
// Journey hemisphere: Trail-level perspective.
// Shows accumulated distance along each Path — how far you've walked —
// with milestone waypoints and 8-week frequency sparklines.
// No individual step details. No step-level interaction.
// Pure DOM SVG — no external library.

import copy, { t } from './copy/index.js'
import { SVG_NS, getJourneyColor, readToken, buildSparklineSVG, buildActivePathData } from './shared.js'

// ─── Trail SVG ──────────────────────────────────────────────────────────────
// A continuous filled line showing accumulated distance along the path.
// Milestone waypoints are marked along the trail.
// No individual step dots — accumulation creates weight.

export function buildTrailSVG(totalSteps, completedSteps, pathMilestones, { journeySlug = null } = {}) {
  const width = 240
  const height = 24
  const color = getJourneyColor(journeySlug)
  const mutedColor = readToken('--color-text-muted')

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('trail-view__trail-svg')

  const padX = 8
  const usable = width - padX * 2
  const cy = height / 2

  // Full trail baseline (where the path could go)
  const baseline = document.createElementNS(SVG_NS, 'line')
  baseline.setAttribute('x1', String(padX))
  baseline.setAttribute('y1', String(cy))
  baseline.setAttribute('x2', String(width - padX))
  baseline.setAttribute('y2', String(cy))
  baseline.setAttribute('stroke', mutedColor)
  baseline.setAttribute('stroke-opacity', '0.18')
  baseline.setAttribute('stroke-width', '2')
  baseline.setAttribute('stroke-linecap', 'round')
  svg.append(baseline)

  if (totalSteps === 0) return svg

  // Completed trail — solid filled line showing distance walked
  const progress = completedSteps / totalSteps
  const trailEnd = padX + progress * usable

  if (completedSteps > 0) {
    const trail = document.createElementNS(SVG_NS, 'line')
    trail.setAttribute('x1', String(padX))
    trail.setAttribute('y1', String(cy))
    trail.setAttribute('x2', String(trailEnd))
    trail.setAttribute('y2', String(cy))
    trail.setAttribute('stroke', color)
    trail.setAttribute('stroke-width', '3')
    trail.setAttribute('stroke-linecap', 'round')
    trail.setAttribute('stroke-opacity', '0.85')
    svg.append(trail)
  }

  // In-progress trail — faded extension for incomplete steps
  if (completedSteps < totalSteps) {
    const inProgress = document.createElementNS(SVG_NS, 'line')
    inProgress.setAttribute('x1', String(trailEnd))
    inProgress.setAttribute('y1', String(cy))
    inProgress.setAttribute('x2', String(padX + usable))
    inProgress.setAttribute('y2', String(cy))
    inProgress.setAttribute('stroke', color)
    inProgress.setAttribute('stroke-width', '2')
    inProgress.setAttribute('stroke-linecap', 'round')
    inProgress.setAttribute('stroke-opacity', '0.25')
    svg.append(inProgress)
  }

  // Milestone waypoints — small diamonds placed proportionally along the trail
  if (pathMilestones && pathMilestones.length > 0) {
    const msSpacing = usable / (pathMilestones.length + 1)
    pathMilestones.forEach((ms, i) => {
      const x = padX + msSpacing * (i + 1)
      const size = 4
      const diamond = document.createElementNS(SVG_NS, 'polygon')
      diamond.setAttribute(
        'points',
        `${x},${cy - size} ${x + size},${cy} ${x},${cy + size} ${x - size},${cy}`,
      )
      const isReached = x <= trailEnd
      diamond.setAttribute('fill', isReached ? color : 'none')
      diamond.setAttribute('stroke', color)
      diamond.setAttribute('stroke-width', '1.5')
      diamond.setAttribute('opacity', isReached ? '0.9' : '0.4')
      svg.append(diamond)
    })
  }

  // Current position indicator — small circle at the leading edge
  const posX = Math.min(trailEnd, padX + usable)
  const pos = document.createElementNS(SVG_NS, 'circle')
  pos.setAttribute('cx', String(posX))
  pos.setAttribute('cy', String(cy))
  pos.setAttribute('r', '3.5')
  pos.setAttribute('fill', color)
  pos.setAttribute('stroke', 'var(--color-surface, #fff)')
  pos.setAttribute('stroke-width', '2')
  svg.append(pos)

  return svg
}

// ─── Main Renderer ──────────────────────────────────────────────────────────

export function renderTrailView(container, { paths, steps, stepPathsMap, milestones, journeys }) {
  container.replaceChildren()

  const activePaths = buildActivePathData(paths, steps, stepPathsMap, milestones)

  if (activePaths.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'trail-view__empty'
    empty.textContent = copy.trail.emptyState
    container.append(empty)
    return
  }

  // Sort paths by total step count descending — most-walked trails first
  activePaths.sort((a, b) => b.steps.length - a.steps.length)

  for (const { path, steps: pathSteps, dominantSlug, pathMilestones } of activePaths) {
    const totalSteps = pathSteps.length
    const completedSteps = pathSteps.filter((s) => s.completed).length

    // Build path section
    const section = document.createElement('article')
    section.className = 'trail-view__path'

    // Header: dot + name + accumulated count
    const header = document.createElement('div')
    header.className = 'trail-view__path-header'

    const dot = document.createElement('span')
    dot.className = 'trail-view__path-dot'
    if (dominantSlug) dot.dataset.journeySlug = dominantSlug

    const nameEl = document.createElement('span')
    nameEl.className = 'trail-view__path-name'
    nameEl.textContent = path.name

    const countEl = document.createElement('span')
    countEl.className = 'trail-view__path-count'
    const noun = completedSteps === 1 ? copy.trail.stepSingular : copy.trail.stepPlural
    countEl.textContent = t(copy.trail.pathCountTemplate, {
      completed: String(completedSteps),
      total: String(totalSteps),
      noun,
    })

    header.append(dot, nameEl, countEl)

    // Trail line — accumulated progress visualization
    const trailSvg = buildTrailSVG(totalSteps, completedSteps, pathMilestones, {
      journeySlug: dominantSlug,
    })

    // Sparkline — 8-week frequency pattern
    const sparklineLabel = document.createElement('span')
    sparklineLabel.className = 'trail-view__sparkline-label'
    sparklineLabel.textContent = copy.trail.frequencyLabel

    const sparklineSvg = buildSparklineSVG(pathSteps, { journeySlug: dominantSlug, className: 'trail-view__sparkline' })

    const sparklineWrap = document.createElement('div')
    sparklineWrap.className = 'trail-view__sparkline-wrap'
    sparklineWrap.append(sparklineLabel, sparklineSvg)

    section.append(header, trailSvg, sparklineWrap)
    container.append(section)
  }
}
