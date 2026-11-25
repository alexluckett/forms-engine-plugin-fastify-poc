import { type FastifyRequest } from 'fastify'
import { z } from 'zod'

import { type FormDefinition } from '../schema/index.js'
import { type FormState } from './state.js'

/**
 * What the engine sends to the output service when a user submits a form.
 */
export interface Submission {
  slug: string
  reference: string
  definition: FormDefinition
  answers: FormState
}

/**
 * Zod 4 has no function schema, so each function option is a `z.custom`
 * with its signature written here. These are the only hand-written types
 * next to a schema in the plugin.
 */
export type GetFormDefinition = (slug: string) => Promise<unknown>
export type Submit = (submission: Submission) => Promise<void>
export type ViewContext = (request: FastifyRequest) => Record<string, unknown>

function fn<T>(description: string) {
  return z
    .custom<T>((value) => typeof value === 'function', {
      error: 'Expected a function'
    })
    .describe(description)
}

/**
 * Options a host passes when it registers the engine. The plugin parses
 * them on register, so that a bad option stops the host at start-up.
 */
export const pluginOptionsSchema = z.object({
  baseUrl: z
    .url()
    .describe('Absolute URL of the host, for example https://example.gov.uk'),
  nunjucks: z
    .object({
      baseLayoutPath: z
        .string()
        .describe('Host layout template that every engine page extends'),
      paths: z
        .array(z.string())
        .describe('Extra template folders, searched after the engine views')
    })
    .describe('Nunjucks set-up for the host layout'),
  services: z
    .object({
      formsService: z
        .object({
          getFormDefinition: fn<GetFormDefinition>(
            'Returns the raw form definition for a slug, or undefined if there is none'
          )
        })
        .describe('Where the engine loads form definitions from'),
      outputService: z
        .object({
          submit: fn<Submit>('Receives each submitted form')
        })
        .describe('Where the engine sends submitted forms')
    })
    .describe('Services the host provides to the engine'),
  viewContext: fn<ViewContext>(
    'Returns extra context merged into every engine view'
  ).optional()
})

export type PluginOptions = z.input<typeof pluginOptionsSchema>
export type ParsedPluginOptions = z.output<typeof pluginOptionsSchema>
export type FormsService = ParsedPluginOptions['services']['formsService']
export type OutputService = ParsedPluginOptions['services']['outputService']
