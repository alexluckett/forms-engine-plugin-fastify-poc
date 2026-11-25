import { z } from 'zod'

import {
  ControllerType,
  isFormComponent,
  type ComponentDef,
  type FormComponentsDef,
  type FormDefinition,
  type List,
  type Page
} from '../../schema/index.js'
import { parsePage, type Field, type PageError } from '../components/index.js'
import { evaluateCondition } from '../conditions/evaluate.js'
import { createPage, type PageController } from '../page-controllers/index.js'
import { type FormState } from '../state.js'
import { type FormContext, type FormContextRequest } from './types.js'

/**
 * The components on a page that collect an answer.
 */
export function fieldsOf(page: Page): FormComponentsDef[] {
  const components: ComponentDef[] = page.components
  return components.filter(isFormComponent)
}

export interface ExecutableCondition {
  fn: (evaluationState: FormState) => boolean
}

const optionsMismatch =
  'Options are different because you changed a previous answer'

/**
 * A parsed form definition with the page walk, ported from the hapi
 * engine's `FormModel`. Joi schemas become Zod schemas; the walk is the same.
 */
export class FormModel {
  readonly definition: FormDefinition
  readonly basePath: string
  readonly slug: string
  readonly conditions: Partial<Record<string, ExecutableCondition>>
  readonly pages: PageController[]

  constructor(
    definition: FormDefinition,
    { basePath, slug = '' }: { basePath: string; slug?: string }
  ) {
    if (
      !definition.pages.some(
        ({ controller }) => controller === ControllerType.Summary
      )
    ) {
      throw new Error('A form needs a summary page')
    }

    this.definition = definition
    this.basePath = basePath
    this.slug = slug
    this.conditions = Object.fromEntries(
      definition.conditions.map(({ id }) => [
        id,
        {
          fn: (evaluationState: FormState) =>
            evaluateCondition(id, definition, evaluationState)
        }
      ])
    )
    this.pages = definition.pages.map((page) => createPage(this, page))
  }

  listById(id: string): List | undefined {
    return this.definition.lists.find((list) => list.id === id)
  }

  pageByPath(path: string): PageController | undefined {
    const withSlash = path.startsWith('/') ? path : `/${path}`
    return this.pages.find((page) => page.path === withSlash)
  }

  /**
   * Builds the schema for the stored answers of a set of pages, so that
   * answers for pages no longer reachable are left out.
   */
  makeFilteredSchema(relevantPages: PageController[]) {
    return relevantPages.reduce<z.ZodObject>(
      (schema, page) => schema.extend(page.stateSchema.shape),
      z.object({})
    )
  }

  /**
   * Form context for the current page
   */
  getFormContext(
    request: FormContextRequest,
    state: FormState,
    errors?: PageError[]
  ): FormContext {
    const page = this.pageByPath(request.path)

    if (!page) {
      throw new Error(`No page at ${request.path}`)
    }

    const currentPath = page.path
    const startPath = page.getStartPath()

    // Preview URL direct access is allowed
    const isForceAccess = 'force' in request.query

    let context: FormContext = {
      evaluationState: {},
      relevantState: {},
      relevantPages: [],
      payload: page.getFormDataFromState(state),
      state,
      paths: [],
      errors,
      isForceAccess
    }

    // Validate current page
    context = validateFormPayload(request, page, context)

    // Find start page
    let nextPage = this.pageByPath(startPath)

    this.initialiseContext(context)

    // Walk form pages from start
    while (nextPage) {
      // Add page to context
      context.relevantPages.push(nextPage)

      this.assignEvaluationState(context, nextPage)

      this.assignRelevantState(context, nextPage)

      // Stop at current page
      if (
        this.pageStateIsInvalid(context, nextPage) ||
        nextPage.path === currentPath
      ) {
        break
      }

      // Apply conditions to determine next page
      const nextPath = nextPage.getNextPath(context)
      nextPage = nextPath ? this.pageByPath(nextPath) : undefined
    }

    // Validate form state
    context = validateFormState(page, context)

    // Add paths for navigation
    this.assignPaths(context)

    return context
  }

  /**
   * Starts every field as unanswered, so that a condition on a page that is
   * not reached sees no answer.
   */
  private initialiseContext(context: FormContext) {
    for (const page of this.pages) {
      for (const key of page.keys) {
        context.evaluationState[key] = undefined
      }
    }
  }

  private assignEvaluationState(context: FormContext, page: PageController) {
    for (const key of page.keys) {
      context.evaluationState[key] = context.state[key]
    }
  }

  private assignRelevantState(context: FormContext, page: PageController) {
    // Copy relevant state by expected keys
    for (const key of page.keys) {
      if (typeof context.state[key] !== 'undefined') {
        context.relevantState[key] = context.state[key]
      }
    }
  }

  /**
   * True when a list answer on the page is no longer one of the options,
   * because an earlier answer hid that option with a condition.
   */
  private pageStateIsInvalid(context: FormContext, page: PageController) {
    for (const field of page.fields) {
      const { list } = field

      if (list?.items.some((item) => item.condition)) {
        if (this.fieldStateIsInvalid(context, field, list)) {
          return true
        }
      }
    }

    return false
  }

  private fieldStateIsInvalid(context: FormContext, field: Field, list: List) {
    const { evaluationState, state } = context
    const items: { value: string | number; condition?: string | undefined }[] =
      list.items

    const validValues = items
      .filter((item) =>
        item.condition
          ? (this.conditions[item.condition]?.fn(evaluationState) ?? false)
          : true
      )
      .map((item) => item.value)

    const fieldState = state[field.name]

    if (fieldState === undefined) {
      return false
    }

    const isInvalid = Array.isArray(fieldState)
      ? !fieldState.every((item) => validValues.includes(item))
      : !(
          (typeof fieldState === 'string' || typeof fieldState === 'number') &&
          validValues.includes(fieldState)
        )

    if (isInvalid) {
      context.errors ??= []
      context.errors.push({
        name: field.name,
        href: field.errorHref,
        text: optionsMismatch
      })
    }

    return isInvalid
  }

  private assignPaths(context: FormContext) {
    for (const { keys, path } of context.relevantPages) {
      context.paths.push(path)

      // Stop at page with errors
      if (context.errors?.some(({ name }) => keys.includes(name))) {
        break
      }
    }
  }
}

/**
 * Validate current page only
 */
function validateFormPayload(
  request: FormContextRequest,
  page: PageController,
  context: FormContext
): FormContext {
  const { payload } = request
  const action = payload?.action

  // Skip validation for GET requests or other actions
  if (!payload || (action && action !== 'validate')) {
    return context
  }

  const result = parsePage(page.fields, payload)
  const posted = Object.fromEntries(
    page.fields.map((field) => [field.name, field.fromBody(payload)] as const)
  )

  if (!result.success) {
    return {
      ...context,
      payload: { ...context.payload, ...posted },
      errors: result.errors
    }
  }

  return {
    ...context,
    payload: { ...context.payload, ...posted },
    state: { ...context.state, ...result.data }
  }
}

/**
 * Validate entire form state
 */
function validateFormState(
  page: PageController,
  context: FormContext
): FormContext {
  const { errors = [], relevantPages, relevantState } = context

  // Exclude current page
  const previousPages = relevantPages.filter(
    (relevantPage) => relevantPage !== page
  )

  // Validate relevant state
  const result = page.model
    .makeFilteredSchema(previousPages)
    .safeParse(relevantState)

  // Add relevant state errors
  if (!result.success) {
    const stateErrors = result.error.issues.flatMap((issue) => {
      const field = previousPages
        .flatMap(({ fields }) => fields)
        .find(({ name }) => name === issue.path[0])

      return field
        ? [{ name: field.name, href: field.errorHref, text: issue.message }]
        : []
    })

    return { ...context, errors: errors.concat(stateErrors) }
  }

  return context
}
