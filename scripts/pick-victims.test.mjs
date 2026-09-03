import assert from 'node:assert/strict'
import { encodeSegment } from '../lib/jsonl-paths.js'
import { isOrdinarySession, isUnusedBlank, pickVictims } from '../lib/logic.js'

assert.equal(
  encodeSegment('session-38f7b585-bbab-4e75-92d7-651f103fa5cd'),
  'session-38f7b585-bbab-4e75-92d7-651f103fa5cd',
)
assert.equal(encodeSegment('a/b'), 'a~002Fb')

assert.equal(isOrdinarySession({}), true)
assert.equal(isOrdinarySession({ origin: undefined }), true)
assert.equal(isOrdinarySession({ origin: 'subagent' }), false)
assert.equal(isOrdinarySession({ origin: 'automation' }), false)

assert.equal(isUnusedBlank([]), true)
assert.equal(isUnusedBlank([{ type: 'permission/preset' }]), true)
assert.equal(isUnusedBlank([{ type: 'turn/start' }]), false)

assert.deepEqual(pickVictims([]), [])
assert.deepEqual(pickVictims([{ id: 'only', createdAt: 1 }]), [])

const victims = pickVictims([
  { id: 'old', createdAt: 1 },
  { id: 'new', createdAt: 3 },
  { id: 'mid', createdAt: 2 },
])
assert.deepEqual(victims.map(item => item.id), ['mid', 'old'])

const tied = pickVictims([
  { id: 'b', createdAt: 1 },
  { id: 'a', createdAt: 1 },
])
assert.equal(tied.length, 1)
assert.equal(tied[0].id, 'b')

console.log('ok')
