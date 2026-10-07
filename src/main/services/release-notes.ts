const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

const VERSION_HEADING = /^v?\d+\.\d+\.\d+\S*(?:\s+\(\d{4}-\d{2}-\d{2}\))?$/
const COMMIT_REFERENCE = /\s*\([0-9a-f]{7,40}\)/g

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#')) {
      const codePoint =
        name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity
  })
}

// electron-updater reads GitHub's Atom feed, whose notes are rendered HTML:
// map the structure back to Markdown markers, then drop every other tag.
function htmlToMarkdown(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*h([1-6])\b[^>]*>/gi, (_, level: string) => `\n${'#'.repeat(Number(level))} `)
      .replace(/<\s*li\b[^>]*>/gi, '\n* ')
      .replace(/<\/\s*(?:p|div|h[1-6]|li|ul|ol)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
}

function inlineText(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(COMMIT_REFERENCE, '')
    .trim()
}

/**
 * Turns GitHub release notes (Markdown from the REST API, or HTML from the
 * Atom feed) into plain text for the update banner: section titles on their
 * own line, bullets as "•", links reduced to their text, and the version
 * heading and commit hashes removed since the banner already names the release.
 */
export function formatReleaseNotes(notes: string): string {
  const source = /<\/?[a-z][^>]*>/i.test(notes) ? htmlToMarkdown(notes) : notes
  const output: string[] = []

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = rawLine.trim().match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      const title = inlineText(heading[1])
      if (title && !VERSION_HEADING.test(title)) {
        if (output.length > 0) {
          output.push('')
        }
        output.push(title)
      }
      continue
    }
    const bullet = rawLine.trim().match(/^[*+-]\s+(.*)$/)
    const text = inlineText(bullet ? bullet[1] : rawLine)
    if (text) {
      output.push(bullet ? `• ${text}` : text)
    }
  }
  return output.join('\n')
}
