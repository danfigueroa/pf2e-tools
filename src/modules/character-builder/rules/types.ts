/* i18n-ignore-file */
// Forma das entradas nos pacotes do catálogo (MODELO-DE-DADOS §4), gerada por `api/_lib/rules-packages.js`.

export type AttributeKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
/** 0 destreinado … 4 lendário. */
export type Rank = 0 | 1 | 2 | 3 | 4

export interface RuleElement {
    key: string
    /** A Ficha trata em combate; o motor não compila (MOTOR-DE-REGRAS §10). */
    situational?: boolean
    /** Variante do Foundry que a AON junta numa entrada ("Advanced Vials (Bomber)" → "Bomber"). */
    variant?: string
    [field: string]: unknown
}

export interface ClassFeatureRef {
    level: number
    name: string
    /** `class-feature:<aon_id>`; ausente = característica sem entrada na AON, o motor avisa. */
    id?: string
}

export interface ClassData {
    hp?: number
    keyAttribute?: AttributeKey[]
    perception?: Rank
    saves?: Partial<Record<'fortitude' | 'reflex' | 'will', Rank>>
    attacks?: Partial<Record<'simple' | 'martial' | 'advanced' | 'unarmed', Rank>>
    defenses?: Partial<Record<'light' | 'medium' | 'heavy' | 'unarmored', Rank>>
    trainedSkills?: { fixed?: string[]; choices?: string[][]; additional?: number }
    featLevels?: { ancestry: number[]; class: number[]; general: number[]; skill: number[] }
    skillIncreaseLevels?: number[]
    spellcasting?: number
    /** Conjuração da classe, lida da AON. `mixed` = preparado e repertório juntos (Animist): o motor avisa. */
    casting?: { traditions: string[]; type?: 'prepared' | 'spontaneous' | 'mixed'; attribute?: AttributeKey }
    features?: ClassFeatureRef[]
}

export interface ItemData {
    traitsRaw?: string[]
    category?: string
    subcategory?: string
    price?: { gp: number }
    bulk?: number | 'L'
    hands?: string
    usage?: string
    parent?: string
    /** Item específico: o nome da base (Hero's Plate → Full Plate). A AON manda lista. */
    baseItem?: string[] | string
    weapon?: { die?: string; damageType?: string; group?: string; category?: string; range?: number; reload?: number; traitsRaw?: string[] }
    armor?: { ac?: number; dexCap?: number; strength?: number; checkPenalty?: number; speedPenalty?: number | string; category?: string; group?: string }
    shield?: { ac?: number; hardness?: number; hp?: number; bt?: number }
}

export interface RuleEntry {
    /** `tipo:aon_id`, estável entre renomeações. */
    id: string
    name: string
    /** Categoria da AON (`feat`, `spell`, `class-feature`, `equipment`…). */
    type: string
    level?: number
    rarity?: string
    traits?: string[]
    source: { id: string; page?: number }
    aon: { id: string; url?: string }
    remaster: boolean
    superseded?: boolean
    replaces?: string
    legacyNames?: string[]
    /** Nomes das entradas substituídas, só para busca. O motor resolve concessões com os nomes da AON. */
    previousNames?: string[]
    summary?: string
    actions?: '1' | '2' | '3' | 'reaction' | 'free'
    prerequisites?: { text: string }
    rules?: RuleElement[]
    /** Efeitos que o motor não calcula: viram aviso "efeito não calculado". */
    unsupported?: string[]
    ancestry?: { hp?: number; size?: string; speed?: number; boosts?: (AttributeKey | 'free')[]; flaws?: AttributeKey[]; languages?: string[]; senses?: string[] }
    heritage?: { ancestry?: string }
    background?: { boosts?: (AttributeKey | 'free')[]; skills?: string[]; feats?: string[] }
    class?: ClassData
    classOption?: { class: string }
    /** Característica de classe: proficiências que ela sobe (lidas do texto da AON). */
    classFeature?: { proficiencies?: { target: string; rank: Rank }[] }
    /** Doutrina do Cleric: proficiências por degrau (Player Core pg. 112). */
    doctrine?: { steps: { level: number; proficiencies: { target: string; rank: Rank }[] }[] }
    feat?: { archetype?: string[]; skill?: string[]
        /** Dedicação de arquétipo conjurador (Player Core pg. 215), lida do texto da AON. */
        casting?: { className?: string; attribute?: AttributeKey; tradition?: string; type?: 'prepared' | 'spontaneous'; cantrips?: number } }
    spell?: { rank?: number; traditions?: string[]; cantrip?: boolean; focus?: boolean; ritual?: boolean; heighten?: string[] }
    item?: ItemData
    /** Conteúdo da mesa (9.1, id `mesa:<uuid>`): o tipo de conteúdo caseiro. */
    homebrew?: string
}

export interface RuleSource {
    id: string
    name: string
    productLine?: string
    releaseDate?: string
    remaster: boolean
    errata?: string
}

export interface RulesManifest {
    version: string
    generatedAt: string
    files: Record<string, { hash: string; count: number; bytes: number }>
    sources: string[]
}
