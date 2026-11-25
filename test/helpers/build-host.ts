import { randomBytes } from 'node:crypto'

import fastifyCookie from '@fastify/cookie'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifySession from '@fastify/session'
import Fastify, { type FastifyInstance } from 'fastify'

import formsEnginePlugin, { type PluginOptions } from '../../src/index.js'
import { validDefinition } from '../fixtures/valid-definition.js'

export interface HostOptions {
  withSession?: boolean
  forms?: Record<string, unknown>
}

/**
 * Builds a host the way an external application would: it registers the
 * plugins the engine depends on and never sets Zod compilers itself.
 */
export async function buildHost(
  overrides: Partial<PluginOptions> = {},
  {
    withSession = true,
    forms = { 'fixture-form': validDefinition }
  }: HostOptions = {}
): Promise<FastifyInstance> {
  const host = Fastify({ logger: false })

  await host.register(fastifyCookie)

  if (withSession) {
    await host.register(fastifySession, {
      secret: process.env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
      cookie: { secure: false }
    })
    await host.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })
  }

  await host.register(formsEnginePlugin, {
    baseUrl: 'http://localhost:3009',
    nunjucks: { baseLayoutPath: 'layout.html', paths: [] },
    services: {
      formsService: {
        getFormDefinition: (slug) => Promise.resolve(forms[slug])
      },
      outputService: { submit: () => Promise.resolve() }
    },
    ...overrides
  })

  return host
}
