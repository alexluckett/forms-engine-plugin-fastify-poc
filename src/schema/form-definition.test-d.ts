import { describe, expectTypeOf, it } from 'vitest'

import { ConditionType, ControllerType } from './enums.js'
import {
  type ConditionDataV2,
  type FormDefinition,
  type Page,
  type Repeat
} from './form-definition.js'

describe('FormDefinition', () => {
  it('fixes the schema version to 2', () => {
    expectTypeOf<FormDefinition['schema']>().toEqualTypeOf<2>()
  })

  it('makes repeat required on a repeat page', () => {
    const check = (page: Page) => {
      if (page.controller === ControllerType.Repeat) {
        expectTypeOf(page.repeat).toEqualTypeOf<Repeat>()
      }
    }

    expectTypeOf(check).toBeFunction()
  })

  it('narrows the condition value by condition type', () => {
    const check = (condition: ConditionDataV2) => {
      if (condition.type === ConditionType.ListItemRef) {
        expectTypeOf(condition.value.itemId).toEqualTypeOf<string[]>()
      }
    }

    expectTypeOf(check).toBeFunction()
  })
})
