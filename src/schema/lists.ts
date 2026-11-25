import { z } from 'zod'

import { componentDefSchema, idSchema } from './components.js'
import { FormDefinitionError } from './errors.js'
import { uniqueBy } from './helpers.js'

const itemBase = z.object({
  id: idSchema,
  text: z.string().trim().describe('Display text shown to the user'),
  description: z
    .string()
    .trim()
    .optional()
    .describe('Optional additional descriptive text for the item'),
  conditional: z
    .object({ components: z.array(componentDefSchema) })
    .optional()
    .describe('Components to show when this item is selected'),
  condition: z
    .string()
    .trim()
    .optional()
    .describe('Condition that decides if this item is shown'),
  hint: z
    .object({ id: idSchema, text: z.string().trim() })
    .optional()
    .describe('Optional hint text to be shown on the list item')
})

const stringItem = itemBase.extend({
  value: z.string().trim().describe('String value stored when selected')
})

const numberItem = itemBase.extend({
  value: z.number().describe('Numeric value stored when selected')
})

/**
 * Items must be unique by id, text and value, so that an answer maps back to
 * exactly one item.
 */
function uniqueItems(
  items: { id: string; text: string; value: string | number }[],
  ctx: z.RefinementCtx
) {
  uniqueBy<(typeof items)[number]>('id', FormDefinitionError.UniqueListItemId)(
    items,
    ctx
  )
  uniqueBy<(typeof items)[number]>(
    'text',
    FormDefinitionError.UniqueListItemText
  )(items, ctx)
  uniqueBy<(typeof items)[number]>(
    'value',
    FormDefinitionError.UniqueListItemValue
  )(items, ctx)
}

const listBase = z.object({
  id: idSchema,
  name: z
    .string()
    .trim()
    .describe('Name used to reference this list from components'),
  title: z.string().trim().describe('Human-readable title for the list')
})

/**
 * Reusable list of options. Zod picks the member by `type`, so item values
 * are strings or numbers to match.
 */
export const listSchema = z
  .discriminatedUnion('type', [
    listBase.extend({
      type: z.literal('string'),
      items: z.array(stringItem).superRefine(uniqueItems)
    }),
    listBase.extend({
      type: z.literal('number'),
      items: z.array(numberItem).superRefine(uniqueItems)
    })
  ])
  .describe('Reusable list of options for select components')

export type List = z.infer<typeof listSchema>
export type Item = List['items'][number]
