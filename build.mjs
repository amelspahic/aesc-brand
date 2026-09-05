#!/usr/bin/env node
/**
 * build.mjs — generate the two token files from tokens.json, and REFUSE to if a colour rule broke.
 *
 *     node build.mjs           # write tokens.css and tokens.theme.css
 *     node build.mjs --check   # verify only; exit 1 on drift. CI runs it.
 *
 * Paths in this file's own output are printed relative to your working directory, because these
 * files are authored at `brand/` inside the website and published at the root of their own repo.
 *
 * ## Why TWO output files
 *
 * `tokens.css` is a plain `:root` block. That is what a non-Tailwind consumer wants — a print
 * template, a deck, a plain HTML page, anything that just needs the values.
 *
 * `tokens.theme.css` is a Tailwind `@theme` block, and it is NOT the same file with a different
 * wrapper. Tailwind 4 generates utility classes from the names it finds inside `@theme`; the same
 * declarations in `:root` produce the values and NO CLASSES. A site that imported the `:root`
 * version and deleted its own `@theme` would keep every colour and silently lose `bg-zlato`,
 * `text-hero`, `p-odjeljak` and every other utility built from these names — and because the
 * values would still resolve, the page would look almost right while its borders and grounds
 * quietly vanished. That exact failure has happened in this codebase before (see DESIGN.md §0).
 * Hence two files, from one source, and a check that neither drifts.
 *
 * ## Why a build step for eleven colours
 *
 * Because the contrast law is the part of this identity that is easiest to break and hardest to
 * see. Gold on cream is 1.60:1 — it is not "a bit weak", it is invisible — and every brand guide
 * that states that rule in prose eventually gets ignored by someone in a hurry. Here the rule is
 * executable: `dozvoljeno` lists the pairings that are allowed and the ratio each must clear,
 * `zabranjeno` lists the one that is forbidden, and this script recomputes every one of them from
 * the hex values on every build. Change a colour by two digits and the build tells you which
 * pairing you just broke, by name, before it reaches a page.
 *
 * That is the whole reason tokens.json is the source and tokens.css is generated. Two hand-kept
 * copies of a palette are two palettes.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * How to refer to a file of ours in a message.
 *
 * This directory is authored inside the website as `brand/` and PUBLISHED to its own repository,
 * where the same files sit at the root. A hard-coded "brand/build.mjs" is therefore correct in one
 * checkout and a lie in the other. Deriving it from the caller's working directory prints a path
 * they can actually paste, in both.
 */
const ja = (f) => relative(process.cwd(), join(HERE, f)) || f
const tokens = JSON.parse(readFileSync(join(HERE, 'tokens.json'), 'utf8'))

/* ---- WCAG 2.x relative luminance, on sRGB ------------------------------- */
const channel = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const luminance = (hex) => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/* ---- the law ------------------------------------------------------------ */
const hex = (name) => {
  const c = tokens.boja[name]
  if (!c) throw new Error(`Unknown colour "${name}" in a rule. Colours: ${Object.keys(tokens.boja).join(', ')}`)
  return c.hex
}

const problems = []

for (const rule of tokens.dozvoljeno) {
  const r = contrast(hex(rule.ink), hex(rule.ground))
  if (r < rule.min) {
    problems.push(
      `ALLOWED PAIRING NO LONGER CLEARS ITS FLOOR\n` +
        `    ${rule.ink} on ${rule.ground} — ${r.toFixed(2)}:1, needs ${rule.min}:1\n` +
        `    ${rule.zasto}`,
    )
  }
}

for (const rule of tokens.zabranjeno) {
  const r = contrast(hex(rule.ink), hex(rule.ground))
  // A forbidden pairing that has become legible is not a pass — it means somebody changed a brand
  // colour far enough that the rule no longer describes the palette, and the guide now lies.
  if (r >= 4.5) {
    problems.push(
      `A FORBIDDEN PAIRING IS NOW LEGIBLE, WHICH MEANS THE PALETTE MOVED\n` +
        `    ${rule.ink} on ${rule.ground} — ${r.toFixed(2)}:1\n` +
        `    Re-read the rule before deleting it: "${rule.zasto}"`,
    )
  }
}

if (problems.length) {
  console.error(`
✗ ${ja('tokens.json')} breaks its own colour law:
`)
  for (const p of problems) console.error('  ' + p + '\n')
  process.exit(1)
}

/* ---- emit --------------------------------------------------------------- */
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length))
const tail = (f) => f.fallback.map((x) => (x.includes(' ') ? `'${x}'` : x)).join(', ')

/**
 * One font declaration that is correct in both kinds of project.
 *
 * `var(--font-prikaz-face, 'Bricolage Grotesque')` resolves to whatever `next/font` injected when
 * the consumer self-hosts, and falls back to the plain family name when it does not — so a project
 * that simply links Google Fonts gets the right face from the identical line. Without the fallback
 * the two consumers would need two different stacks, which is two places to forget a face.
 */
const stack = (key, f) => `var(--font-${key}-face, '${f.family}'), ${tail(f)}`

/** The declarations, once. Both output files are this list in a different wrapper. */
function declarations() {
  const out = []
  const push = (name, value, note) => out.push({ name, value, note })

  out.push({ group: 'boja — nikad se ne mijenja po temi' })
  for (const [k, v] of Object.entries(tokens.boja)) push(`--color-${k}`, v.hex)

  out.push({ group: 'pismo' })
  for (const k of ['prikaz', 'tijelo', 'podaci']) push(`--font-${k}`, stack(k, tokens.pismo[k]))

  out.push({ group: 'velicine — clamp() rjesen izmedju 20rem i 80rem' })
  for (const [k, v] of Object.entries(tokens.velicine)) push(`--text-${k}`, v.css, v.px)

  out.push({ group: 'ritam' })
  for (const [k, v] of Object.entries(tokens.ritam)) push(`--spacing-${k}`, v.css, v.px)

  out.push({ group: 'pokret' })
  push('--ease-izlaz', tokens.pokret['ease-izlaz'])
  push('--ease-ulaz', tokens.pokret['ease-ulaz'])

  return out
}

function render(wrapper, banner) {
  const lines = [
    `/* GENERATED by brand/build.mjs from brand/tokens.json — do not edit.`,
    ` *`,
    ` * ${tokens.name} v${tokens.version}. ${banner}`,
    ` *`,
    ` * Every pairing in tokens.json was re-measured when this file was written; the build fails`,
    ` * rather than emit a palette that breaks its own colour law.`,
    ` */`,
    `${wrapper} {`,
  ]
  for (const d of declarations()) {
    if (d.group) {
      if (lines[lines.length - 1] !== `${wrapper} {`) lines.push('')
      lines.push(`  /* ${d.group} */`)
      continue
    }
    lines.push(`  ${pad(d.name + ':', 22)}${d.value};${d.note ? ` /* ${d.note} */` : ''}`)
  }
  lines.push('}')

  // The plain build carries the two widths as well. They are deliberately NOT in the @theme
  // build: `--spacing-mjera` would make Tailwind generate p-mjera, m-mjera, gap-mjera and forty
  // more classes for a value that is only ever a max-width.
  if (wrapper === ':root') {
    lines.splice(lines.length - 1, 0, '', '  /* mjere — nisu spacing skala, vidi napomenu u build.mjs */')
    for (const [k, v] of Object.entries(tokens.mjere)) {
      lines.splice(lines.length - 1, 0, `  ${pad(`--${k}:`, 22)}${v.css};`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

const outputs = [
  {
    file: 'tokens.css',
    body: render(':root', 'Plain custom properties, for any consumer that is not Tailwind.'),
  },
  {
    file: 'tokens.theme.css',
    body: render(
      '@theme',
      'A Tailwind 4 @theme block — this is what generates bg-zlato, text-hero, p-odjeljak and the rest.',
    ),
  },
]

if (process.argv.includes('--check')) {
  let stale = false
  for (const o of outputs) {
    const path = join(HERE, o.file)
    const current = (() => { try { return readFileSync(path, 'utf8') } catch { return null } })()
    if (current !== o.body) {
      console.error(`✗ ${ja(o.file)} is stale. Run: node ${ja('build.mjs')}`)
      stale = true
    }
  }
  if (stale) process.exit(1)
  console.log(
    `✓ tokens.css and tokens.theme.css current · ` +
      `${tokens.dozvoljeno.length} pairings clear their floor · ` +
      `${tokens.zabranjeno.length} forbidden pairing still forbidden`,
  )
} else {
  for (const o of outputs) {
    writeFileSync(join(HERE, o.file), o.body)
    console.log(`✓ wrote ${ja(o.file)}`)
  }
  console.log(`\n  ${tokens.dozvoljeno.length} allowed pairings re-measured, all clear:`)
  for (const r of tokens.dozvoljeno) {
    console.log(`    ${pad(`${r.ink} on ${r.ground}`, 30)} ${contrast(hex(r.ink), hex(r.ground)).toFixed(2)}:1`)
  }
  for (const r of tokens.zabranjeno) {
    console.log(`  forbidden, and still unreadable as required:`)
    console.log(`    ${pad(`${r.ink} on ${r.ground}`, 30)} ${contrast(hex(r.ink), hex(r.ground)).toFixed(2)}:1`)
  }
}
