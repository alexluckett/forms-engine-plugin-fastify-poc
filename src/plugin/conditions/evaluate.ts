import {
  ConditionType,
  Coordinator,
  OperatorName,
  isConditionData,
  type ConditionDataV2,
  type FormDefinition
} from '../../schema/index.js'
import { type FormState, type FormValue } from '../state.js'

class UnsupportedConditionError extends Error {
  constructor(operator: string, type: string) {
    super(
      `Condition operator "${operator}" for "${type}" is not supported in this proof of concept`
    )
  }
}

function findComponentName(definition: FormDefinition, componentId: string) {
  for (const page of definition.pages) {
    const component = page.components.find(({ id }) => id === componentId)

    if (component) {
      return component.name
    }
  }

  return undefined
}

/**
 * Maps list item ids to the values a user's answer would hold, so that the
 * condition can compare like with like.
 */
function itemValues(
  definition: FormDefinition,
  listId: string,
  itemIds: string[]
): (string | number)[] {
  const list = definition.lists.find(({ id }) => id === listId)
  const items: { id: string; value: string | number }[] = list?.items ?? []

  return items
    .filter(({ id }) => itemIds.includes(id))
    .map(({ value }) => value)
}

function isSame(
  item: ConditionDataV2,
  answer: FormValue,
  definition: FormDefinition
): boolean {
  switch (item.type) {
    case ConditionType.StringValue:
    case ConditionType.BooleanValue:
      return answer === item.value

    case ConditionType.ListItemRef: {
      const values = itemValues(
        definition,
        item.value.listId,
        item.value.itemId
      )

      if (Array.isArray(answer)) {
        return item.value.itemsCoordinator === Coordinator.AND
          ? values.every((value) => answer.includes(value))
          : values.some((value) => answer.includes(value))
      }

      return typeof answer !== 'object' && values.includes(answer)
    }

    default:
      throw new UnsupportedConditionError(item.operator, item.type)
  }
}

function evaluateItem(
  item: ConditionDataV2,
  definition: FormDefinition,
  state: FormState
): boolean {
  const name = findComponentName(definition, item.componentId)
  const answer = name ? state[name] : undefined

  switch (item.operator) {
    case OperatorName.Is:
      return answer !== undefined && isSame(item, answer, definition)

    case OperatorName.IsNot:
      return answer !== undefined && !isSame(item, answer, definition)

    case OperatorName.IsMoreThan:
    case OperatorName.IsLessThan: {
      if (item.type !== ConditionType.NumberValue) {
        throw new UnsupportedConditionError(item.operator, item.type)
      }

      if (typeof answer !== 'number') {
        return false
      }

      return item.operator === OperatorName.IsMoreThan
        ? answer > item.value
        : answer < item.value
    }

    default:
      throw new UnsupportedConditionError(item.operator, item.type)
  }
}

/**
 * Evaluates a named condition against a user's answers. An unanswered
 * component makes a comparison false, so that a page that depends on it
 * stays hidden until the user answers.
 */
export function evaluateCondition(
  conditionId: string,
  definition: FormDefinition,
  state: FormState
): boolean {
  const wrapper = definition.conditions.find(({ id }) => id === conditionId)

  if (!wrapper) {
    return false
  }

  const results = wrapper.items.map((item) =>
    isConditionData(item)
      ? evaluateItem(item, definition, state)
      : evaluateCondition(item.conditionId, definition, state)
  )

  return wrapper.coordinator === Coordinator.OR
    ? results.some(Boolean)
    : results.every(Boolean)
}
