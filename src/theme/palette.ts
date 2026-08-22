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
