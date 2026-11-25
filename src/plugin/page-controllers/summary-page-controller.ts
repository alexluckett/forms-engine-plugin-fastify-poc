import { type FastifyReply, type FastifyRequest } from 'fastify'

import { getPageHref } from '../helpers.js'
import { type FormContext } from '../models/types.js'
import { type ParsedPluginOptions } from '../options.js'
import { generateReference } from '../reference.js'
import { clearState, setReference } from '../session.js'
import { PageController } from './page-controller.js'
import { QuestionPageController } from './question-page-controller.js'
import { viewContext } from './view-context.js'

/**
 * The check-your-answers page, ported from the hapi engine's
 * `SummaryPageController` without payment or notification email.
 */
export class SummaryPageController extends PageController {
  get viewName() {
    return 'summary.html'
  }

  /**
   * Answers from relevant pages, each with a link that returns here after
   * the change.
   */
  getSummaryRows(context: FormContext) {
    const { relevantPages, relevantState, isForceAccess } = context
    const returnUrl = this.getHref(this.getSummaryPath())

    return relevantPages
      .filter((page) => page instanceof QuestionPageController)
      .flatMap((page) =>
        page.fields.map((field) => ({
          key: { text: field.label },
          value: { text: field.display(relevantState[field.name]) },
          // Remove summary list actions from previews
          actions: isForceAccess
            ? undefined
            : {
                items: [
                  {
                    href: getPageHref(page.href, { returnUrl }),
                    text: 'Change',
                    classes: 'govuk-link--no-visited-state',
                    visuallyHiddenText: field.label.toLowerCase()
                  }
                ]
              }
        }))
      )
  }

  makeGetRouteHandler(options: ParsedPluginOptions) {
    return (
      request: FastifyRequest,
      context: FormContext,
      reply: FastifyReply
    ) =>
      reply.view(this.viewName, {
        ...viewContext(this, request, reply, options),
        pageTitle: this.title,
        rows: this.getSummaryRows(context),
        declaration: this.model.definition.declaration
      })
  }

  /**
   * Sends the relevant answers to the host's output service, then clears
   * them so that the next visit starts a new submission.
   */
  makePostRouteHandler(options: ParsedPluginOptions) {
    return async (
      request: FastifyRequest,
      context: FormContext,
      reply: FastifyReply
    ) => {
      // A preview shows the page again rather than sending anything
      if (context.isForceAccess) {
        return this.makeGetRouteHandler(options)(request, context, reply)
      }

      const { model } = this
      const reference = generateReference()

      await options.services.outputService.submit({
        slug: model.slug,
        reference,
        definition: model.definition,
        answers: context.relevantState
      })

      setReference(request, model.slug, reference)
      clearState(request, model.slug)

      return reply.code(303).redirect(this.getHref(this.getStatusPath()))
    }
  }
}
