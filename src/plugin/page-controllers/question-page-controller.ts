import { type FastifyReply, type FastifyRequest } from 'fastify'

import { proceed } from '../helpers.js'
import { type FormContext, type FormContextRequest } from '../models/types.js'
import { type ParsedPluginOptions } from '../options.js'
import { setState } from '../session.js'
import { PageController } from './page-controller.js'
import { viewContext } from './view-context.js'

/**
 * A page of questions, ported from the hapi engine's
 * `QuestionPageController`. Only the request and reply types differ.
 */
export class QuestionPageController extends PageController {
  get viewName() {
    return 'question.html'
  }

  /**
   * Ported from the hapi engine's `QuestionPageController.getViewModel`:
   * a single question becomes the page heading, and several questions get
   * labels and legends of equal size.
   */
  getViewModel(context: FormContext) {
    const { payload, errors } = context
    let pageTitle = this.title
    let showTitle = true

    const components = this.fields.map((field) => {
      const error = errors?.find(({ name }) => name === field.name)
      return field.toViewModel(payload[field.name], error?.text)
    })

    // Single form component? Hide title and customise label or legend instead
    if (components.length === 1 && components[0]) {
      const { fieldset, label } = components[0].params

      // Set as page heading when not following other content
      const isPageHeading =
        this.pageDef.components[0]?.name === this.fields[0]?.name

      // Check for legend or label
      const labelOrLegend = fieldset?.legend ?? label

      // Use legend or label as page heading
      if (labelOrLegend) {
        const size = isPageHeading ? 'l' : 'm'

        labelOrLegend.classes =
          labelOrLegend === label
            ? `govuk-label--${size}`
            : `govuk-fieldset__legend--${size}`

        if (isPageHeading) {
          labelOrLegend.isPageHeading = isPageHeading

          // Check for optional in label
          const isOptional = this.fields.at(0)?.isRequired === false

          if (!pageTitle) {
            pageTitle = labelOrLegend.text
          }

          // The question text may already end with "(optional)"
          const optionalAlreadyAppended = pageTitle.endsWith(' (optional)')
          labelOrLegend.text =
            isOptional && !optionalAlreadyAppended
              ? `${pageTitle} (optional)`
              : pageTitle
        }

        // Fallback if still no pageTitle set
        if (!pageTitle) {
          pageTitle = labelOrLegend.text
        }
      }

      showTitle = !isPageHeading
    } else if (components.length > 1) {
      // When there is more than one form component,
      // adjust the label/legends to give equal prominence
      for (const { params } of components) {
        if (params.fieldset?.legend) {
          params.fieldset.legend.classes = 'govuk-fieldset__legend--m'
        }
        if (params.label) {
          params.label.classes = 'govuk-label--m'
        }
      }
    }

    return {
      pageTitle,
      showTitle,
      errors: errors ?? [],
      fields: components
    }
  }

  makeGetRouteHandler(options: ParsedPluginOptions) {
    return (
      request: FastifyRequest,
      context: FormContext,
      reply: FastifyReply
    ) =>
      reply.view(this.viewName, {
        ...viewContext(this, request, reply, options),
        ...this.getViewModel(context)
      })
  }

  makePostRouteHandler(options: ParsedPluginOptions) {
    return (
      request: FastifyRequest,
      formRequest: FormContextRequest,
      context: FormContext,
      reply: FastifyReply
    ) => {
      const { isForceAccess, state } = context

      // If there are any errors, render the page with the parsed errors
      if (context.errors || isForceAccess) {
        return reply.view(this.viewName, {
          ...viewContext(this, request, reply, options),
          ...this.getViewModel(context)
        })
      }

      // Save state
      setState(request, this.model.slug, state)

      // Proceed to the next page
      return this.proceed(formRequest, reply, this.getNextPath(context))
    }
  }

  proceed(request: FormContextRequest, reply: FastifyReply, nextPath?: string) {
    const nextUrl = nextPath
      ? this.getHref(nextPath) // Redirect to next page
      : this.href // Redirect to current page (refresh)

    return proceed(request, reply, nextUrl, this.model.basePath)
  }
}
