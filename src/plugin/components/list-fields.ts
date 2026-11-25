import { z } from 'zod'

import {
  type CheckboxesFieldComponent,
  type Item,
  type RadiosFieldComponent
} from '../../schema/index.js'
import { type FormModel } from '../models/form-model.js'
import { type FormValue } from '../state.js'
import { type Body, FieldBase, type FieldViewModel } from './component.js'
import { messages } from './messages.js'

/**
 * Shared parts of fields whose answers come from a list. Posted values are
 * always strings, so each is matched to an item by its string form and
 * stored as the item's own value (a number for a number list).
 */
abstract class ListField<
  D extends RadiosFieldComponent | CheckboxesFieldComponent
> extends FieldBase<D> {
  readonly items: Item[]

  constructor(def: D, model: FormModel) {
    super(def)
    this.items = model.listById(def.list)?.items ?? []
  }

  protected itemFor(posted: string) {
    return this.items.find(({ value }) => String(value) === posted)
  }

  protected get selectMessage() {
    return this.message(messages.selectRequired(this.label))
  }

  protected legend(isPageHeading: boolean) {
    return {
      legend: isPageHeading
        ? {
            text: this.title,
            isPageHeading,
            classes: 'govuk-fieldset__legend--l'
          }
        : { text: this.title }
    }
  }

  protected textFor(value: string | number) {
    return this.items.find((item) => item.value === value)?.text ?? ''
  }
}

export class RadiosField extends ListField<RadiosFieldComponent> {
  answerSchema(): z.ZodType<FormValue | undefined> {
    const schema = z
      .string({ error: this.selectMessage })
      .transform((posted, ctx) => {
        const item = this.itemFor(posted)

        if (!item) {
          ctx.addIssue({ code: 'custom', message: this.selectMessage })
          return z.NEVER
        }

        return item.value
      })

    return this.isRequired ? schema : schema.optional()
  }

  toViewModel(
    value: FormValue | undefined,
    error?: string,
    isPageHeading = false
  ): FieldViewModel {
    return {
      macro: 'govukRadios',
      params: {
        ...this.common(undefined, error),
        idPrefix: this.name,
        fieldset: this.legend(isPageHeading),
        items: this.items.map((item) => ({
          value: String(item.value),
          text: item.text,
          hint: item.hint ? { text: item.hint.text } : undefined,
          checked: item.value === value
        }))
      }
    }
  }

  display(value: FormValue | undefined) {
    return typeof value === 'string' || typeof value === 'number'
      ? this.textFor(value)
      : ''
  }
}

export class CheckboxesField extends ListField<CheckboxesFieldComponent> {
  /**
   * A single ticked box posts a string and none posts nothing, so both are
   * turned into a list before validation.
   */
  fromBody(body: Body): unknown {
    const posted = body[this.name]

    if (posted === undefined) {
      return []
    }

    return typeof posted === 'string' ? [posted] : posted
  }

  answerSchema(): z.ZodType<FormValue | undefined> {
    return z
      .array(z.string(), { error: this.selectMessage })
      .transform((posted, ctx) => {
        const values: (string | number)[] = []

        for (const value of posted) {
          const item = this.itemFor(value)

          if (!item) {
            ctx.addIssue({ code: 'custom', message: this.selectMessage })
            return z.NEVER
          }

          values.push(item.value)
        }

        if (this.isRequired && !values.length) {
          ctx.addIssue({ code: 'custom', message: this.selectMessage })
          return z.NEVER
        }

        return values
      })
  }

  toViewModel(
    value: FormValue | undefined,
    error?: string,
    isPageHeading = false
  ): FieldViewModel {
    const selected = Array.isArray(value) ? value : []

    return {
      macro: 'govukCheckboxes',
      params: {
        ...this.common(undefined, error),
        idPrefix: this.name,
        fieldset: this.legend(isPageHeading),
        items: this.items.map((item) => ({
          value: String(item.value),
          text: item.text,
          hint: item.hint ? { text: item.hint.text } : undefined,
          checked: selected.includes(item.value)
        }))
      }
    }
  }

  display(value: FormValue | undefined) {
    return Array.isArray(value)
      ? value.map((item) => this.textFor(item)).join(', ')
      : ''
  }
}
