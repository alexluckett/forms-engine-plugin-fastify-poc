import { z } from 'zod'

import { type Page } from '../../schema/index.js'
import { createField, type Field } from '../components/index.js'
import { fieldsOf, type FormModel } from '../models/form-model.js'
import { type FormContext } from '../models/types.js'
import { type FormState } from '../state.js'

export const ControllerPath = {
  Summary: '/summary',
  Status: '/status'
} as const

/**
 * Shared page behaviour, ported from the hapi engine's `PageController`.
 */
export abstract class PageController {
  readonly model: FormModel
  readonly pageDef: Page
  readonly fields: Field[]

  constructor(model: FormModel, pageDef: Page) {
    this.model = model
    this.pageDef = pageDef
    this.fields = fieldsOf(pageDef).flatMap(
      (def) => createField(def, model) ?? []
    )
  }

  get path() {
    return this.pageDef.path
  }

  get title() {
    return this.pageDef.title
  }

  get href() {
    return this.getHref(this.path)
  }

  /** State keys this page owns */
  get keys() {
    return this.fields.map(({ name }) => name)
  }

  /** The page's executable condition, if it has one */
  get condition() {
    return this.pageDef.condition
      ? this.model.conditions[this.pageDef.condition]
      : undefined
  }

  /**
   * Schema for this page's stored answers. The form schema for a set of
   * pages joins these, as the hapi engine's `collection.stateSchema` does.
   */
  get stateSchema() {
    return z.object(
      Object.fromEntries(
        this.fields.map((field) => [field.name, field.stateSchema()])
      )
    )
  }

  getHref(path: string) {
    return `${this.model.basePath}${path}`
  }

  /** V2 forms start at their first page */
  getStartPath() {
    return this.model.definition.pages[0]?.path ?? '/'
  }

  getSummaryPath(): string {
    return ControllerPath.Summary
  }

  getStatusPath(): string {
    return ControllerPath.Status
  }

  /**
   * The last page the user may open; requests for later pages go here.
   */
  getRelevantPath(context: FormContext) {
    const { paths } = context
    const startPath = this.getStartPath()
    const relevantPath = paths.at(-1) ?? startPath

    return !paths.length ? startPath : relevantPath
  }

  /**
   * Apply conditions to evaluation state to determine next page path.
   * V2 forms take the first later page that has no condition or whose
   * condition is true, rather than following `next` links.
   */
  getNextPath(context: FormContext): string | undefined {
    const { pages } = this.model
    const { evaluationState } = context

    const defaultPath =
      this.path === this.getSummaryPath() ? this.getStatusPath() : undefined

    const pageIndex = pages.indexOf(this)
    const nextPage = pages.slice(pageIndex + 1).find((page) => {
      const { condition } = page
      return !condition || condition.fn(evaluationState)
    })

    return nextPage?.path ?? defaultPath
  }

  /** Values to show in this page's fields from stored answers */
  getFormDataFromState(state: FormState): Record<string, unknown> {
    return Object.fromEntries(
      this.fields.map(({ name }) => [name, state[name]] as const)
    )
  }
}
