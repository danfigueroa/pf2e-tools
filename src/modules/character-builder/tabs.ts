/* i18n-ignore-file */
// Abas do modo editar e em qual delas cada pendência/aviso do motor se resolve (pela chave do slot).
export type BuilderTab = 'origin' | 'class' | 'attributes' | 'skills' | 'progression' | 'spells' | 'equipment' | 'details'

const ATTRS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export function tabOf(ref: string | undefined): BuilderTab {
    if (!ref) return 'origin'
    if (ref === 'class' || ref === 'class-key') return 'class'
    if (ref.startsWith('spells') || ref === 'spell-tradition') return 'spells'
    if (ref === 'equipment') return 'equipment'
    if (/-feat-\d+/.test(ref) || ref.startsWith('class-choice:') || ref.startsWith('awarded:') || ref.includes('/choice:')) return 'progression'
    if (ref.startsWith('boosts') || ATTRS.has(ref)) return 'attributes'
    if (ref.startsWith('skill') || ref.startsWith('class-skill') || ref.startsWith('lore')) return 'skills'
    return 'origin'
}
