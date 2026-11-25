import { describe, expect, it } from 'vitest'

import { definitionWith } from '../../../test/fixtures/definitions.js'
import { FormModel } from './form-model.js'

const model = new FormModel(definitionWith(() => undefined))

describe('FormModel', () => {
  it('drops a page whose condition is false', () => {
    const paths = model.relevantPages({ hasPet: 'no' }).map(({ path }) => path)

    expect(paths).toEqual(['/your-name', '/has-pet'])
  })

  it('skips a page whose condition is false when moving on', () => {
    expect(model.nextPath('/has-pet', { hasPet: 'no' })).toBe('/summary')
    expect(model.nextPath('/has-pet', { hasPet: 'yes' })).toBe('/pet-name')
  })

  it('starts at the first page with empty state', () => {
    expect(model.firstUnansweredPath({})).toBe('/your-name')
  })

  it('goes to the summary when every relevant page is answered', () => {
    expect(model.firstUnansweredPath({ fullName: 'Ann', hasPet: 'no' })).toBe(
      '/summary'
    )
  })

  it('keeps only answers from relevant pages', () => {
    expect(
      model.relevantAnswers({ fullName: 'Ann', hasPet: 'no', petName: 'Rex' })
    ).toEqual({ fullName: 'Ann', hasPet: 'no' })
  })

  it('finds a page by a path with or without the leading slash', () => {
    expect(model.pageByPath('has-pet')?.title).toBe('Pets')
  })

  it('needs a summary page', () => {
    const definition = definitionWith((input) => {
      input.pages.pop()
    })

    expect(() => new FormModel(definition)).toThrow('summary page')
  })
})
