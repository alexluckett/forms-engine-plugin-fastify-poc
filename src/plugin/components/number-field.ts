import { z } from 'zod'

import { type NumberFieldComponent } from '../../schema/index.js'
import { type FormValue } from '../state.js'
import { FieldBase, type FieldViewModel } from './component.js'
import { messages } from './messages.js'
import { optionalWhenEmpty } from './text-field.js'

export class NumberField extends FieldBase<NumberFieldComponent> {
  answerSchema() {
    const { min, max } = this.def.schema
    const name = this.label
    let number = z.number({ error: this.message(messages.number(name)) })

    if (min !== undefined) {
      number = number.min(min, {
        error: this.message(messages.numberMin(name, min))
      })
    }

    if (max !== undefined) {
      number = number.max(max, {
        error: this.message(messages.numberMax(name, max))
      })
    }

    const required = this.message(messages.required(name))
    const schema = z
      .string({ error: required })
      .trim()
      .min(1, { error: required })
      .transform(Number)
      .pipe(number)

    return optionalWhenEmpty(this.isRequired, schema)
  }

  protected toPosted(value: unknown) {
    return typeof value === 'number' ? String(value) : value
  }

  toViewModel(value: unknown, error?: string): FieldViewModel {
    const { prefix, suffix } = this.def.options

    return {
      macro: 'govukInput',
      params: {
        ...this.common(
          typeof value === 'number' || typeof value === 'string'
            ? String(value)
            : undefined,
          error
        ),
        inputmode: 'numeric',
        classes: 'govuk-input--width-5',
        label: { text: this.labelText },
        prefix: prefix ? { text: prefix } : undefined,
        suffix: suffix ? { text: suffix } : undefined
      }
    }
  }

  display(value: FormValue | undefined) {
    return typeof value === 'number' ? String(value) : ''
  }
}
