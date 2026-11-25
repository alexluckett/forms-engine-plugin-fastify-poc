import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import {
  ComponentType,
  GeospatialFieldGeometryTypesEnum,
  GeospatialFieldOptionsCountryEnum,
  TelephoneNumberFieldOptionsFormatEnum
} from './enums.js'
import { FormDefinitionError, FormDefinitionErrorType } from './errors.js'
import { emptyToUndefined, rtrimOnly } from './helpers.js'

/**
 * Unique id that the schema creates when it is missing, so that hand-written
 * definitions can leave it out.
 */
export const idSchema = z
  .uuid()
  .default(() => randomUUID())
  .describe('Unique identifier (UUID)')

const fieldName = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]+$/)
  .describe('Unique identifier for the component, used in form data')

const optionalNumber = emptyToUndefined(z.number().optional())

const isoDate = emptyToUndefined(z.iso.date().optional())

/**
 * Regex text that must compile, so that a bad pattern is found when the form
 * is saved rather than when a user submits the page.
 */
const regexSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    try {
      new RegExp(value)
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'The regex expression is invalid',
        params: {
          errorCode: FormDefinitionError.IncompatibleQuestionRegex,
          errorType: FormDefinitionErrorType.Incompatible
        }
      })
    }
  })
  .optional()
  .describe('Regex expression for validation of user field content')

const minMaxLength = z.object({
  min: optionalNumber.describe('Minimum value or length for validation'),
  max: optionalNumber.describe('Maximum value or length for validation'),
  length: optionalNumber.describe('Exact length required for validation')
})

const minMax = z.object({ min: optionalNumber, max: optionalNumber })

const mapLayers = z
  .object({
    sssi: z
      .boolean()
      .optional()
      .describe('Sites of Special Scientific Interest layer')
  })
  .optional()
  .describe('Supported map layers')

const countries = z
  .array(z.enum(GeospatialFieldOptionsCountryEnum))
  .optional()
  .describe('Country filters for geospatial data')

/**
 * Options that every form field accepts.
 */
const fieldOptions = z.object({
  required: z
    .boolean()
    .optional()
    .describe('When false, the user can leave the field empty'),
  optionalText: z
    .boolean()
    .optional()
    .describe('When true, hides "(optional)" after the label'),
  classes: z.string().optional().describe('Extra CSS classes for the input'),
  customValidationMessages: z
    .record(z.string(), z.string())
    .optional()
    .describe('Custom error messages keyed by validation rule name'),
  instructionText: z
    .string()
    .optional()
    .describe('Markdown instructions shown above the field')
})

const condition = z
  .string()
  .optional()
  .describe('Condition that reveals the field')

const customValidationMessage = z
  .string()
  .trim()
  .optional()
  .describe('Custom error message that replaces every validation message')

/**
 * Properties shared by every form field, with `type` fixed to one literal so
 * that the union can pick the right member by `type`.
 */
function field<T extends ComponentType>(type: T) {
  return z.object({
    id: idSchema,
    type: z.literal(type),
    shortDescription: rtrimOnly
      .optional()
      .describe('Short description of the component used in the summary'),
    errorDescription: rtrimOnly
      .optional()
      .describe('Description that will be displayed in error messages'),
    name: fieldName,
    title: z.string().trim().describe('Label displayed above the component'),
    hint: z
      .string()
      .trim()
      .optional()
      .describe('Additional guidance text displayed below the title')
  })
}

/**
 * Properties shared by display-only components, which have no answer and so
 * an optional name and title.
 */
function content<T extends ComponentType>(type: T) {
  return z.object({
    id: idSchema,
    type: z.literal(type),
    name: fieldName.optional(),
    title: z.string().trim().optional().describe('Optional title')
  })
}

const listFieldOptions = fieldOptions.extend({
  type: z
    .enum(['string', 'number', 'boolean'])
    .optional()
    .describe('Data type of the list values')
})

/**
 * Properties shared by fields whose answers come from a list.
 */
function listField<T extends ComponentType>(type: T) {
  return field(type).extend({
    list: z
      .string()
      .trim()
      .describe('Id of the list that gives the options for this field')
  })
}

export const textFieldSchema = field(ComponentType.TextField).extend({
  options: fieldOptions
    .extend({
      autocomplete: z.string().optional(),
      condition,
      customValidationMessage
    })
    .default({}),
  schema: minMaxLength.extend({ regex: regexSchema }).default({})
})

export const multilineTextFieldSchema = field(
  ComponentType.MultilineTextField
).extend({
  options: fieldOptions
    .extend({
      autocomplete: z.string().optional(),
      condition,
      customValidationMessage,
      rows: optionalNumber.describe('Number of rows for the textarea'),
      maxWords: optionalNumber.describe('Maximum number of words allowed')
    })
    .default({}),
  schema: minMaxLength.extend({ regex: regexSchema }).default({})
})

export const emailAddressFieldSchema = field(
  ComponentType.EmailAddressField
).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage })
    .default({})
})

export const numberFieldSchema = field(ComponentType.NumberField).extend({
  options: fieldOptions
    .extend({
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      autocomplete: z.string().optional(),
      condition,
      customValidationMessage
    })
    .default({}),
  schema: z
    .object({
      min: optionalNumber.describe('Lowest number allowed'),
      max: optionalNumber.describe('Highest number allowed'),
      precision: optionalNumber.describe('Most decimal places allowed'),
      minPrecision: optionalNumber,
      minLength: optionalNumber,
      maxLength: optionalNumber
    })
    .default({})
})

export const telephoneNumberFieldSchema = field(
  ComponentType.TelephoneNumberField
).extend({
  options: fieldOptions
    .extend({
      condition,
      format: z
        .enum(TelephoneNumberFieldOptionsFormatEnum)
        .optional()
        .describe('Format for the telephone number'),
      customValidationMessage
    })
    .default({})
})

export const fileUploadFieldSchema = field(
  ComponentType.FileUploadField
).extend({
  options: fieldOptions.extend({ accept: z.string().optional() }).default({}),
  schema: minMaxLength.default({})
})

export const yesNoFieldSchema = field(ComponentType.YesNoField).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage })
    .default({})
})

export const declarationFieldSchema = field(
  ComponentType.DeclarationField
).extend({
  content: z.string().describe('Declaration text the user must agree to'),
  options: fieldOptions
    .extend({
      condition,
      declarationConfirmationLabel: z.string().optional()
    })
    .default({})
})

export const ukAddressFieldSchema = field(ComponentType.UkAddressField).extend({
  options: fieldOptions
    .extend({
      hideTitle: z.boolean().optional(),
      usePostcodeLookup: z.boolean().optional()
    })
    .default({})
})

export const eastingNorthingFieldSchema = field(
  ComponentType.EastingNorthingField
).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage, mapLayers, countries })
    .default({}),
  schema: z
    .object({ easting: minMax.optional(), northing: minMax.optional() })
    .default({})
})

export const osGridRefFieldSchema = field(ComponentType.OsGridRefField).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage, mapLayers })
    .default({})
})

export const nationalGridFieldNumberFieldSchema = field(
  ComponentType.NationalGridFieldNumberField
).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage })
    .default({})
})

export const latLongFieldSchema = field(ComponentType.LatLongField).extend({
  options: fieldOptions
    .extend({ condition, customValidationMessage, mapLayers })
    .default({}),
  schema: z
    .object({ latitude: minMax.optional(), longitude: minMax.optional() })
    .default({})
})

export const hiddenFieldSchema = field(ComponentType.HiddenField).extend({
  options: fieldOptions.extend({ condition }).default({})
})

export const trackingFieldSchema = field(ComponentType.TrackingField).extend({
  options: fieldOptions.extend({ condition }).default({})
})

export const datePartsFieldSchema = field(ComponentType.DatePartsField).extend({
  options: fieldOptions
    .extend({
      condition,
      maxDaysInPast: optionalNumber.describe(
        'Maximum days in the past allowed'
      ),
      maxDaysInFuture: optionalNumber.describe(
        'Maximum days in the future allowed'
      ),
      earliestDate: isoDate.describe('Earliest date allowed (YYYY-MM-DD)'),
      latestDate: isoDate.describe('Latest date allowed (YYYY-MM-DD)')
    })
    .default({})
})

export const monthYearFieldSchema = field(ComponentType.MonthYearField).extend({
  options: fieldOptions
    .extend({
      customValidationMessage,
      earliestMonthYear: z.string().optional(),
      latestMonthYear: z.string().optional()
    })
    .default({})
})

export const paymentFieldSchema = field(ComponentType.PaymentField).extend({
  options: fieldOptions.extend({
    amount: z
      .number()
      .min(0)
      .max(100000)
      .describe('Payment amount in GBP (£0 - £100,000)'),
    description: z
      .string()
      .max(230)
      .describe('Payment description (max 230 chars)'),
    conditionalAmounts: z
      .array(
        z.object({
          condition: z.string().trim().describe('Condition ID for this amount'),
          amount: z
            .number()
            .min(0.3)
            .max(100000)
            .describe('Amount in GBP when the condition is true (min £0.30)')
        })
      )
      .optional()
      .describe('Conditional payment amounts evaluated in order'),
    emailField: z
      .string()
      .trim()
      .optional()
      .describe('Name of EmailAddressField to prepopulate GOV.UK Pay email')
  })
})

export const geospatialFieldSchema = field(
  ComponentType.GeospatialField
).extend({
  options: fieldOptions
    .extend({
      condition,
      countries,
      geometryTypes: z
        .array(z.enum(GeospatialFieldGeometryTypesEnum))
        .optional()
        .describe('Geometry types for geospatial data'),
      mapLayers
    })
    .default({}),
  schema: minMaxLength.default({})
})

export const autocompleteFieldSchema = listField(
  ComponentType.AutocompleteField
).extend({
  options: listFieldOptions.extend({ condition }).default({})
})

export const checkboxesFieldSchema = listField(
  ComponentType.CheckboxesField
).extend({
  options: listFieldOptions
    .extend({ bold: z.boolean().optional(), condition })
    .default({}),
  schema: minMaxLength.default({})
})

export const radiosFieldSchema = listField(ComponentType.RadiosField).extend({
  options: listFieldOptions
    .extend({ bold: z.boolean().optional(), condition })
    .default({})
})

export const selectFieldSchema = listField(ComponentType.SelectField).extend({
  options: listFieldOptions
    .extend({ autocomplete: z.string().optional(), condition })
    .default({})
})

const contentText = z.string().describe('Content shown to the user')

export const detailsSchema = content(ComponentType.Details).extend({
  content: contentText,
  options: z.object({ condition }).default({})
})

export const htmlSchema = content(ComponentType.Html).extend({
  content: contentText,
  options: z.object({ condition }).default({})
})

export const markdownSchema = content(ComponentType.Markdown).extend({
  content: contentText,
  options: z.object({ condition }).default({})
})

export const insetTextSchema = content(ComponentType.InsetText).extend({
  content: contentText
})

export const listComponentSchema = content(ComponentType.List).extend({
  hint: z.string().trim().optional(),
  list: z.string().trim().describe('Id of the list to display'),
  options: z
    .object({
      type: z.enum(['bulleted', 'numbered']).optional(),
      classes: z.string().optional(),
      hideTitle: z.boolean().optional(),
      bold: z.boolean().optional()
    })
    .default({})
})

export const notificationBannerSchema = content(
  ComponentType.NotificationBanner
).extend({
  content: contentText,
  options: z
    .object({
      type: z.literal('success').optional(),
      heading: z.string().optional(),
      condition
    })
    .default({})
})

/**
 * Every component a page can hold. Zod picks the member by `type`, so each
 * member checks only its own options and the inferred type narrows the same
 * way in code.
 */
export const componentDefSchema = z
  .discriminatedUnion('type', [
    textFieldSchema,
    multilineTextFieldSchema,
    emailAddressFieldSchema,
    numberFieldSchema,
    telephoneNumberFieldSchema,
    fileUploadFieldSchema,
    yesNoFieldSchema,
    declarationFieldSchema,
    ukAddressFieldSchema,
    eastingNorthingFieldSchema,
    osGridRefFieldSchema,
    nationalGridFieldNumberFieldSchema,
    latLongFieldSchema,
    hiddenFieldSchema,
    trackingFieldSchema,
    datePartsFieldSchema,
    monthYearFieldSchema,
    paymentFieldSchema,
    geospatialFieldSchema,
    autocompleteFieldSchema,
    checkboxesFieldSchema,
    radiosFieldSchema,
    selectFieldSchema,
    detailsSchema,
    htmlSchema,
    markdownSchema,
    insetTextSchema,
    listComponentSchema,
    notificationBannerSchema
  ])
  .describe('Form component definition specifying UI element behaviour')

export type ComponentDef = z.infer<typeof componentDefSchema>
export type ComponentDefInput = z.input<typeof componentDefSchema>

export type ComponentDefByType<T extends ComponentType> = Extract<
  ComponentDef,
  { type: T }
>

export type TextFieldComponent = ComponentDefByType<ComponentType.TextField>
export type NumberFieldComponent = ComponentDefByType<ComponentType.NumberField>
export type EmailAddressFieldComponent =
  ComponentDefByType<ComponentType.EmailAddressField>
export type RadiosFieldComponent = ComponentDefByType<ComponentType.RadiosField>
export type CheckboxesFieldComponent =
  ComponentDefByType<ComponentType.CheckboxesField>
export type DatePartsFieldComponent =
  ComponentDefByType<ComponentType.DatePartsField>

const contentTypes = [
  ComponentType.Details,
  ComponentType.Html,
  ComponentType.InsetText,
  ComponentType.List,
  ComponentType.Markdown,
  ComponentType.NotificationBanner
] as const

export type ContentComponentsDef = ComponentDefByType<
  (typeof contentTypes)[number]
>
export type FormComponentsDef = Exclude<ComponentDef, ContentComponentsDef>

/**
 * True for components that collect an answer.
 */
export function isFormComponent(def: ComponentDef): def is FormComponentsDef {
  return !contentTypes.some((type) => type === def.type)
}

/**
 * Component types that a condition can test.
 */
export const conditionalComponentTypes: readonly ComponentType[] = [
  ComponentType.AutocompleteField,
  ComponentType.RadiosField,
  ComponentType.CheckboxesField,
  ComponentType.DatePartsField,
  ComponentType.EmailAddressField,
  ComponentType.MultilineTextField,
  ComponentType.TelephoneNumberField,
  ComponentType.NumberField,
  ComponentType.SelectField,
  ComponentType.TextField,
  ComponentType.YesNoField,
  ComponentType.DeclarationField
]
