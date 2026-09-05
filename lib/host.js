import { rm } from 'node:fs/promises'
import { findJsonlSessionDir } from './jsonl-paths.js'
import { isOrdinarySession, isUnusedBlank, pickVictims } from './logic.js'
export { isOrdinarySession, isUnusedBlank, pickVictims }

/** Factory receives the versioned StarPivot host API after admission. */
export default function createHost(api) {
  const { snapshotSessionEvents, readPersistedSession, dshHomePath, z } = api


const name = 'blank-session-gc'

const inject = ['sessionPersistence', 'workspaceRegistry']


/** Skip open/read for logs this large: they are treated as used. */
const INSPECT_MAX_BYTES = 64 * 1024


/**
 * Live Session dropped the `events` getter; persistence dropped `inspect()`.
 * @param {{snapshotEvents?: () => readonly object[], events?: readonly object[]}} session
 * @returns {readonly object[]}
 */
function sessionLog(session) {
  return snapshotSessionEvents(session)
}


/**
 * @param {{open: (id: string, access: string) => Promise<{read: () => Promise<readonly object[]>, close: () => Promise<void>}>}} persistence
 * @param {string} id
 * @returns {Promise<readonly object[]>}
 */
async function readPersistedEvents(persistence, id) {
  return (await readPersistedSession(persistence, id)).events
}


const Config = z.object({
  /** Milliseconds to wait after a create burst before scanning. */
  debounceMs: z.number().default(250),
})


/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{debounceMs?: number}} config
 */
function apply(ctx, config) {
  const debounceMs = Number(config?.debounceMs) > 0 ? Number(config.debounceMs) : 250
  ctx.inject(['sessionPersistence', 'workspaceRegistry'], (ready) => {
    const log = ctx.logger
    let pending
    let inFlight = false
    let rerun = false

    const schedule = () => {
      if (pending !== undefined) return
      pending = setTimeout(() => {
        pending = undefined
        void sweep('scheduled')
      }, debounceMs)
      pending.unref?.()
    }

    ctx.effect(() => () => {
      if (pending !== undefined) clearTimeout(pending)
    }, 'blank-session-gc: debounce')

    /**
     * Collect unused ordinary blanks from live sessions and materialized logs.
     * Live wins on id so an attached session is not re-inspected from disk.
     */
    const collectBlanks = async () => {
      /** @type {Map<string, {id: string, createdAt: number, live: boolean, header: object}>} */
      const byId = new Map()
      const sessions = ready.get('sessions')
      if (sessions !== undefined) {
        for (const session of sessions.list()) {
          if (!isOrdinarySession(session.header)) continue
          if (!isUnusedBlank(sessionLog(session))) continue
          byId.set(session.id, {
            id: session.id,
            createdAt: session.header.createdAt,
            live: true,
            header: session.header,
          })
        }
      }
      const persisted = await ready.sessionPersistence.list()
      for (const snapshot of persisted) {
        const header = snapshot.header
        if (header === undefined || byId.has(header.id)) continue
        if (!isOrdinarySession(header)) continue
        if (typeof snapshot.sizeBytes === 'number' && snapshot.sizeBytes > INSPECT_MAX_BYTES) continue
        let events
        try {
          events = snapshot.eventCount === 0
            ? []
            : await readPersistedEvents(ready.sessionPersistence, header.id)
        } catch (error) {
          log.warn(`blank-session-gc: read "${header.id}" failed, skipping: ${String(error)}`)
          continue
        }
        if (!isUnusedBlank(events)) continue
        byId.set(header.id, {
          id: header.id,
          createdAt: header.createdAt,
          live: false,
          header,
        })
      }
      return [...byId.values()]
    }

    /**
     * Drop one unused blank from every workspace account and the JSONL
     * directory. Do not unwind a live agent: the Host owns that handle.
     * @param {{id: string, live: boolean, header: object}} blank
     */
    const forget = async (blank) => {
      for (const workspace of ready.workspaceRegistry.list()) {
        if (!workspace.sessionIds.includes(blank.id)) continue
        try {
          await workspace.detachSession(blank.id)
        } catch (error) {
          log.warn(`blank-session-gc: detach "${blank.id}" from ${workspace.path} failed: ${String(error)}`)
        }
      }

      const sessionDir = await findJsonlSessionDir(dshHomePath('sessions'), blank.id)
      if (sessionDir !== undefined) {
        try {
          await rm(sessionDir, { recursive: true, force: true })
        } catch (error) {
          log.warn(`blank-session-gc: rm "${sessionDir}" failed: ${String(error)}`)
        }
      }
    }

    const sweep = async (reason) => {
      if (inFlight) {
        rerun = true
        return
      }
      inFlight = true
      try {
        const blanks = await collectBlanks()
        const victims = pickVictims(blanks)
        if (victims.length === 0) return
        log.info(`blank-session-gc: ${reason}: keeping newest unused blank, deleting ${victims.length}`)
        for (const victim of victims) {
          try {
            await forget(victim)
            log.info(`blank-session-gc: deleted unused blank ${victim.id}`)
          } catch (error) {
            log.warn(`blank-session-gc: delete "${victim.id}" failed: ${String(error)}`)
          }
        }
      } catch (error) {
        log.warn(`blank-session-gc: sweep failed (${reason}): ${String(error)}`)
      } finally {
        inFlight = false
        if (rerun) {
          rerun = false
          schedule()
        }
      }
    }

    ctx.effect(() => ready.on('session/created', (session) => {
      if (!isOrdinarySession(session.header)) return
      schedule()
    }, { global: true }), 'blank-session-gc: session/created')

    void sweep('startup')
  })
}
  return { name, inject, Config, apply }
}
