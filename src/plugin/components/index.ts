import { z } from 'zod'

import { ComponentType, type ComponentDef } from '../../schema/index.js'
import { type FormModel } from '../models/form-model.js'
import { type FormState } from '../state.js'
import { type Body, type Field } from './component.js'
import { DatePartsField } from './date-parts-field.js'
import { CheckboxesField, RadiosField } from './list-fields.js'
import { NumberField } from './number-field.js'
import { EmailAddressField, TextField } from './text-field.js'

export { type Field, type FieldViewModel } from './component.js'

/**
 * Makes the field class for a component. Each `case` narrows `def` to one
 * member of the component union, so each constructor gets exactly its own
 * definition type.
 */
export function createField(
  def: ComponentDef,
  model: FormModel
): Field | undefined {
  switch (def.type) {
    case ComponentType.TextField:
      return new TextField(def)
    case ComponentType.EmailAddressField:
      return new EmailAddressField(def)
    case ComponentType.NumberField:
      return new NumberField(def)
    case ComponentType.RadiosField:
      return new RadiosField(def, model)
    case ComponentType.CheckboxesField:
      return new CheckboxesField(def, model)
    case ComponentType.DatePartsField:
      return new DatePartsField(def)
    case ComponentType.Details:
    case ComponentType.Html:
    case ComponentType.InsetText:
    case ComponentType.List:
    case ComponentType.Markdown:
    case ComponentType.NotificationBanner:
      return undefined
    default:
      throw new Error(
        `Component type "${def.type}" is not supported in this proof of concept`
      )
  }
}

export interface PageError {
  name: string
  href: string
  text: string
}

export type ParsePageResult =
  { success: true; data: FormState } | { success: false; errors: PageError[] }

/**
 * Validates a posted page. The schema is built from the page's fields when
 * the form loads, so it checks what this form asks for, and the result is
 * the general `FormState`.
 */
export function parsePage(fields: Field[], body: Body): ParsePageResult {
  const schema = z.object(
    Object.fromEntries(
      fields.map((field) => [field.name, field.answerSchema()])
    )
  )
  const input = Object.fromEntries(
    fields.map((field) => [field.name, field.fromBody(body)] as const)
  )
  const result = schema.safeParse(input)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.flatMap((issue) => {
    const field = fields.find(({ name }) => name === issue.path[0])
    return field
      ? [{ name: field.name, href: field.errorHref, text: issue.message }]
      : []
  })

  return { success: false, errors }
}
