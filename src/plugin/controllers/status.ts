import { getReference } from '../session.js'
import { viewContext, type PageContext } from './context.js'

/**
 * Confirms the submission. Without a reference in the session the user has
 * not sent the form, so they go back to its start.
 */
export function renderStatus(context: PageContext) {
  const reference = getReference(context.request, context.slug)

  if (!reference) {
    return context.reply.redirect(context.formUrl)
  }

  return context.reply.view('status.html', {
    ...viewContext(context),
    pageTitle: 'Form submitted',
    reference
  })
}
