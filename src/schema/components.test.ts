import { describe, expect, it } from 'vitest'

import { componentDefSchema } from './components.js'
import { ComponentType } from './enums.js'

const textField = {
  type: ComponentType.TextField,
  name: 'fullName',
  title: 'What is your name?',
  options: {},
  schema: {}
}

describe('componentDefSchema', () => {
  it('rejects an invalid regex with the regex error code', () => {
    const result = componentDefSchema.safeParse({
      ...textField,
      schema: { regex: '[' }
    })

    const issue = result.error?.issues[0]
    expect(issue?.path).toEqual(['schema', 'regex'])
    expect(issue?.message).toBe('The regex expression is invalid')
    expect(issue).toMatchObject({
      params: { errorCode: 'incompatible_question_regex' }
    })
  })

  it('rejects a name that is not letters only', () => {
    const result = componentDefSchema.safeParse({
      ...textField,
      name: 'bad name'
    })

    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('accepts a display-only component without a name', () => {
    const result = componentDefSchema.safeParse({
      type: ComponentType.Html,
      title: 'Html',
      content: '<p>Hello</p>',
      options: {}
    })

    expect(result.success).toBe(true)
  })

  it('rejects a field component without a name', () => {
    const { name: _name, ...withoutName } = textField

    expect(componentDefSchema.safeParse(withoutName).success).toBe(false)
  })

  it('rejects an unknown component type', () => {
    const result = componentDefSchema.safeParse({
      ...textField,
      type: 'NotAComponent'
    })

    expect(result.error?.issues[0]?.path).toEqual(['type'])
  })

  it('removes option keys that the component type does not declare', () => {
    const result = componentDefSchema.parse({
      ...textField,
      options: { rows: 3 }
    })

    expect(result.type).toBe(ComponentType.TextField)
    expect(result.type === ComponentType.TextField && result.options).toEqual(
      {}
    )
  })

  it('turns an empty schema number into undefined', () => {
    const result = componentDefSchema.parse({
      ...textField,
      schema: { max: '' }
    })

    expect(result.type === ComponentType.TextField && result.schema.max).toBe(
      undefined
    )
  })

  it('trims the title', () => {
    const result = componentDefSchema.parse({
      ...textField,
      title: '  Name  '
    })

    expect(result.title).toBe('Name')
  })

  it('gives a missing id a UUID', () => {
    const result = componentDefSchema.parse(textField)

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
