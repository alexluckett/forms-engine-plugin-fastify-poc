import { formsEnginePlugin } from './plugin/plugin.js'

export default formsEnginePlugin
export { formsEnginePlugin }
export {
  pluginOptionsSchema,
  type FormsService,
  type OutputService,
  type PluginOptions,
  type Submission
} from './plugin/options.js'
export { type FormState, type FormValue } from './plugin/state.js'
export * from './schema/index.js'
