import { type FastifyReply, type FastifyRequest } from 'fastify'

import { type Page } from '../../schema/index.js'
import { createField, type Field } from '../components/index.js'
import { fieldsOf, type FormModel } from '../models/form-model.js'
import { type ParsedPluginOptions } from '../options.js'

/**
 * What every page handler needs about the current request.
 */
export interface PageContext {
  request: FastifyRequest
  reply: FastifyReply
  model: FormModel
  slug: string
  /** Path to the form, including any prefix the host registered the engine at */
  formUrl: string
  options: ParsedPluginOptions
}

export function fieldsFor(page: Page, model: FormModel): Field[] {
  return fieldsOf(page).flatMap((def) => createField(def, model) ?? [])
}

/**
 * Context shared by every engine view.
 */
export function viewContext(context: PageContext) {
  return {
    ...context.options.viewContext?.(context.request),
    formUrl: context.formUrl,
    formName: context.model.definition.name,
    csrfToken: context.reply.generateCsrf()
  }
}
