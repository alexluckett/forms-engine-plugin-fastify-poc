import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import fastifyCookie from '@fastify/cookie'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifySession from '@fastify/session'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'

import formsEnginePlugin, { type PluginOptions } from '../index.js'
import { fileFormsService, loggingOutputService } from './services.js'

export const port = Number(process.env.PORT ?? 3009)

const govukFrontend = join(
  dirname(
    createRequire(import.meta.url).resolve('govuk-frontend/package.json')
  ),
  'dist/govuk'
)

export interface ServerOptions {
  withSession?: boolean
  logger?: boolean
}

/**
 * Builds a host the way an external application would: it registers the
 * plugins the engine depends on, then the engine through the package entry.
 */
export async function createServer(
  overrides: Partial<PluginOptions> = {},
  { withSession = true, logger = true }: ServerOptions = {}
): Promise<FastifyInstance> {
  const server = Fastify({ logger })

  await server.register(fastifyCookie)

  if (withSession) {
    await server.register(fastifySession, {
      // A new secret on each start rather than one in the repo, so that no
      // secret is ever committed. Sessions end when the devserver restarts.
      secret: process.env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
      cookie: { secure: false }
    })
    await server.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })
  }

  await server.register(fastifyStatic, {
    root: govukFrontend,
    prefix: '/govuk/'
  })
  await server.register(fastifyStatic, {
    root: join(govukFrontend, 'assets'),
    prefix: '/assets/',
    decorateReply: false
  })

  await server.register(formsEnginePlugin, {
    baseUrl: `http://localhost:${port}`,
    nunjucks: {
      baseLayoutPath: 'layout.html',
      paths: [join(import.meta.dirname, 'views')]
    },
    services: {
      formsService: fileFormsService(join(import.meta.dirname, 'forms')),
      outputService: loggingOutputService(server.log)
    },
    ...overrides
  })

  return server
}
