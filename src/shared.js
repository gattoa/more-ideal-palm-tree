// ─── Shared Utilities ───────────────────────────────────────────────────────
// Common constants, helpers, and data shared across view modules.

export const SVG_NS = 'http://www.w3.org/2000/svg'

export const JOURNEY_SLUGS = ['vitality', 'pursuits', 'prosperity', 'connections', 'foundations']

export const TRAIL_WINDOW_DAYS = 55
export const TOPOGRAPHIC_WINDOW_DAYS = 90

// ─── CSS Token Reader ───────────────────────────────────────────────────────

const rootStyles = getComputedStyle(document.documentElement)

export function readToken(name) {
  return rootStyles.getPropertyValue(name).trim()
}

// ─── Journey Colors ─────────────────────────────────────────────────────────

const JOURNEY_COLOR_MAP = {
  vitality: '--journey-vitality-500',
  pursuits: '--journey-pursuits-500',
  prosperity: '--journey-prosperity-500',
  connections: '--journey-connections-500',
  foundations: '--journey-foundations-500',
}

export function getJourneyColor(slug) {
  const varName = JOURNEY_COLOR_MAP[slug]
  if (!varName) return readToken('--color-text-muted')
  return readToken(varName)
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // Sunday start
  return d
}

export function weeksBetween(a, b) {
  return Math.floor((b - a) / (7 * 24 * 60 * 60 * 1000))
}

export function formatDateRange(daysBack) {
  const now = new Date()
  const past = new Date(now)
  past.setDate(past.getDate() - daysBack)
  const fmt = { month: 'short', day: 'numeric' }
  return `${past.toLocaleDateString('en-US', fmt)} – ${now.toLocaleDateString('en-US', fmt)}`
}

// ─── Path Data Assembly ─────────────────────────────────────────────────────
// Shared logic for building path → steps associations used by trail-view and week-view.

export function buildActivePathData(paths, steps, stepPathsMap, milestones) {
  const pathDataMap = new Map()
  for (const path of paths) {
    pathDataMap.set(path.id, { path, steps: [], journeySlugs: new Set() })
  }

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

  const activePaths = [...pathDataMap.values()].filter((d) => d.steps.length > 0)

  // Enrich each entry with dominantSlug and pathMilestones
  for (const entry of activePaths) {
    // Dominant slug
    const slugCounts = {}
    for (const slug of entry.journeySlugs) slugCounts[slug] = 0
    for (const step of entry.steps) {
      const slug = step.journeys?.slug
      if (slug) slugCounts[slug] = (slugCounts[slug] || 0) + 1
    }
    entry.dominantSlug = Object.entries(slugCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // Path milestones
    const milestoneIds = new Set()
    for (const step of entry.steps) {
      if (step.milestone_id) milestoneIds.add(step.milestone_id)
    }
    entry.pathMilestones = milestones.filter((m) => milestoneIds.has(m.id))
  }

  return activePaths
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
// 8 vertical bars, one per week. Shared between trail-view and week-view.

export function buildSparklineSVG(pathSteps, { weeks = 8, width = 160, height = 20, journeySlug = null, className = 'sparkline' } = {}) {
  const color = getJourneyColor(journeySlug)
  const mutedColor = readToken('--color-text-muted')

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add(className)

  const now = new Date()
  const currentWeekStart = startOfWeek(now)

  const counts = new Array(weeks).fill(0)
  for (const step of pathSteps) {
    const stepDate = new Date(step.created_at)
    const ws = startOfWeek(stepDate)
    const weeksAgo = weeksBetween(ws, currentWeekStart)
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
