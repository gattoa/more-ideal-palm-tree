// ─── Week View ──────────────────────────────────────────────────────────────
// Renders per-path activity visualization and 8-week sparkline.
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

// ─── Activity SVG ───────────────────────────────────────────────────────────
// Horizontal dot sequence: ● = step, ⚑ = milestone, ○ = current position.

export function buildActivitySVG(pathSteps, pathMilestones, { journeySlug = null } = {}) {
  const width = 240
  const height = 24
  const color = getJourneyColor(journeySlug)
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()

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

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
// 8 vertical bars, one per week, no labels/axes.

export function buildSparklineSVG(pathSteps, { weeks = 8, width = 160, height = 20, journeySlug = null } = {}) {
  const color = getJourneyColor(journeySlug)
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('week-view__sparkline')

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

export function renderWeekView(container, { paths, steps, stepPathsMap, milestones, journeys }) {
  container.replaceChildren()

  // Build a map: pathId → { path, steps[], journeySlugs Set }
  const pathDataMap = new Map()
  for (const path of paths) {
    pathDataMap.set(path.id, { path, steps: [], journeySlugs: new Set() })
  }

  // Associate steps with their paths via stepPathsMap
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
    empty.className = 'week-view__empty'
    empty.textContent = copy.week.emptyState
    container.append(empty)
    return
  }

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
    const sparklineSvg = buildSparklineSVG(pathSteps, { journeySlug: dominantSlug })

    section.append(header, activitySvg, sparklineSvg)
    container.append(section)
  }
}
