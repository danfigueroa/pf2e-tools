/**
 * Os grupos das abas Talentos e Habilidades, em português.
 *
 * **Talentos**: o Pathbuilder já manda o tipo de cada um ("Class Feat", "Mythic Feat"…); aqui só se traduz o
 * título. **Habilidades** (`specials`): o Pathbuilder manda uma lista PLANA de nomes, sem categoria — então ela
 * vem da AON, que o pacote de descrições já traz em `category` de cada uma. NÃO use o `className` dela: a AON
 * acha "Weapon Specialization" na primeira classe que a tem (o Brukuthur, bárbaro, vinha como "Alchemist").
 * Enquanto a descrição não chegou, a habilidade fica em "Outras" e muda de grupo sozinha quando ela vier.
 */
import type { FeatDescription } from '../../pathbuilder/types'

// --- Talentos ---------------------------------------------------------------------------------------

const FEAT_TYPES: Record<string, string> = {
    'class feat': 'Talentos de classe',
    'ancestry feat': 'Talentos de ancestralidade',
    'skill feat': 'Talentos de perícia',
    'general feat': 'Talentos gerais',
    'archetype feat': 'Talentos de arquétipo',
    'mythic feat': 'Talentos míticos',
    'awarded feat': 'Talentos concedidos',
    heritage: 'Herança',
    'bonus feat': 'Talentos bônus',
}

// As classes que as fichas usam (os nomes dos presets); a que não está aqui fica com o nome da AON.
const CLASSES: Record<string, string> = {
    barbarian: 'Bárbaro', ranger: 'Patrulheiro', rogue: 'Ladino', fighter: 'Guerreiro', magus: 'Magus',
    psychic: 'Psíquico', investigator: 'Investigador', monk: 'Monge', cleric: 'Clérigo', wizard: 'Mago',
    druid: 'Druida', bard: 'Bardo', alchemist: 'Alquimista', champion: 'Campeão', sorcerer: 'Feiticeiro',
    inventor: 'Inventor', swashbuckler: 'Espadachim', summoner: 'Invocador', witch: 'Bruxa', oracle: 'Oráculo',
}

/** "Class Feat" → "Talentos de classe"; "Fighter Feat" → "Talentos de Guerreiro"; "Elf Heritage" → "Herança: Elf". */
export function featTypeLabel(type: string): string {
    const t = type.trim()
    const known = FEAT_TYPES[t.toLowerCase()]
    if (known) return known
    const feat = /^(.+) Feat$/i.exec(t)
    if (feat) return `Talentos de ${CLASSES[feat[1].toLowerCase()] ?? feat[1]}`
    const heritage = /^(.+) Heritage$/i.exec(t)
    if (heritage) return `Herança: ${heritage[1]}`
    return t
}

// --- Habilidades ------------------------------------------------------------------------------------

export type SpecialGroup = 'class' | 'ancestry' | 'mythic' | 'actions' | 'spells' | 'relic' | 'choices' | 'other'

export const SPECIAL_GROUPS: Array<{ id: SpecialGroup; label: string }> = [
    { id: 'class', label: 'Características de classe' },
    { id: 'ancestry', label: 'Ancestralidade e herança' },
    { id: 'mythic', label: 'Habilidades míticas' },
    { id: 'actions', label: 'Ações' },
    { id: 'spells', label: 'Magias e poderes' },
    { id: 'relic', label: 'Relíquias' },
    { id: 'choices', label: 'Escolhas da ficha' },
    { id: 'other', label: 'Outras' },
]

// Categorias da AON que são parte da classe (o ramo/escolha que a classe pede: escola, mente, doutrina…).
const CLASS_CATEGORIES = new Set([
    'class-feature', 'arcane-school', 'arcane-thesis', 'conscious-mind', 'subconscious-mind', 'hybrid-study',
    'doctrine', 'domain', 'draconic-exemplar', 'style', 'methodology', 'instinct', 'order', 'bloodline', 'patron',
    'racket', 'muse', 'cause', 'research-field', 'innovation', 'implement', 'eidolon', 'curse', 'mystery',
])

// A AON acha o sentido da ancestralidade ("Darkvision") em outras categorias; pelo nome é certeza.
const ANCESTRY_NAME = /(?:^|\b)(?:low-light vision|darkvision|greater darkvision|scent|constructed|tremorsense)\b/i

/** O grupo da habilidade pelo que a AON diz dela (`category`, e o traço Mythic nas ações). */
export function specialGroup(name: string, desc: FeatDescription | null | undefined): SpecialGroup {
    if (ANCESTRY_NAME.test(name)) return 'ancestry'
    if (!desc) return 'other'
    const category = (desc.category ?? '').toLowerCase()
    if (category === 'heritage' || category === 'ancestry' || category === 'familiar-ability') return 'ancestry'
    if (category === 'mythic-calling' || category === 'mythic') return 'mythic'
    if (category === 'action') return (desc.traits ?? []).some((t) => t.toLowerCase() === 'mythic') ? 'mythic' : 'actions'
    if (category === 'relic') return 'relic'
    if (category === 'spell' || category === 'feat') return 'spells'
    if (CLASS_CATEGORIES.has(category)) return 'class'
    return category ? 'choices' : 'other'
}
