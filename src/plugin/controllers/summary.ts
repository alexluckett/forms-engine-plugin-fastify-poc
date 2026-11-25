import { generateReference } from '../reference.js'
import { clearState, getState, setReference } from '../session.js'
import { fieldsFor, viewContext, type PageContext } from './context.js'

/**
 * Lists the answers from relevant pages with a link to change each one.
 */
export function renderSummary(context: PageContext) {
  const { model, formUrl } = context
  const state = getState(context.request, context.slug)

  const rows = model.relevantPages(state).flatMap((page) =>
    fieldsFor(page, model).map((field) => ({
      key: { text: field.label },
      value: { text: field.display(state[field.name]) },
      actions: {
        items: [
          {
            href: `${formUrl}${page.path}`,
            text: 'Change',
            visuallyHiddenText: field.label.toLowerCase()
          }
        ]
      }
    }))
  )

  return context.reply.view('summary.html', {
    ...viewContext(context),
    pageTitle: model.summaryPage.title,
    rows,
    declaration: model.definition.declaration
  })
}

/**
 * Sends the relevant answers to the host's output service, then clears them
 * so that the next visit starts a new submission.
 */
export async function submitForm(context: PageContext) {
  const { request, slug, model } = context
  const state = getState(request, slug)
  const reference = generateReference()

  await context.options.services.outputService.submit({
    slug,
    reference,
    definition: model.definition,
    answers: model.relevantAnswers(state)
  })

  setReference(request, slug, reference)
  clearState(request, slug)

  return context.reply.redirect(`${context.formUrl}/status`)
}
