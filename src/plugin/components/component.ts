import { z } from 'zod'

import { type FormComponentsDef, type List } from '../../schema/index.js'
import { type FormValue } from '../state.js'

export type Body = Record<string, unknown>

/**
 * A GOV.UK Frontend macro name and the params to call it with.
 */
export interface FieldViewModel {
  macro: 'govukInput' | 'govukRadios' | 'govukCheckboxes' | 'govukDateInput'
  params: Record<string, unknown>
}

/**
 * What a page needs from each field it renders. `answerSchema` is built at
 * runtime from the field's definition, so the answer is checked by Zod but
 * typed only as a general `FormValue`. `toViewModel` takes either a stored
 * answer or what the user just posted, so that a page with errors shows
 * back exactly what was typed.
 */
export interface Field {
  readonly name: string
  readonly label: string
  readonly errorHref: string
  /** The list a list-backed field takes its options from */
  readonly list?: List | undefined
  answerSchema(): z.ZodType<FormValue | undefined>
  stateSchema(): z.ZodType<FormValue | undefined>
  fromBody(body: Body): unknown
  toViewModel(
    value: unknown,
    error?: string,
    isPageHeading?: boolean
  ): FieldViewModel
  display(value: FormValue | undefined): string
}

/**
 * Shared parts of every field. `D` is one member of the component union, so
 * a subclass reads only the options its own type declares.
 */
export abstract class FieldBase<D extends FormComponentsDef> implements Field {
  readonly def: D

  constructor(def: D) {
    this.def = def
  }

  get name() {
    return this.def.name
  }

  get title() {
    return this.def.title
  }

  get label() {
    return this.def.shortDescription ?? this.def.title
  }

  get errorHref() {
    return `#${this.name}`
  }

  get isRequired() {
    return this.def.options.required !== false
  }

  /**
   * The custom message replaces every message when the form sets one.
   */
  message(text: string) {
    return 'customValidationMessage' in this.def.options &&
      this.def.options.customValidationMessage
      ? this.def.options.customValidationMessage
      : text
  }

  fromBody(body: Body): unknown {
    return body[this.name]
  }

  /**
   * Checks a stored answer with the same rules as a posted one, by turning
   * it back into what the page would post. Each field keeps one set of
   * rules rather than one for the page and another for the session.
   */
  stateSchema(): z.ZodType<FormValue | undefined> {
    return z.preprocess((value) => this.toPosted(value), this.answerSchema())
  }

  protected toPosted(value: unknown): unknown {
    return value
  }

  protected common(value: unknown, error?: string) {
    return {
      id: this.name,
      name: this.name,
      hint: this.def.hint ? { text: this.def.hint } : undefined,
      value,
      errorMessage: error ? { text: error } : undefined
    }
  }

  abstract answerSchema(): z.ZodType<FormValue | undefined>
  abstract toViewModel(
    value: FormValue | undefined,
    error?: string,
    isPageHeading?: boolean
  ): FieldViewModel
  abstract display(value: FormValue | undefined): string
}
