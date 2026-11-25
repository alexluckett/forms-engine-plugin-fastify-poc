import { type FastifyInstance, type LightMyRequestResponse } from 'fastify'
import { JSDOM } from 'jsdom'

export type FormFields = Record<string, string | string[]>

/**
 * A browser-like client: it keeps the session cookie between requests and
 * posts with the CSRF token from the page it last loaded.
 */
export function createClient(host: FastifyInstance) {
  let cookie = ''
  let csrfToken = ''

  function remember(response: LightMyRequestResponse) {
    const session = response.cookies.find(({ name }) => name === 'sessionId')

    if (session) {
      cookie = `sessionId=${session.value}`
    }

    const input = new JSDOM(response.body).window.document.querySelector(
      'input[name="_csrf"]'
    )

    if (input?.getAttribute('value')) {
      csrfToken = input.getAttribute('value') ?? ''
    }

    return response
  }

  return {
    async get(url: string) {
      return remember(
        await host.inject({ method: 'GET', url, headers: { cookie } })
      )
    },

    async post(url: string, fields: FormFields, { withCsrf = true } = {}) {
      const body = new URLSearchParams()

      if (withCsrf) {
        body.append('_csrf', csrfToken)
      }

      for (const [key, value] of Object.entries(fields)) {
        for (const item of [value].flat()) {
          body.append(key, item)
        }
      }

      return remember(
        await host.inject({
          method: 'POST',
          url,
          headers: {
            cookie,
            'content-type': 'application/x-www-form-urlencoded'
          },
          payload: body.toString()
        })
      )
    }
  }
}
