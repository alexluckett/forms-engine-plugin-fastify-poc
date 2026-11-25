import { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Submission } from '../src/index.js'
import { buildHost } from './helpers/build-host.js'
import { createClient } from './helpers/client.js'
import { renderResponse } from './helpers/render-response.js'

const base = '/example-form'

let host: FastifyInstance
let submit: ReturnType<typeof vi.fn<(submission: Submission) => Promise<void>>>

beforeEach(async () => {
  submit = vi.fn(() => Promise.resolve())
  host = await buildHost({}, { submit })
})

afterEach(async () => {
  await host.close()
})

/**
 * Loads each page and posts its answers, as a user would.
 */
async function answer(
  client: ReturnType<typeof createClient>,
  steps: [string, Record<string, string | string[]>][]
) {
  for (const [path, fields] of steps) {
    await client.get(`${base}${path}`)
    const response = await client.post(`${base}${path}`, fields)
    expect(response.statusCode).toBe(303)
  }
}

const aboutYou: [string, Record<string, string>][] = [
  ['/your-name', { fullName: 'Ann Smith' }],
  ['/contact', { email: 'ann@example.com', age: '40' }]
]

const petDetails = {
  petTypes: ['cat', 'dog'],
  petBirthday__day: '27',
  petBirthday__month: '3',
  petBirthday__year: '2019'
}

describe('example form journey', () => {
  it('sends the user to the first page', async () => {
    const response = await createClient(host).get(base)

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(`${base}/your-name`)
  })

  it('uses the question as the page heading on a one-question page', async () => {
    const response = await createClient(host).get(`${base}/your-name`)
    const { getByRole } = renderResponse(response)

    expect(
      getByRole('heading', { level: 1, name: 'What is your full name?' })
    ).toBeDefined()
  })

  it('shows an error summary that links to the field', async () => {
    const client = createClient(host)
    await client.get(`${base}/your-name`)

    const response = await client.post(`${base}/your-name`, { fullName: '' })
    const { getByRole } = renderResponse(response)

    expect(response.statusCode).toBe(200)
    const link = getByRole('alert').querySelector('a')
    expect(link?.textContent).toBe('Enter what is your full name?')
    expect(link?.getAttribute('href')).toBe('#fullName')
  })

  it('shows the pet page, summary and confirmation for a pet owner', async () => {
    const client = createClient(host)
    await answer(client, [
      ...aboutYou,
      ['/has-pet', { hasPet: 'yes' }],
      ['/pet-details', petDetails]
    ])

    const summary = renderResponse(await client.get(`${base}/summary`))
    expect(
      summary.getByRole('heading', {
        level: 1,
        name: 'Check your answers before sending your form'
      })
    ).toBeDefined()
    expect(summary.getByText('Cat, Dog')).toBeDefined()
    expect(summary.getByText('27 March 2019')).toBeDefined()

    const sent = await client.post(`${base}/summary`, { action: 'send' })
    expect(sent.headers.location).toBe(`${base}/status`)

    const status = renderResponse(await client.get(`${base}/status`))
    expect(
      status.getByRole('heading', { level: 1, name: 'Form submitted' })
    ).toBeDefined()
    expect(
      status.getByText(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/)
    ).toBeDefined()
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'example-form',
        answers: expect.objectContaining({ petTypes: ['cat', 'dog'] })
      })
    )
  })

  it('skips the pet page for someone without a pet', async () => {
    const client = createClient(host)
    await answer(client, aboutYou)
    await client.get(`${base}/has-pet`)

    const response = await client.post(`${base}/has-pet`, { hasPet: 'no' })

    expect(response.headers.location).toBe(`${base}/summary`)
  })

  it('drops answers from a page that is no longer shown', async () => {
    const client = createClient(host)
    await answer(client, [
      ...aboutYou,
      ['/has-pet', { hasPet: 'yes' }],
      ['/pet-details', petDetails],
      ['/has-pet', { hasPet: 'no' }]
    ])

    const summary = renderResponse(await client.get(`${base}/summary`))
    expect(summary.queryByText('Pet types')).toBeNull()

    await client.post(`${base}/summary`, { action: 'send' })
    expect(submit.mock.calls[0]?.[0].answers).not.toHaveProperty('petTypes')
  })

  it('sends a user who skips ahead back to the first unanswered page', async () => {
    const response = await createClient(host).get(`${base}/pet-details`)

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(`${base}/your-name`)
  })

  it('refuses a post to a page the user cannot open yet', async () => {
    const client = createClient(host)
    await client.get(`${base}/your-name`)

    const response = await client.post(`${base}/pet-details`, petDetails)

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(`${base}/your-name`)
  })

  it('refuses to send a form that is not complete', async () => {
    const client = createClient(host)
    await answer(client, aboutYou)

    const response = await client.post(`${base}/summary`, { action: 'send' })

    expect(response.headers.location).toBe(`${base}/has-pet`)
    expect(submit).not.toHaveBeenCalled()
  })

  it('opens a later page directly with ?force, as previews do', async () => {
    const response = await createClient(host).get(`${base}/pet-details?force`)

    expect(response.statusCode).toBe(200)
  })

  it('returns to the summary after an answer is changed from it', async () => {
    const client = createClient(host)
    await answer(client, [...aboutYou, ['/has-pet', { hasPet: 'no' }]])

    const summary = renderResponse(await client.get(`${base}/summary`))
    const change = summary
      .getAllByRole('link', { name: /Change/ })
      .find((link) => link.getAttribute('href')?.startsWith(`${base}/contact`))
    const href = change?.getAttribute('href') ?? ''
    expect(href).toBe(`${base}/contact?returnUrl=%2Fexample-form%2Fsummary`)

    await client.get(href)
    const response = await client.post(href, {
      email: 'ann@example.com',
      age: '41'
    })

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(`${base}/summary`)
  })

  it('refuses a post without a CSRF token and keeps the session unchanged', async () => {
    const client = createClient(host)
    await client.get(`${base}/your-name`)

    const response = await client.post(
      `${base}/your-name`,
      { fullName: 'Ann' },
      { withCsrf: false }
    )
    expect(response.statusCode).toBe(403)

    const page = renderResponse(await client.get(`${base}/your-name`))
    expect(
      page.getByRole('textbox', { name: 'What is your full name?' })
    ).toHaveProperty('value', '')
  })

  it('returns 404 for an unknown form or page', async () => {
    const client = createClient(host)

    expect((await client.get('/no-such-form/your-name')).statusCode).toBe(404)
    expect((await client.get(`${base}/no-such-page`)).statusCode).toBe(404)
  })

  it('validates route params with Zod although the host never set it up', async () => {
    const response = await createClient(host).get('/Not_A_Slug/your-name')

    expect(response.statusCode).toBe(400)
  })

  it('clears the answers after the form is sent', async () => {
    const client = createClient(host)
    await answer(client, [...aboutYou, ['/has-pet', { hasPet: 'no' }]])
    await client.get(`${base}/summary`)
    await client.post(`${base}/summary`, { action: 'send' })

    const page = renderResponse(await client.get(`${base}/your-name`))

    expect(
      page.getByRole('textbox', { name: 'What is your full name?' })
    ).toHaveProperty('value', '')
  })
})
