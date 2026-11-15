// Asks the Genie space each judge question and writes what it answered, with its SQL, to databricks/genie-answers.md.
// node databricks/genie/ask.mjs        (spends warehouse time: one query per question)
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const SPACE = '01f1e0d8d8d3161fa9590e55702c1b46'
export const QUESTIONS = [
  'What is the Adidas Yeezy Boost 350 V2 Zebra worth, and which sales does that rest on?',
  'How did our price do against the last sale and the 90-day median on the same sales?',
  'Which price engine does the app serve, and how does it compare with the last sale?',
  'Which weight moved, and on what evidence?',
  'How many sales did each source contribute, and under what rights?',
  'What is the median sold price among the earliest 10 StockX sales?',
  'What is the median sold price of a Yeezy on Depop?',
  'Which core tables are locked to their owner, and which columns are masked?',
]

// One answer as markdown: Genie's words, then the SQL it ran.
export function section(question, message) {
  const parts = (message.attachments ?? []).flatMap(a => [
    a.text?.content ? a.text.content.trim() : null,
    a.query?.query ? '```sql\n' + a.query.query.trim() + '\n```' : null,
  ]).filter(Boolean)
  const error = message.error ? `Error: ${message.error.error ?? JSON.stringify(message.error)}` : null
  return [`## ${question}`, `Status: ${message.status}`, ...parts, ...(error ? [error] : [])].join('\n\n')
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const out = [
    `# Genie's answers to the judge questions`,
    `Asked ${new Date().toISOString()} of the space secondhand market (${SPACE}) by \`node databricks/genie/ask.mjs\`. Every figure is a development reading on historical public sales (StockX 2017 to 2019 and the other public datasets), never accuracy on live listings. The workspace backtest scores the nightly market model, which the app does not serve; the served engine is \`measures.engine_ablation\`.`,
  ]
  for (const q of QUESTIONS) {
    const raw = execFileSync('databricks', ['genie', 'start-conversation', SPACE, q, '--profile', 'Nate', '-o', 'json'],
      { encoding: 'utf8', maxBuffer: 16 << 20 })
    const message = JSON.parse(raw)
    out.push(section(q, message))
  }
  writeFileSync(new URL('../genie-answers.md', import.meta.url), out.join('\n\n') + '\n')
}
