import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('python', [join(root, 'scripts', 'generate-icons.py')], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
})
process.exit(result.status ?? 1)
