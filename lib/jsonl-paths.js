/**
 * JSONL session-directory lookup after SessionPersistence.locate() went private.
 * encodeSegment mirrors @deepseek-ai/dsh-session-persistence-jsonl/src/format.ts
 * so a session-id path segment still matches the on-disk bucket.
 *
 * @module dsh-plugin-blank-session-gc/jsonl-paths
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Encode one session id as a single safe path segment.
 * @param {string} raw
 * @returns {string}
 */
export function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

/**
 * Find `<root>/<projectKey>/<encodedId>` without recomputing projectKey.
 * @param {string} root
 * @param {string} id
 * @returns {Promise<string | undefined>}
 */
export async function findJsonlSessionDir(root, id) {
  const encoded = encodeSegment(id)
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name, encoded)
    try {
      await stat(dir)
      return dir
    } catch {
      // next project bucket
    }
  }
  return undefined
}
