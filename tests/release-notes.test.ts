import { expect, test } from 'vitest'
import { formatReleaseNotes } from '@main/services/release-notes'

// v4.2.0 notes as returned by the GitHub REST API (pacman mode).
const markdownNotes = `## [4.2.0](https://github.com/lachaux-remi/StreamDeckDeeJ-App/compare/v4.1.0...v4.2.0) (2026-10-06)


### Fonctionnalités

* **electron:** upgrade to Electron 44.5.1 while keeping the Linux tray working on KDE Wayland ([#62](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/62)) ([d5fb45f](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d5fb45f1a855e0c2196aa663da97cca9ead7c58a))
* **updater:** add verified Windows NSIS updates ([#50](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/50)) ([1c9c5bb](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1c9c5bbb4d7de9c6105e666fb797e6dd80de0fe5))


### Corrections de bugs

* **ci:** run release signing from main ([#46](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/46)) ([479bc10](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/479bc1068d6d579031ed421edab0cb1d41f10ced))
`

// The same notes as rendered HTML in the Atom feed read by electron-updater.
const htmlNotes = `<h2><a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/compare/v4.1.0...v4.2.0">4.2.0</a> (2026-10-06)</h2>
<h3>Fonctionnalités</h3>
<ul>
<li><strong>electron:</strong> upgrade to Electron 44.5.1 while keeping the Linux tray working on KDE Wayland (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/62" data-hovercard-type="pull_request">#62</a>) (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d5fb45f1a855e0c2196aa663da97cca9ead7c58a">d5fb45f</a>)</li>
<li><strong>updater:</strong> add verified Windows NSIS updates (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/50">#50</a>) (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1c9c5bbb4d7de9c6105e666fb797e6dd80de0fe5">1c9c5bb</a>)</li>
</ul>
<h3>Corrections de bugs</h3>
<ul>
<li><strong>ci:</strong> run release signing from main (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/46">#46</a>) (<a href="https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/479bc1068d6d579031ed421edab0cb1d41f10ced">479bc10</a>)</li>
</ul>`

const readableNotes = `Fonctionnalités
• electron: upgrade to Electron 44.5.1 while keeping the Linux tray working on KDE Wayland (#62)
• updater: add verified Windows NSIS updates (#50)

Corrections de bugs
• ci: run release signing from main (#46)`

test('renders Release Please Markdown notes as readable text', () => {
  expect(formatReleaseNotes(markdownNotes)).toBe(readableNotes)
})

test('renders the Atom feed HTML notes to the same readable text', () => {
  expect(formatReleaseNotes(htmlNotes)).toBe(readableNotes)
})

test('decodes HTML entities and never keeps markup', () => {
  const formatted = formatReleaseNotes(
    '<p>Fix &lt;script&gt; &amp; &quot;quotes&quot; &#39;x&#39; &#x2713;<script>alert(1)</script></p>'
  )
  expect(formatted).toBe('Fix <script> & "quotes" \'x\' ✓alert(1)')
  expect(formatReleaseNotes('<img src=x onerror=alert(1)>Hello')).toBe('Hello')
})

test('keeps plain text notes and non-version headings unchanged', () => {
  expect(formatReleaseNotes('Security fixes')).toBe('Security fixes')
  expect(formatReleaseNotes('# Highlights\nFaster `startup`\n\n- one\n- two')).toBe(
    'Highlights\nFaster startup\n• one\n• two'
  )
  expect(formatReleaseNotes('')).toBe('')
})
