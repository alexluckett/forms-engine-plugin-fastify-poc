import { z } from 'zod'

import {
  type CheckboxesFieldComponent,
  type Item,
  type List,
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
  readonly list: List | undefined

  constructor(def: D, model: FormModel) {
    super(def)
    this.list = model.listById(def.list)
  }

  get items(): Item[] {
    return this.list?.items ?? []
  }

  protected itemFor(posted: string) {
    return this.items.find(({ value }) => String(value) === posted)
  }

  protected get selectMessage() {
    return this.message(messages.selectRequired(this.label))
  }

  /**
   * Selection fields have a medium legend unless the page makes it the
   * heading, as in the hapi engine's `SelectionControlField`.
   */
  protected legend() {
    return {
      legend: { text: this.labelText, classes: 'govuk-fieldset__legend--m' }
    }
  }

  /**
   * Item labels are bold when the form asks for it.
   */
  protected itemLabel() {
    return this.def.options.bold ? { classes: 'govuk-label--s' } : undefined
  }

  protected textFor(value: string | number) {
    return this.items.find((item) => item.value === value)?.text ?? ''
  }
}

export class RadiosField extends ListField<RadiosFieldComponent> {
  protected toPosted(value: unknown) {
    return typeof value === 'number' ? String(value) : value
  }

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

  toViewModel(value: unknown, error?: string): FieldViewModel {
    return {
      macro: 'govukRadios',
      params: {
        ...this.common(undefined, error),
        idPrefix: this.name,
        fieldset: this.legend(),
        items: this.items.map((item) => ({
          value: String(item.value),
          text: item.text,
          hint: item.hint ? { text: item.hint.text } : undefined,
          label: this.itemLabel(),
          checked: String(item.value) === String(value)
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

  protected toPosted(value: unknown) {
    return Array.isArray(value) ? value.map(String) : []
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

  toViewModel(value: unknown, error?: string): FieldViewModel {
    const selected = (Array.isArray(value) ? value : [value]).map(String)

    return {
      macro: 'govukCheckboxes',
      params: {
        ...this.common(undefined, error),
        idPrefix: this.name,
        fieldset: this.legend(),
        items: this.items.map((item) => ({
          value: String(item.value),
          text: item.text,
          hint: item.hint ? { text: item.hint.text } : undefined,
          label: this.itemLabel(),
          checked: selected.includes(String(item.value))
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
