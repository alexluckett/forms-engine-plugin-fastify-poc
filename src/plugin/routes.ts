import { type FastifyInstance, type FastifyReply } from 'fastify'
import { type ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { type PageContext } from './controllers/context.js'
import { renderQuestion, submitQuestion } from './controllers/question.js'
import { renderStatus } from './controllers/status.js'
import { renderSummary, submitForm } from './controllers/summary.js'
import { type LoadForm } from './form-loader.js'
import { type ParsedPluginOptions } from './options.js'
import { getState } from './session.js'

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

/**
 * A posted page. The engine's own keys are declared; every other key is an
 * answer, which a form posts as a string or, for checkboxes, a list.
 */
const pageBody = z
  .object({
    _csrf: z.string().describe('CSRF token from the rendered page'),
    action: z
      .enum(['continue', 'send'])
      .default('continue')
      .describe('Which button the user pressed')
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

export function registerRoutes(
  fastify: FastifyInstance,
  options: ParsedPluginOptions,
  loadForm: LoadForm
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  /**
   * Loads the form for a slug, or sends a 404 when there is none.
   */
  async function contextFor(
    request: PageContext['request'],
    reply: FastifyReply,
    formSlug: string
  ): Promise<PageContext | undefined> {
    const model = await loadForm(formSlug)

    if (!model) {
      return undefined
    }

    return {
      request,
      reply,
      model,
      slug: formSlug,
      formUrl: `${fastify.prefix}/${formSlug}`,
      options
    }
  }

  app.get(
    '/:slug',
    { schema: { params: paramsSlug } },
    async (request, reply) => {
      const context = await contextFor(request, reply, request.params.slug)

      if (!context) {
        return notFound(reply)
      }

      const state = getState(request, context.slug)
      return reply.redirect(
        `${context.formUrl}${context.model.firstUnansweredPath(state)}`
      )
    }
  )

  app.get(
    '/:slug/status',
    { schema: { params: paramsSlug } },
    async (request, reply) => {
      const context = await contextFor(request, reply, request.params.slug)
      return context ? renderStatus(context) : notFound(reply)
    }
  )

  app.get(
    '/:slug/:path',
    { schema: { params: paramsPage } },
    async (request, reply) => {
      const { params } = request
      const context = await contextFor(request, reply, params.slug)
      const page = context?.model.pageByPath(params.path)

      if (!context || !page) {
        return notFound(reply)
      }

      const redirect = context.model.redirectBefore(
        page,
        getState(request, context.slug)
      )

      if (redirect) {
        return reply.redirect(`${context.formUrl}${redirect}`)
      }

      if (page === context.model.summaryPage) {
        return renderSummary(context)
      }

      return renderQuestion(context, page)
    }
  )

  app.post(
    '/:slug/:path',
    {
      schema: { params: paramsPage, body: pageBody },
      // Checked before the body schema, so that a missing token is a 403
      // rather than a validation error.
      preValidation: (request, reply, done) => {
        fastify.csrfProtection(request, reply, done)
      }
    },
    async (request, reply) => {
      const { params, body } = request
      const context = await contextFor(request, reply, params.slug)
      const page = context?.model.pageByPath(params.path)

      if (!context || !page) {
        return notFound(reply)
      }

      const redirect = context.model.redirectBefore(
        page,
        getState(request, context.slug)
      )

      if (redirect) {
        return reply.redirect(`${context.formUrl}${redirect}`)
      }

      if (page === context.model.summaryPage) {
        return body.action === 'send'
          ? submitForm(context)
          : renderSummary(context)
      }

      return submitQuestion(context, page, body)
    }
  )
}
