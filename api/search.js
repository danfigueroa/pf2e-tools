// Busca genérica na AON. Dois modos:
//
//   ?name=       → descrição de item/habilidade, TRADUZIDA (comportamento legado)
//   ?affliction= → venenos e doenças com estágios, SEM tradução
//   ?spells=1    → lista de magias por tradição e rank, SEM tradução
//   ?rule=       → a regra de um termo (condição, habilidade, traço, magia), SEM tradução
//
// O modo de aflição mora aqui porque o plano Hobby da Vercel permite 12 funções
// serverless por deploy e `api/*.js` já está em 12 — arquivo novo passaria do
// limite e o deploy falharia DEPOIS do build, como já aconteceu uma vez. Quando
// precisar de mais espaço, o caminho é fundir os pares singular/plural
// (feat/feats, spell/spells…) num arquivo só por método.
//
// Aflição não é traduzida pela mesma razão de `creature-core.js`: o índice já
// traz tudo estruturado e traduzir a cada tecla estoura o rate limit.
import { resolveSpecial } from './_lib/feat-core.js'
import { resolveAfflictions } from './_lib/affliction-core.js'
import { resolveSpellList } from './_lib/spell-list-core.js'
import { resolveRule } from './_lib/rule-core.js'
import { hasTranslationKey } from './_lib/aon.js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Modo aflição: lista de venenos/doenças com estágios.
  const affliction = req.query?.affliction ? String(req.query.affliction).trim() : ''
  if (affliction) {
    try {
      return res.status(200).json(await resolveAfflictions(affliction, parseInt(req.query.limit, 10) || 10))
    } catch (error) {
      console.error('Affliction API error:', error)
      return res.status(500).json({ error: 'Erro ao buscar aflição' })
    }
  }

  // Modo regra: o texto de um termo, em inglês, para a caixinha da ficha.
  const rule = req.query?.rule ? String(req.query.rule).trim() : ''
  if (rule) {
    try {
      const entry = await resolveRule(rule, req.query.kind ? String(req.query.kind) : null)
      if (!entry) return res.status(404).json({ error: 'Regra não encontrada' })
      return res.status(200).json(entry)
    } catch (error) {
      console.error('Rule API error:', error)
      return res.status(500).json({ error: 'Erro ao buscar regra' })
    }
  }

  // Modo lista de magias: escolher as magias de um monstro no escalar monstro.
  if (req.query?.spells) {
    try {
      const num = (key) => {
        const n = parseInt(req.query[key], 10)
        return Number.isFinite(n) ? n : null
      }
      return res.status(200).json(await resolveSpellList(
        req.query.q ? String(req.query.q) : '',
        parseInt(req.query.limit, 10) || 20,
        {
          tradition: req.query.tradition ? String(req.query.tradition) : null,
          maxRank: num('maxRank'),
          minRank: num('minRank'),
          kind: req.query.kind ? String(req.query.kind) : 'spell',
          offset: num('offset') ?? 0,
        },
      ))
    } catch (error) {
      console.error('Spell list API error:', error)
      return res.status(500).json({ error: 'Erro ao buscar magias' })
    }
  }

  const { name } = req.query

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório' })
  }

  try {
    const entry = await resolveSpecial(name, hasTranslationKey())
    if (!entry.description) {
      return res.status(404).json({ error: 'Item não encontrado' })
    }
    return res.status(200).json(entry)
  } catch (error) {
    console.error('Search API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar item' })
  }
}
