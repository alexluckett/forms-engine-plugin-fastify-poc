/**
 * Answers are typed in general terms, as the engine learns a form's fields
 * only when it loads the definition at runtime.
 */
export interface DatePartsValue {
  day: number
  month: number
  year: number
}

export type FormValue = string | number | (string | number)[] | DatePartsValue

export type FormState = Record<string, FormValue | undefined>
