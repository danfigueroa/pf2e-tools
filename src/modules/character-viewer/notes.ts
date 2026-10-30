// Anotações do personagem: o formato e a validação. O servidor (`notes-store.js`)
// confere os mesmos tetos — mudou um, muda o outro.

export const NOTE_TAGS = ['npc', 'item', 'local', 'evento', 'outro'] as const
export type NoteTag = (typeof NOTE_TAGS)[number]

export const TAG_LABELS: Record<NoteTag, string> = {
    npc: 'NPC', item: 'Item', local: 'Local', evento: 'Evento', outro: 'Outro',
}

export const MAX_TEXT = 20000
export const MAX_NOTES = 200

export interface Note {
    id: string
    title: string
    tag: NoteTag
    body: string
    createdAt: number
    updatedAt: number
    pinned?: boolean
}

export interface CharacterNotes {
    background: string
    notes: Note[]
}

export const emptyNotes = (): CharacterNotes => ({ background: '', notes: [] })

const ID_RE = /^[a-z0-9-]{1,64}$/

/** Documento cru (servidor, rascunho) → o que a tela entende; `null` se não é reconhecível. */
export function sanitizeNotes(raw: unknown): CharacterNotes | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as { background?: unknown; notes?: unknown }
    const background = typeof r.background === 'string' ? r.background.slice(0, MAX_TEXT) : ''
    const notes: Note[] = []
    const seen = new Set<string>()
    if (Array.isArray(r.notes)) {
        for (const item of r.notes.slice(0, MAX_NOTES)) {
            const n = item as Partial<Note> | null
            if (!n || typeof n.id !== 'string' || !ID_RE.test(n.id) || seen.has(n.id)) continue
            seen.add(n.id)
            notes.push({
                id: n.id,
                title: typeof n.title === 'string' ? n.title.slice(0, 200) : '',
                tag: NOTE_TAGS.includes(n.tag as NoteTag) ? n.tag as NoteTag : 'outro',
                body: typeof n.body === 'string' ? n.body.slice(0, MAX_TEXT) : '',
                createdAt: Number.isFinite(n.createdAt) ? Number(n.createdAt) : 0,
                updatedAt: Number.isFinite(n.updatedAt) ? Number(n.updatedAt) : 0,
                ...(n.pinned === true ? { pinned: true } : {}),
            })
        }
    }
    return { background, notes }
}

/** As chaves sempre na mesma ordem: o `jsonb` do banco reordena, e a comparação é por texto. */
export const wireNotes = (n: CharacterNotes) => JSON.stringify(sanitizeNotes(n))

export const newNoteId = () => `n-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
