import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { emptyToUndefined, rtrimOnly, uniqueBy } from './helpers.js'

describe('uniqueBy', () => {
  const schema = z
    .array(z.object({ name: z.string().optional() }))
    .superRefine(uniqueBy('name'))

  it('reports one issue at the duplicate index', () => {
    const result = schema.safeParse([
      { name: 'a' },
      { name: 'a' },
      { name: 'b' }
    ])

    expect(result.success).toBe(false)
    expect(result.error?.issues).toHaveLength(1)
    expect(result.error?.issues[0]?.path).toEqual([1, 'name'])
  })

  it('ignores items where the key is undefined', () => {
    expect(schema.safeParse([{}, {}, { name: 'a' }]).success).toBe(true)
  })
})

describe('emptyToUndefined', () => {
  const schema = emptyToUndefined(z.number().optional())

  it('turns an empty string into undefined', () => {
    expect(schema.parse('')).toBeUndefined()
  })

  it('keeps other values', () => {
    expect(schema.parse(3)).toBe(3)
  })
})

describe('rtrimOnly', () => {
  it('removes trailing white space only', () => {
    expect(rtrimOnly.parse('  a  ')).toBe('  a')
  })
})
