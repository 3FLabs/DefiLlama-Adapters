const { execFileSync } = require('child_process')

const MODIFIED = parse(process.env.MODIFIED)
const ADDED = parse(process.env.ADDED)
const fileSet = new Set();

[...MODIFIED, ...ADDED].forEach(file => {
  const [root, dir] = file.split('/')
  if (dir === 'treasury' || dir === 'entities') fileSet.add(file)
  else if (root === 'projects' && dir !=='helper' && dir !== 'config') fileSet.add(root + '/' + dir)
  else if (root === 'registries' && file.endsWith('.js') && dir !== 'index.js' && dir !== 'utils.js') {
    // `file` and the base revision both originate from the pull request, so the
    // diff is executed with an argument array instead of a shell string: a
    // filename containing shell metacharacters must never be interpreted as
    // shell syntax (CWE-78). `--` keeps a path that starts with `-` from being
    // parsed as an option.
    const diffBase = process.env.DIFF_BASE || 'HEAD~1'
    const diff = execFileSync('git', ['diff', diffBase, '--', file]).toString()
    const lines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))
    for (const line of lines) {
      const match = line.match(/['"]([a-zA-Z0-9][a-zA-Z0-9_-]+)['"]\s*:/)
      if (match) fileSet.add(match[1])
    }
  }
})

console.log(JSON.stringify([...fileSet]))

function parse(data) {
  if (!data) return []
  // The file-changes action emits a JSON array. Parse it properly so quote
  // characters never leak into the paths (the previous string surgery kept
  // the quotes inside each entry). The lenient fallback below tolerates a
  // bare comma- or space-separated list.
  try {
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) return parsed.map((f) => String(f).trim()).filter(Boolean)
  } catch (e) {
    // not strict JSON: fall through to lenient parsing
  }
  return data
    .replace(/[\[\]"]/g, '')
    .split(/[,\s]+/)
    .map((f) => f.trim())
    .filter(Boolean)
}
