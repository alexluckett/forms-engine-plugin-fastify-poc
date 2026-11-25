import { describe, expectTypeOf, it } from 'vitest'

import { type ComponentDef, type ComponentDefByType } from './components.js'
import { ComponentType } from './enums.js'

describe('ComponentDef', () => {
  it('narrows options by component type', () => {
    const check = (def: ComponentDef) => {
      if (def.type === ComponentType.MultilineTextField) {
        expectTypeOf(def.options.rows).toEqualTypeOf<number | undefined>()
      }

      if (def.type === ComponentType.TextField) {
        // @ts-expect-error `rows` exists only on MultilineTextField
        expectTypeOf(def.options.rows).toBeUnknown()
      }
    }

    expectTypeOf(check).toBeFunction()
  })

  it('makes list required on list-backed fields', () => {
    expectTypeOf<
      ComponentDefByType<ComponentType.RadiosField>['list']
    >().toEqualTypeOf<string>()
  })
})
