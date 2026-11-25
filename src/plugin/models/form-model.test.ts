import { describe, expect, it } from 'vitest'

import { definitionWith } from '../../../test/fixtures/definitions.js'
import { ids } from '../../../test/fixtures/valid-definition.js'
import { FormModel } from './form-model.js'
import { type FormContextRequest } from './types.js'

const model = new FormModel(
  definitionWith(() => undefined),
  {
    basePath: '/fixture-form'
  }
)

const get = (path: string, query = {}): FormContextRequest => ({
  method: 'get',
  path,
  query
})

const paths = (pages: { path: string }[]) => pages.map(({ path }) => path)

describe('FormModel.getFormContext', () => {
  it('stops the paths at the first page whose answers are missing', () => {
    const context = model.getFormContext(get('/pet-name'), {})

    expect(context.paths).toEqual(['/your-name'])
  })

  it('walks every relevant page up to the current page', () => {
    const context = model.getFormContext(get('/summary'), {
      fullName: 'Ann',
      hasPet: 'no'
    })

    expect(paths(context.relevantPages)).toEqual([
      '/your-name',
      '/has-pet',
      '/summary'
    ])
    expect(context.paths).toEqual(['/your-name', '/has-pet', '/summary'])
  })

  it('leaves answers from skipped pages out of the relevant state', () => {
    const context = model.getFormContext(get('/summary'), {
      fullName: 'Ann',
      hasPet: 'no',
      petName: 'Rex'
    })

    expect(context.relevantState).toEqual({ fullName: 'Ann', hasPet: 'no' })
  })

  it('evaluates conditions only on answers from pages it has walked', () => {
    const context = model.getFormContext(get('/your-name'), {
      fullName: 'Ann',
      hasPet: 'yes'
    })

    expect(context.evaluationState).toEqual({
      fullName: 'Ann',
      hasPet: undefined,
      petName: undefined
    })
  })

  it('marks force access from the query string', () => {
    expect(
      model.getFormContext(get('/pet-name', { force: '' }), {}).isForceAccess
    ).toBe(true)
  })

  it('validates a posted page and merges its answers into the state', () => {
    const context = model.getFormContext(
      {
        method: 'post',
        path: '/your-name',
        query: {},
        payload: { action: 'validate', fullName: 'Ann' }
      },
      {}
    )

    expect(context.errors).toBeUndefined()
    expect(context.state).toEqual({ fullName: 'Ann' })
  })

  it('reports a list answer that a changed answer no longer offers', () => {
    const conditional = new FormModel(
      definitionWith((input) => {
        const namedBob = '7c3e5b6a-2f2c-4e0a-9d9d-3b2b4c5d6e01'
        input.conditions.push({
          id: namedBob,
          displayName: 'Named Bob',
          items: [
            {
              componentId: ids.fullName,
              operator: 'is',
              type: 'StringValue',
              value: 'Bob'
            }
          ]
        })
        input.lists[0].items[0].condition = namedBob
      }),
      { basePath: '/fixture-form' }
    )

    const context = conditional.getFormContext(get('/summary'), {
      fullName: 'Ann',
      hasPet: 'yes'
    })

    expect(context.errors).toContainEqual({
      name: 'hasPet',
      href: '#hasPet',
      text: 'Options are different because you changed a previous answer'
    })
    expect(context.paths.at(-1)).toBe('/has-pet')
  })
})

describe('QuestionPageController', () => {
  it('goes from a page to the next page whose condition is true', () => {
    const page = model.pageByPath('/has-pet')
    const context = model.getFormContext(get('/has-pet'), {
      fullName: 'Ann',
      hasPet: 'no'
    })

    expect(page?.getNextPath(context)).toBe('/summary')
  })

  it('goes from the summary page to the status page', () => {
    const page = model.pageByPath('/summary')

    expect(page?.getNextPath(model.getFormContext(get('/summary'), {}))).toBe(
      '/status'
    )
  })
})
