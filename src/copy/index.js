import auth from './auth.json'
import today from './today.json'
import trail from './trail.json'
import dialogs from './dialogs.json'
import steps from './steps.json'
import satellite from './satellite.json'
import topographic from './topographic.json'

/**
 * Interpolate {{key}} placeholders in a string.
 * @param {string} str - Template string (e.g. "{{count}} {{noun}} today")
 * @param {Record<string, string>} vars - Key-value map for substitution
 * @returns {string}
 */
export function t(str, vars = {}) {
  if (typeof str !== 'string') return ''
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? ''))
}

export default { auth, today, trail, dialogs, steps, satellite, topographic }
