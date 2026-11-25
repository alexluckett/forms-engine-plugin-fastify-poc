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

  getViewModel(context: FormContext) {
    const { payload, errors } = context
    const isSingleField = this.fields.length === 1

    return {
      pageTitle: this.title,
      showTitle: !isSingleField,
      errors: errors ?? [],
      fields: this.fields.map((field) => {
        const error = errors?.find(({ name }) => name === field.name)
        return field.toViewModel(
          payload[field.name],
          error?.text,
          isSingleField
        )
      })
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
