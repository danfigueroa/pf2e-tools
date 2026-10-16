import { memo, useEffect, useRef, useState } from 'react'
import { Box, Chip, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { DiceTray } from '../motion/DiceTray'
import { gold, mapChrome, MYTHIC_COLOR, MYTHIC_ON_DARK, parchment } from '../theme'
import { isOwnRoll, useTableRolls } from '../services/rolls'
import { basicSaveLine, partFormula, rayCritTotal, rayTotal, rollSummaryText, type RolledPart, type RollRay, type TableRoll } from '../dice/tableRoll'

// Rolagens da mesa, para todo mundo, em qualquer página — montado UMA vez no
// `MainLayout`. Por ficar no layout, trocar de rota não refaz o "já visto".
//
// Mesma regra do `PingLayer` do mapa: cada rolagem aparece UMA vez por aparelho,
// decidida pelo id. As que já estavam na mesa quando o app abriu contam como
// vistas, menos as que saíram DESTE aparelho (a otimista pode chegar antes da
// primeira leitura do feed).

/**
 * Quanto a rolagem fica na tela. Com 8 s sumia antes de a mesa terminar de ler a
 * conta; quem já leu fecha pelo ×.
 */
const SHOW_MS = 30_000
const MAX_SHOWN = 2

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

/** "Ficha +23 · Amedrontado 1 −1 · 2º ataque −5". */
const partsLine = (parts: { label: string; value: number }[]) =>
    parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')

function damageDice(parts: RolledPart[]) {
    const immediate = parts.filter((p) => !p.persistent)
    return {
        dice: immediate.flatMap((p) => p.dice),
        flat: immediate.reduce((s, p) => s + p.flat, 0),
    }
}

const Caption = ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <Typography
        variant="caption"
        sx={{ display: 'block', textAlign: 'center', lineHeight: 1.35, color: color ?? `${parchment.page}CC`, overflowWrap: 'anywhere' }}
    >
        {children}
    </Typography>
)

/** Vários raios na mesma rolagem: cada um com o ataque e o dano, e o total dos raios no fim. */
const RaysBlock = ({ rays, color }: { rays: RollRay[]; color: string }) => (
    <Box sx={{ mt: 0.75 }}>
        {rays.map((ray, i) => {
            const dmg = damageDice(ray.damage.parts)
            return (
                <Box key={i} sx={{ mt: 0.75 }}>
                    <Divider sx={{ borderColor: `${gold.main}55`, mb: 0.5 }} />
                    <Caption color={gold.bright}>Raio {i + 1} de {rays.length}</Caption>
                    <DiceTray dice={[{ faces: 20, value: ray.check.d20 }]} flat={ray.check.mod} total={ray.check.total} color={color} compact />
                    {ray.check.mythic && <Caption color={MYTHIC_ON_DARK}>✦ proficiência mítica</Caption>}
                    <Caption color={gold.bright}>Dano se acertar</Caption>
                    <DiceTray dice={dmg.dice} flat={dmg.flat} total={ray.damage.total} color={color} compact />
                    <Caption>{ray.damage.parts.filter((p) => !p.persistent).map((p) => `${p.label} ${p.total}`).join(' · ')}</Caption>
                    {ray.damage.crit && <Caption color={gold.bright}><b>Crítico: {ray.damage.crit.total}</b></Caption>}
                </Box>
            )
        })}
        <Divider sx={{ borderColor: `${gold.main}99`, my: 0.75 }} />
        <Typography sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.15rem' }}>
            Total dos {rays.length} raios: {rayTotal(rays)}
        </Typography>
        <Caption color={gold.bright}>
            <b>Se todos forem críticos: {rayCritTotal(rays)}</b>
        </Caption>
        <Caption>Some só os raios que acertarem.</Caption>
    </Box>
)

/** O cartão de uma rolagem, com a bandeja animada. */
const RollCard = ({ roll, onClose }: { roll: TableRoll; onClose: () => void }) => {
    const dmg = roll.damage ? damageDice(roll.damage.parts) : null
    const persistent = roll.damage?.parts.filter((p) => p.persistent) ?? []
    return (
        <Box
            sx={{
                position: 'relative',
                px: 2,
                py: 1.25,
                width: 'min(360px, calc(100vw - 32px))',
                borderRadius: 2,
                backgroundColor: `${mapChrome.label}F2`,
                border: `2px solid ${roll.check?.mythic || roll.rays?.[0]?.check.mythic ? MYTHIC_ON_DARK : gold.main}`,
                // Vários raios fazem um cartão alto: rola por dentro em vez de passar da tela.
                maxHeight: 'calc(100vh - 32px)',
                overflowY: 'auto',
                overflowX: 'hidden',
                boxShadow: '0 6px 24px #00000080',
                color: parchment.page,
                pointerEvents: 'auto',
            }}
        >
            <IconButton
                size="small"
                aria-label="Fechar rolagem"
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    color: `${parchment.page}CC`,
                    '&:hover': { color: parchment.page, backgroundColor: `${parchment.page}1A` },
                }}
            >
                <CloseIcon fontSize="small" />
            </IconButton>
            {/* Recuo dos dois lados para o título centrado não passar por baixo do ×. */}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: gold.bright, fontWeight: 700, px: 3.5 }}>
                {roll.by || 'Alguém'} · {roll.title}
            </Typography>
            {roll.sub && <Caption>{roll.sub}</Caption>}
            {roll.note && <Caption>{roll.note}</Caption>}

            {roll.check && (
                <Box sx={{ mt: 0.75 }}>
                    <DiceTray dice={[{ faces: 20, value: roll.check.d20 }]} flat={roll.check.mod} total={roll.check.total} color={roll.color} />
                    {roll.check.mythic && <Caption color={MYTHIC_ON_DARK}>✦ proficiência mítica</Caption>}
                    {roll.check.parts.length > 0 && <Caption>{partsLine(roll.check.parts)}</Caption>}
                </Box>
            )}

            {roll.damage && dmg && (
                <Box sx={{ mt: 1 }}>
                    {roll.check && <Divider sx={{ borderColor: `${gold.main}55`, mb: 0.75 }} />}
                    <Caption color={gold.bright}>{roll.check ? 'Dano se acertar' : 'Dano'}</Caption>
                    <DiceTray dice={dmg.dice} flat={dmg.flat} total={roll.damage.total} color={roll.color} compact={!!roll.check} />
                    <Caption>{roll.damage.parts.filter((p) => !p.persistent).map((p) => `${p.label} ${p.total}`).join(' · ')}</Caption>
                    {persistent.map((p, i) => (
                        <Caption key={i}>+ {p.label}: {p.total} no fim de cada turno</Caption>
                    ))}
                    {roll.damage.crit && (
                        <Caption color={gold.bright}>
                            <b>Crítico: {roll.damage.crit.total}</b>
                            {roll.damage.crit.note ? ` (${roll.damage.crit.note})` : ''}
                        </Caption>
                    )}
                    {roll.damage.basic && <Caption>{basicSaveLine(roll.damage.total)}</Caption>}
                </Box>
            )}

            {roll.rays && <RaysBlock rays={roll.rays} color={roll.color} />}

            {roll.free && (
                <Box sx={{ mt: 0.75 }}>
                    <DiceTray dice={roll.free.dice} flat={roll.free.flat} total={roll.free.total} color={roll.color} />
                </Box>
            )}

            {/* Só o resultado vai para o leitor de tela; as bandejas são aria-hidden. */}
            <Box component="span" // '1px', não 1: no `sx` do MUI o número 1 em width/height é 100% — esta caixa só-para-leitor-de-tela
                // virava uma caixa do tamanho do cartão e criava uma área rolável vazia embaixo dele.
                sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }} role="status">
                {rollSummaryText(roll)}
            </Box>
        </Box>
    )
}

interface Shown { id: string; roll: TableRoll }

export const RollFeedLayer = memo(function RollFeedLayer() {
    const { rolls, ready } = useTableRolls()
    const seen = useRef<Set<string> | null>(null)
    const [shown, setShown] = useState<Shown[]>([])
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

    useEffect(() => {
        if (!ready) return
        if (seen.current === null) {
            seen.current = new Set(rolls.filter((r) => !isOwnRoll(r.id)).map((r) => r.id))
        }
        // Do mais velho para o mais novo, para empilhar na ordem em que rolaram.
        const fresh = rolls.filter((r) => !seen.current!.has(r.id)).reverse()
        if (fresh.length === 0) return
        fresh.forEach((r) => seen.current!.add(r.id))
        setShown((prev) => [...prev, ...fresh.map((roll) => ({ id: roll.id, roll }))].slice(-MAX_SHOWN))
        for (const f of fresh) {
            const t = setTimeout(() => {
                timers.current.delete(t)
                setShown((prev) => prev.filter((s) => s.id !== f.id))
            }, SHOW_MS)
            timers.current.add(t)
        }
    }, [rolls, ready])

    useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

    if (shown.length === 0) return null
    return (
        <Box
            sx={{
                position: 'fixed',
                // Abaixo da AppBar do celular; no desktop, centrado no conteúdo (fora da sidebar).
                top: { xs: 64, md: 16 },
                left: { xs: '50%', md: 'calc(50% + 130px)' },
                transform: 'translateX(-50%)',
                zIndex: 1250,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                alignItems: 'center',
                pointerEvents: 'none',
            }}
        >
            {shown.map(({ id, roll }) => (
                <RollCard key={id} roll={roll} onClose={() => setShown((prev) => prev.filter((s) => s.id !== id))} />
            ))}
        </Box>
    )
})

const timeOf = (at: number) =>
    at ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''

/** Uma linha do histórico: sem animação, com a conta inteira. */
const HistoryRow = ({ roll }: { roll: TableRoll }) => (
    <Box sx={{ py: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700 }}>{roll.by || 'Alguém'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>{roll.title}</Typography>
            <Typography variant="caption" color="text.secondary">{timeOf(roll.at)}</Typography>
        </Box>
        {roll.sub && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{roll.sub}</Typography>}
        {roll.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{roll.note}</Typography>}
        {roll.check && (
            <Box sx={{ mt: 0.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>{roll.check.total}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        d20 {roll.check.d20} {signed(roll.check.mod)}
                    </Typography>
                    {roll.check.d20 === 20 && <Chip size="small" label="Natural 20" sx={{ height: 20, color: gold.deep, borderColor: gold.main }} variant="outlined" />}
                    {roll.check.d20 === 1 && <Chip size="small" label="Natural 1" color="error" variant="outlined" sx={{ height: 20 }} />}
                    {roll.check.mythic && <Chip size="small" label="✦ mítico" variant="outlined" sx={{ height: 20, color: MYTHIC_COLOR, borderColor: MYTHIC_COLOR }} />}
                </Stack>
                {roll.check.parts.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{partsLine(roll.check.parts)}</Typography>
                )}
            </Box>
        )}
        {roll.damage && (
            <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2">
                    <b>Dano {roll.damage.total}</b>
                    {' — '}
                    {roll.damage.parts.map((p) => `${p.label}: ${partFormula(p)} = ${p.total}${p.persistent ? ' (persistente)' : ''}`).join(' · ')}
                </Typography>
                {roll.damage.crit && (
                    <Typography variant="body2" sx={{ color: gold.deep }}>
                        Crítico {roll.damage.crit.total}{roll.damage.crit.note ? ` (${roll.damage.crit.note})` : ''}
                    </Typography>
                )}
                {roll.damage.basic && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{basicSaveLine(roll.damage.total)}</Typography>
                )}
            </Box>
        )}
        {roll.rays && (
            <Box sx={{ mt: 0.5 }}>
                {roll.rays.map((ray, i) => (
                    <Typography key={i} variant="body2">
                        <b>Raio {i + 1}:</b> ataque {ray.check.total} (d20 {ray.check.d20} {signed(ray.check.mod)}) · dano {ray.damage.total}
                        {ray.damage.crit ? ` · crítico ${ray.damage.crit.total}` : ''}
                    </Typography>
                ))}
                <Typography variant="body2"><b>Total {rayTotal(roll.rays)}</b> · todos críticos {rayCritTotal(roll.rays)}</Typography>
            </Box>
        )}
        {roll.free && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                <b>{roll.free.total}</b> — {partFormula(roll.free)} [{roll.free.dice.map((d) => d.value).join(', ')}]
            </Typography>
        )}
    </Box>
)

/** As últimas rolagens da mesa, para conferir depois que o cartão sumiu. */
export const RollHistoryDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { rolls, ready } = useTableRolls()
    return (
        <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 'min(400px, 100vw)' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>Rolagens da mesa</Typography>
                <IconButton aria-label="Fechar" onClick={onClose}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ px: 2, overflowY: 'auto' }}>
                {rolls.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 3, fontStyle: 'italic' }}>
                        {ready ? 'Ninguém rolou nada nas últimas 24 horas.' : 'Carregando…'}
                    </Typography>
                ) : (
                    <Stack divider={<Divider flexItem />}>
                        {rolls.map((r) => <HistoryRow key={r.id} roll={r} />)}
                    </Stack>
                )}
            </Box>
        </Drawer>
    )
}
