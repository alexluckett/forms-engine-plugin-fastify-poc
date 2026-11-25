import { type FastifyReply, type FastifyRequest } from 'fastify'

import { type ParsedPluginOptions } from '../options.js'
import { type PageController } from './page-controller.js'

/**
 * Context shared by every engine view, including anything the host adds
 * through its `viewContext` option.
 */
export function viewContext(
  page: PageController,
  request: FastifyRequest,
  reply: FastifyReply,
  options: ParsedPluginOptions
) {
  return {
    ...options.viewContext?.(request),
    formUrl: page.model.basePath,
    formName: page.model.definition.name,
    csrfToken: reply.generateCsrf()
  }
}
