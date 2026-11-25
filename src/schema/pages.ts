import { z } from 'zod'

import {
  componentDefSchema,
  fileUploadFieldSchema,
  htmlSchema,
  idSchema,
  insetTextSchema,
  markdownSchema,
  detailsSchema,
  listComponentSchema,
  notificationBannerSchema
} from './components.js'
import { ComponentType, ControllerType } from './enums.js'
import { FormDefinitionError } from './errors.js'
import { uniqueBy } from './helpers.js'

export const MIN_NUMBER_OF_REPEAT_ITEMS = 1
export const MAX_NUMBER_OF_REPEAT_ITEMS = 200

const linkSchema = z.object({
  path: z.string().trim().describe('The target page path'),
  condition: z.string().trim().optional(),
  redirect: z.string().trim().optional()
})

const eventSchema = z.object({
  type: z.literal('http').describe('Type of the event handler'),
  options: z.object({
    method: z.literal('POST'),
    url: z.url({ protocol: /^https?$/ })
  })
})

const componentsSchema = z
  .array(componentDefSchema)
  .superRefine(uniqueBy('id', FormDefinitionError.UniquePageComponentId))
  .superRefine(uniqueBy('name', FormDefinitionError.UniquePageComponentName))
  .default([])
  .describe('UI components displayed on this page')

const pageBase = z.object({
  id: idSchema,
  path: z
    .string()
    .trim()
    .refine((path) => path !== '/status', {
      error: 'The /status path is reserved'
    })
    .describe('URL path for this page; "/status" is reserved'),
  title: z.string().trim().describe('Page title displayed at the top'),
  section: z.string().trim().optional().describe('Section this page is in'),
  condition: z
    .string()
    .trim()
    .optional()
    .describe('Condition that decides if this page is shown'),
  next: z
    .array(linkSchema)
    .default([])
    .describe('V1 navigation links; V2 forms use page order instead'),
  events: z
    .object({ onLoad: eventSchema.optional(), onSave: eventSchema.optional() })
    .optional()
    .describe('Event handlers for page lifecycle events'),
  view: z.string().trim().optional().describe('Custom view template'),
  components: componentsSchema
})

export const repeatSchema = z
  .object({
    options: z.object({
      name: z.string().trim().describe('Identifier for the repeated section'),
      title: z.string().trim().describe('Title shown for each repeated item')
    }),
    schema: z
      .object({
        min: z.number().min(MIN_NUMBER_OF_REPEAT_ITEMS),
        max: z.number().max(MAX_NUMBER_OF_REPEAT_ITEMS)
      })
      .refine(({ min, max }) => max >= min, {
        path: ['max'],
        error: 'max must be the same as or more than min'
      })
  })
  .describe('Configuration for a repeatable page')

const uploadPageComponents = z
  .array(
    z.discriminatedUnion('type', [
      fileUploadFieldSchema,
      detailsSchema,
      htmlSchema,
      markdownSchema,
      insetTextSchema,
      listComponentSchema,
      notificationBannerSchema
    ])
  )
  .min(1)
  .max(2)
  .refine(
    (components) =>
      components.filter((c) => c.type === ComponentType.FileUploadField)
        .length === 1,
    { error: 'A file upload page needs exactly one FileUploadField' }
  )

/**
 * A page. Zod picks the member by `controller`, so a repeat page must carry
 * `repeat` and a file upload page limits its components.
 */
export const pageSchema = z
  .discriminatedUnion('controller', [
    pageBase.extend({
      controller: z.literal(ControllerType.Repeat),
      repeat: repeatSchema
    }),
    pageBase.extend({
      controller: z.literal(ControllerType.FileUpload),
      components: uploadPageComponents
    }),
    pageBase.extend({
      controller: z
        .literal([
          ControllerType.Start,
          ControllerType.Page,
          ControllerType.Terminal,
          ControllerType.Summary,
          ControllerType.SummaryWithConfirmationEmail,
          ControllerType.Status
        ])
        .optional()
    })
  ])
  .describe('Form page definition specifying content and behaviour')

export type Page = z.infer<typeof pageSchema>
export type Repeat = z.infer<typeof repeatSchema>
