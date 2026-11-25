import { z } from 'zod'

import { FormDefinitionError, FormDefinitionErrorType } from './errors.js'

/**
 * Makes a `superRefine` callback that reports each item whose `key` value
 * was already seen earlier in the array. Items without a value are skipped,
 * so that optional keys can be unique only where present.
 */
export function uniqueBy<T>(
  key: keyof T & (string | number),
  errorCode: FormDefinitionError = FormDefinitionError.Other
) {
  return (items: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<unknown>()

    items.forEach((item, index) => {
      const value = item[key]

      if (value === undefined) {
        return
      }

      if (seen.has(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, key],
          message: `Duplicate ${String(key)} "${String(value)}"`,
          params: { errorCode, errorType: FormDefinitionErrorType.Unique }
        })
      }

      seen.add(value)
    })
  }
}

/**
 * Treats an empty string as "not given", as HTML form editors often send
 * `''` for an empty number input. A union rather than a preprocess step
 * keeps the input type precise (`'' | number`), so that callers who build
 * definitions by hand still get type checks.
 */
export function emptyToUndefined<T extends z.ZodType>(schema: T) {
  return z.union([z.literal('').transform(() => undefined), schema])
}

/**
 * Removes trailing white space and keeps leading white space, so that
 * indented Markdown in descriptions keeps its meaning.
 */
export const rtrimOnly = z.string().transform((value) => value.trimEnd())
