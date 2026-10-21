/**
 * Talentos míticos que gastam um Ponto Mítico para fazer algo NO TURNO e não têm outro lugar
 * na ficha: Godspeed, Correct the Story, Arc of Destruction, Become Destiny e We've Met Before.
 * (Rewrite Fate, Mythic Strike, Ears… são o ✦ dos diálogos, em `mythicUse.ts`; Summon Mythic
 * Power, Divert Destiny e Fiery Rebirth já têm a linha delas na faixa do `MagusBar`.)
 *
 * Cada um paga o tempo (ação, reação ou livre) E o ponto pelo mesmo `useActivity`; o custo
 * conferido na AON mora aqui, e o `check-economy` confere contra o pacote de descrições.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { ActivityInfo } from './activities'
import type { ConditionModifiers } from './conditions'

export type MythicFeatId = 'godspeed' | 'correct-the-story' | 'arc-of-destruction' | 'become-destiny' | 'weve-met-before'

export interface MythicFeatDef {
    id: MythicFeatId
    /** Nome em inglês, como a ficha e a AON o chamam. */
    name: string
    info: ActivityInfo
    /** O que o talento faz, em pt-BR (a linha da faixa). */
    summary: string
}

const act = (time: ActivityInfo['time'], trigger?: string): ActivityInfo => ({ time, mythicPoint: true, daily: false, includesStrike: false, trigger })

export const MYTHIC_FEATS: ReadonlyArray<MythicFeatDef> = [
    {
        id: 'godspeed',
        name: 'Godspeed',
        info: act({ kind: 'actions', n: 1 }),
        summary: '1 ação + 1 ponto: por 1 minuto, +3 m (10 pés) de status nos Deslocamentos e Acelerado (a ação extra serve para Andar, Passo ou Salto).',
    },
    {
        id: 'correct-the-story',
        name: 'Correct the Story',
        info: act({ kind: 'reaction' }, 'Um inimigo tira um sucesso crítico num ataque ou salvaguarda.'),
        summary: 'Reação + 1 ponto: o inimigo rola de novo o ataque ou a salvaguarda e fica com o novo resultado.',
    },
    {
        id: 'arc-of-destruction',
        name: 'Arc of Destruction',
        info: act({ kind: 'reaction' }, 'Um inimigo que você observa mira você com um Golpe à distância.'),
        summary: 'Reação + 1 ponto: +4 de status na CA contra esse Golpe; se ele errar, você devolve a arma ou munição com proficiência mítica.',
    },
    {
        id: 'become-destiny',
        name: 'Become Destiny',
        info: act({ kind: 'free' }),
        summary: 'Ação livre + 1 ponto: remove uma condição, encerra o efeito contínuo de uma magia ou liberta você de uma armadilha ou perigo.',
    },
    {
        id: 'weve-met-before',
        name: "We've Met Before",
        info: act({ kind: 'actions', n: 1 }),
        summary: '1 ação + 1 ponto (exige 1 minuto de conversa): ganha um Saber da criatura por 24 h, com proficiência mítica.',
    },
]

const norm = (s: string) => s.trim().toLowerCase()
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

/** Os talentos desta lista que a ficha tem. */
export const mythicFeatsOf = (b: BuildInfo): MythicFeatDef[] => MYTHIC_FEATS.filter((f) => hasFeat(b, f.name))

/** Godspeed: +10 pés de status (3 m) nos Deslocamentos enquanto ativo. */
export const GODSPEED_SPEED = 10

export function withGodspeed(mods: ConditionModifiers, on: boolean): ConditionModifiers {
    return on ? { ...mods, total: { ...mods.total, speed: mods.total.speed + GODSPEED_SPEED } } : mods
}

/** O Acelerado do Godspeed, no formato das condições derivadas (a faixa de Ações lê o orçamento daí). */
export const GODSPEED_SOURCE = 'Godspeed'
export const godspeedConditions = (on: boolean): Record<string, number> => (on ? { quickened: 1 } : {})
