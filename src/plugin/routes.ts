import {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from 'fastify'
import { type ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { type LoadForm } from './form-loader.js'
import { proceed } from './helpers.js'
import { type FormModel } from './models/form-model.js'
import { type FormContext, type FormContextRequest } from './models/types.js'
import { type ParsedPluginOptions } from './options.js'
import {
  type PageController,
  QuestionPageController,
  SummaryPageController
} from './page-controllers/index.js'
import { getReference, getState } from './session.js'

const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .describe('Form slug, for example "example-form"')

const paramsSlug = z.object({ slug })

const paramsPage = z.object({
  slug,
  path: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .describe('Page path without its leading slash')
})

const query = z
  .object({ returnUrl: z.string().optional() })
  .catchall(z.string())
  .describe('Query string; `force` opens any page, as previews do')

/**
 * A posted page. The engine's own keys are declared; every other key is an
 * answer, which a form posts as a string or, for checkboxes, a list.
 */
const pageBody = z
  .object({
    _csrf: z.string().describe('CSRF token from the rendered page'),
    action: z
      .enum(['validate', 'continue', 'send'])
      .default('validate')
      .describe('Which button the user pressed; Continue sends none')
  })
  .catchall(z.union([z.string(), z.array(z.string())]))

/**
 * Hands the request to the host's not-found handler, so that the host's
 * own 404 page is shown.
 */
function notFound(reply: FastifyReply) {
  reply.callNotFound()
  return reply
}

/**
 * Walks the form for this request, then either runs the page's handler or
 * redirects to the last page the user may open. Ported from the hapi
 * engine's `redirectOrMakeHandler`.
 */
function redirectOrMakeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  model: FormModel,
  page: PageController,
  formRequest: FormContextRequest,
  makeHandler: (context: FormContext) => unknown
) {
  const state = getState(request, model.slug)
  const context = model.getFormContext(formRequest, state)
  const relevantPath = page.getRelevantPath(context)

  // Return handler for relevant pages or preview URL direct access
  if (relevantPath.startsWith(page.path) || context.isForceAccess) {
    return makeHandler(context)
  }

  // Redirect back to last relevant page
  return proceed(formRequest, reply, page.getHref(relevantPath))
}

export function registerRoutes(
  fastify: FastifyInstance,
  options: ParsedPluginOptions,
  loadForm: LoadForm
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get(
    '/:slug',
    { schema: { params: paramsSlug } },
    async (request, reply) => {
      const model = await loadForm(request.params.slug)
      const start = model?.pages[0]

      return start
        ? reply.redirect(start.getHref(start.getStartPath()))
        : notFound(reply)
    }
  )

  app.get(
    '/:slug/status',
    { schema: { params: paramsSlug } },
    async (request, reply) => {
      const model = await loadForm(request.params.slug)

      if (!model) {
        return notFound(reply)
      }

      // Without a reference the user has not sent the form yet
      const reference = getReference(request, model.slug)

      if (!reference) {
        return reply.redirect(model.basePath)
      }

      return reply.view('status.html', {
        formName: model.definition.name,
        pageTitle: 'Form submitted',
        reference
      })
    }
  )

  app.get(
    '/:slug/:path',
    { schema: { params: paramsPage, querystring: query } },
    async (request, reply) => {
      const { params } = request
      const model = await loadForm(params.slug)
      const page = model?.pageByPath(params.path)

      if (!model || !page) {
        return notFound(reply)
      }

      const formRequest: FormContextRequest = {
        method: 'get',
        path: page.path,
        query: request.query
      }

      return redirectOrMakeHandler(
        request,
        reply,
        model,
        page,
        formRequest,
        (context) =>
          page instanceof SummaryPageController ||
          page instanceof QuestionPageController
            ? page.makeGetRouteHandler(options)(request, context, reply)
            : notFound(reply)
      )
    }
  )

  app.post(
    '/:slug/:path',
    {
      schema: { params: paramsPage, querystring: query, body: pageBody },
      // Checked before the body schema, so that a missing token is a 403
      // rather than a validation error.
      preValidation: (request, reply, done) => {
        fastify.csrfProtection(request, reply, done)
      }
    },
    async (request, reply) => {
      const { params, body } = request
      const model = await loadForm(params.slug)
      const page = model?.pageByPath(params.path)

      if (!model || !page) {
        return notFound(reply)
      }

      const formRequest: FormContextRequest = {
        method: 'post',
        path: page.path,
        query: request.query,
        payload: body
      }

      return redirectOrMakeHandler(
        request,
        reply,
        model,
        page,
        formRequest,
        (context) => {
          if (page instanceof SummaryPageController) {
            return page.makePostRouteHandler(options)(request, context, reply)
          }

          if (page instanceof QuestionPageController) {
            return page.makePostRouteHandler(options)(
              request,
              formRequest,
              context,
              reply
            )
          }

          return notFound(reply)
        }
      )
    }
  )
}
