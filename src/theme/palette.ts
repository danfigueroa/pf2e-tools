/**
 * Paleta do Pathfinder 2e Remaster: verde profundo (moldura), pergaminho
 * (conteúdo) e ouro/latão (filetes e rótulos) — o trade dress do Player Core /
 * GM Core.
 *
 * Tudo em hex de 6 dígitos, sem oklch/lab/color-mix: o html2canvas usado na
 * exportação do stat block (v1.4.1) não entende funções de cor modernas, e
 * vários componentes concatenam alpha direto na string (`accent + '22'`).
 *
 * Os acentos semânticos foram entonados para ler sobre pergaminho (>= 4.5:1
 * sobre `parchment.paper`) — as versões antigas eram claras demais porque
 * assumiam fundo escuro.
 */

// Verde Remaster — moldura, chrome, cabeçalhos
export const green = {
    deepest: '#14281D',
    main: '#1B3B2A',
    mid: '#2A5540',
    light: '#3D7357',
} as const

// Pergaminho — superfícies de conteúdo
export const parchment = {
    page: '#EDE3CC',
    paper: '#F7F1E1',
    sunken: '#E3D7BC',
} as const

// Ouro/latão — filetes, rótulos e destaques
export const gold = {
    deep: '#7E611D',
    main: '#A8842C',
    bright: '#C8A951',
} as const

// Tinta
export const ink = {
    primary: '#23201A',
    secondary: '#5A5044',
    disabled: '#8A8072',
} as const

// Filete / divisória
export const rule = '#CDBE9E'

// Estados (entonados para fundo claro)
export const status = {
    error: '#A62A21',
    warning: '#B0761A',
    success: '#2F7D46',
    info: '#2B5FA8',
} as const

/**
 * A moldura verde da sidebar, do cabeçalho do celular e dos blocos escuros da Início (herói,
 * prévias). O fundo é o `green.deepest`; estes são os degraus por cima dele e as tintas que
 * leem sobre ele (todas ≥4,5:1 sobre `green.deepest`, os rótulos inclusive).
 */
export const chrome = {
    /** Bloco escuro destacado (herói da Início). */
    hero: '#16291F',
    /** Cartão sobre a moldura (mesa, últimas rolagens, prévias). */
    raised: '#1A3027',
    /** Rodapé de um cartão elevado. */
    raisedDeep: '#172B22',
    /** Item ativo da navegação. */
    active: '#23402F',
    line: '#2C4A3B',
    lineStrong: '#3A5A49',
    /** Título e número sobre a moldura. */
    text: '#F3E6C4',
    textSoft: '#C9D2CB',
    textMuted: '#A9B5AD',
    /** Rótulo de seção ("JOGO", "MESA"), 5,5:1. */
    label: '#8FA096',
    /** Ponto de "online" sobre a moldura. */
    online: '#6FCF8E',
    /** Iniciais sobre a cor de um personagem (as cores das rolagens são todas escuras o bastante). */
    onAccent: '#FFFFFF',
} as const

/** Selo "N online" sobre o pergaminho. */
export const ONLINE_BADGE = { bg: '#E3F0E6', text: '#22603A', dot: '#2F8A52' } as const

// --- Acentos semânticos do PF2e ---

/** Tradições de magia. */
export const TRADITION_COLORS: Record<string, string> = {
    arcane: '#2B5FA8', // azul
    divine: '#9A6B12', // âmbar
    occult: '#6B3FA0', // roxo
    primal: '#3E7A33', // verde
}

export const MYTHIC_COLOR = '#B03356'
/** O mesmo acento sobre a moldura escura (cartão de rolagem): o de cima dá 2,5:1 ali. */
export const MYTHIC_ON_DARK = '#F2A0B6'

/** Pontos de vida (HpTracker). */
export const HP_COLOR = '#B4442A'

/**
 * Fúria do bárbaro (a faixa da ficha). Vermelho de braseiro, mais escuro que o
 * `HP_COLOR` para não se confundir com a barra de PV; 6,6:1 sobre `parchment.paper`.
 */
export const RAGE_COLOR = '#A02A18'

/** Psique liberada do Psíquico (a faixa da ficha). Violeta; 7,7:1 sobre `parchment.paper`. */
export const PSYCHE_COLOR = '#5B3A8C'

/** Poison Weapon (a faixa do Ladino). Roxo-veneno; 7,0:1 sobre `parchment.paper`. */
export const ROGUE_COLOR = '#6A3F7A'

/** Hunt Prey e Gravity Weapon (a faixa do Patrulheiro). Verde-floresta; 6,5:1 sobre `parchment.paper`. */
export const RANGER_COLOR = '#3A6B35'

/** A faixa do Monge (postura, Flurry, Ki Strike). Bronze; 5,0:1 sobre `parchment.paper`. */
export const MONK_COLOR = '#8A5A1E'

/** Investigações e estratagemas da faixa do Investigador. Verde-azulado; 5,9:1 sobre `parchment.paper`. */
export const INVESTIGATOR_COLOR = '#1F6A73'

/** Arcane Cascade e a faixa do Magus. Azul-arcano; 7,3:1 sobre `parchment.paper`. */
export const MAGUS_COLOR = '#2F4F8F'

/**
 * Escudo (ShieldCard, cartão da Iniciativa) — aço azulado. É item, não
 * criatura: a barra de PV dele não pode ser confundida com a do personagem.
 * 5,5:1 sobre `parchment.paper`.
 */
export const SHIELD_COLOR = '#4A6572'

/**
 * Borda dos tokens do mapa de combate. Ficam sobre a IMAGEM do mapa (lava,
 * masmorra, pergaminho), não sobre o tema — por isso são mais vivas que os
 * acentos de texto, e o anel de quem está no turno é o ouro claro.
 */
export const TOKEN_PC = '#4F9A6B'
export const TOKEN_NPC = '#B23A2E'
/** Fundo do token sem imagem e do mapa vazio. */
export const MAP_BACKDROP = '#2B2A26'
/** Peças desenhadas POR CIMA da imagem do mapa: precisam ler em qualquer fundo. */
export const mapChrome = {
    /** Linha do grid — usada com opacidade, não como cor cheia. */
    grid: '#000000',
    outline: '#000000',
    track: '#1A1A1A',
    text: '#FFFFFF',
    /** Fundo dos rótulos (nome do token, distância da régua). */
    label: '#14281D',
} as const

/**
 * Cores dos desenhos do mapa, por efeito. Vivas e opacas de propósito: são
 * desenhadas com transparência POR CIMA de uma imagem qualquer, e uma cor
 * apagada sumiria no mapa de lava ou no de pergaminho.
 */
export const DRAW_COLORS = [
    { id: 'fire', label: 'Fogo', hex: '#E0531F' },
    { id: 'cold', label: 'Gelo', hex: '#3FA9F5' },
    { id: 'acid', label: 'Ácido', hex: '#6BBF3A' },
    { id: 'arcane', label: 'Arcano', hex: '#9B59D0' },
    { id: 'light', label: 'Luz', hex: '#F2D04B' },
    { id: 'shadow', label: 'Sombra', hex: '#1C1C1C' },
    { id: 'electricity', label: 'Elétrico', hex: '#7DF9FF' },
    { id: 'poison', label: 'Veneno', hex: '#2E7D32' },
    { id: 'blood', label: 'Sangue', hex: '#8E1B1B' },
    { id: 'sonic', label: 'Sônico', hex: '#FF6FB5' },
    { id: 'terrain', label: 'Terreno difícil', hex: '#8B5A2B' },
    { id: 'vital', label: 'Vital', hex: '#FFFFFF' },
] as const

/** Condições ativas (ConditionsBar) — roxo de esmalte, distinto do PV e do mítico. */
export const CONDITION_COLOR = '#5E4B8B'

/** Moedas: platina, ouro, prata, cobre. */
export const COIN_COLORS = {
    pp: '#7C8FA8',
    gp: '#9A6B12',
    sp: '#6E7175',
    cp: '#8A4B22',
} as const

/** Ranks de proficiência (bônus 2×rank do Pathbuilder). */
export const RANK_COLORS: Record<number, string> = {
    0: ink.disabled, // destreinado
    2: green.main, // treinado
    4: '#2B5FA8', // perito
    6: '#6B3FA0', // mestre
    8: '#9A6B12', // lendário
}

/** Raridade PF2e — cores canônicas da Paizo, escurecidas para pergaminho. */
export const RARITY_COLORS = {
    common: ink.secondary,
    uncommon: '#A84800',
    rare: '#0C1466',
    unique: '#800080',
} as const

/** Tipo de item aberto no DescriptionDrawer. */
export const TYPE_ACCENT = {
    feat: green.main,
    special: '#6B3FA0',
    spell: '#2B5FA8',
    item: '#9A6B12',
} as const
