import { tr } from '../i18n'
import { isDark } from './mode'
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
 * assumiam fundo escuro. No tema escuro (`theme/mode`) cada um tem a sua versão
 * clara, escolhida por `pick` no boot; `scripts/check-contrast.mjs` confere os dois.
 */

/** Escolhe o valor do tema desta carga (`theme/mode`: constante, trocar recarrega). */
const pick = <T,>(light: T, dark: T): T => (isDark ? dark : light)

/**
 * Os tokens de base de cada tema. O claro é o de sempre, sem mudança nenhuma; o escuro é o
 * "pergaminho à luz de vela": marrom quente no conteúdo, a MESMA moldura verde, e a tinta e
 * os acentos clareados para ler sobre ele (≥4,5:1, conferido pelo `scripts/check-contrast.mjs`).
 *
 * `lightCore` existe para o tema claro aninhado (`components/LightTheme.tsx`) dos stat blocks
 * exportados, que ficam claros nos dois temas.
 */
export const lightCore = {
    // Verde Remaster — moldura, chrome, cabeçalhos. É MOLDURA: igual nos dois temas.
    green: { deepest: '#14281D', main: '#1B3B2A', mid: '#2A5540', light: '#3D7357' },
    // O verde como TINTA/acento sobre o conteúdo (texto, borda, ícone). No claro é o próprio
    // `green`; no escuro clareia, senão some sobre o pergaminho escuro.
    greenInk: { main: '#1B3B2A', mid: '#2A5540', light: '#3D7357' },
    // Pergaminho — superfícies de conteúdo
    parchment: { page: '#EDE3CC', paper: '#F7F1E1', sunken: '#E3D7BC' },
    // Ouro/latão — filetes, rótulos e destaques. `deep` é o ouro de TEXTO.
    gold: { deep: '#7E611D', main: '#A8842C', bright: '#C8A951' },
    // Tinta
    ink: { primary: '#23201A', secondary: '#5A5044', disabled: '#8A8072' },
    // Filete / divisória
    rule: '#CDBE9E',
    // Estados (entonados para fundo claro)
    status: { error: '#A62A21', warning: '#B0761A', success: '#2F7D46', info: '#2B5FA8' },
    // Sombras e véus do tema do MUI (cartão, hover de lista, item selecionado).
    fx: {
        shadow: 'rgba(35, 32, 26, 0.06)',
        shadowSoft: 'rgba(35, 32, 26, 0.05)',
        shadowHover: 'rgba(35, 32, 26, 0.08)',
        shadowHoverTint: 'rgba(27, 59, 42, 0.10)',
        button: 'rgba(20, 40, 29, 0.28)',
        buttonHover: 'rgba(20, 40, 29, 0.32)',
        outlinedHover: 'rgba(27, 59, 42, 0.06)',
        selected: 'rgba(27, 59, 42, 0.10)',
        selectedHover: 'rgba(27, 59, 42, 0.16)',
        hover: 'rgba(35, 32, 26, 0.05)',
    },
}

export type ThemeCore = typeof lightCore

const darkCore: ThemeCore = {
    green: lightCore.green,
    greenInk: { main: '#7DBB93', mid: '#6FAE86', light: '#95CCA8' },
    parchment: { page: '#15130F', paper: '#1E1B15', sunken: '#29251D' },
    gold: { deep: '#D4B565', main: '#A8842C', bright: '#C8A951' },
    ink: { primary: '#EDE3CC', secondary: '#B8AC95', disabled: '#8F8576' },
    rule: '#3D372C',
    status: { error: '#F07A6E', warning: '#E8A84A', success: '#6FC587', info: '#7FAEEA' },
    fx: {
        shadow: 'rgba(0, 0, 0, 0.30)',
        shadowSoft: 'rgba(0, 0, 0, 0.22)',
        shadowHover: 'rgba(0, 0, 0, 0.36)',
        shadowHoverTint: 'rgba(0, 0, 0, 0.28)',
        button: 'rgba(0, 0, 0, 0.40)',
        buttonHover: 'rgba(0, 0, 0, 0.50)',
        outlinedHover: 'rgba(125, 187, 147, 0.10)',
        selected: 'rgba(125, 187, 147, 0.14)',
        selectedHover: 'rgba(125, 187, 147, 0.20)',
        hover: 'rgba(237, 227, 204, 0.06)',
    },
}

/** Os tokens de base do tema desta carga. */
export const core: ThemeCore = pick(lightCore, darkCore)

export const green = core.green
export const greenInk = core.greenInk
export const parchment = core.parchment
export const gold = core.gold
export const ink = core.ink
export const rule = core.rule
export const status = core.status

/**
 * Tinta clara SOBRE a moldura verde (cabeçalho de cartão, barra da Iniciativa, do mapa). São os
 * tons do pergaminho claro, fixos nos dois temas: no escuro o `parchment` vira fundo escuro, e
 * texto sobre a moldura escrito com ele sumiria. Regra: sobre `green.*`/`chrome.*`, nunca
 * `parchment.*` — use `onFrame` ou `chrome.*`.
 */
export const onFrame = lightCore.parchment

/**
 * Texto sobre um ACENTO cheio (chip "Em fúria", "Presa marcada", pip livre, botão "Beber"). No
 * claro o acento é escuro e o texto é branco; no escuro o acento clareia, e o texto passa a ser
 * o pergaminho escuro.
 */
export const onSolid = pick('#FFFFFF', darkCore.parchment.paper)

/** Halo atrás de um número que flutua sobre o conteúdo (o "−9" do PV): a cor do fundo, mais forte. */
export const textHalo = pick('#FFFFFF', '#000000')

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
export const ONLINE_BADGE = pick(
    { bg: '#E3F0E6', text: '#22603A', dot: '#2F8A52' },
    { bg: '#1F3327', text: '#7FD69A', dot: '#6FCF8E' },
)

// --- Acentos semânticos do PF2e ---

/** Tradições de magia. */
export const TRADITION_COLORS: Record<string, string> = pick<Record<string, string>>({
    arcane: '#2B5FA8', // azul
    divine: '#9A6B12', // âmbar
    occult: '#6B3FA0', // roxo
    primal: '#3E7A33', // verde
}, {
    arcane: '#7FAEEA',
    divine: '#E0B252',
    occult: '#B993E6',
    primal: '#86C57A',
})

export const MYTHIC_COLOR = pick('#B03356', '#F2A0B6')
/** O mesmo acento sobre a moldura escura (cartão de rolagem): o de cima dá 2,5:1 ali. */
export const MYTHIC_ON_DARK = '#F2A0B6'

/** Pontos de vida (HpTracker). */
export const HP_COLOR = pick('#B4442A', '#F08A6E')
/** Hover do botão cheio de dano (`HP_COLOR`): mais escuro no claro, mais claro no escuro. */
export const HP_HOVER = pick('#8F3622', '#F4A28B')
/** Hover do botão cheio de aviso (`status.warning`). */
export const WARNING_HOVER = pick('#8E5F14', '#EDBC6E')

/**
 * Fúria do bárbaro (a faixa da ficha). Vermelho de braseiro, mais escuro que o
 * `HP_COLOR` para não se confundir com a barra de PV; 6,6:1 sobre `parchment.paper`.
 */
export const RAGE_COLOR = pick('#A02A18', '#F27A62')

/** Psique liberada do Psíquico (a faixa da ficha). Violeta; 7,7:1 sobre `parchment.paper`. */
export const PSYCHE_COLOR = pick('#5B3A8C', '#B79BE8')

/** Poison Weapon (a faixa do Ladino). Roxo-veneno; 7,0:1 sobre `parchment.paper`. */
export const ROGUE_COLOR = pick('#6A3F7A', '#CB97DA') // i18n-ok (hex)

/** Hunt Prey e Gravity Weapon (a faixa do Patrulheiro). Verde-floresta; 6,5:1 sobre `parchment.paper`. */
export const RANGER_COLOR = pick('#3A6B35', '#8CC683')

/** A faixa do Monge (postura, Flurry, Ki Strike). Bronze; 5,0:1 sobre `parchment.paper`. */
export const MONK_COLOR = pick('#8A5A1E', '#DDA35E')

/** Investigações e estratagemas da faixa do Investigador. Verde-azulado; 5,9:1 sobre `parchment.paper`. */
export const INVESTIGATOR_COLOR = pick('#1F6A73', '#6CC3CD')

/** Arcane Cascade e a faixa do Magus. Azul-arcano; 7,3:1 sobre `parchment.paper`. */
export const MAGUS_COLOR = pick('#2F4F8F', '#8FAEEB')

/**
 * Escudo (ShieldCard, cartão da Iniciativa) — aço azulado. É item, não
 * criatura: a barra de PV dele não pode ser confundida com a do personagem.
 * 5,5:1 sobre `parchment.paper`.
 */
export const SHIELD_COLOR = pick('#4A6572', '#9DB8C5')

/**
 * Borda dos tokens do mapa de combate. Ficam sobre a IMAGEM do mapa (lava,
 * masmorra, pergaminho), não sobre o tema — por isso são mais vivas que os
 * acentos de texto, e o anel de quem está no turno é o ouro claro.
 */
/**
 * Troféus do Covil, por grau: `medal` pinta a medalha (preenchimento), `ink` é o texto do grau
 * sobre o pergaminho (≥4,5:1) e `tint` é o fundo do cartão desbloqueado.
 */
export const TROPHY_TIERS = {
    bronze: { medal: '#B0723F', ink: pick('#7A4A24', '#D9A577'), tint: pick('#F1E2D2', '#33261B'), label: 'Bronze' },
    prata: { medal: '#9AA3AA', ink: pick('#4F5960', '#BFC7CD'), tint: pick('#E8EAEB', '#2A2D2F'), label: tr('Prata', 'Silver') },
    ouro: { medal: '#C8A951', ink: pick('#7E611D', '#D4B565'), tint: pick('#F3E8C6', '#332B17'), label: tr('Ouro', 'Gold') },
    platina: { medal: '#7FA0B8', ink: pick('#2F5470', '#9EC3DE'), tint: pick('#DDE8EF', '#1F2B33'), label: tr('Platina', 'Platinum') }, // i18n-ok (hex)
} as const

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
    { id: 'fire', label: tr('Fogo', 'Fire'), hex: '#E0531F' },
    { id: 'cold', label: tr('Gelo', 'Ice'), hex: '#3FA9F5' },
    { id: 'acid', label: tr('Ácido', 'Acid'), hex: '#6BBF3A' },
    { id: 'arcane', label: tr('Arcano', 'Arcane'), hex: '#9B59D0' },
    { id: 'light', label: tr('Luz', 'Light'), hex: '#F2D04B' },
    { id: 'shadow', label: tr('Sombra', 'Shadow'), hex: '#1C1C1C' },
    { id: 'electricity', label: tr('Elétrico', 'Electric'), hex: '#7DF9FF' },
    { id: 'poison', label: tr('Veneno', 'Poison'), hex: '#2E7D32' },
    { id: 'blood', label: tr('Sangue', 'Blood'), hex: '#8E1B1B' },
    { id: 'sonic', label: tr('Sônico', 'Sonic'), hex: '#FF6FB5' },
    { id: 'terrain', label: tr('Terreno difícil', 'Difficult terrain'), hex: '#8B5A2B' },
    { id: 'vital', label: 'Vital', hex: '#FFFFFF' },
] as const

/** Condições ativas (ConditionsBar) — roxo de esmalte, distinto do PV e do mítico. */
export const CONDITION_COLOR = pick('#5E4B8B', '#B4A2E3')

/** Moedas: platina, ouro, prata, cobre. */
export const COIN_COLORS = pick(
    { pp: '#7C8FA8', gp: '#9A6B12', sp: '#6E7175', cp: '#8A4B22' },
    { pp: '#AEBFD4', gp: '#E0B252', sp: '#B5B8BC', cp: '#DC9767' },
)

/** Ranks de proficiência (bônus 2×rank do Pathbuilder). */
export const RANK_COLORS: Record<number, string> = {
    0: ink.disabled, // destreinado
    2: greenInk.main, // treinado
    4: TRADITION_COLORS.arcane, // perito (azul)
    6: TRADITION_COLORS.occult, // mestre (roxo)
    8: TRADITION_COLORS.divine, // lendário (âmbar)
}

/** Raridade PF2e — cores canônicas da Paizo, escurecidas para pergaminho. */
export const RARITY_COLORS = {
    common: ink.secondary,
    uncommon: pick('#A84800', '#F09A5A'),
    rare: pick('#0C1466', '#8F9DF5'),
    unique: pick('#800080', '#E08AE0'),
} as const

/** Tipo de item aberto no DescriptionDrawer. */
export const TYPE_ACCENT = {
    feat: greenInk.main,
    special: TRADITION_COLORS.occult,
    spell: TRADITION_COLORS.arcane,
    item: TRADITION_COLORS.divine,
} as const
