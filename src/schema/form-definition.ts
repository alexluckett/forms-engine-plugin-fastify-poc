import { z } from 'zod'

import { conditionalComponentTypes, type ComponentDef } from './components.js'
import {
  conditionWrapperSchema,
  isConditionData,
  type ConditionWrapperV2
} from './conditions.js'
import { ConditionType } from './enums.js'
import { FormDefinitionError, FormDefinitionErrorType } from './errors.js'
import { uniqueBy } from './helpers.js'
import { listSchema, type List } from './lists.js'
import { pageSchema, type Page } from './pages.js'
import { idSchema } from './components.js'

export {
  type ConditionDataV2,
  type ConditionListItemRefValueDataV2,
  type ConditionRefDataV2,
  type ConditionWrapperV2,
  isConditionData
} from './conditions.js'
export { type Item, type List } from './lists.js'
export {
  MAX_NUMBER_OF_REPEAT_ITEMS,
  MIN_NUMBER_OF_REPEAT_ITEMS,
  type Page,
  type Repeat
} from './pages.js'

const emailAddress = z.email().trim()

const sectionSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().describe('Identifier used in page references'),
    title: z.string().trim().describe('Section title displayed to users'),
    hideTitle: z
      .boolean()
      .default(false)
      .describe('When true, the section title is not displayed')
  })
  .describe('A form section grouping related pages together')

const outputSchema = z
  .object({
    emailAddress: emailAddress.describe('Where form submissions are sent'),
    audience: z
      .enum(['human', 'machine'])
      .describe('Target audience for the output'),
    version: z.string().trim().describe('Version of the output format'),
    condition: z
      .string()
      .trim()
      .optional()
      .describe('Condition that decides if submissions go to this output')
  })
  .describe('Configuration for a single submission email target')

type Output = z.infer<typeof outputSchema>

/**
 * Outputs are unique by address, audience and version together, so that the
 * same submission is never sent twice to one inbox.
 */
function uniqueOutputs(outputs: Output[], ctx: z.RefinementCtx) {
  const seen = new Set<string>()

  outputs.forEach((output, index) => {
    const key = `${output.emailAddress}|${output.audience}|${output.version}`

    if (seen.has(key)) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: `Email address ${output.emailAddress} is already receiving the same submissions`,
        params: {
          errorCode: FormDefinitionError.UniqueOutput,
          errorType: FormDefinitionErrorType.Unique
        }
      })
    }

    seen.add(key)
  })
}

type Path = (string | number)[]

/**
 * Checks that every id one part of the definition uses exists in another
 * part. This runs on the whole parsed definition, so that each check can see
 * the pages, lists and conditions together.
 */
function checkReferences(
  definition: {
    pages: Page[]
    lists: List[]
    conditions: ConditionWrapperV2[]
    outputs?: Output[] | undefined
  },
  ctx: z.RefinementCtx
) {
  const report = (path: Path, errorCode: FormDefinitionError) => {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Invalid reference (${errorCode})`,
      params: {
        errorCode,
        errorType: errorCode.startsWith('incompatible')
          ? FormDefinitionErrorType.Incompatible
          : FormDefinitionErrorType.Ref
      }
    })
  }

  const conditionIds = new Set(definition.conditions.map(({ id }) => id))
  const listsById = new Map(definition.lists.map((list) => [list.id, list]))
  const componentsById = new Map<string, ComponentDef>(
    definition.pages.flatMap((page) =>
      page.components.map((component) => [component.id, component] as const)
    )
  )

  definition.pages.forEach((page, pageIndex) => {
    if (page.condition && !conditionIds.has(page.condition)) {
      report(
        ['pages', pageIndex, 'condition'],
        FormDefinitionError.RefPageCondition
      )
    }

    page.components.forEach((component, componentIndex) => {
      if ('list' in component && !listsById.has(component.list)) {
        report(
          ['pages', pageIndex, 'components', componentIndex, 'list'],
          FormDefinitionError.RefPageComponentList
        )
      }
    })
  })

  definition.conditions.forEach((wrapper, wrapperIndex) => {
    wrapper.items.forEach((item, itemIndex) => {
      const path: Path = ['conditions', wrapperIndex, 'items', itemIndex]

      if (!isConditionData(item)) {
        if (!conditionIds.has(item.conditionId)) {
          report(
            [...path, 'conditionId'],
            FormDefinitionError.RefConditionConditionId
          )
        }
        return
      }

      const component = componentsById.get(item.componentId)

      if (!component) {
        report(
          [...path, 'componentId'],
          FormDefinitionError.RefConditionComponentId
        )
      } else if (!conditionalComponentTypes.includes(component.type)) {
        report(path, FormDefinitionError.IncompatibleConditionComponentType)
      }

      if (item.type === ConditionType.ListItemRef) {
        const list = listsById.get(item.value.listId)

        if (!list) {
          report(
            [...path, 'value', 'listId'],
            FormDefinitionError.RefConditionListId
          )
          return
        }

        item.value.itemId.forEach((itemId, index) => {
          if (!list.items.some(({ id }) => id === itemId)) {
            report(
              [...path, 'value', 'itemId', index],
              FormDefinitionError.RefConditionItemId
            )
          }
        })
      }
    })
  })

  definition.outputs?.forEach((output, index) => {
    if (output.condition && !conditionIds.has(output.condition)) {
      report(
        ['outputs', index, 'condition'],
        FormDefinitionError.RefOutputCondition
      )
    }
  })
}

/**
 * The V2 form definition. Every type the engine uses for a definition is
 * inferred from this schema.
 */
export const formDefinitionSchema = z
  .object({
    engine: z
      .literal('V2')
      .default('V2')
      .describe('Form engine version to use'),
    schema: z.literal(2).describe('Form schema version'),
    name: z
      .string()
      .trim()
      .optional()
      .describe('Unique name identifying the form'),
    feedback: z
      .object({
        url: z.string().trim().optional(),
        emailAddress: emailAddress.optional()
      })
      .optional()
      .describe('Feedback mechanism configuration'),
    startPage: z
      .string()
      .trim()
      .optional()
      .describe('Path of the first page to show when starting the form'),
    pages: z
      .array(pageSchema)
      .superRefine(uniqueBy('id', FormDefinitionError.UniquePageId))
      .superRefine(uniqueBy('path', FormDefinitionError.UniquePagePath))
      .describe('Pages, in the order a user moves through them'),
    sections: z
      .array(sectionSchema)
      .superRefine(uniqueBy('id', FormDefinitionError.UniqueSectionId))
      .superRefine(uniqueBy('name', FormDefinitionError.UniqueSectionName))
      .superRefine(uniqueBy('title', FormDefinitionError.UniqueSectionTitle))
      .describe('Sections grouping related pages together'),
    conditions: z
      .array(conditionWrapperSchema)
      .superRefine(uniqueBy('id', FormDefinitionError.UniqueConditionId))
      .superRefine(
        uniqueBy('displayName', FormDefinitionError.UniqueConditionDisplayName)
      )
      .default([])
      .describe('Named conditions used for form logic'),
    lists: z
      .array(listSchema)
      .superRefine(uniqueBy('id', FormDefinitionError.UniqueListId))
      .superRefine(uniqueBy('name', FormDefinitionError.UniqueListName))
      .superRefine(uniqueBy('title', FormDefinitionError.UniqueListTitle))
      .default([])
      .describe('Reusable lists of options for select components'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Custom metadata for the form'),
    declaration: z
      .string()
      .trim()
      .optional()
      .describe('Declaration text shown on the summary page'),
    phaseBanner: z
      .object({ phase: z.enum(['alpha', 'beta']).optional() })
      .optional()
      .describe('Phase banner configuration'),
    options: z
      .object({
        showReferenceNumber: z.boolean().default(false),
        disableUserFeedback: z.boolean().default(false)
      })
      .optional()
      .describe('Options for the form'),
    outputEmail: emailAddress
      .optional()
      .describe('Email address where form submissions are sent'),
    output: z
      .object({
        audience: z.enum(['human', 'machine']),
        version: z.string().trim()
      })
      .optional()
      .describe('Configuration for submission output format'),
    outputs: z
      .array(outputSchema)
      .superRefine(uniqueOutputs)
      .optional()
      .describe('One or more email targets for submission emails')
  })
  .superRefine(checkReferences)
  .describe('Complete form definition describing all aspects of a form')

export type FormDefinition = z.infer<typeof formDefinitionSchema>
export type FormDefinitionInput = z.input<typeof formDefinitionSchema>
