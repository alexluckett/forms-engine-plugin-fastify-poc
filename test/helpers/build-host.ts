import { type FastifyInstance } from 'fastify'

import { createServer } from '../../src/devserver/create-server.js'
import { fileFormsService } from '../../src/devserver/services.js'
import { type PluginOptions, type Submission } from '../../src/index.js'
import { validDefinition } from '../fixtures/valid-definition.js'

export interface HostOptions {
  withSession?: boolean
  forms?: Record<string, unknown>
  submit?: (submission: Submission) => Promise<void>
}

const exampleForms = fileFormsService(
  new URL('../../src/devserver/forms', import.meta.url).pathname
)

/**
 * Builds the devserver host, so that tests and dogfooding share one set-up,
 * with fixture forms and a spy output service swapped in.
 */
export async function buildHost(
  overrides: Partial<PluginOptions> = {},
  {
    withSession = true,
    forms = { 'fixture-form': validDefinition },
    submit = () => Promise.resolve()
  }: HostOptions = {}
): Promise<FastifyInstance> {
  return createServer(
    {
      services: {
        formsService: {
          getFormDefinition: (slug) =>
            slug in forms
              ? Promise.resolve(forms[slug])
              : exampleForms.getFormDefinition(slug)
        },
        outputService: { submit }
      },
      ...overrides
    },
    { withSession, logger: false }
  )
}
