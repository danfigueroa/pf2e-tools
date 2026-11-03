// Guia "Como Jogar" de uma ficha publicada, gerado pela cadeia de IA.
//
// Histórico da decisão: os guias nasceram escritos à mão (`combatGuides.ts`), e
// gerar por IA tinha sido vetado. Mudou quando os jogadores passaram a publicar
// a própria ficha depois do level-up: o guia curado continuava aparecendo,
// descrevendo o personagem do nível anterior, e ninguém o reescrevia. Agora a
// ficha publicada ganha um guia gerado na hora.
//
// Quando existe um guia anterior (o curado à mão, ou o gerado para a versão
// passada), ele entra no prompt como BASE: a IA atualiza em vez de começar do
// zero, então a tática que alguém já revisou sobrevive ao level-up.
//
// Dois idiomas: o guia em inglês é GERADO a partir da ficha, com o prompt em inglês —
// nunca uma tradução do português (decisão do usuário: a fonte é a ficha e a AON, que já
// são em inglês). A publicação pede os dois juntos (`sheet-handler.js`).

import { runChainedPrompt } from './aon.js'
import { MAX_GUIDE_BYTES } from './sheet-store.js'

// Chaves do export que só ocupam token: dinheiro, formatação do Pathbuilder e
// listas de proficiência específica que o guia nunca usa.
const DROP_KEYS = new Set(['money', 'specificProficiencies', 'formula', 'lores', 'mods', 'keyability'])

function compactBuild(json) {
  const b = json?.build ?? {}
  const out = {}
  for (const [k, v] of Object.entries(b)) {
    if (DROP_KEYS.has(k)) continue
    if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    out[k] = v
  }
  return JSON.stringify(out)
}

const SECTIONS = [
  '## 🎯 Papel em Combate',
  '## 🔁 Rotina de Turno',
  '## ⭐ Nunca Esqueça',
  '## ✨ Magias e Recursos',
  '## 🎒 Itens',
  '## 🛡️ Defesa e Sobrevivência',
  '## ⚠️ Erros Comuns',
]

const SECTIONS_EN = [
  '## 🎯 Combat Role',
  '## 🔁 Turn Routine',
  '## ⭐ Never Forget',
  '## ✨ Spells and Resources',
  '## 🎒 Items',
  '## 🛡️ Defense and Survival',
  '## ⚠️ Common Mistakes',
]

function buildPromptEn(json, baseGuide) {
  const baseSections = baseGuide ? (String(baseGuide).match(/^## .*$/gm) || []).map((h) => h.trim()) : []
  const sectionRule = baseSections.length >= 3
    ? `use EXACTLY these sections, in this order: ${baseSections.join(' | ')}.`
    : `use this order: ${SECTIONS_EN.join(' | ')}, skipping "✨ Spells and Resources" if the character has no spells nor daily resources.`
  const base = baseGuide
    ? `\n\nPREVIOUS GUIDE for this character (written for an earlier version of the sheet). Use it as a BASE: keep the tactics that still apply, fix what the new sheet changed (level, feats, spells, items, numbers) and add what is new. Do not copy old numbers without checking them against the sheet:\n\n${String(baseGuide).slice(0, MAX_GUIDE_BYTES)}`
    : ''

  return `You are a veteran Pathfinder 2e Remaster player writing a practical "how to play" guide for this character in combat, for the player to read at the table on their phone.

Write in English. Use the official Remaster names of feats, spells, items, actions and conditions (Strike, Stride, Demoralize, off-guard, frightened…), exactly as they appear on the sheet.

FORMAT (mandatory — the app only understands this):
- Section titles starting with "## "; ${sectionRule}
- Lists with "- " at the start of the line.
- Bold with **text**. No tables, links, italics, "###" headings or code blocks.
- With a previous guide, keep the same level of detail and a similar length — do not summarize. Without one, between 450 and 900 words. Short, actionable sentences, citing the sheet's real numbers (AC, HP, attack bonus, DCs).

RULES:
- Use ONLY what is on the sheet below and the Remaster rules.
- NEVER describe the mechanical effect of a feat, spell or item you are not absolutely sure about — an invented effect at the table is worse than none. When in doubt, name it, say WHEN to use it and tell the player to tap it on the sheet to read the rule.
- Do not invent numeric bonuses: only numbers that are on the sheet or in the previous guide.
- In the routine, say what to do with the 3 actions on typical turns, citing the feats the sheet has.
- Return ONLY the guide in markdown, with no introduction nor closing comment.

SHEET (Pathbuilder JSON):
${compactBuild(json)}${base}`
}

function buildPrompt(json, baseGuide) {
  // As seções do guia anterior, ditas explicitamente: só "siga as seções dele"
  // não bastou — o modelo voltava à lista padrão e perdia "⚡ Poderes Míticos".
  const baseSections = baseGuide ? (String(baseGuide).match(/^## .*$/gm) || []).map((h) => h.trim()) : []
  const sectionRule = baseSections.length >= 3
    ? `use EXATAMENTE estas seções, nesta ordem: ${baseSections.join(' | ')}.`
    : `use nesta ordem: ${SECTIONS.join(' | ')}, pulando "✨ Magias e Recursos" se o personagem não tiver magia nem recurso por dia.`
  const base = baseGuide
    ? `\n\nGUIA ANTERIOR deste personagem (escrito para uma versão anterior da ficha). Use-o como BASE: mantenha a tática que continua valendo, corrija o que a ficha nova mudou (nível, talentos, magias, itens, números) e acrescente o que é novo. Não copie números antigos sem conferir na ficha:\n\n${String(baseGuide).slice(0, MAX_GUIDE_BYTES)}`
    : ''

  return `Você é um jogador veterano de Pathfinder 2e Remaster escrevendo um guia prático de "como jogar" este personagem em combate, para o próprio jogador ler na mesa pelo celular.

Escreva em português brasileiro. Mantenha em inglês os nomes próprios de talentos, magias, itens, ações e condições (Strike, Stride, Demoralize, off-guard, frightened…), exatamente como aparecem na ficha.

FORMATO (obrigatório — o app só entende isto):
- Títulos de seção começando com "## "; ${sectionRule}
- Listas com "- " no início da linha.
- Negrito com **texto**. Nada de tabelas, links, itálico, títulos "###" ou blocos de código.
- Havendo guia anterior, mantenha o mesmo nível de detalhe e tamanho parecido — não resuma. Sem ele, entre 450 e 900 palavras. Frases curtas, acionáveis, citando os números reais da ficha (CA, PV, bônus de ataque, CDs).

REGRAS:
- Use SOMENTE o que está na ficha abaixo e as regras do Remaster.
- NUNCA descreva o efeito mecânico de um talento, magia ou item de que você não tenha certeza absoluta — um efeito inventado na mesa é pior que nenhum. Na dúvida, cite o nome, diga QUANDO usar e mande o jogador tocar nele na ficha para ler a regra.
- Não invente bônus numéricos: números só os que estão na ficha ou no guia anterior.
- Na rotina, diga o que fazer com as 3 ações nos turnos típicos, citando os talentos que a ficha tem.
- Devolva APENAS o guia em markdown, sem introdução nem comentário final.

FICHA (JSON do Pathbuilder):
${compactBuild(json)}${base}`
}

/** Guia plausível: começa por seção, tem várias seções e tamanho de guia. */
export function looksLikeGuide(text) {
  const t = String(text || '').trim()
  const sections = (t.match(/^## /gm) || []).length
  return t.startsWith('## ') && sections >= 4 && t.length >= 1200
}

/** Tira cercas de código e preâmbulo que alguns modelos insistem em pôr. */
function tidy(text) {
  let t = String(text || '').trim()
  t = t.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim()
  const first = t.indexOf('## ')
  if (first > 0) t = t.slice(first)
  // Itálico (*x* ou _x_) apesar de o prompt proibir: o `GuideMarkdown` só
  // entende **negrito**, e o asterisco solto aparecia cru na tela.
  // Lista com "* " ou "1. " também escapa do renderizador, que só lê "- ".
  t = t
    .replace(/^(\s*)(?:\*|\d+\.)\s+/gm, '$1- ')
    .replace(/(?<![*\w])\*(?!\*)([^*\n]+?)\*(?![*\w])/g, '$1')
    .replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g, '$1')
  return t
}

/**
 * @returns {Promise<string|null>} o markdown, ou null quando a cadeia inteira
 *   falhou — a ficha continua publicada, e o guia pode ser pedido de novo.
 */
export async function generateGuide(json, baseGuide = null, lang = 'pt') {
  const prompt = lang === 'en' ? buildPromptEn(json, baseGuide) : buildPrompt(json, baseGuide)
  const out = await runChainedPrompt(prompt, {
    maxTokens: 4096,
    // `cleanTranslation` é feito para prosa traduzida (tira aspas das pontas,
    // prefixos como "Aqui está") e não tem o que fazer num markdown.
    clean: false,
    validate: (text) => looksLikeGuide(tidy(text)),
  })
  if (!out) return null
  const guide = tidy(out)
  return looksLikeGuide(guide) ? guide : null
}
