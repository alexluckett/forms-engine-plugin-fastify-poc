import { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildHost } from './helpers/build-host.js'
import { createClient } from './helpers/client.js'
import { renderResponse } from './helpers/render-response.js'

const base = '/example-form'

let host: FastifyInstance

beforeEach(async () => {
  host = await buildHost()
})

afterEach(async () => {
  await host.close()
})

async function pageAt(
  path: string,
  steps: [string, Record<string, string>][] = []
) {
  const client = createClient(host)

  for (const [stepPath, fields] of steps) {
    await client.get(`${base}${stepPath}`)
    await client.post(`${base}${stepPath}`, fields)
  }

  return renderResponse(await client.get(`${base}${path}`))
}

const toPets: [string, Record<string, string>][] = [
  ['/your-name', { fullName: 'Ann' }],
  ['/contact', { email: 'ann@example.com', age: '70' }],
  ['/has-pet', { hasPet: 'yes' }]
]

describe('page styling, as in the hapi engine', () => {
  it('uses the GOV.UK rebrand', async () => {
    const { document } = await pageAt('/your-name')

    expect(
      document.documentElement.classList.contains('govuk-template--rebranded')
    ).toBe(true)
  })

  it('gives each label on a page with several questions equal prominence', async () => {
    const { getByText } = await pageAt('/contact', toPets.slice(0, 1))

    expect(
      getByText('Email address', { selector: 'label' }).classList
    ).toContain('govuk-label--m')
    expect(getByText('Your age', { selector: 'label' }).classList).toContain(
      'govuk-label--m'
    )
  })

  it('gives each legend on a page with several questions equal prominence', async () => {
    const { getByRole } = await pageAt('/pet-details', toPets)

    expect(
      getByRole('group', { name: 'Pet types' }).querySelector('legend')
        ?.classList
    ).toContain('govuk-fieldset__legend--m')
  })

  it('uses a single question as a large page heading', async () => {
    const { getByRole } = await pageAt('/has-pet', toPets.slice(0, 2))

    const heading = getByRole('heading', {
      level: 1,
      name: 'Do you have a pet?'
    })
    expect(heading.closest('legend')?.classList).toContain(
      'govuk-fieldset__legend--l'
    )
  })

  it('marks an optional question', async () => {
    const { getByRole } = await pageAt('/retirement', [
      ...toPets.slice(0, 2),
      ['/has-pet', { hasPet: 'no' }]
    ])

    expect(
      getByRole('heading', {
        level: 1,
        name: 'What are your retirement plans? (optional)'
      })
    ).toBeDefined()
  })
})
