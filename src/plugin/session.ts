import { type FastifyRequest } from 'fastify'

import '../types/fastify.js'
import { type FormState } from './state.js'

export function getState(request: FastifyRequest, slug: string): FormState {
  return request.session.get('forms')?.[slug] ?? {}
}

export function setState(
  request: FastifyRequest,
  slug: string,
  state: FormState
) {
  request.session.set('forms', {
    ...request.session.get('forms'),
    [slug]: state
  })
}

export function clearState(request: FastifyRequest, slug: string) {
  const { [slug]: _cleared, ...rest } = request.session.get('forms') ?? {}
  request.session.set('forms', rest)
}

export function getReference(request: FastifyRequest, slug: string) {
  return request.session.get('references')?.[slug]
}

export function setReference(
  request: FastifyRequest,
  slug: string,
  reference: string
) {
  request.session.set('references', {
    ...request.session.get('references'),
    [slug]: reference
  })
}
