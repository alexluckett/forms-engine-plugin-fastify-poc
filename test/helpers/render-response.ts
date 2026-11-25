import { within } from '@testing-library/dom'
import { JSDOM } from 'jsdom'
import { type LightMyRequestResponse } from 'fastify'

/**
 * Renders an HTML response into a DOM, so that tests can query it by role
 * and name as a user would see it.
 */
export function renderResponse(response: LightMyRequestResponse) {
  const { document } = new JSDOM(response.body).window
  return { document, container: document.body, ...within(document.body) }
}
