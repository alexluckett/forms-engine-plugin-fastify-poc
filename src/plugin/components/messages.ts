import { lowerFirst } from '../views.js'

/**
 * Error message text, matching the hapi engine's English messages.
 */
export const messages = {
  required: (label: string) => `Enter ${lowerFirst(label)}`,
  selectRequired: (label: string) => `Select ${lowerFirst(label)}`,
  format: (label: string) => `Enter ${lowerFirst(label)} in the correct format`,
  pattern: (label: string) => `Enter a valid ${lowerFirst(label)}`,
  max: (label: string, limit: number) =>
    `${label} must be ${limit} characters or less`,
  min: (label: string, limit: number) =>
    `${label} must be ${limit} characters or more`,
  length: (label: string, limit: number) =>
    `${label} must be ${limit} characters`,
  number: (label: string) => `${label} must be a number`,
  numberMin: (label: string, limit: number) =>
    `${label} must be ${limit} or higher`,
  numberMax: (label: string, limit: number) =>
    `${label} must be ${limit} or lower`,
  dateFormat: (title: string) => `${title} must be a real date`,
  objectMissing: (title: string, part: string) =>
    `${title} must include a ${lowerFirst(part)}`
}
