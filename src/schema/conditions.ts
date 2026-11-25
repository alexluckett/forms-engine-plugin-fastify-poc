import { z } from 'zod'

import { idSchema } from './components.js'
import { ConditionType, Coordinator, OperatorName } from './enums.js'

const trimmed = z.string().trim()

const conditionBase = z.object({
  id: idSchema,
  componentId: trimmed.describe(
    'Reference to the component id being evaluated in this condition'
  ),
  operator: z
    .enum(OperatorName)
    .describe('Comparison operator (is, is not, is more than, and so on)')
})

/**
 * List item reference. A single `itemId` string is wrapped in an array, so
 * that conditions saved before multi-select support still load and the
 * parsed value always has one shape.
 */
export const conditionListItemRefValueSchema = z.object({
  listId: trimmed.describe('The id of the list'),
  itemId: z
    .union([trimmed.transform((id) => [id]), z.array(trimmed).min(1)])
    .describe('The ids of the selected list items'),
  itemsCoordinator: z
    .enum(Coordinator)
    .optional()
    .describe('How multiple checkbox selections are combined (and/or)')
})

export const relativeDateValueSchema = z.object({
  period: z
    .number()
    .int()
    .positive()
    .describe('Numeric amount of the time period'),
  unit: trimmed.describe('Time unit (e.g. days, weeks, months, years)'),
  direction: trimmed.describe('Temporal direction, either "past" or "future"')
})

/**
 * One comparison. Zod picks the member by `type`, so the shape of `value`
 * follows the condition type both when parsing and in code.
 */
export const conditionDataSchema = z
  .discriminatedUnion('type', [
    conditionBase.extend({
      type: z.literal(ConditionType.BooleanValue),
      value: z.boolean()
    }),
    conditionBase.extend({
      type: z.literal(ConditionType.StringValue),
      value: z.string()
    }),
    conditionBase.extend({
      type: z.literal(ConditionType.NumberValue),
      value: z.number()
    }),
    conditionBase.extend({
      type: z.literal(ConditionType.DateValue),
      value: z.iso.date()
    }),
    conditionBase.extend({
      type: z.literal(ConditionType.ListItemRef),
      value: conditionListItemRefValueSchema
    }),
    conditionBase.extend({
      type: z.literal(ConditionType.RelativeDate),
      value: relativeDateValueSchema
    })
  ])
  .describe('Condition definition')

export const conditionRefSchema = z
  .object({
    id: idSchema,
    conditionId: trimmed.describe('Id of the referenced condition')
  })
  .describe('Reference to a named condition defined elsewhere')

export const conditionWrapperSchema = z
  .object({
    id: idSchema,
    displayName: trimmed.describe('Human-readable name for display in the UI'),
    coordinator: z
      .enum(Coordinator)
      .optional()
      .describe('Logical operator joining the items (and/or)'),
    items: z
      .array(z.union([conditionDataSchema, conditionRefSchema]))
      .min(1)
      .describe('Array of conditions or condition references')
  })
  .superRefine((wrapper, ctx) => {
    if (wrapper.items.length >= 2 && !wrapper.coordinator) {
      ctx.addIssue({
        code: 'custom',
        path: ['coordinator'],
        message: 'A coordinator is required when there are two or more items'
      })
    }
  })
  .describe('Container for a named condition with its definition')

export type ConditionDataV2 = z.infer<typeof conditionDataSchema>
export type ConditionRefDataV2 = z.infer<typeof conditionRefSchema>
export type ConditionWrapperV2 = z.infer<typeof conditionWrapperSchema>
export type ConditionListItemRefValueDataV2 = z.infer<
  typeof conditionListItemRefValueSchema
>

/**
 * True for a comparison, false for a reference to another condition.
 */
export function isConditionData(
  item: ConditionDataV2 | ConditionRefDataV2
): item is ConditionDataV2 {
  return 'componentId' in item
}
