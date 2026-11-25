import { formDefinitionSchema } from '../schema/index.js'
import { FormModel } from './models/form-model.js'
import { type FormsService } from './options.js'

/**
 * Error for a definition that fails to parse. Fastify reads `statusCode`,
 * and the message stays general so that schema details reach only the log.
 */
export class FormDefinitionInvalidError extends Error {
  readonly statusCode = 500

  constructor() {
    super('Form definition is invalid')
  }
}

interface ErrorLogger {
  error: (details: object, message: string) => void
}

/**
 * Makes a function that loads, parses and caches a form by slug. A form is
 * parsed once per process, so that each request reuses the same model.
 */
export function createFormLoader(formsService: FormsService, log: ErrorLogger) {
  const cache = new Map<string, FormModel>()

  return async (slug: string): Promise<FormModel | undefined> => {
    const cached = cache.get(slug)

    if (cached) {
      return cached
    }

    const raw = await formsService.getFormDefinition(slug)

    if (raw === undefined) {
      return undefined
    }

    const result = formDefinitionSchema.safeParse(raw)

    if (!result.success) {
      log.error(
        { slug, issues: result.error.issues },
        'Form definition is invalid'
      )
      throw new FormDefinitionInvalidError()
    }

    const model = new FormModel(result.data)
    cache.set(slug, model)
    return model
  }
}

export type LoadForm = ReturnType<typeof createFormLoader>
