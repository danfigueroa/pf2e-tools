import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Snackbar,
    Typography,
} from '@mui/material'
import { PersonAdd as AddIcon } from '@mui/icons-material'
import { gold, ink } from '../../theme'
import { ConditionsDialog } from '../character-viewer/components/ConditionsDialog'
import { encounterReducer, activeOrder, peekNext } from './encounterReducer'
import { loadEncounter, saveEncounter } from './encounterStorage'
import { useEncounterParty } from './useEncounterParty'
import { useCombatantViews } from './useCombatantViews'
import { EncounterToolbar } from './components/EncounterToolbar'
import { CombatantCard } from './components/CombatantCard'
import { BulkActionBar } from './components/BulkActionBar'
import { BulkDamageDialog } from './components/BulkDamageDialog'
import { BulkHealDialog } from './components/BulkHealDialog'
import { BulkConditionDialog } from './components/BulkConditionDialog'
import { AddCombatantDialog } from './components/AddCombatantDialog'
import type { Combatant, CombatantView } from './types'

type OpenDialog = 'add' | 'damage' | 'heal' | 'condition' | 'end' | null

export const InitiativePage = () => {
    const [state, dispatch] = useReducer(encounterReducer, undefined, loadEncounter)

    const slugs = useMemo(
        () => state.combatants.filter((c) => c.kind === 'pc').map((c) => c.slug),
        [state.combatants],
    )
    const party = useEncounterParty(slugs)

    // Um fireball derruba vários alvos dentro do MESMO handler. Os avisos são
    // juntados e só depois viram um aviso só, em vez de snackbars que se
    // atropelam.
    const downedRef = useRef<string[]>([])
    // `flushDowned` fecha sobre `viewsById`, que muda a cada render; sem o ref,
    // o microtask rodaria com o mapa do primeiro render e não acharia ninguém.
    const flushRef = useRef<() => void>(() => {})
    const collectDowned = useCallback((id: string) => {
        if (downedRef.current.length === 0) queueMicrotask(() => flushRef.current())
        downedRef.current.push(id)
    }, [])

    const views = useCombatantViews(state, party, dispatch, collectDowned)

    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [dialog, setDialog] = useState<OpenDialog>(null)
    const [conditionsFor, setConditionsFor] = useState<string | null>(null)
    const [toast, setToast] = useState<{ text: string; action?: () => void; label?: string } | null>(null)

    // O encontro fica só neste aparelho — PV e condições dos personagens é que
    // são da mesa (ver useEncounterParty).
    useEffect(() => {
        const timer = setTimeout(() => saveEncounter(state), 300)
        return () => clearTimeout(timer)
    }, [state])

    const viewsById = useMemo(
        () => new Map(views.map((v) => [v.combatant.id, v])),
        [views],
    )
    const targets = useMemo(
        () => views.filter((v) => selected.has(v.combatant.id)),
        [views, selected],
    )

    const active = state.combatants.find((c) => c.id === state.activeId) ?? null
    const { next } = peekNext(state)

    // --- Turnos --------------------------------------------------------------

    /**
     * As durações são decrementadas AQUI, no handler, e não num efeito: um
     * efeito que lê estado e escreve no estado compartilhado da mesa reagiria
     * ao próprio `subscribeSnapshot` e amplificaria escrita a cada releitura.
     * Handlers de evento não são duplicados pelo StrictMode.
     */
    const dropForNext = useCallback((upcoming: Combatant | null): string[] => {
        if (!upcoming) return []
        const view = viewsById.get(upcoming.id)
        const activeIds = new Set(Object.keys(view?.conditions ?? {}))
        const drop: string[] = []

        for (const [conditionId, rounds] of Object.entries(upcoming.durations)) {
            // Prazo vencido, ou condição que o jogador já tirou pela Ficha
            // Virtual e deixou a duração órfã aqui.
            if (rounds - 1 <= 0 || !activeIds.has(conditionId)) drop.push(conditionId)
        }
        return drop
    }, [viewsById])

    /** Remove do estado compartilhado as condições que expiraram no tique. */
    const expireConditions = useCallback((upcoming: Combatant | null, drop: string[]) => {
        if (!upcoming || drop.length === 0) return
        const view = viewsById.get(upcoming.id)
        if (!view) return
        for (const conditionId of drop) {
            if (view.conditions[conditionId] !== undefined) view.setCondition(conditionId, 0)
        }
    }, [viewsById])

    const handleNext = () => {
        const { next: upcoming } = peekNext(state)
        const drop = dropForNext(upcoming)
        dispatch({ type: 'nextTurn', drop })
        expireConditions(upcoming, drop)
    }

    const handleDelay = (id: string) => {
        if (state.activeId !== id) {
            dispatch({ type: 'delay', id, drop: [] })
            return
        }
        const { next: upcoming } = peekNext(state)
        const drop = dropForNext(upcoming)
        dispatch({ type: 'delay', id, drop })
        expireConditions(upcoming, drop)
    }

    // --- Ações em lote -------------------------------------------------------

    const applyDamage = (entries: Array<{ view: CombatantView; amount: number }>) => {
        for (const { view, amount } of entries) view.applyDamage(amount)
    }

    /**
     * PF2e RAW: um personagem que cai a 0 PV fica Morrendo 1 + o valor de
     * Ferido que já tinha; um NPC simplesmente morre. A sugestão nunca é
     * automática — quem decide é o GM.
     */
    const flushDowned = () => {
        const ids = downedRef.current
        downedRef.current = []
        const first = ids.map((id) => viewsById.get(id)).find(Boolean)
        if (!first) return

        const others = ids.length > 1 ? ` (+${ids.length - 1} caíram junto)` : ''

        if (first.combatant.kind === 'npc') {
            setToast({
                text: `${first.combatant.name} chegou a 0 PV.${others}`,
                label: 'Marcar derrotado',
                action: () => dispatch({ type: 'setDefeated', id: first.combatant.id, value: true }),
            })
            return
        }

        const dying = 1 + (first.conditions.wounded ?? 0)
        setToast({
            text: `${first.combatant.name} caiu a 0 PV.${others}`,
            label: `Aplicar Morrendo ${dying}`,
            action: () => first.setCondition('dying', dying),
        })
    }
    flushRef.current = flushDowned

    const applyHeal = (mode: 'heal' | 'temp', amount: number) => {
        for (const view of targets) {
            if (mode === 'heal') view.applyHealing(amount)
            else view.setTemp(amount)
        }
    }

    const applyCondition = (conditionId: string, value: number, rounds: number | null) => {
        for (const view of targets) {
            view.setCondition(conditionId, value)
            view.setDuration(conditionId, rounds)
        }
    }

    // --- Render --------------------------------------------------------------

    const toggleSelect = (id: string) => setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    })

    const conditionsView = conditionsFor ? viewsById.get(conditionsFor) : null

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 2 }}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Iniciativa
            </Typography>
            <Box sx={{ height: 2, width: { xs: 120, sm: 180 }, backgroundColor: gold.main, mb: 2 }} />

            <EncounterToolbar
                round={state.round}
                active={active}
                next={next}
                canStart={activeOrder(state).length > 0}
                onStart={() => dispatch({ type: 'start' })}
                onNext={handleNext}
                onPrev={() => dispatch({ type: 'prevTurn' })}
                onSort={() => dispatch({ type: 'sortByInitiative' })}
                onRefresh={() => void party.refresh()}
                onEnd={() => setDialog('end')}
            />

            <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setDialog('add')}
                sx={{ mb: 2 }}
            >
                Adicionar combatente
            </Button>

            {views.length === 0 ? (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 5 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                            Nenhum combatente
                        </Typography>
                        <Typography sx={{ color: ink.secondary }}>
                            Importe os personagens da campanha e acrescente os monstros do encontro.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {/* Coluna única de propósito: a ordem de turnos É a lista, e
                        em várias colunas o olho perde quem age depois de quem.
                        Rolar vira o gesto de ver os próximos turnos. */}
                    {views.map((view) => (
                        <CombatantCard
                            key={view.combatant.id}
                            view={view}
                            selected={selected.has(view.combatant.id)}
                            onToggleSelect={() => toggleSelect(view.combatant.id)}
                            onSetInitiative={(value) =>
                                dispatch({ type: 'setInitiative', id: view.combatant.id, value })}
                            onMove={(dir) => dispatch({ type: 'move', id: view.combatant.id, dir })}
                            onDelay={() => handleDelay(view.combatant.id)}
                            onRejoin={() => dispatch({ type: 'returnFromDelay', id: view.combatant.id })}
                            onToggleDefeated={() => dispatch({
                                type: 'setDefeated',
                                id: view.combatant.id,
                                value: !view.combatant.defeated,
                            })}
                            onDuplicate={() => dispatch({ type: 'duplicate', id: view.combatant.id })}
                            onRemove={() => {
                                dispatch({ type: 'remove', id: view.combatant.id })
                                setSelected((prev) => {
                                    const next = new Set(prev)
                                    next.delete(view.combatant.id)
                                    return next
                                })
                            }}
                            onOpenConditions={() => setConditionsFor(view.combatant.id)}
                        />
                    ))}
                </Box>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
                O encontro fica só neste aparelho. Os PV e as condições dos personagens são da mesa:
                aparecem na Ficha Virtual de quem estiver jogando, nos dois sentidos.
            </Alert>

            {selected.size > 0 && (
                <BulkActionBar
                    count={selected.size}
                    onDamage={() => setDialog('damage')}
                    onHeal={() => setDialog('heal')}
                    onCondition={() => setDialog('condition')}
                    onClear={() => setSelected(new Set())}
                />
            )}

            <AddCombatantDialog
                open={dialog === 'add'}
                onClose={() => setDialog(null)}
                onAdd={(combatants) => dispatch({ type: 'addCombatants', combatants })}
                existingSlugs={slugs}
            />

            <BulkDamageDialog
                open={dialog === 'damage'}
                onClose={() => setDialog(null)}
                targets={targets}
                onApply={applyDamage}
            />

            <BulkHealDialog
                open={dialog === 'heal'}
                onClose={() => setDialog(null)}
                targets={targets}
                onApply={applyHeal}
            />

            <BulkConditionDialog
                open={dialog === 'condition'}
                onClose={() => setDialog(null)}
                targets={targets}
                onApply={applyCondition}
            />

            {conditionsView && (
                <ConditionsDialog
                    open
                    onClose={() => setConditionsFor(null)}
                    state={conditionsView.conditions}
                    onToggle={conditionsView.toggleCondition}
                    onAdjust={conditionsView.adjustCondition}
                />
            )}

            <Dialog open={dialog === 'end'} onClose={() => setDialog(null)}>
                <DialogTitle sx={{ fontWeight: 700 }}>Encerrar o combate?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        A lista de combatentes e a rodada são apagadas. Os PV e as condições dos
                        personagens continuam como estão, na mesa.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialog(null)}>Cancelar</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => {
                            dispatch({ type: 'endEncounter' })
                            setSelected(new Set())
                            setDialog(null)
                        }}
                    >
                        Encerrar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!toast}
                autoHideDuration={8000}
                onClose={() => setToast(null)}
                message={toast?.text}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                action={toast?.action ? (
                    <Button
                        size="small"
                        sx={{ color: gold.bright }}
                        onClick={() => { toast.action?.(); setToast(null) }}
                    >
                        {toast.label}
                    </Button>
                ) : undefined}
            />
        </Container>
    )
}
