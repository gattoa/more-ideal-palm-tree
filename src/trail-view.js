// ─── Trail View ─────────────────────────────────────────────────────────────
// Journey hemisphere: Trail-level perspective.
// Shows accumulated distance along each Path — how far you've walked —
// with milestone waypoints and 8-week frequency sparklines.
// No individual step details. No step-level interaction.
// Pure DOM SVG — no external library.

import copy, { t } from './copy/index.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // Sunday start
  return d
}

function weeksBetween(a, b) {
  return Math.floor((b - a) / (7 * 24 * 60 * 60 * 1000))
}

function getJourneyColor(slug) {
  const root = document.documentElement
  const map = {
    vitality: '--journey-vitality-500',
    pursuits: '--journey-pursuits-500',
    prosperity: '--journey-prosperity-500',
    connections: '--journey-connections-500',
    foundations: '--journey-foundations-500',
  }
  const varName = map[slug]
  if (!varName) return getComputedStyle(root).getPropertyValue('--color-text-muted').trim()
  return getComputedStyle(root).getPropertyValue(varName).trim()
}

// ─── Trail SVG ──────────────────────────────────────────────────────────────
// A continuous filled line showing accumulated distance along the path.
// Milestone waypoints are marked along the trail.
// No individual step dots — accumulation creates weight.

export function buildTrailSVG(totalSteps, completedSteps, pathMilestones, { journeySlug = null } = {}) {
  const width = 240
  const height = 24
  const color = getJourneyColor(journeySlug)
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()

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

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
// 8 vertical bars, one per week. Visual pattern only, no evaluative labels.

export function buildSparklineSVG(pathSteps, { weeks = 8, width = 160, height = 20, journeySlug = null } = {}) {
  const color = getJourneyColor(journeySlug)
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('trail-view__sparkline')

  const now = new Date()
  const currentWeekStart = startOfWeek(now)

  // Count steps per week
  const counts = new Array(weeks).fill(0)
  for (const step of pathSteps) {
    const stepDate = new Date(step.created_at)
    const weekStart = startOfWeek(stepDate)
    const weeksAgo = weeksBetween(weekStart, currentWeekStart)
    if (weeksAgo >= 0 && weeksAgo < weeks) {
      counts[weeks - 1 - weeksAgo]++
    }
  }

  const maxCount = Math.max(...counts, 1)
  const barGap = 3
  const barWidth = (width - barGap * (weeks - 1)) / weeks
  const minBarHeight = 2

  counts.forEach((count, i) => {
    const barHeight = count === 0 ? minBarHeight : Math.max((count / maxCount) * (height - 2), minBarHeight)
    const x = i * (barWidth + barGap)
    const y = height - barHeight

    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(barWidth))
    rect.setAttribute('height', String(barHeight))
    rect.setAttribute('rx', '1.5')
    rect.setAttribute('fill', count === 0 ? mutedColor : color)
    rect.setAttribute('opacity', count === 0 ? '0.15' : String(0.4 + (count / maxCount) * 0.6))
    svg.append(rect)
  })

  return svg
}

// ─── Main Renderer ──────────────────────────────────────────────────────────

export function renderTrailView(container, { paths, steps, stepPathsMap, milestones, journeys }) {
  container.replaceChildren()

  // Build a map: pathId → { path, steps[], journeySlugs Set }
  const pathDataMap = new Map()
  for (const path of paths) {
    pathDataMap.set(path.id, { path, steps: [], journeySlugs: new Set() })
  }

  // Associate ALL steps (not just today's) with their paths via stepPathsMap
  for (const step of steps) {
    const stepPaths = stepPathsMap.get(step.id)
    if (!stepPaths) continue
    for (const sp of stepPaths) {
      const entry = pathDataMap.get(sp.id)
      if (entry) {
        entry.steps.push(step)
        if (step.journeys?.slug) entry.journeySlugs.add(step.journeys.slug)
      }
    }
  }

  // Filter to paths with at least one step
  const activePaths = [...pathDataMap.values()].filter((d) => d.steps.length > 0)

  if (activePaths.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'trail-view__empty'
    empty.textContent = copy.trail.emptyState
    container.append(empty)
    return
  }

  // Sort paths by total step count descending — most-walked trails first
  activePaths.sort((a, b) => b.steps.length - a.steps.length)

  for (const { path, steps: pathSteps, journeySlugs } of activePaths) {
    // Pick the dominant journey slug (most frequent in this path's steps)
    const slugCounts = {}
    for (const slug of journeySlugs) slugCounts[slug] = 0
    for (const step of pathSteps) {
      const slug = step.journeys?.slug
      if (slug) slugCounts[slug] = (slugCounts[slug] || 0) + 1
    }
    const dominantSlug = Object.entries(slugCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // Get milestones associated with steps in this path
    const milestoneIds = new Set()
    for (const step of pathSteps) {
      if (step.milestone_id) milestoneIds.add(step.milestone_id)
    }
    const pathMilestones = milestones.filter((m) => milestoneIds.has(m.id))

    // Compute accumulated stats
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

    const sparklineSvg = buildSparklineSVG(pathSteps, { journeySlug: dominantSlug })

    const sparklineWrap = document.createElement('div')
    sparklineWrap.className = 'trail-view__sparkline-wrap'
    sparklineWrap.append(sparklineLabel, sparklineSvg)

    section.append(header, trailSvg, sparklineWrap)
    container.append(section)
  }
}
