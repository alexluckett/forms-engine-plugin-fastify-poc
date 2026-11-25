import { z } from 'zod'

import { type DatePartsFieldComponent } from '../../schema/index.js'
import { type DatePartsValue, type FormValue } from '../state.js'
import { type Body, FieldBase, type FieldViewModel } from './component.js'
import { messages } from './messages.js'

const parts = ['day', 'month', 'year'] as const

/**
 * Reads day, month and year from a stored answer or a posted page, and
 * gives empty parts for anything else.
 */
const shownParts = z
  .object({ day: z.unknown(), month: z.unknown(), year: z.unknown() })
  .partial()
  .catch({})

/**
 * True when the day, month and year make a date that exists, so that
 * 31 February is refused.
 */
function isRealDate({ day, month, year }: DatePartsValue) {
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * A date entered as three inputs, named `<name>__day`, `<name>__month` and
 * `<name>__year`, and stored as numbers.
 */
export class DatePartsField extends FieldBase<DatePartsFieldComponent> {
  get errorHref() {
    return `#${this.name}__day`
  }

  fromBody(body: Body) {
    return Object.fromEntries(
      parts.map((part) => [part, body[`${this.name}__${part}`]] as const)
    )
  }

  answerSchema(): z.ZodType<FormValue | undefined> {
    const title = this.title
    const part = z.string().trim().optional().catch(undefined)

    return z
      .object({ day: part, month: part, year: part })
      .transform((posted, ctx) => {
        const missing = parts.filter((name) => !posted[name])

        if (missing.length === parts.length) {
          if (this.isRequired) {
            ctx.addIssue({
              code: 'custom',
              message: this.message(messages.required(this.label))
            })
            return z.NEVER
          }

          return undefined
        }

        const [first] = missing

        if (first) {
          ctx.addIssue({
            code: 'custom',
            message: this.message(messages.objectMissing(title, first))
          })
          return z.NEVER
        }

        const value = {
          day: Number(posted.day),
          month: Number(posted.month),
          year: Number(posted.year)
        }

        if (
          !Object.values(value).every(Number.isInteger) ||
          !isRealDate(value)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: this.message(messages.dateFormat(title))
          })
          return z.NEVER
        }

        return value
      })
  }

  toViewModel(
    value: unknown,
    error?: string,
    isPageHeading = false
  ): FieldViewModel {
    const date = shownParts.parse(value)

    return {
      macro: 'govukDateInput',
      params: {
        ...this.common(undefined, error),
        id: this.name,
        fieldset: {
          legend: isPageHeading
            ? {
                text: this.title,
                isPageHeading,
                classes: 'govuk-fieldset__legend--l'
              }
            : { text: this.title }
        },
        items: parts.map((part) => ({
          id: `${this.name}__${part}`,
          name: `${this.name}__${part}`,
          label: part.charAt(0).toUpperCase() + part.slice(1),
          value: date[part],
          classes: `govuk-input--width-${part === 'year' ? '4' : '2'}${error ? ' govuk-input--error' : ''}`
        }))
      }
    }
  }

  display(value: FormValue | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return ''
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(value.year, value.month - 1, value.day)))
  }
}
