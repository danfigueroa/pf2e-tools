import { tr } from '../../i18n'

/* i18n-ignore-file */
// Seções do editor e em qual delas cada pendência/aviso do motor se resolve (pela chave do slot).
export type BuilderTab = 'progression' | 'origin' | 'class' | 'attributes' | 'skills' | 'actions' | 'spells' | 'equipment' | 'companions' | 'details'

export const TABS: BuilderTab[] = ['origin', 'class', 'attributes', 'progression', 'skills', 'spells', 'equipment', 'companions', 'details', 'actions']

export const TAB_LABEL: Record<BuilderTab, string> = {
    progression: tr('Talentos', 'Feats'),
    origin: tr('Origem', 'Origin'),
    class: tr('Classe', 'Class'),
    attributes: tr('Atributos', 'Attributes'),
    skills: tr('Perícias', 'Skills'),
    actions: tr('Ações', 'Actions'),
    spells: tr('Magias', 'Spells'),
    equipment: tr('Equipamento', 'Equipment'),
    companions: tr('Companheiros', 'Companions'),
    details: tr('Detalhes', 'Details'),
}

export const TAB_HELP: Record<BuilderTab, string> = {
    progression: tr('Escolha talentos e opções de classe a partir do nível 1. Revise os pré-requisitos antes de avançar.',
        'Choose feats and class options starting at level 1. Review prerequisites before moving on.'),
    origin: tr('Escolha a ancestralidade, a herança e o antecedente do personagem. Complete as escolhas que sua origem oferece.',
        'Choose your character’s ancestry, heritage, and background. Fill in any choices they grant.'),
    class: tr('Escolha a classe e defina o atributo-chave e as opções iniciais que ela oferece.',
        'Choose a class and set its key attribute and any starting options it offers.'),
    attributes: tr('Distribua os aumentos de atributo da criação e dos níveis que o personagem já alcançou.',
        'Assign attribute boosts from character creation and from the levels your character has reached.'),
    skills: tr('Escolha as perícias treinadas, preencha os Saberes e distribua os aumentos de perícia por nível.',
        'Choose trained skills, fill in Lore skills, and assign skill increases by level.'),
    actions: tr('Consulte as ações, reações e atividades que sua origem, classe e talentos concedem. Toque em uma opção para ler como usá-la.',
        'Review the actions, reactions, and activities your origin, class, and feats grant. Tap one to learn how to use it.'),
    spells: tr('Escolha truques e magias. Use as seções de cada conjurador para montar o repertório ou preencher os espaços de preparação.',
        'Choose cantrips and spells. Use each caster’s section to build a repertoire or fill prepared spell slots.'),
    equipment: tr('Compre itens ou adicione os que ganhou. Equipe o que for usar e gerencie runas, dinheiro e Volume.',
        'Buy items or add gear you received. Equip what you’ll use and manage runes, money, and Bulk.'),
    companions: tr('Adicione um familiar ou companheiro animal e escolha as habilidades ou avanços disponíveis.',
        'Add a familiar or animal companion and choose its available abilities or advancements.'),
    details: tr('Preencha a identidade e a história do personagem. Registre ajustes manuais que sua mesa usa.',
        'Fill in your character’s identity and backstory. Record any manual adjustments your table uses.'),
}

const ATTRS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export function tabOf(ref: string | undefined): BuilderTab {
    if (!ref) return 'origin'
    if (ref === 'class' || ref === 'class-key' || ref === 'class-archetype' || ref === 'archetype-feat-2') return 'class'
    if (ref.startsWith('spells') || ref.startsWith('focus-choice:') || ref === 'spell-tradition') return 'spells'
    if (ref === 'equipment') return 'equipment'
    if (ref.startsWith('companion')) return 'companions'
    if (/-feat-\d+/.test(ref) || ref.startsWith('class-choice:') || ref.startsWith('awarded:') || ref.includes('/choice:')) return 'progression'
    if (ref.startsWith('boosts') || ATTRS.has(ref)) return 'attributes'
    if (ref.startsWith('skill') || ref.startsWith('class-skill') || ref.startsWith('lore')) return 'skills'
    return 'origin'
}
