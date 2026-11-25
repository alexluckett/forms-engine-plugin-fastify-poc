import { type FastifyInstance, type LightMyRequestResponse } from 'fastify'
import { JSDOM } from 'jsdom'

export type FormFields = Record<string, string | string[]>

/**
 * A browser-like client: it keeps the session cookie between requests and
 * posts with the CSRF token and the submit button of the page it last
 * loaded, as a browser sends the clicked button's name and value.
 */
export function createClient(host: FastifyInstance) {
  let cookie = ''
  let csrfToken = ''
  let button: [string, string] | undefined

  function remember(response: LightMyRequestResponse) {
    const session = response.cookies.find(({ name }) => name === 'sessionId')

    if (session) {
      cookie = `sessionId=${session.value}`
    }

    const { document } = new JSDOM(response.body).window
    const input = document.querySelector('input[name="_csrf"]')
    const submit = document.querySelector('form button')

    if (submit) {
      const name = submit.getAttribute('name')
      button = name ? [name, submit.getAttribute('value') ?? ''] : undefined
    }

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

      if (button && !(button[0] in fields)) {
        body.append(button[0], button[1])
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
