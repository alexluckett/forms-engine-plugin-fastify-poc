import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

import { beforeAll, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const devserver = join(root, 'src/devserver')

describe('devserver', () => {
  it('imports the plugin only through the package entry', async () => {
    const files = (await readdir(devserver, { recursive: true })).filter(
      (file) => file.endsWith('.ts')
    )
    const outside: string[] = []

    for (const file of files) {
      const text = await readFile(join(devserver, file), 'utf8')

      for (const [, specifier = ''] of text.matchAll(/from '(\.[^']+)'/g)) {
        const target = relative(root, resolve(devserver, file, '..', specifier))
        const allowed =
          target === 'src/index.js' || target.startsWith('src/devserver/')

        if (!allowed) {
          outside.push(`${file} -> ${specifier}`)
        }
      }
    }

    expect(outside).toEqual([])
  })
})

describe('package', () => {
  let files: string[] = []

  beforeAll(async () => {
    await run('npm', ['run', 'build'], { cwd: root })
    // A private npm cache, so that the check does not depend on the state
    // of the user's own cache folder.
    const { stdout } = await run('npm', ['pack', '--dry-run', '--json'], {
      cwd: root,
      env: { ...process.env, npm_config_cache: join(tmpdir(), 'pack-cache') }
    })
    const [pack] = JSON.parse(stdout) as [{ files: { path: string }[] }]
    files = pack.files.map(({ path }) => path)
  }, 120_000)

  it('leaves out the devserver, tests and sources', () => {
    expect(
      files.filter(
        (path) =>
          path.includes('devserver') ||
          path.includes('.test.') ||
          path.startsWith('src/')
      )
    ).toEqual([])
  })

  it('ships the entry points, schema and views', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        '.server/index.js',
        '.server/index.d.ts',
        '.server/schema/index.js',
        '.server/types/fastify.d.ts',
        '.server/plugin/views/question.html'
      ])
    )
  })
})
