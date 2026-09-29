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
function looksLikeGuide(text) {
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
export async function generateGuide(json, baseGuide = null) {
  const out = await runChainedPrompt(buildPrompt(json, baseGuide), {
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
