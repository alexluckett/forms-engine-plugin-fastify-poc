import { describe, expect, it } from 'vitest'

import { extraIds, richDefinition } from '../../../test/fixtures/definitions.js'
import { ids } from '../../../test/fixtures/valid-definition.js'
import {
  ComponentType,
  componentDefSchema,
  type ComponentDefInput
} from '../../schema/index.js'
import { FormModel } from '../models/form-model.js'
import { createField, parsePage } from './index.js'

const model = new FormModel(richDefinition, { basePath: '/rich-form' })

function fieldFor(input: ComponentDefInput) {
  const field = createField(componentDefSchema.parse(input), model)

  if (!field) {
    throw new Error('Expected a field')
  }

  return field
}

function errorFor(input: ComponentDefInput, body: Record<string, unknown>) {
  const result = parsePage([fieldFor(input)], body)
  return result.success ? undefined : result.errors[0]
}

function valueFor(input: ComponentDefInput, body: Record<string, unknown>) {
  const field = fieldFor(input)
  const result = parsePage([field], body)

  if (!result.success) {
    throw new Error(`Expected success, got ${result.errors[0]?.text ?? ''}`)
  }

  return result.data[field.name]
}

const text = {
  type: ComponentType.TextField,
  name: 'fullName',
  title: 'What is your name',
  schema: { max: 5 }
} as const

describe('TextField', () => {
  it('asks for an answer when empty', () => {
    expect(errorFor(text, { fullName: '' })).toEqual({
      name: 'fullName',
      href: '#fullName',
      text: 'Enter what is your name'
    })
  })

  it('applies the maximum length', () => {
    expect(errorFor(text, { fullName: 'Alexander' })?.text).toBe(
      'What is your name must be 5 characters or less'
    )
  })

  it('treats a repeated value as no answer rather than throwing', () => {
    expect(errorFor(text, { fullName: ['a', 'b'] })?.text).toBe(
      'Enter what is your name'
    )
  })

  it('uses the custom validation message for every error', () => {
    expect(
      errorFor(
        { ...text, options: { customValidationMessage: 'Custom' } },
        { fullName: '' }
      )?.text
    ).toBe('Custom')
  })

  it('is optional when required is false', () => {
    expect(
      valueFor({ ...text, options: { required: false } }, { fullName: '' })
    ).toBeUndefined()
  })
})

describe('NumberField', () => {
  const number = {
    type: ComponentType.NumberField,
    name: 'howMany',
    title: 'How many',
    schema: { min: 2 }
  } as const

  it('rejects text', () => {
    expect(errorFor(number, { howMany: 'abc' })?.text).toBe(
      'How many must be a number'
    )
  })

  it('applies the minimum', () => {
    expect(errorFor(number, { howMany: '1' })?.text).toBe(
      'How many must be 2 or higher'
    )
  })

  it('stores a number', () => {
    expect(valueFor(number, { howMany: '3' })).toBe(3)
  })
})

describe('EmailAddressField', () => {
  it('asks for the correct format', () => {
    expect(
      errorFor(
        {
          type: ComponentType.EmailAddressField,
          name: 'email',
          title: 'Your email'
        },
        { email: 'x' }
      )?.text
    ).toBe('Enter your email in the correct format')
  })
})

describe('RadiosField', () => {
  const radios = {
    type: ComponentType.RadiosField,
    name: 'hasPet',
    title: 'Do you have a pet',
    list: ids.yesNoList
  } as const

  it('rejects a value that is not in the list', () => {
    expect(errorFor(radios, { hasPet: 'not-in-list' })?.text).toBe(
      'Select do you have a pet'
    )
  })

  it('stores the item value', () => {
    expect(valueFor(radios, { hasPet: 'yes' })).toBe('yes')
  })
})

describe('CheckboxesField', () => {
  const checkboxes = {
    type: ComponentType.CheckboxesField,
    name: 'petTypes',
    title: 'Which pets',
    list: extraIds.petTypeList
  } as const

  it('stores a single value as a list', () => {
    expect(valueFor(checkboxes, { petTypes: 'cat' })).toEqual(['cat'])
  })

  it('asks for a selection when none is made', () => {
    expect(errorFor(checkboxes, {})?.text).toBe('Select which pets')
  })

  it('accepts no selection when optional', () => {
    expect(
      valueFor({ ...checkboxes, options: { required: false } }, {})
    ).toEqual([])
  })
})

describe('DatePartsField', () => {
  const date = {
    type: ComponentType.DatePartsField,
    name: 'dob',
    title: 'Date of birth'
  } as const

  it('names the missing part', () => {
    expect(
      errorFor(date, { dob__day: '1', dob__month: '2', dob__year: '' })
    ).toEqual({
      name: 'dob',
      href: '#dob__day',
      text: 'Date of birth must include a year'
    })
  })

  it('rejects a date that does not exist', () => {
    expect(
      errorFor(date, { dob__day: '31', dob__month: '2', dob__year: '2020' })
        ?.text
    ).toBe('Date of birth must be a real date')
  })

  it('stores day, month and year', () => {
    expect(
      valueFor(date, { dob__day: '1', dob__month: '2', dob__year: '2020' })
    ).toEqual({ day: 1, month: 2, year: 2020 })
  })
})

describe('createField', () => {
  it('returns undefined for content components', () => {
    expect(
      createField(
        componentDefSchema.parse({
          type: ComponentType.Html,
          content: '<p>Hi</p>'
        }),
        model
      )
    ).toBeUndefined()
  })

  it('throws for a field type the proof of concept does not render', () => {
    expect(() =>
      createField(
        componentDefSchema.parse({
          type: ComponentType.UkAddressField,
          name: 'address',
          title: 'Address'
        }),
        model
      )
    ).toThrow(
      'Component type "UkAddressField" is not supported in this proof of concept'
    )
  })
})
