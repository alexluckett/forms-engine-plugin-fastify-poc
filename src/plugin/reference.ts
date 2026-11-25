import { randomInt } from 'node:crypto'

const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * A reference such as `K7Q-2MX-9PD`. Letters and numbers that look alike
 * (I, O, 0, 1) are left out, so that users can read it back by phone.
 */
export function generateReference() {
  const group = () =>
    Array.from(
      { length: 3 },
      () => characters[randomInt(characters.length)]
    ).join('')

  return [group(), group(), group()].join('-')
}
