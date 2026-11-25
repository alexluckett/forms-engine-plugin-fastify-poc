import { type PageError } from '../components/index.js'
import { type PageController } from '../page-controllers/page-controller.js'
import { type FormState } from '../state.js'

/**
 * The parts of a request the page walk reads. Kept free of Fastify types,
 * so that the walk is the same code whatever framework hosts it.
 */
export interface FormContextRequest {
  method: 'get' | 'post'
  path: string
  query: Record<string, unknown>
  payload?: Record<string, unknown>
}

/**
 * The result of walking a form for one request, as in the hapi engine.
 */
export interface FormContext {
  /** Answers that conditions see: only from pages walked so far */
  evaluationState: FormState
  /** Answers from relevant pages only; this is what gets submitted */
  relevantState: FormState
  /** Pages walked from the start page up to the current page */
  relevantPages: PageController[]
  /** Values to show in the current page's fields */
  payload: Record<string, unknown>
  /** All stored answers, with a valid posted page merged in */
  state: FormState
  /** Pages the user may open, ending at the first page with errors */
  paths: string[]
  errors?: PageError[]
  /** Preview access to any page with `?force` */
  isForceAccess: boolean
}
