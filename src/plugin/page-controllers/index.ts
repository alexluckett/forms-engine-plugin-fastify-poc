import { ControllerType, type Page } from '../../schema/index.js'
import { type FormModel } from '../models/form-model.js'
import { type PageController } from './page-controller.js'
import { QuestionPageController } from './question-page-controller.js'
import { SummaryPageController } from './summary-page-controller.js'

export { PageController } from './page-controller.js'
export { QuestionPageController } from './question-page-controller.js'
export { SummaryPageController } from './summary-page-controller.js'

export function createPage(model: FormModel, pageDef: Page): PageController {
  return pageDef.controller === ControllerType.Summary
    ? new SummaryPageController(model, pageDef)
    : new QuestionPageController(model, pageDef)
}
