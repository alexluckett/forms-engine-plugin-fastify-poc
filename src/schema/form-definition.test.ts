import { describe, expect, it } from 'vitest'

import { ids, validDefinition } from '../../test/fixtures/valid-definition.js'
import { ComponentType, ControllerType } from './enums.js'
import { formDefinitionSchema } from './form-definition.js'

/**
 * Returns an untyped copy, so that each test can break the fixture in ways
 * the input type would refuse.
 */
function clone(): any {
  return JSON.parse(JSON.stringify(validDefinition))
}

function firstIssue(input: unknown) {
  const result = formDefinitionSchema.safeParse(input)

  expect(result.success).toBe(false)
  return result.error?.issues[0]
}

describe('formDefinitionSchema', () => {
  it('parses the fixture and fills in missing ids', () => {
    const definition = formDefinitionSchema.parse(clone())

    expect(definition.pages[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects a page condition that names an unknown condition', () => {
    const input = clone()
    input.pages[2].condition = '00000000-0000-4000-8000-000000000000'

    const issue = firstIssue(input)
    expect(issue?.path).toEqual(['pages', 2, 'condition'])
    expect(issue).toMatchObject({
      params: { errorCode: 'ref_page_condition' }
    })
  })

  it('rejects a component list that names an unknown list', () => {
    const input = clone()
    input.pages[1].components[0].list = '00000000-0000-4000-8000-000000000000'

    expect(firstIssue(input)).toMatchObject({
      path: ['pages', 1, 'components', 0, 'list'],
      params: { errorCode: 'ref_page_component_list' }
    })
  })

  it('rejects a list item reference that is not in its list', () => {
    const input = clone()
    input.conditions[0].items[0].value.itemId = [
      '00000000-0000-4000-8000-000000000000'
    ]

    expect(firstIssue(input)).toMatchObject({
      params: { errorCode: 'ref_condition_item_id' }
    })
  })

  it('rejects a condition on a component type that cannot have one', () => {
    const input = clone()
    input.pages[1].components[0] = {
      id: ids.hasPet,
      type: ComponentType.Html,
      content: '<p>Hello</p>'
    }

    expect(firstIssue(input)).toMatchObject({
      path: ['conditions', 0, 'items', 0],
      params: { errorCode: 'incompatible_condition_component_type' }
    })
  })

  it('rejects two pages with the same path', () => {
    const input = clone()
    input.pages[1].path = '/your-name'

    expect(firstIssue(input)).toMatchObject({
      path: ['pages', 1, 'path'],
      params: { errorCode: 'unique_page_path' }
    })
  })

  it('rejects the reserved /status path', () => {
    const input = clone()
    input.pages[0].path = '/status'

    expect(firstIssue(input)?.path).toEqual(['pages', 0, 'path'])
  })

  it('requires repeat on a repeat page', () => {
    const input = clone()
    input.pages[0].controller = ControllerType.Repeat

    expect(firstIssue(input)?.path).toEqual(['pages', 0, 'repeat'])
  })

  it('requires a coordinator when a condition has two items', () => {
    const input = clone()
    const item = input.conditions[0].items[0]
    input.conditions[0].items = [
      item,
      { ...item, id: '00000000-0000-4000-8000-000000000001' }
    ]

    expect(firstIssue(input)?.path).toEqual(['conditions', 0, 'coordinator'])
  })
})
