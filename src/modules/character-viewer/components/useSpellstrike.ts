import { useEffect, useMemo, useState } from 'react'
import { fetchSpellDescription, getCachedSpell } from '../../../services/descriptions'
import type { BuildInfo, SpellDescription } from '../../character-sheet/types'
import { damageComponents, scaleSpell, type ScaledComponent } from '../heightening'
import { actionRange, variantFor } from '../actionVariants'
import { legacyCharKey, slotsKeyFor } from '../charId'
import { spellstrikeIssue, spellstrikeOptions, spellstrikeUsesAttack, type SpellstrikeOption } from '../spellstrike'
import { useSpellSlots } from './useSpellSlots'

/**
 * Dano padrão: ligado o que não é persistente nem incerto, e de componentes com
 * a mesma fórmula só o primeiro (costumam ser ALTERNATIVAS — Gouging Claw:
 * cortante OU perfurante). Mesma regra do diálogo de magia.
 */
export function defaultComponentSelection(list: ScaledComponent[]): Set<number> {
    const on = new Set<number>()
    const formulas = new Set<string>()
    for (const c of list) {
        if (c.uncertain || c.persistent) continue
        const f = `${c.value.count}d${c.value.faces}+${c.value.flat}`
        if (formulas.has(f)) continue
        formulas.add(f)
        on.add(c.id)
    }
    return on
}

/**
 * O que o Golpe precisa saber da magia escolhida para o Spellstrike: a lista de
 * opções (com os slots que restam), a descrição (buscada ao escolher), o dano no
 * rank certo e o gasto do slot. `enabled` = a ficha tem Spellstrike.
 */
export function useSpellstrike(build: BuildInfo, enabled: boolean, mythicPoints?: { available: number; spend: () => void }) {
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const options = useMemo(
        () => (enabled ? spellstrikeOptions(build, slots.usedOf, mythicPoints?.available ?? 0) : []),
        [enabled, build, slots.usedOf, mythicPoints?.available],
    )

    const [choice, setChoice] = useState<string | null>(null)
    const option: SpellstrikeOption | null = options.find((o) => o.id === choice) ?? null

    const [fetched, setFetched] = useState<{ name: string; spell: SpellDescription | null } | null>(null)
    const name = option?.name ?? null
    useEffect(() => {
        if (!name || getCachedSpell(name)) return
        let cancelled = false
        fetchSpellDescription(name).then((spell) => { if (!cancelled) setFetched({ name, spell }) })
        return () => { cancelled = true }
    }, [name])
    const spell: SpellDescription | null = name
        ? (getCachedSpell(name) as SpellDescription | null) ?? (fetched?.name === name ? fetched.spell : null)
        : null
    const loading = !!name && !spell && fetched?.name !== name

    // Magia de ação variável: no Spellstrike cabem 1 ou 2 ações, e o dano segue a escolha.
    const range = spell ? actionRange(spell.actions) : null
    const limit = range ? { min: range.min, max: Math.min(2, range.max) } : null
    const [chosenActions, setChosenActions] = useState<number | null>(null)
    const nActions = limit ? Math.min(limit.max, Math.max(limit.min, chosenActions ?? limit.min)) : null
    const variant = option && nActions != null ? variantFor(option.name, option.rank, nActions) : null

    const scaled = spell && option ? scaleSpell(spell, option.rank) : null
    const components = useMemo(
        () => variant?.components ?? (scaled ? damageComponents(scaled).filter((c) => c.kind === 'damage') : []),
        [scaled, variant],
    )

    // O que o jogador ligou vale para ESTA magia neste rank; trocar de magia volta ao padrão.
    const selectionKey = `${option?.id ?? ''}|${option?.rank ?? ''}|${spell ? 1 : 0}|${nActions ?? ''}`
    const [picked, setPicked] = useState<{ key: string; on: Set<number> } | null>(null)
    const selected = picked?.key === selectionKey ? picked.on : defaultComponentSelection(components)
    const toggle = (id: number) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setPicked({ key: selectionKey, on: next })
    }
    const chosen = components.filter((c) => selected.has(c.id) && !c.uncertain)

    const issue = spellstrikeIssue(spell)
    const [enterCascade, setEnterCascade] = useState(true)

    /** Truque não gasta; Mythic Magic gasta 1 Ponto Mítico; o resto tira 1 slot do grupo da magia. */
    const spend = () => {
        if (option?.kind === 'mythic') mythicPoints?.spend()
        else if (option?.slot) slots.spendOne(option.slot.key, option.slot.total)
    }

    return {
        options, option, choice, setChoice,
        spell, loading, issue,
        usesAttack: spell ? spellstrikeUsesAttack(spell) : false,
        components, selected, toggle, chosen,
        enterCascade, setEnterCascade,
        /** Magia de ação variável: de quantas ações a escolha (limitada a 2) e o que a regra diz. */
        actionLimit: limit, nActions, setNActions: setChosenActions, variant,
        /** Pronto para rolar junto do Golpe. */
        ready: !!option && !!spell && !issue && (option.left === null || option.left > 0),
        spend,
    }
}

export type SpellstrikeApi = ReturnType<typeof useSpellstrike>
