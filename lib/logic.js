/**
 * Pure helpers for unused-blank selection. Kept free of cordis/schemastery
 * so the unit script can import them under plain Node.
 * @module dsh-plugin-blank-session-gc/logic
 */

/**
 * A session is unused when no model turn has started. Standalone plugin
 * events (permission pins, /plan, /goal, titles) do not count as use —
 * matching Host `sessionBlank`.
 * @param {readonly {type: string}[]} events
 */
export function isUnusedBlank(events) {
  return !events.some(event => event.type === 'turn/start')
}

/**
 * Keep the newest unused blank; return the rest for deletion.
 * @param {Array<{id: string, createdAt: number}>} blanks
 */
export function pickVictims(blanks) {
  if (blanks.length <= 1) return []
  const ranked = [...blanks].sort((left, right) =>
    right.createdAt - left.createdAt || (left.id < right.id ? -1 : 1))
  return ranked.slice(1)
}
