import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

import { buildHost } from '../../test/helpers/build-host.js'
import { validDefinition } from '../../test/fixtures/valid-definition.js'
import { createFormLoader } from './form-loader.js'

describe('formsEnginePlugin registration', () => {
  it('starts when the host registers its dependencies', async () => {
    const host = await buildHost()

    await expect(host.ready()).resolves.toBeDefined()
    await host.close()
  })

  it('refuses to start without @fastify/session', async () => {
    await expect(
      buildHost({}, { withSession: false }).then((host) => host.ready())
    ).rejects.toThrow('@fastify/session')
  })

  it('refuses invalid options with a Zod error at the option path', async () => {
    const error: unknown = await buildHost({ baseUrl: 'not a url' })
      .then((host) => host.ready())
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ZodError)
    expect(error instanceof ZodError && error.issues[0]?.path).toEqual([
      'baseUrl'
    ])
  })

  it('keeps its view engine inside its own scope', async () => {
    const host = await buildHost()
    host.get('/host-probe', (_request, reply) => typeof reply.view)

    const response = await host.inject('/host-probe')

    expect(response.body).toBe('undefined')
    await host.close()
  })
})

describe('createFormLoader', () => {
  const logger = () => ({ error: vi.fn() })

  it('returns undefined for an unknown slug', async () => {
    const loadForm = createFormLoader(
      { getFormDefinition: () => Promise.resolve(undefined) },
      logger()
    )

    await expect(loadForm('missing')).resolves.toBeUndefined()
  })

  it('throws a 500 and logs the issues for an invalid definition', async () => {
    const log = logger()
    const loadForm = createFormLoader(
      { getFormDefinition: () => Promise.resolve({ schema: 2, pages: 'x' }) },
      log
    )

    await expect(loadForm('broken')).rejects.toMatchObject({
      statusCode: 500,
      message: 'Form definition is invalid'
    })
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'broken', issues: expect.any(Array) }),
      'Form definition is invalid'
    )
  })

  it('parses a definition once and reuses it', async () => {
    const getFormDefinition = vi.fn(() => Promise.resolve(validDefinition))
    const loadForm = createFormLoader({ getFormDefinition }, logger())

    const first = await loadForm('fixture-form')
    const second = await loadForm('fixture-form')

    expect(first?.definition.name).toBe('Fixture form')
    expect(second).toBe(first)
    expect(getFormDefinition).toHaveBeenCalledTimes(1)
  })
})
