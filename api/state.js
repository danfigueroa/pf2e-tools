// Estado de jogo compartilhado da mesa. Toda a persistência vive em
// api/_lib/table-store.js, compartilhado com server/index.mjs.
//
// Mora em api/state.js (um nível) de propósito: o glob "api/*.js" do
// vercel.json não alcança subpastas, então api/state/[char].js perderia o
// maxDuration configurado.
import {
  readCharacter,
  readField,
  readIncoming,
  writeField,
  isValidSlug,
  isValidField,
  isStoreConfigured,
  MAX_FIELD_BYTES,
} from './_lib/table-store.js'
import { handleSheetRequest, isSheetRequest } from './_lib/sheet-handler.js'
import { handleMapRequest, isMapRequest } from './_lib/map-handler.js'
import { handleRollRequest, isRollRequest } from './_lib/roll-handler.js'
import { handleEncounterRequest, isEncounterRequest } from './_lib/encounter-handler.js'
import { handleFixRequest, isFixRequest } from './_lib/fix-handler.js'
import { mesaFrom } from './_lib/mesas.js'
import { requestUserId } from './_lib/supabase.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  // Estado de jogo muda a todo momento: nunca servir de cache de borda.
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // A mesa vale para tudo abaixo (ver _lib/mesas.js). Vai na query também no POST.
  const mesa = mesaFrom(req.query || {})
  if (!mesa) return res.status(400).json({ error: 'Parâmetro "mesa" inválido' })

  // Mapa de combate. Antes da ficha: as duas rotas usam `action` no POST, e a
  // da ficha aceita qualquer `action`.
  if (isMapRequest(req.method, req.query || {}, req.body)) {
    try {
      const { status, body } = await handleMapRequest(mesa, req.method, req.query || {}, req.body || {})
      return res.status(status).json(body)
    } catch (error) {
      console.error('[/api/state] Erro no mapa:', error)
      return res.status(500).json({ error: 'Erro ao tratar o mapa' })
    }
  }

  // Feed de rolagens da mesa — também antes da ficha, pelo mesmo motivo.
  if (isRollRequest(req.method, req.query || {}, req.body)) {
    try {
      const userId = req.method === 'POST' ? await requestUserId(req) : null
      const { status, body } = await handleRollRequest(mesa, req.method, req.query || {}, req.body || {}, { userId })
      return res.status(status).json(body)
    } catch (error) {
      console.error('[/api/state] Erro nas rolagens:', error)
      return res.status(500).json({ error: 'Erro ao tratar as rolagens' })
    }
  }

  // Correções de tradução da mesa (globais) — também antes da ficha.
  if (isFixRequest(req.method, req.query || {}, req.body)) {
    try {
      const userId = req.method === 'POST' ? await requestUserId(req) : null
      const { status, body } = await handleFixRequest(req.method, req.query || {}, req.body || {}, { userId })
      return res.status(status).json(body)
    } catch (error) {
      console.error('[/api/state] Erro na correção de tradução:', error)
      return res.status(500).json({ error: 'Erro ao tratar a correção de tradução' })
    }
  }

  // Encontros da Iniciativa na nuvem — também antes da ficha.
  if (isEncounterRequest(req.method, req.query || {}, req.body)) {
    try {
      const userId = req.method === 'POST' ? await requestUserId(req) : null
      const { status, body } = await handleEncounterRequest(mesa, req.method, req.query || {}, req.body || {}, { userId })
      return res.status(status).json(body)
    } catch (error) {
      console.error('[/api/state] Erro no encontro:', error)
      return res.status(500).json({ error: 'Erro ao tratar o encontro' })
    }
  }

  // Fichas publicadas (e o guia gerado): mesmas rotas do dev server.
  if (isSheetRequest(req.method, req.query || {}, req.body)) {
    try {
      const userId = req.method === 'POST' ? await requestUserId(req) : null
      const { status, body } = await handleSheetRequest(mesa, req.method, req.query || {}, req.body || {}, { userId })
      return res.status(status).json(body)
    } catch (error) {
      console.error('[/api/state] Erro na ficha publicada:', error)
      return res.status(500).json({ error: 'Erro ao tratar a ficha publicada' })
    }
  }

  if (req.method === 'GET' && req.query?.incoming !== undefined) {
    // O que os colegas me passaram (`gave` de cada um que aponta para mim).
    const to = req.query.incoming
    if (!isValidSlug(to)) return res.status(400).json({ error: 'Parâmetro "incoming" inválido' })
    try {
      return res.status(200).json({ char: to, incoming: await readIncoming(mesa, to) })
    } catch (error) {
      console.error('[/api/state] Erro ao ler o que me passaram:', error)
      return res.status(500).json({ error: 'Erro ao ler o estado da mesa' })
    }
  }

  if (req.method === 'GET') {
    const char = req.query?.char
    if (!isValidSlug(char)) {
      return res.status(400).json({ error: 'Parâmetro "char" inválido' })
    }
    // Uma fatia só (`?field=`): o poll leve do contador de ações do turno.
    const one = req.query?.field
    if (one !== undefined) {
      if (!isValidField(one)) return res.status(400).json({ error: 'Parâmetro "field" inválido' })
      try {
        const entry = await readField(mesa, char, one)
        return res.status(200).json({ char, field: one, data: entry ? entry.data : null, updatedAt: entry ? entry.updatedAt : 0 })
      } catch (error) {
        console.error('[/api/state] Erro ao ler o campo:', error)
        return res.status(500).json({ error: 'Erro ao ler o estado da mesa' })
      }
    }
    try {
      const fields = await readCharacter(mesa, char)
      // Personagem sem estado ainda não é erro — devolve o mapa vazio.
      return res.status(200).json({ char, fields, storeReady: isStoreConfigured() })
    } catch (error) {
      console.error('[/api/state] Erro ao ler:', error)
      return res.status(500).json({ error: 'Erro ao ler o estado da mesa' })
    }
  }

  if (req.method === 'POST') {
    const { char, field, data } = req.body || {}
    if (!isValidSlug(char)) {
      return res.status(400).json({ error: 'Campo "char" inválido' })
    }
    if (!isValidField(field)) {
      return res.status(400).json({ error: 'Campo "field" inválido' })
    }
    if (data === undefined) {
      return res.status(400).json({ error: 'Campo "data" ausente' })
    }
    // O endpoint é público: um teto por escrita evita encher o banco.
    if (JSON.stringify(data).length > MAX_FIELD_BYTES) {
      return res.status(400).json({ error: 'Estado grande demais' })
    }
    try {
      const updatedAt = await writeField(mesa, char, field, data, await requestUserId(req))
      return res.status(200).json({ ok: true, updatedAt, storeReady: isStoreConfigured() })
    } catch (error) {
      console.error('[/api/state] Erro ao gravar:', error)
      return res.status(500).json({ error: 'Erro ao gravar o estado da mesa' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
