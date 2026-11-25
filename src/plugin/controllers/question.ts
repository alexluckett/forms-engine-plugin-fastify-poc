import { type Page } from '../../schema/index.js'
import { parsePage, type PageError } from '../components/index.js'
import { getState, mergeState } from '../session.js'
import { fieldsFor, viewContext, type PageContext } from './context.js'

/**
 * Renders a question page. With errors it shows back what the user posted;
 * otherwise it shows their stored answers.
 */
export function renderQuestion(
  context: PageContext,
  page: Page,
  posted?: { body: Record<string, unknown>; errors: PageError[] }
) {
  const fields = fieldsFor(page, context.model)
  const state = getState(context.request, context.slug)
  const isSingleField = fields.length === 1

  const fieldViews = fields.map((field) => {
    const error = posted?.errors.find(({ name }) => name === field.name)
    const value = posted ? field.fromBody(posted.body) : state[field.name]
    return field.toViewModel(value, error?.text, isSingleField)
  })

  return context.reply.code(posted ? 400 : 200).view('question.html', {
    ...viewContext(context),
    pageTitle: page.title,
    showTitle: !isSingleField,
    fields: fieldViews,
    errors: posted?.errors ?? []
  })
}

/**
 * Validates a posted question page, saves the answers and moves on to the
 * next relevant page.
 */
export function submitQuestion(
  context: PageContext,
  page: Page,
  body: Record<string, unknown>
) {
  const fields = fieldsFor(page, context.model)
  const result = parsePage(fields, body)

  if (!result.success) {
    return renderQuestion(context, page, { body, errors: result.errors })
  }

  mergeState(context.request, context.slug, result.data)

  const state = getState(context.request, context.slug)
  return context.reply.redirect(
    `${context.formUrl}${context.model.nextPath(page.path, state)}`
  )
}
