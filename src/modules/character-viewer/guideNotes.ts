/**
 * Os trechos que o jogador escreveu no guia "Como Jogar": texto livre (o mesmo Markdown curto do guia), mostrado
 * junto do guia e NUNCA reescrito pela IA. Mora no estado da mesa (campo `guide`, por personagem), não na ficha
 * publicada: a publicação recomeça o guia a cada versão, e os trechos têm de sobreviver a ela.
 *
 * Conteúdo do usuário: fica como foi escrito, nos dois idiomas da plataforma.
 */

export interface GuideNotesStored {
    text: string
}

/** O campo da mesa tem teto de 8 KB, e acento ocupa 2 bytes: 3500 caracteres cabem com folga. */
export const MAX_GUIDE_NOTES = 3500

export const NO_GUIDE_NOTES: GuideNotesStored = { text: '' }

export function sanitizeGuideNotes(raw: unknown): GuideNotesStored {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NO_GUIDE_NOTES
    const text = (raw as Record<string, unknown>).text
    if (typeof text !== 'string') return NO_GUIDE_NOTES
    const clean = text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_GUIDE_NOTES)
    return clean ? { text: clean } : NO_GUIDE_NOTES
}

export const isGuideNotesEmpty = (s: GuideNotesStored) => !s.text
