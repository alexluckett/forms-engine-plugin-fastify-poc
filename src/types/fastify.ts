import type {} from '@fastify/session'

import { type FormState } from '../plugin/state.js'

/**
 * Adds the engine's data to the session type, so that
 * `request.session.get('forms')` is typed without a cast. This is a `.ts`
 * file rather than `.d.ts`, so that the build ships it to hosts.
 */
declare module 'fastify' {
  interface Session {
    /** Answers per form slug */
    forms?: Record<string, FormState>
    /** Reference number of the last submission per form slug */
    references?: Record<string, string>
  }
}

export {}
