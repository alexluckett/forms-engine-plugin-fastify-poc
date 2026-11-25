import { type FastifyReply } from 'fastify'

import { type FormContextRequest } from './models/types.js'

/**
 * True for a link to another page of the same form. Anything else, such as
 * `/\evil.example`, which browsers read as another site, is ignored, so
 * that `returnUrl` cannot send users away from the service.
 */
function isFormPath(path: unknown, basePath: string): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${basePath}/`) &&
    !path.includes('\\') &&
    !path.includes('//')
  )
}

/**
 * Redirects to the next page, or back to `returnUrl` (for example the
 * summary page after a change), ported from the hapi engine's `proceed`.
 * A POST redirects with 303 so that a refresh does not post again.
 */
export function proceed(
  request: FormContextRequest,
  reply: FastifyReply,
  nextUrl: string,
  basePath: string
) {
  const { method, payload, query } = request
  const { returnUrl } = query

  const isReturnAllowed =
    payload && 'action' in payload
      ? payload.action === 'continue' || payload.action === 'validate'
      : false

  const url =
    isReturnAllowed && isFormPath(returnUrl, basePath) ? returnUrl : nextUrl

  return reply.code(method === 'post' ? 303 : 302).redirect(url)
}

/**
 * Adds query params to a page link.
 */
export function getPageHref(href: string, query: Record<string, string> = {}) {
  const search = new URLSearchParams(query).toString()
  return search ? `${href}?${search}` : href
}
