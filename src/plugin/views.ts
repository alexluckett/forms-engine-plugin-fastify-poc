import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import fastifyView from '@fastify/view'
import { type FastifyInstance } from 'fastify'
import nunjucks from 'nunjucks'

import { type ParsedPluginOptions } from './options.js'

const require = createRequire(import.meta.url)

export const engineViewsPath = join(import.meta.dirname, 'views')

const govukFrontendPath = join(
  dirname(require.resolve('govuk-frontend/package.json')),
  'dist'
)

/**
 * Makes the first character lower case, as GOV.UK error messages put a
 * question label in the middle of a sentence.
 */
export function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * Registers nunjucks inside the engine's scope. The engine views come first
 * so that a host cannot replace them by accident; host paths come next so
 * that the host layout resolves.
 */
export async function registerViews(
  fastify: FastifyInstance,
  options: ParsedPluginOptions
) {
  await fastify.register(fastifyView, {
    engine: { nunjucks },
    templates: [engineViewsPath, ...options.nunjucks.paths, govukFrontendPath],
    defaultContext: { baseLayoutPath: options.nunjucks.baseLayoutPath },
    options: {
      onConfigure: (env: nunjucks.Environment) => {
        env.addFilter('lowerFirst', lowerFirst)
      }
    }
  })
}
