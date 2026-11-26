import { tr } from '../../i18n'

/* i18n-ignore-file */
// Seções do editor e em qual delas cada pendência/aviso do motor se resolve (pela chave do slot).
export type BuilderTab = 'progression' | 'origin' | 'class' | 'attributes' | 'skills' | 'spells' | 'equipment' | 'companions' | 'details'

/** A ordem das seções: o Plano (trilha 1–20) é a casa do personagem; as outras seguem o livro. */
export const TABS: BuilderTab[] = ['progression', 'origin', 'class', 'attributes', 'skills', 'spells', 'equipment', 'companions', 'details']

export const TAB_LABEL: Record<BuilderTab, string> = {
    progression: tr('Plano', 'Plan'),
    origin: tr('Origem', 'Origin'),
    class: tr('Classe', 'Class'),
    attributes: tr('Atributos', 'Attributes'),
    skills: tr('Perícias', 'Skills'),
    spells: tr('Magias', 'Spells'),
    equipment: tr('Equipamento', 'Equipment'),
    companions: tr('Companheiros', 'Companions'),
    details: tr('Detalhes', 'Details'),
}

const ATTRS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export function tabOf(ref: string | undefined): BuilderTab {
    if (!ref) return 'origin'
    if (ref === 'class' || ref === 'class-key' || ref === 'class-archetype') return 'class'
    if (ref.startsWith('spells') || ref.startsWith('focus-choice:') || ref === 'spell-tradition') return 'spells'
    if (ref === 'equipment') return 'equipment'
    if (ref.startsWith('companion')) return 'companions'
    if (/-feat-\d+/.test(ref) || ref.startsWith('class-choice:') || ref.startsWith('awarded:') || ref.includes('/choice:')) return 'progression'
    if (ref.startsWith('boosts') || ATTRS.has(ref)) return 'attributes'
    if (ref.startsWith('skill') || ref.startsWith('class-skill') || ref.startsWith('lore')) return 'skills'
    return 'origin'
}
