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

// --- Acentos semânticos do PF2e ---

/** Tradições de magia. */
export const TRADITION_COLORS: Record<string, string> = {
    arcane: '#2B5FA8', // azul
    divine: '#9A6B12', // âmbar
    occult: '#6B3FA0', // roxo
    primal: '#3E7A33', // verde
}

export const MYTHIC_COLOR = '#B03356'

/** Pontos de vida (HpTracker). */
export const HP_COLOR = '#B4442A'

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
