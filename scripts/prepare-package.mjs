import { readFile, writeFile } from 'node:fs/promises'

const mainBundle = new URL('../out/main/index.js', import.meta.url)
const developmentCheck = 'process.env.NODE_ENV !== "production"'
const source = await readFile(mainBundle, 'utf8')
const occurrences = source.split(developmentCheck).length - 1

if (occurrences !== 1) {
  throw new Error(`Expected one production logger guard in out/main/index.js, found ${occurrences}`)
}

await writeFile(mainBundle, source.replace(developmentCheck, 'false'))
