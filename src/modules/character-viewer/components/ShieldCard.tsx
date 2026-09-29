import { useEffect, useRef, useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { Build as RepairIcon, Shield as ShieldIcon } from '@mui/icons-material'
import { gold, SHIELD_COLOR, status } from '../../../theme/palette'
import type { BuildInfo } from '../../character-sheet/types'
import { characterMaxHp } from '../helpers'
import { hpKeyFor, legacyCharKey } from '../charId'
import { blockSplit, craftingRank, isBroken, repairAmount, type ShieldStored } from '../shield'
import type { CharacterShield } from './useShield'
import { useHpTracker } from './useHpTracker'
import { crack, floatUp, lift, pulseAnimation, useArmed, useReducedMotion, type Pulse } from '../../../motion/motion'
import { useAnimatedNumber } from '../../../motion/useAnimatedNumber'
import { useValueDeltas } from '../../../motion/useValueDeltas'
import { FloatingDeltas } from '../../../motion/FloatingDeltas'

const RANK_LABELS = ['destreinado', 'treinado', 'especialista', 'mestre', 'lendário']

interface Props {
    build: BuildInfo
    shield: CharacterShield
    /** Corte de Drenado no PV máximo — o dano que passa do escudo cai no PV. */
    hpMaxDelta: number
}

/** O aviso do último bloqueio, com o que é preciso para desfazê-lo. */
interface BlockNotice {
    text: string
    shield: ShieldStored
    hp: { current: number; temp: number }
}

let flashSeq = 0

/**
 * O escudo vestido: PV em barra de aço (item, não criatura), Dureza, BT marcado
 * na barra, Quebrado/Destruído, e as três ações — Erguer, Bloquear e Consertar.
 * O estado é da mesa: o GM vê na Iniciativa o escudo que o jogador ergueu aqui.
 */
export const ShieldCard = ({ build, shield, hpMaxDelta }: Props) => {
    const { view, item, loading, setRaised, block, repair, restore } = shield
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, hpMaxDelta), legacyCharKey(build))
    const armed = useArmed()
    const reduced = useReducedMotion()

    const [amount, setAmount] = useState('')
    const [notice, setNotice] = useState<BlockNotice | null>(null)
    const [repairOpen, setRepairOpen] = useState(false)
    // Lampejo do que a Dureza segurou: aparece até quando o escudo não perde PV.
    const [flash, setFlash] = useState<{ id: number; absorbed: number } | null>(null)
    const [manualPulse, setManualPulse] = useState<Pulse | null>(null)

    const shieldHp = view?.hp ?? 0
    const bt = view?.stats.bt ?? 0
    // O `classify` roda no efeito de `useValueDeltas`, declarado antes do efeito
    // que atualiza o ref — ainda enxerga o PV anterior.
    const lastHp = useRef(shieldHp)
    const deltas = useValueDeltas(shieldHp, (diff) => {
        if (diff > 0) return 'repair'
        return lastHp.current > bt && shieldHp <= bt ? 'break' : 'block'
    })
    useEffect(() => { lastHp.current = shieldHp }, [shieldHp])
    const shownHp = useAnimatedNumber(shieldHp, { instant: !deltas.armed })

    useEffect(() => {
        if (!flash && !manualPulse) return
        const t = window.setTimeout(() => { setFlash(null); setManualPulse(null) }, 1300)
        return () => window.clearTimeout(t)
    }, [flash, manualPulse])

    if (!item) return null

    if (!view) {
        return (
            <Card sx={{ borderColor: SHIELD_COLOR + '60' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ShieldIcon sx={{ color: SHIELD_COLOR }} />
                        <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {loading
                            ? 'Buscando Dureza e PV do escudo na AON…'
                            : 'A AON não tem os números deste escudo — sem eles não dá para erguer nem bloquear.'}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    const { stats, raised, broken, destroyed } = view
    const pct = (n: number) => (stats.maxHp > 0 ? Math.min(100, (n / stats.maxHp) * 100) : 0)
    const value = parseInt(amount, 10)
    const valid = Number.isFinite(value) && value > 0
    const rank = craftingRank(build)

    const handleBlock = (destructive: boolean) => {
        if (!valid) return
        const before = { shield: { hp: view.hp, raised: view.raised }, hp: { current: hp.current, temp: hp.temp } }
        const result = block(value, destructive)
        if (!result) return
        if (result.toCreature > 0) hp.applyDamage(result.toCreature)
        setAmount('')
        const id = ++flashSeq
        setFlash({ id, absorbed: result.absorbed })
        if (!reduced) setManualPulse({ kind: result.broke || result.destroyed ? 'break' : 'block', id })
        const tail = result.destroyed
            ? ' · Escudo DESTRUÍDO'
            : result.broke ? ' · Escudo QUEBRADO' : ''
        setNotice({
            text: `${result.destructive ? 'Bloqueio Destrutivo' : 'Bloqueio'}: Dureza segurou ${result.absorbed} · escudo −${result.toShield} · você −${result.toCreature}${tail}`,
            ...before,
        })
    }

    const undo = (n: BlockNotice) => {
        restore(n.shield)
        hp.restoreHp(n.hp)
    }

    const animation = pulseAnimation(manualPulse) ?? pulseAnimation(deltas.pulse)
    const barColor = broken ? status.error : SHIELD_COLOR

    return (
        <Card sx={{ borderColor: SHIELD_COLOR + '60', overflow: 'visible', animation }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
                    <ShieldIcon
                        key={raised ? 'up' : 'down'}
                        sx={{
                            color: raised ? gold.deep : SHIELD_COLOR,
                            transform: raised ? 'translateY(-2px) scale(1.08)' : undefined,
                            animation: raised && armed && !reduced ? `${lift} 380ms ease-out` : 'none',
                        }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Escudo</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }} noWrap>
                        {stats.name}
                    </Typography>
                    <Stack direction="row" sx={{ ml: 'auto', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Chip size="small" variant="outlined" label={`Dureza ${stats.hardness}`} sx={{ fontWeight: 700, color: SHIELD_COLOR, borderColor: SHIELD_COLOR }} />
                        <Chip size="small" variant="outlined" label={`+${stats.bonus} CA`} />
                        {destroyed ? (
                            <Chip size="small" color="error" label="Destruído" sx={{ fontWeight: 700 }} />
                        ) : broken ? (
                            <Tooltip title="Escudo quebrado não dá bônus na CA, não pode ser erguido nem bloquear até ser consertado acima do BT.">
                                <Chip size="small" color="error" label="Quebrado" sx={{ fontWeight: 700 }} />
                            </Tooltip>
                        ) : raised ? (
                            <Chip size="small" label="Erguido" sx={{ fontWeight: 700, backgroundColor: gold.main + '33', color: gold.deep }} />
                        ) : null}
                    </Stack>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.75 }}>
                    <Typography sx={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
                        {shownHp}
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                        / {stats.maxHp}
                    </Typography>
                    <Box sx={{ position: 'relative', alignSelf: 'flex-start' }}>
                        <FloatingDeltas deltas={deltas.deltas} />
                    </Box>
                    {flash && flash.absorbed > 0 && (
                        <Typography
                            key={flash.id}
                            aria-hidden
                            sx={{
                                ml: 'auto',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: SHIELD_COLOR,
                                animation: reduced ? 'none' : `${floatUp} 1300ms ease-out forwards`,
                            }}
                        >
                            Dureza segurou {flash.absorbed}
                        </Typography>
                    )}
                </Box>

                {/* Barra própria (não LinearProgress): precisa da marca do BT e
                    da rachadura quando quebra. */}
                <Box
                    role="progressbar"
                    aria-label={`PV do escudo, BT ${stats.bt}`}
                    aria-valuemin={0}
                    aria-valuemax={stats.maxHp}
                    aria-valuenow={shieldHp}
                    sx={{ position: 'relative', height: 12, borderRadius: 6, backgroundColor: SHIELD_COLOR + '1F', mb: 0.5 }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            width: `${pct(shieldHp)}%`,
                            borderRadius: 6,
                            backgroundColor: barColor,
                            // Brilho metálico discreto, para ler como item.
                            backgroundImage: 'linear-gradient(180deg, #FFFFFF33 0%, #FFFFFF00 60%)',
                            transition: 'width 0.6s cubic-bezier(.2,.8,.2,1), background-color 0.4s',
                            opacity: destroyed ? 0.35 : 1,
                            overflow: 'hidden',
                        }}
                    >
                        {/* A rachadura só no que resta do escudo. */}
                        {broken && (
                            <Box
                                component="svg"
                                viewBox="0 0 100 12"
                                preserveAspectRatio="none"
                                aria-hidden
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    animation: armed && !reduced ? `${crack} 500ms ease-out` : 'none',
                                }}
                            >
                                <polyline
                                    points="0,6 12,3 20,9 31,2 40,8 52,4 61,10 72,3 83,8 92,4 100,7"
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth={1.4}
                                    vectorEffect="non-scaling-stroke"
                                />
                            </Box>
                        )}
                    </Box>
                    <Tooltip title={`Limiar de quebra (BT) ${stats.bt}`}>
                        <Box
                            sx={{
                                position: 'absolute',
                                top: -3,
                                bottom: -3,
                                left: `calc(${pct(stats.bt)}% - 1px)`,
                                width: 2,
                                backgroundColor: status.error,
                                borderRadius: 1,
                            }}
                        />
                    </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    BT {stats.bt} · {stats.canBlock ? 'Bloqueio com Escudo: a Dureza segura o dano, e o resto vai para você e para o escudo.' : 'Sem o talento Bloqueio com Escudo.'}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                    <Tooltip title={broken ? 'Escudo quebrado não pode ser erguido.' : raised ? 'Vale até o início do seu próximo turno.' : ''}>
                        <span style={{ flex: '1 1 140px', display: 'flex' }}>
                            <Button
                                fullWidth
                                variant={raised ? 'outlined' : 'contained'}
                                startIcon={<ShieldIcon />}
                                disabled={broken && !raised}
                                onClick={() => setRaised(!raised)}
                                sx={raised
                                    ? { fontWeight: 700, color: gold.deep, borderColor: gold.main }
                                    : { fontWeight: 700, backgroundColor: SHIELD_COLOR, '&:hover': { backgroundColor: SHIELD_COLOR, filter: 'brightness(0.9)' } }}
                            >
                                {raised ? 'Abaixar escudo' : `Erguer (+${stats.bonus} CA)`}
                            </Button>
                        </span>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<RepairIcon />}
                        onClick={() => setRepairOpen(true)}
                        disabled={shieldHp >= stats.maxHp}
                        sx={{ flex: '1 1 120px', fontWeight: 700 }}
                    >
                        Consertar
                    </Button>
                </Box>

                {stats.canBlock && (
                    <Box sx={{ display: 'flex', gap: 1.25, mt: 1.25 }}>
                        <TextField
                            size="small"
                            label="Dano do golpe"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleBlock(false) }}
                            inputProps={{ inputMode: 'numeric' }}
                            disabled={!view.canBlock}
                            sx={{ width: 130, flexShrink: 0 }}
                        />
                        <Tooltip title={view.canBlock ? 'Dano físico de um ataque, já com resistências.' : broken ? 'Escudo quebrado não bloqueia.' : 'Erga o escudo para bloquear.'}>
                            <span style={{ flex: 1, display: 'flex' }}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    disabled={!view.canBlock || !valid}
                                    onClick={() => handleBlock(false)}
                                    sx={{ fontWeight: 700, backgroundColor: SHIELD_COLOR, '&:hover': { backgroundColor: SHIELD_COLOR, filter: 'brightness(0.9)' } }}
                                >
                                    Bloquear
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>
                )}

                {stats.canBlock && stats.destructive && (
                    <DestructiveBlock
                        damage={valid ? value : null}
                        hardness={stats.hardness}
                        shieldHp={shieldHp}
                        bt={stats.bt}
                        enabled={view.canBlock}
                        onBlock={() => handleBlock(true)}
                    />
                )}
            </CardContent>

            <RepairDialog
                open={repairOpen}
                onClose={() => setRepairOpen(false)}
                rank={rank}
                destroyed={destroyed}
                missing={stats.maxHp - shieldHp}
                onRepair={(n) => { repair(n); setRepairOpen(false) }}
            />

            <Snackbar
                open={!!notice}
                autoHideDuration={10000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(null) }}
                message={notice?.text}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                action={notice ? (
                    <Button size="small" sx={{ color: gold.bright }} onClick={() => { undo(notice); setNotice(null) }}>
                        Desfazer
                    </Button>
                ) : undefined}
            />
        </Card>
    )
}

/**
 * Destructive Block (Bastion): a escolha entre os dois bloqueios é feita depois
 * de saber o dano, então os dois resultados aparecem lado a lado antes do toque.
 */
const DestructiveBlock = ({ damage, hardness, shieldHp, bt, enabled, onBlock }: {
    damage: number | null
    hardness: number
    shieldHp: number
    bt: number
    enabled: boolean
    onBlock: () => void
}) => {
    const outcome = (destructive: boolean) => {
        if (damage == null) return ''
        const split = blockSplit(damage, hardness, destructive)
        const after = Math.max(0, shieldHp - split.toShield)
        const tail = after === 0 ? ' (destruído)' : shieldHp > bt && isBroken(after, { bt }) ? ' (quebra)' : ''
        return `você −${split.toCreature} · escudo −${split.toShield}${tail}`
    }

    return (
        <Box sx={{ mt: 1.25 }}>
            <Tooltip title={enabled
                ? `Reduz o seu dano pelo dobro da Dureza (${2 * hardness}), mas o escudo toma o dobro do dano antes da Dureza.`
                : 'Erga o escudo (inteiro) para bloquear.'}
            >
                <span style={{ display: 'flex' }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ShieldIcon />}
                        disabled={!enabled || damage == null}
                        onClick={onBlock}
                        sx={{ fontWeight: 700, color: status.error, borderColor: status.error + '80', '&:hover': { borderColor: status.error } }}
                    >
                        Bloqueio Destrutivo
                    </Button>
                </span>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {damage == null
                    ? `Destructive Block: você desconta ${2 * hardness} (o dobro da Dureza) e o escudo toma o dobro do dano, menos a Dureza.`
                    : `Comum: ${outcome(false)} · Destrutivo: ${outcome(true)}`}
            </Typography>
        </Box>
    )
}

/**
 * Reparar (Ofício, 1 hora): sucesso devolve 5 + 5×rank, crítico 10 + 10×rank.
 * O app não rola o teste — o jogador rola e informa o grau, como todo teste de
 * quem está jogando. "Restaurar tudo" cobre o descanso longo e o escudo novo.
 */
const RepairDialog = ({ open, onClose, rank, destroyed, missing, onRepair }: {
    open: boolean
    onClose: () => void
    rank: number
    destroyed: boolean
    missing: number
    onRepair: (amount: number) => void
}) => {
    const [custom, setCustom] = useState('')
    const value = parseInt(custom, 10)
    const success = repairAmount(rank, false)
    const crit = repairAmount(rank, true)

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Consertar escudo</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Teste de Ofício para Reparar · {RANK_LABELS[rank]}. Faltam {missing} PV.
                </Typography>
                {destroyed ? (
                    <Typography variant="body2" sx={{ mb: 2, color: status.error, fontWeight: 600 }}>
                        Escudo destruído não pode ser consertado. Se ele foi substituído, use “Restaurar tudo”.
                    </Typography>
                ) : (
                    <Stack spacing={1} sx={{ mb: 2 }}>
                        <Button variant="contained" color="success" onClick={() => onRepair(success)} sx={{ fontWeight: 700 }}>
                            Sucesso · +{success} PV
                        </Button>
                        <Button variant="contained" color="success" onClick={() => onRepair(crit)} sx={{ fontWeight: 700 }}>
                            Sucesso crítico · +{crit} PV
                        </Button>
                    </Stack>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        label="Outro valor"
                        value={custom}
                        disabled={destroyed}
                        onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                        inputProps={{ inputMode: 'numeric' }}
                        sx={{ width: 120 }}
                    />
                    <Button
                        variant="outlined"
                        disabled={destroyed || !(value > 0)}
                        onClick={() => { onRepair(value); setCustom('') }}
                    >
                        Aplicar
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onRepair(missing)} color="inherit">Restaurar tudo</Button>
                <Button onClick={onClose}>Fechar</Button>
            </DialogActions>
        </Dialog>
    )
}
