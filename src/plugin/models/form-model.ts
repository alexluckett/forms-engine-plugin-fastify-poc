import {
  ControllerType,
  isFormComponent,
  type ComponentDef,
  type FormComponentsDef,
  type FormDefinition,
  type List,
  type Page
} from '../../schema/index.js'
import { evaluateCondition } from '../conditions/evaluate.js'
import { type FormState } from '../state.js'

/**
 * The components on a page that collect an answer.
 */
export function fieldsOf(page: Page): FormComponentsDef[] {
  const components: ComponentDef[] = page.components
  return components.filter(isFormComponent)
}

/**
 * A parsed form definition with the page walk the engine needs. V2 forms
 * move through pages in order and skip pages whose condition is false,
 * rather than following `next` links.
 */
export class FormModel {
  readonly definition: FormDefinition
  readonly summaryPage: Page

  constructor(definition: FormDefinition) {
    const summaryPage = definition.pages.find(
      ({ controller }) => controller === ControllerType.Summary
    )

    if (!summaryPage) {
      throw new Error('A form needs a summary page')
    }

    this.definition = definition
    this.summaryPage = summaryPage
  }

  listById(id: string): List | undefined {
    return this.definition.lists.find((list) => list.id === id)
  }

  pageByPath(path: string): Page | undefined {
    const withSlash = path.startsWith('/') ? path : `/${path}`
    return this.definition.pages.find((page) => page.path === withSlash)
  }

  isRelevant(page: Page, state: FormState): boolean {
    return (
      !page.condition ||
      evaluateCondition(page.condition, this.definition, state)
    )
  }

  /**
   * Question pages the user should see for these answers, in order.
   */
  relevantPages(state: FormState): Page[] {
    return this.definition.pages.filter(
      (page) => page !== this.summaryPage && this.isRelevant(page, state)
    )
  }

  nextPath(currentPath: string, state: FormState): string {
    const pages = this.definition.pages
    const index = pages.findIndex(({ path }) => path === currentPath)
    const next = pages
      .slice(index + 1)
      .find((page) => page !== this.summaryPage && this.isRelevant(page, state))

    return next?.path ?? this.summaryPage.path
  }

  firstUnansweredPath(state: FormState): string {
    const unanswered = this.relevantPages(state).find((page) =>
      fieldsOf(page).some(({ name }) => state[name] === undefined)
    )

    return unanswered?.path ?? this.summaryPage.path
  }

  /**
   * Answers from relevant pages only, so that an answer the user gave
   * before changing their route is never shown or submitted.
   */
  relevantAnswers(state: FormState): FormState {
    const answers: FormState = {}

    for (const page of this.relevantPages(state)) {
      for (const { name } of fieldsOf(page)) {
        if (name in state) {
          answers[name] = state[name]
        }
      }
    }

    return answers
  }
}
