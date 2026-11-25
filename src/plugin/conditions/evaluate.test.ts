import { describe, expect, it } from 'vitest'

import {
  definitionWith,
  extraIds,
  richDefinition
} from '../../../test/fixtures/definitions.js'
import { ids } from '../../../test/fixtures/valid-definition.js'
import { type FormState } from '../state.js'
import { evaluateCondition } from './evaluate.js'

const evaluate = (id: string, state: FormState) =>
  evaluateCondition(id, richDefinition, state)

describe('evaluateCondition', () => {
  it('is true when a radio answer matches the list item', () => {
    expect(evaluate(ids.hasPetYes, { hasPet: 'yes' })).toBe(true)
  })

  it('is false when a radio answer does not match', () => {
    expect(evaluate(ids.hasPetYes, { hasPet: 'no' })).toBe(false)
  })

  it('needs every item when checkbox items are joined with and', () => {
    expect(evaluate(extraIds.petTypesCond, { petTypes: ['cat'] })).toBe(false)
    expect(evaluate(extraIds.petTypesCond, { petTypes: ['cat', 'dog'] })).toBe(
      true
    )
  })

  it('needs any item when checkbox items are not joined with and', () => {
    expect(
      evaluate('6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d10', { petTypes: ['dog'] })
    ).toBe(true)
  })

  it('negates the result for is not', () => {
    const definition = definitionWith((input) => {
      input.conditions[0].items[0].operator = 'is not'
    })

    expect(evaluateCondition(ids.hasPetYes, definition, { hasPet: 'no' })).toBe(
      true
    )
  })

  it('compares numbers with is more than', () => {
    expect(evaluate(extraIds.ageCond, { age: 31 })).toBe(true)
    expect(evaluate(extraIds.ageCond, { age: 30 })).toBe(false)
  })

  it('follows a reference to another condition', () => {
    expect(evaluate(extraIds.refCond, { hasPet: 'yes' })).toBe(true)
  })

  it('joins items with the wrapper coordinator', () => {
    expect(evaluate(extraIds.bothCond, { hasPet: 'yes', age: 31 })).toBe(true)
    expect(evaluate(extraIds.bothCond, { hasPet: 'yes', age: 20 })).toBe(false)
  })

  it('is false when the component is not answered', () => {
    expect(evaluate(ids.hasPetYes, {})).toBe(false)
  })

  it('throws for an operator the proof of concept does not support', () => {
    const definition = definitionWith((input) => {
      input.conditions[0].items[0].operator = 'contains'
    })

    expect(() =>
      evaluateCondition(ids.hasPetYes, definition, { hasPet: 'yes' })
    ).toThrow(
      'Condition operator "contains" for "ListItemRef" is not supported in this proof of concept'
    )
  })
})
