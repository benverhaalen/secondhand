// Run before 02_governance.sql. A new governed tag may take a minute to reach CREATE POLICY.
// node databricks/tags.mjs
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createLog } from '../log/index.js'

export const wanted = [
  { tag_key: 'sh_personal', description: 'a column holding a buyer or seller handle; masked by policy sh_mask_handle', values: [{ name: 'handle' }] },
  { tag_key: 'sh_owner', description: 'the column that names whose row this is; filtered by policy sh_owner_only', values: [{ name: 'user_id' }] },
]

export function plan(existing, wanted) {
  const keys = new Set(existing.map(tag => tag.tag_key))
  return wanted.filter(tag => !keys.has(tag.tag_key))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Structured, redacted call evidence goes to stderr; stdout has one status line per tag.
  const log = createLog({ src: 'databricks.tags', build: 'governed-tags-v1', sink: line => process.stderr.write(line + '\n') })
  const cli = args => execFileSync('databricks', ['tag-policies', ...args, '--profile', 'Nate', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const existing = await log.call('tool', 'tag-policies.list-tag-policies', {},
      () => JSON.parse(cli(['list-tag-policies'])), out => ({ count: out.length }))
    const missing = plan(existing, wanted)
    for (const tag of wanted) {
      if (missing.includes(tag)) {
        await log.call('tool', 'tag-policies.create-tag-policy', { tag_key: tag.tag_key },
          () => cli(['create-tag-policy', '--json', JSON.stringify(tag)]), () => ({}))
        log.change('tag_policy', tag.tag_key, 'created')
        process.stdout.write(`${tag.tag_key}: created\n`)
      } else {
        process.stdout.write(`${tag.tag_key}: exists\n`)
      }
    }
    log.end({ ok: true })
  } catch (error) {
    log.end({ ok: false })
    throw error
  }
}
