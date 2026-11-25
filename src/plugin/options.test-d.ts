import Fastify from 'fastify'
import { describe, expectTypeOf, it } from 'vitest'

import formsEnginePlugin, { type PluginOptions } from '../index.js'

describe('PluginOptions', () => {
  it('requires baseUrl when the plugin is registered', () => {
    const host = Fastify()

    // @ts-expect-error baseUrl is required
    void host.register(formsEnginePlugin, {
      nunjucks: { baseLayoutPath: 'layout.html', paths: [] },
      services: {
        formsService: { getFormDefinition: () => Promise.resolve(undefined) },
        outputService: { submit: () => Promise.resolve() }
      }
    })
  })

  it('types the forms service from the schema', () => {
    expectTypeOf<
      PluginOptions['services']['formsService']['getFormDefinition']
    >().returns.toEqualTypeOf<Promise<unknown>>()
  })
})
