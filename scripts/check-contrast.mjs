// Confere o contraste das cores do tema, no CLARO e no ESCURO (`src/theme/palette.ts`).
//
//   node scripts/check-contrast.mjs
//
// O modo é constante por carga (`src/theme/mode.ts`), então cada tema roda num processo
// próprio (`PF2E_THEME=light|dark`), e este script chama a si mesmo duas vezes.
//
// O que confere (WCAG, 4,5:1 para texto):
//   - toda tinta de TEXTO do conteúdo (`ink`, `gold.deep`, `greenInk`, `status`, os acentos
//     semânticos, a tinta dos graus de troféu) sobre `parchment.paper` (o fundo dos cartões, onde
//     está quase todo texto); sobre `parchment.page` e `parchment.sunken`, 3:1 (fundo da página e
//     faixas rebaixadas, que levam rótulo e chip);
//   - a tinta da moldura (`chrome.*`, `onFrame`) sobre `green.deepest`, `green.main` e os
//     degraus do `chrome`;
//   - o texto sobre acento cheio (`onSolid`) sobre cada acento.
// Sai com código 1 se algum par falhar.
//
// O tema claro é o de sempre e não muda (regra da casa, como o português do `tr()`). Os pares
// dele que já estavam abaixo do mínimo antes do tema escuro ficam em `LIGHT_KNOWN`: saem como
// aviso, não como falha. Cor NOVA no claro não entra na lista — tem de passar.

import { spawnSync } from 'node:child_process'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

if (!process.env.PF2E_THEME) {
    let failed = false
    for (const theme of ['light', 'dark']) {
        const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
            stdio: 'inherit',
            env: { ...process.env, PF2E_THEME: theme },
        })
        if (r.status !== 0) failed = true
    }
    process.exit(failed ? 1 : 0)
}

register('./ts-loader.mjs', import.meta.url)
const P = await import('../src/theme/palette.ts')

const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
}

const theme = process.env.PF2E_THEME
const failures = []
const known = []
let checked = 0
/** Pares do claro abaixo do mínimo desde antes do tema escuro (`cor/fundo`). */
const LIGHT_KNOWN = new Set([
    'status.warning/parchment.paper', 'status.warning/parchment.sunken', 'status.success/parchment.paper',
    'TRADITION.divine/parchment.paper', 'TYPE_ACCENT.item/parchment.paper', 'RANK.8/parchment.paper',
])
const check = (fgName, fg, bgName, bg, min = 4.5) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(fg) || !/^#[0-9A-Fa-f]{6}$/.test(bg)) {
        failures.push(`${fgName} (${fg}) / ${bgName} (${bg}): não é hex de 6 dígitos`)
        return
    }
    checked++
    const r = ratio(fg, bg)
    if (r >= min) return
    const msg = `${fgName} ${fg} sobre ${bgName} ${bg}: ${r.toFixed(2)}:1 (mínimo ${min}:1)`
    if (theme === 'light' && LIGHT_KNOWN.has(`${fgName}/${bgName}`)) known.push(msg)
    else failures.push(msg)
}

// --- Texto sobre o conteúdo ---
const contentInk = {
    'ink.primary': P.ink.primary,
    'ink.secondary': P.ink.secondary,
    'gold.deep': P.gold.deep,
    'greenInk.main': P.greenInk.main,
    'greenInk.mid': P.greenInk.mid,
    ...Object.fromEntries(Object.entries(P.status).map(([k, v]) => [`status.${k}`, v])),
    ...Object.fromEntries(Object.entries(P.TRADITION_COLORS).map(([k, v]) => [`TRADITION.${k}`, v])),
    ...Object.fromEntries(Object.entries(P.RARITY_COLORS).map(([k, v]) => [`RARITY.${k}`, v])),
    ...Object.fromEntries(Object.entries(P.TYPE_ACCENT).map(([k, v]) => [`TYPE_ACCENT.${k}`, v])),
    ...Object.fromEntries(Object.entries(P.TROPHY_TIERS).map(([k, v]) => [`TROPHY.${k}.ink`, v.ink])),
    ...Object.fromEntries(Object.entries(P.RANK_COLORS).filter(([k]) => k !== '0').map(([k, v]) => [`RANK.${k}`, v])),
    MYTHIC_COLOR: P.MYTHIC_COLOR,
    HP_COLOR: P.HP_COLOR,
    RAGE_COLOR: P.RAGE_COLOR,
    PSYCHE_COLOR: P.PSYCHE_COLOR,
    ROGUE_COLOR: P.ROGUE_COLOR,
    RANGER_COLOR: P.RANGER_COLOR,
    MONK_COLOR: P.MONK_COLOR,
    INVESTIGATOR_COLOR: P.INVESTIGATOR_COLOR,
    MAGUS_COLOR: P.MAGUS_COLOR,
    SHIELD_COLOR: P.SHIELD_COLOR,
    CONDITION_COLOR: P.CONDITION_COLOR,
}
for (const [name, fg] of Object.entries(contentInk)) {
    check(name, fg, 'parchment.paper', P.parchment.paper)
    check(name, fg, 'parchment.page', P.parchment.page, 3)
    check(name, fg, 'parchment.sunken', P.parchment.sunken, 3)
}
check('ONLINE_BADGE.text', P.ONLINE_BADGE.text, 'ONLINE_BADGE.bg', P.ONLINE_BADGE.bg)
for (const [k, v] of Object.entries(P.TROPHY_TIERS)) check(`TROPHY.${k}.ink`, v.ink, `TROPHY.${k}.tint`, v.tint)

// --- Texto sobre a moldura ---
const frames = { 'green.deepest': P.green.deepest, 'chrome.raised': P.chrome.raised, 'chrome.active': P.chrome.active, 'green.main': P.green.main }
for (const [bgName, bg] of Object.entries(frames)) {
    check('chrome.text', P.chrome.text, bgName, bg)
    check('chrome.textSoft', P.chrome.textSoft, bgName, bg)
    check('onFrame.paper', P.onFrame.paper, bgName, bg)
    check('onFrame.page', P.onFrame.page, bgName, bg)
    check('gold.bright', P.gold.bright, bgName, bg)
}
check('chrome.textMuted', P.chrome.textMuted, 'green.deepest', P.green.deepest)
check('chrome.label', P.chrome.label, 'green.deepest', P.green.deepest)

// --- Texto sobre acento cheio (chips das faixas, pip livre, botão "Beber") ---
for (const name of ['RAGE_COLOR', 'PSYCHE_COLOR', 'RANGER_COLOR', 'MONK_COLOR', 'INVESTIGATOR_COLOR', 'MAGUS_COLOR', 'HP_COLOR', 'CONDITION_COLOR']) {
    check('onSolid', P.onSolid, name, P[name], 4.5)
}
// O ícone branco sobre o ladrilho de cada tipo de página da Wiki.
for (const [k, v] of Object.entries(P.WIKI_KIND_COLORS)) check('chrome.onAccent', P.chrome.onAccent, `WIKI_KIND.${k}`, v, 4.5)
// O link "criar" no cartão escuro da Wiki: o sublinhado tracejado sobre o herói (filete, 3:1).
check('chrome.linkMissing', P.chrome.linkMissing, 'chrome.hero', P.chrome.hero, 3)
// O botão do MUI com o primário: `contrastText` (o pergaminho) sobre o verde de tinta.
check('primary.contrastText', P.parchment.paper, 'greenInk.main', P.greenInk.main)

if (known.length) {
    console.warn(`! tema ${theme}: ${known.length} pares conhecidos abaixo do mínimo (o claro de sempre)`)
    for (const k of known) console.warn('  · ' + k)
}
if (failures.length) {
    console.error(`✗ tema ${theme}: ${failures.length} de ${checked} pares abaixo do mínimo`)
    for (const f of failures) console.error('  - ' + f)
    process.exit(1)
}
console.log(`✓ tema ${theme}: ${checked} pares com contraste suficiente`)
