import { gzipSync } from 'node:zlib'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientDir = path.join(root, 'dist', 'client')
const maxEntryGzipBytes = 164 * 1024
const maxWorkerBytes = 90 * 1024

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

const files = await filesUnder(clientDir).catch(() => [])
if (files.length === 0) throw new Error('未找到 dist/client，请先运行 pnpm build。')

const htmlPath = path.join(clientDir, 'index.html')
const html = await readFile(htmlPath, 'utf8')
const scriptPaths = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/g)]
  .map((match) => path.join(clientDir, match[1].replace(/^\/+/, '')))
  .filter((filePath) => files.includes(filePath))
const entryPath = scriptPaths.find((filePath) => path.basename(filePath).startsWith('index-'))
  ?? files.find((filePath) => /^index-[^/]+\.js$/.test(path.basename(filePath)))
if (!entryPath) throw new Error('未找到入口 JavaScript。')

const entry = await readFile(entryPath)
const entryGzipBytes = gzipSync(entry).byteLength
if (entryGzipBytes > maxEntryGzipBytes) {
  throw new Error(`入口 gzip 超出预算：${entryGzipBytes} B > ${maxEntryGzipBytes} B (${path.relative(clientDir, entryPath)})`)
}

const workerPath = files.find((filePath) => /^offline\.worker-[^/]+\.js$/.test(path.basename(filePath)))
if (!workerPath) throw new Error('未找到离线 Worker bundle。')
const workerBytes = (await stat(workerPath)).size
if (workerBytes >= maxWorkerBytes) {
  throw new Error(`离线 Worker 超出预算：${workerBytes} B >= ${maxWorkerBytes} B (${path.relative(clientDir, workerPath)})`)
}

console.log(`bundle budget ok: entry ${entryGzipBytes} B gzip / ${maxEntryGzipBytes} B, worker ${workerBytes} B / ${maxWorkerBytes} B`)
