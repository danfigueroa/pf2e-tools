// Dano persistente (Player Core, condição Dano Persistente).
//
// RAW, e é o que o motor faz: ao FINAL de cada um dos seus turnos você sofre o
// dano de novo, rolando os dados outra vez, e em seguida faz um teste plano de
// CD 15 para se livrar dele. Ajuda apropriada (apagar o fogo, estancar o
// sangue) baixa a CD para 10.
//
// Duas coisas ficam fora de propósito, pela mesma política das aflições:
// - **O teste plano não é rolado pelo app.** Dano é o que o motor rola sozinho
//   (ver `dice.ts`); teste é rolagem de quem está jogando, então o cartão
//   oferece "Passou"/"Falhou" e o RAW é aplicado sobre a resposta.
// - **Nada expira sozinho sem o GM ver.** Uma entrada só sai da lista quando
//   alguém passa no teste plano ou a remove — e ela pode ser removida a
//   qualquer momento, que é como uma cura ou o fim do combate acabam com ela.
//
// Onde mora: a de PERSONAGEM vive no estado da mesa (campo `persistent`, ao
// lado de `hp` e `afflictions`), então aparece na Ficha Virtual; a de MONSTRO
// vive dentro do encontro. Mesma divisão das aflições.

import { parseDamageEntries } from './dice'
import { stageDamage, type AfflictionState } from './afflictions'

/** CD do teste plano de recuperação. */
export const FLAT_DC = 15
/** Com ajuda apropriada — Player Core, Dano Persistente. */
export const ASSISTED_DC = 10

export interface PersistentDamage {
    id: string
    /** Fórmula como escrita: "1d6", "2d8+4", "3". */
    formula: string
    /** Tipo canônico em inglês, como o resto das defesas. */
    type: string
    /** CD do teste plano: `FLAT_DC`, ou `ASSISTED_DC` com ajuda apropriada. */
    dc: number
    /** true depois do dano do fim de turno: o teste plano está pendente. */
    checkDue: boolean
    /**
     * Id da aflição que impôs este dano, quando ele veio de um estágio. As
     * entradas com dono são REGERADAS a cada mudança de estágio e somem junto
     * com a aflição — nunca acumulam uma cópia por vez que o estágio muda.
     */
    fromAffliction?: string
    /** De onde veio, para o cartão dizer ("Giant Centipede Venom"). */
    sourceName?: string
}

export function newPersistent(
    formula: string,
    type: string,
    extra: Partial<PersistentDamage> = {},
): PersistentDamage {
    return {
        id: crypto.randomUUID(),
        formula,
        type,
        dc: FLAT_DC,
        checkDue: false,
        ...extra,
    }
}

/** Entradas que o estágio atual de uma aflição impõe. */
export function persistentFromAffliction(affliction: AfflictionState): PersistentDamage[] {
    return stageDamage(affliction)
        .filter((entry) => entry.persistent)
        .map((entry) =>
            newPersistent(entry.formula, entry.type, {
                fromAffliction: affliction.id,
                sourceName: affliction.def.name,
            }),
        )
}

/**
 * Reescreve as entradas de uma aflição.
 *
 * `affliction === null` significa que ela saiu (curada ou removida): o dano
 * persistente dela sai junto. Um estágio que continua impondo o mesmo dano
 * mantém a entrada que já existia — assim o "checkDue" e a CD baixada por
 * ajuda apropriada não são perdidos a cada tique.
 */
export function syncFromAffliction(
    list: PersistentDamage[],
    afflictionId: string,
    affliction: AfflictionState | null,
): PersistentDamage[] {
    const mine = list.filter((p) => p.fromAffliction === afflictionId)
    const others = list.filter((p) => p.fromAffliction !== afflictionId)
    if (!affliction) return others

    const wanted = persistentFromAffliction(affliction)
    const kept = wanted.map((w) => {
        const existing = mine.find((p) => p.formula === w.formula && p.type === w.type)
        return existing ?? w
    })
    return [...others, ...kept]
}

/** Lê fórmula e tipo de um texto solto ("1d6 persistent fire damage"). */
export function persistentFromText(text: string): PersistentDamage[] {
    return parseDamageEntries(text).map((e) => newPersistent(e.formula, e.type))
}

/** Descarta o que não se parece com dano persistente, em vez de quebrar a ficha. */
export function sanitizePersistent(raw: unknown): PersistentDamage[] {
    if (!Array.isArray(raw)) return []
    const out: PersistentDamage[] = []
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const p = item as Record<string, unknown>
        const formula = typeof p.formula === 'string' ? p.formula.trim() : ''
        if (!formula) continue
        out.push({
            id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
            formula,
            type: typeof p.type === 'string' && p.type ? p.type : 'untyped',
            dc: Number.isFinite(p.dc as number) ? (p.dc as number) : FLAT_DC,
            checkDue: p.checkDue === true,
            ...(typeof p.fromAffliction === 'string' ? { fromAffliction: p.fromAffliction } : {}),
            ...(typeof p.sourceName === 'string' ? { sourceName: p.sourceName } : {}),
        })
    }
    return out
}
