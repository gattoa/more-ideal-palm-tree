// ─── Journey Balance Wheel ──────────────────────────────────────────────────
// Five-spoke radial SVG. Spoke length proportional to Step count per Journey.
// Ghost outline of previous period for trend comparison.
// Pure DOM SVG — no external library.

const SVG_NS = 'http://www.w3.org/2000/svg'

const JOURNEY_ANGLES = {
  // Evenly spaced around the circle, starting from top (12 o'clock)
  // Order: Vitality (top), Pursuits (top-right), Prosperity (bottom-right),
  //        Connections (bottom-left), Foundations (top-left)
  vitality:    -90,
  pursuits:    -90 + 72,
  prosperity:  -90 + 144,
  connections: -90 + 216,
  foundations: -90 + 288,
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

function getJourneySoftColor(slug) {
  const root = document.documentElement
  const map = {
    vitality: '--journey-vitality-100',
    pursuits: '--journey-pursuits-100',
    prosperity: '--journey-prosperity-100',
    connections: '--journey-connections-100',
    foundations: '--journey-foundations-100',
  }
  const varName = map[slug]
  if (!varName) return 'transparent'
  return getComputedStyle(root).getPropertyValue(varName).trim()
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

/**
 * Build the Journey Balance Wheel SVG.
 *
 * @param {Object} currentCounts - { vitality: N, pursuits: N, ... } step counts for current period
 * @param {Object} previousCounts - same shape for previous period (ghost outline)
 * @param {Object[]} journeys - array of journey objects with { slug, name }
 * @param {Object} options
 * @returns {SVGElement}
 */
export function buildWheelSVG(currentCounts, previousCounts, journeys, { size = 280 } = {}) {
  const cx = size / 2
  const cy = size / 2
  const maxRadius = size / 2 - 32 // leave room for labels
  const minDotRadius = 4

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('balance-wheel__svg')

  // Find max count to normalize spoke lengths
  const allCounts = Object.values(currentCounts)
  const maxCount = Math.max(...allCounts, 1)

  const allPrevCounts = Object.values(previousCounts || {})
  const maxPrev = Math.max(...allPrevCounts, 1)
  const normalizeMax = Math.max(maxCount, maxPrev, 1)

  // ── Grid rings (subtle concentric circles for reference) ──
  const rings = [0.25, 0.5, 0.75, 1.0]
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()

  for (const fraction of rings) {
    const ring = document.createElementNS(SVG_NS, 'circle')
    ring.setAttribute('cx', String(cx))
    ring.setAttribute('cy', String(cy))
    ring.setAttribute('r', String(fraction * maxRadius))
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', mutedColor)
    ring.setAttribute('stroke-opacity', '0.08')
    ring.setAttribute('stroke-width', '1')
    svg.append(ring)
  }

  // ── Spoke baselines ──
  const slugs = ['vitality', 'pursuits', 'prosperity', 'connections', 'foundations']

  for (const slug of slugs) {
    const angle = JOURNEY_ANGLES[slug]
    const end = polarToCartesian(cx, cy, maxRadius, angle)

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(cx))
    line.setAttribute('y1', String(cy))
    line.setAttribute('x2', String(end.x))
    line.setAttribute('y2', String(end.y))
    line.setAttribute('stroke', mutedColor)
    line.setAttribute('stroke-opacity', '0.1')
    line.setAttribute('stroke-width', '1')
    svg.append(line)
  }

  // ── Ghost outline (previous period) ──
  if (previousCounts && allPrevCounts.some((c) => c > 0)) {
    const ghostPoints = slugs.map((slug) => {
      const count = previousCounts[slug] || 0
      const radius = count === 0 ? 0 : Math.max((count / normalizeMax) * maxRadius, minDotRadius)
      const angle = JOURNEY_ANGLES[slug]
      return polarToCartesian(cx, cy, radius, angle)
    })

    const ghostPath = ghostPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'

    const ghost = document.createElementNS(SVG_NS, 'path')
    ghost.setAttribute('d', ghostPath)
    ghost.setAttribute('fill', 'none')
    ghost.setAttribute('stroke', mutedColor)
    ghost.setAttribute('stroke-opacity', '0.2')
    ghost.setAttribute('stroke-width', '1.5')
    ghost.setAttribute('stroke-dasharray', '4 3')
    svg.append(ghost)
  }

  // ── Current period shape ──
  const currentPoints = slugs.map((slug) => {
    const count = currentCounts[slug] || 0
    const radius = count === 0 ? 0 : Math.max((count / normalizeMax) * maxRadius, minDotRadius)
    const angle = JOURNEY_ANGLES[slug]
    return polarToCartesian(cx, cy, radius, angle)
  })

  if (allCounts.some((c) => c > 0)) {
    // Filled shape
    const shapePath = currentPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'

    const shape = document.createElementNS(SVG_NS, 'path')
    shape.setAttribute('d', shapePath)
    shape.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--brand-200').trim())
    shape.setAttribute('fill-opacity', '0.18')
    shape.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim())
    shape.setAttribute('stroke-opacity', '0.4')
    shape.setAttribute('stroke-width', '1.5')
    shape.setAttribute('stroke-linejoin', 'round')
    svg.append(shape)
  }

  // ── Spoke endpoints (journey-colored dots) ──
  for (const slug of slugs) {
    const count = currentCounts[slug] || 0
    const radius = count === 0 ? 0 : Math.max((count / normalizeMax) * maxRadius, minDotRadius)
    const angle = JOURNEY_ANGLES[slug]
    const pos = polarToCartesian(cx, cy, radius, angle)
    const color = getJourneyColor(slug)

    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.setAttribute('cx', String(count === 0 ? cx : pos.x))
    dot.setAttribute('cy', String(count === 0 ? cy : pos.y))
    dot.setAttribute('r', count === 0 ? '3' : '5')
    dot.setAttribute('fill', color)
    dot.setAttribute('stroke', 'var(--color-surface, #fff)')
    dot.setAttribute('stroke-width', '2')
    dot.setAttribute('opacity', count === 0 ? '0.35' : '1')
    svg.append(dot)
  }

  // ── Labels around the outside ──
  for (const j of journeys) {
    if (!JOURNEY_ANGLES[j.slug]) continue
    const angle = JOURNEY_ANGLES[j.slug]
    const labelRadius = maxRadius + 18
    const pos = polarToCartesian(cx, cy, labelRadius, angle)

    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('x', String(pos.x))
    text.setAttribute('y', String(pos.y))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', getJourneyColor(j.slug))
    text.setAttribute('font-size', '10')
    text.setAttribute('font-weight', '500')
    text.setAttribute('font-family', 'var(--font-family-body)')
    text.setAttribute('opacity', '0.75')
    text.textContent = j.name
    svg.append(text)
  }

  // ── Center dot ──
  const center = document.createElementNS(SVG_NS, 'circle')
  center.setAttribute('cx', String(cx))
  center.setAttribute('cy', String(cy))
  center.setAttribute('r', '2')
  center.setAttribute('fill', mutedColor)
  center.setAttribute('opacity', '0.25')
  svg.append(center)

  return svg
}

/**
 * Count steps per journey slug for a given time window.
 *
 * @param {Object[]} steps - all loaded steps
 * @param {Date} start - window start (inclusive)
 * @param {Date} end - window end (inclusive)
 * @returns {Object} { vitality: N, pursuits: N, ... }
 */
export function countStepsByJourney(steps, start, end) {
  const counts = {
    vitality: 0,
    pursuits: 0,
    prosperity: 0,
    connections: 0,
    foundations: 0,
  }

  for (const step of steps) {
    const created = new Date(step.created_at)
    if (created < start || created > end) continue
    const slug = step.journeys?.slug
    if (slug && counts[slug] !== undefined) {
      counts[slug]++
    }
  }

  return counts
}

/**
 * Get time windows for current and previous periods.
 *
 * @param {'week' | 'month' | 'quarter'} period
 * @returns {{ current: { start, end }, previous: { start, end } }}
 */
export function getPeriodWindows(period) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (period === 'week') {
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const prevWeekEnd = new Date(weekStart)
    prevWeekEnd.setMilliseconds(-1)
    const prevWeekStart = new Date(prevWeekEnd)
    prevWeekStart.setDate(prevWeekStart.getDate() - 6)
    prevWeekStart.setHours(0, 0, 0, 0)

    return {
      current: { start: weekStart, end: today },
      previous: { start: prevWeekStart, end: prevWeekEnd },
    }
  }

  if (period === 'month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const prevMonthEnd = new Date(monthStart)
    prevMonthEnd.setMilliseconds(-1)
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)

    return {
      current: { start: monthStart, end: today },
      previous: { start: prevMonthStart, end: prevMonthEnd },
    }
  }

  // quarter
  const quarterMonth = Math.floor(today.getMonth() / 3) * 3
  const quarterStart = new Date(today.getFullYear(), quarterMonth, 1)
  const prevQuarterEnd = new Date(quarterStart)
  prevQuarterEnd.setMilliseconds(-1)
  const prevQuarterMonth = Math.floor(prevQuarterEnd.getMonth() / 3) * 3
  const prevQuarterStart = new Date(prevQuarterEnd.getFullYear(), prevQuarterMonth, 1)

  return {
    current: { start: quarterStart, end: today },
    previous: { start: prevQuarterStart, end: prevQuarterEnd },
  }
}
