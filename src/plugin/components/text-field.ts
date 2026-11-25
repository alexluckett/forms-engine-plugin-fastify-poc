import { z } from 'zod'

import {
  type EmailAddressFieldComponent,
  type TextFieldComponent
} from '../../schema/index.js'
import { type FormValue } from '../state.js'
import { FieldBase, type FieldViewModel } from './component.js'
import { messages } from './messages.js'

/**
 * A trimmed string that is required unless `required` is false, in which
 * case an empty answer is stored as undefined.
 */
export function trimmedAnswer(
  field: FieldBase<TextFieldComponent | EmailAddressFieldComponent>
) {
  const required = field.message(messages.required(field.label))
  return z.string({ error: required }).trim()
}

export function optionalWhenEmpty(
  isRequired: boolean,
  schema: z.ZodType<FormValue>
): z.ZodType<FormValue | undefined> {
  return isRequired
    ? schema
    : z.union([z.literal('').transform(() => undefined), z.undefined(), schema])
}

export class TextField extends FieldBase<TextFieldComponent> {
  answerSchema() {
    const { min, max, length, regex } = this.def.schema
    const label = this.label
    let schema = trimmedAnswer(this).min(1, {
      error: this.message(messages.required(label))
    })

    if (min !== undefined) {
      schema = schema.min(min, {
        error: this.message(messages.min(label, min))
      })
    }

    if (max !== undefined) {
      schema = schema.max(max, {
        error: this.message(messages.max(label, max))
      })
    }

    if (length !== undefined) {
      schema = schema.length(length, {
        error: this.message(messages.length(label, length))
      })
    }

    if (regex) {
      schema = schema.regex(new RegExp(regex), {
        error: this.message(messages.pattern(label))
      })
    }

    return optionalWhenEmpty(this.isRequired, schema)
  }

  toViewModel(value: unknown, error?: string): FieldViewModel {
    return {
      macro: 'govukInput',
      params: {
        ...this.common(typeof value === 'string' ? value : undefined, error),
        label: { text: this.labelText },
        autocomplete: this.def.options.autocomplete,
        classes: this.def.options.classes
      }
    }
  }

  display(value: FormValue | undefined) {
    return typeof value === 'string' ? value : ''
  }
}

export class EmailAddressField extends FieldBase<EmailAddressFieldComponent> {
  answerSchema() {
    const schema = trimmedAnswer(this)
      .min(1, { error: this.message(messages.required(this.label)) })
      .pipe(z.email({ error: this.message(messages.format(this.label)) }))

    return optionalWhenEmpty(this.isRequired, schema)
  }

  toViewModel(value: unknown, error?: string): FieldViewModel {
    return {
      macro: 'govukInput',
      params: {
        ...this.common(typeof value === 'string' ? value : undefined, error),
        type: 'email',
        autocomplete: 'email',
        spellcheck: false,
        label: { text: this.labelText }
      }
    }
  }

  display(value: FormValue | undefined) {
    return typeof value === 'string' ? value : ''
  }
}
