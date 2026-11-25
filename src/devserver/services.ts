import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parse } from 'yaml'

import { type FormsService, type OutputService } from '../index.js'

/**
 * Reads `<slug>.yaml` from a folder. The engine parses and checks what this
 * returns, so the devserver only needs to find the file.
 */
export function fileFormsService(folder: string): FormsService {
  return {
    async getFormDefinition(slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return undefined
      }

      try {
        const text = await readFile(join(folder, `${slug}.yaml`), 'utf8')
        const definition: unknown = parse(text)
        return definition
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return undefined
        }

        throw error
      }
    }
  }
}

interface InfoLogger {
  info: (details: object, message: string) => void
}

/**
 * Logs each submission rather than sending it anywhere, so that the
 * devserver can run a whole journey with no other services.
 */
export function loggingOutputService(log: InfoLogger): OutputService {
  return {
    submit(submission) {
      log.info(
        {
          slug: submission.slug,
          reference: submission.reference,
          answers: submission.answers
        },
        'Form submitted'
      )
      return Promise.resolve()
    }
  }
}
