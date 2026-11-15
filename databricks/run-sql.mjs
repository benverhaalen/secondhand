// Runs each statement of one or more .sql files in order on the Nate workspace, stopping at the first failure.
// node databricks/run-sql.mjs <file.sql>...   (statements end with ';' at a line end; '--' lines are comments)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export function statements(text) {
  return text.split(/;\s*$/m).map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()).filter(Boolean)
}

export function query(sql) {
  let out
  try {
    out = execFileSync('databricks', ['experimental', 'aitools', 'tools', 'query', sql, '--profile', 'Nate', '--output', 'json'],
      { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(`${sql.slice(0, 120)}\n${e.stdout || ''}${e.stderr || ''}`)
  }
  return out.trim().startsWith('[') ? JSON.parse(out) : []   // one statement: exit code 1 on failure, rows as a JSON array on success
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  for (const f of process.argv.slice(2)) for (const s of statements(readFileSync(f, 'utf8'))) {
    const t = Date.now()
    query(s)
    console.log(`ok ${Date.now() - t}ms  ${s.split('\n')[0].slice(0, 100)}`)
  }
}
