// Criaturas da AON. Dois modos no MESMO endpoint:
//
//   ?q= / ?minLevel= / ?maxLevel=  → busca (lista resumida, para a Iniciativa)
//   ?name=                          → ficha completa (para o Escalar Monstro)
//
// Estão juntos porque o plano Hobby da Vercel permite **12 funções serverless
// por deploy** e o `api/*.js` já tinha 12. Um `api/monster.js` separado virava
// a 13ª: o `vercel build` passava e o deploy falhava depois, na criação das
// funções, deixando produção parada no deploy anterior — sem erro de build
// nenhum para explicar.
//
// A fusão não é gambiarra: os dois modos são a mesma categoria do índice e
// compartilham o mesmo núcleo. Ao acrescentar endpoint novo, confira a
// contagem antes.
//
// Nenhum dos dois passa pela cadeia de tradução (ver creature-core.js).
import { resolveCreatures } from './_lib/creature-core.js'
import { resolveMonster } from './_lib/monster-core.js'

/** Nível aceita negativo (criaturas de nível -1); ausente e inválido viram null. */
function parseLevel(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // Modo ficha completa: nome exato, uma criatura só.
  const name = req.query?.name ? String(req.query.name).trim() : ''
  if (name) {
    try {
      const monster = await resolveMonster(name)
      if (!monster) {
        return res.status(404).json({ error: 'Criatura não encontrada' })
      }
      return res.status(200).json(monster)
    } catch (error) {
      console.error('Monster API error:', error)
      return res.status(500).json({ error: 'Erro ao buscar a ficha da criatura' })
    }
  }

  const { q, limit, minLevel, maxLevel, offset } = req.query
  const term = q ? String(q).trim() : ''
  const min = parseLevel(minLevel)
  const max = parseLevel(maxLevel)

  // Sem termo E sem faixa de nível, a busca devolveria o bestiário inteiro.
  if (!term && min === null && max === null) {
    return res.status(400).json({ error: 'Informe um nome ou uma faixa de nível' })
  }

  try {
    const page = await resolveCreatures(term, parseInt(limit, 10) || 8, {
      minLevel: min,
      maxLevel: max,
      offset: parseInt(offset, 10) || 0,
    })
    return res.status(200).json(page)
  } catch (error) {
    console.error('Creature API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar criatura' })
  }
}
