import { formDefinitionSchema, type FormDefinition } from '../../src/index.js'
import { ids, validDefinition } from './valid-definition.js'

/**
 * Parses a changed copy of the fixture, so that each test can add the
 * components and conditions it needs and still get a checked definition.
 */
export function definitionWith(change: (input: any) => void): FormDefinition {
  const input = JSON.parse(JSON.stringify(validDefinition))
  change(input)
  return formDefinitionSchema.parse(input)
}

export const extraIds = {
  petTypeList: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d01',
  cat: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d02',
  dog: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d03',
  petTypes: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d04',
  age: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d05',
  petTypesCond: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d06',
  ageCond: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d07',
  refCond: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d08',
  bothCond: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d09'
} as const

/**
 * Fixture plus a checkboxes field, a number field and conditions on each.
 */
export const richDefinition = definitionWith((input) => {
  input.lists.push({
    id: extraIds.petTypeList,
    name: 'petTypes',
    title: 'Pet types',
    type: 'string',
    items: [
      { id: extraIds.cat, text: 'Cat', value: 'cat' },
      { id: extraIds.dog, text: 'Dog', value: 'dog' }
    ]
  })
  input.pages[0].components.push(
    {
      id: extraIds.petTypes,
      type: 'CheckboxesField',
      name: 'petTypes',
      title: 'Which pets?',
      list: extraIds.petTypeList
    },
    { id: extraIds.age, type: 'NumberField', name: 'age', title: 'Age' }
  )
  const listRef = (itemsCoordinator?: string) => ({
    id: extraIds.petTypesCond,
    displayName: 'Cat and dog',
    items: [
      {
        componentId: extraIds.petTypes,
        operator: 'is',
        type: 'ListItemRef',
        value: {
          listId: extraIds.petTypeList,
          itemId: [extraIds.cat, extraIds.dog],
          itemsCoordinator
        }
      }
    ]
  })
  input.conditions.push(
    listRef('and'),
    {
      ...listRef(),
      id: '6b2d4a5f-1e1b-4d9f-8c8c-2a1a3b4c5d10',
      displayName: 'Cat or dog'
    },
    {
      id: extraIds.ageCond,
      displayName: 'Over 30',
      items: [
        {
          componentId: extraIds.age,
          operator: 'is more than',
          type: 'NumberValue',
          value: 30
        }
      ]
    },
    {
      id: extraIds.refCond,
      displayName: 'Ref to has a pet',
      items: [{ conditionId: ids.hasPetYes }]
    },
    {
      id: extraIds.bothCond,
      displayName: 'Has a pet and over 30',
      coordinator: 'and',
      items: [{ conditionId: ids.hasPetYes }, { conditionId: extraIds.ageCond }]
    }
  )
})
