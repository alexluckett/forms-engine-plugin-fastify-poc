import fastifyFormbody from '@fastify/formbody'
import { type FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'

import type {} from '@fastify/csrf-protection'
import { createFormLoader } from './form-loader.js'
import { registerRoutes } from './routes.js'
import { pluginOptionsSchema, type PluginOptions } from './options.js'
import { registerViews } from './views.js'

async function register(fastify: FastifyInstance, rawOptions: PluginOptions) {
  const options = pluginOptionsSchema.parse(rawOptions)

  // Set inside the engine's scope rather than on the host, so that hosts
  // need no Zod set-up and keep their own validators for their own routes.
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)

  // A request that fails a route schema gets a plain answer, so that schema
  // details reach only the log. A path that does not match is a page that
  // does not exist. Other errors go on to the host's error handler.
  fastify.setErrorHandler((error, request, reply) => {
    if (!hasZodFastifySchemaValidationErrors(error)) {
      throw error
    }

    if (error.validationContext === 'params') {
      reply.callNotFound()
      return reply
    }

    request.log.info({ issues: error.validation }, 'Request failed validation')
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'The request could not be processed'
    })
  })

  await fastify.register(fastifyFormbody)
  await registerViews(fastify, options)

  registerRoutes(
    fastify,
    options,
    createFormLoader(options.services.formsService, fastify.log, fastify.prefix)
  )
}

/**
 * The forms engine. `encapsulate` keeps its routes, views and body parser
 * inside its own scope, and `dependencies` stops the host at start-up when
 * a plugin the engine needs is missing.
 */
export const formsEnginePlugin = fastifyPlugin<PluginOptions>(register, {
  name: '@defra/forms-engine-plugin-fastify',
  fastify: '5.x',
  dependencies: [
    '@fastify/cookie',
    '@fastify/session',
    '@fastify/csrf-protection'
  ],
  encapsulate: true
})
