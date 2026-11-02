import { memo, useEffect, useRef, useState } from 'react'
import { Box, Button, Chip, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Close as CloseIcon } from '@mui/icons-material'
import { DiceTray } from '../motion/DiceTray'
import { gold, mapChrome, MYTHIC_COLOR, MYTHIC_ON_DARK, onFrame } from '../theme'
import { isOwnRoll, useTableRolls } from '../services/rolls'
import { basicSaveLine, partFormula, rayCritTotal, rayTotal, rollSummaryText, type RolledPart, type RollRay, type TableRoll } from '../dice/tableRoll'
import { locale, tr } from '../i18n'

// Rolagens da mesa (as últimas, na sidebar), para todo mundo, em qualquer página — montado UMA vez no
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
        sx={{ display: 'block', textAlign: 'center', lineHeight: 1.35, color: color ?? `${onFrame.page}CC`, overflowWrap: 'anywhere' }}
    >
        {children}
    </Typography>
)

/** Flurry of Blows são golpes; o resto (Blazing Bolt…) são raios. */
type RaysKind = 'strike' | 'ray'
const raysKind = (roll: TableRoll): RaysKind => (roll.title.startsWith('Flurry') ? 'strike' : 'ray')
const RAYS_TEXT: Record<RaysKind, { one: string; many: string; hit: string }> = {
    strike: { one: tr('Golpe', 'Strike'), many: tr('golpes', 'Strikes'), hit: tr('os golpes que acertarem', 'the Strikes that hit') },
    ray: { one: tr('Raio', 'Ray'), many: tr('raios', 'rays'), hit: tr('os raios que acertarem', 'the rays that hit') },
}
const raysLabel = (roll: TableRoll) => RAYS_TEXT[raysKind(roll)].one

/** Vários raios na mesma rolagem: cada um com o ataque e o dano, e o total dos raios no fim. */
const RaysBlock = ({ rays, color, kind = 'ray' }: { rays: RollRay[]; color: string; kind?: RaysKind }) => {
    const label = RAYS_TEXT[kind].one
    return (
    <Box sx={{ mt: 0.75 }}>
        {rays.map((ray, i) => {
            const dmg = damageDice(ray.damage.parts)
            return (
                <Box key={i} sx={{ mt: 0.75 }}>
                    <Divider sx={{ borderColor: `${gold.main}55`, mb: 0.5 }} />
                    <Caption color={gold.bright}>{label} {i + 1} {tr(' de ', ' of ')}{rays.length}</Caption>
                    <DiceTray dice={[{ faces: 20, value: ray.check.d20 }]} flat={ray.check.mod} total={ray.check.total} color={color} compact />
                    {ray.check.mythic && <Caption color={MYTHIC_ON_DARK}>{tr('✦ proficiência mítica', '✦ mythic proficiency')}</Caption>}
                    <Caption color={gold.bright}>{tr('Dano se acertar', 'Damage on a hit')}</Caption>
                    <DiceTray dice={dmg.dice} flat={dmg.flat} total={ray.damage.total} color={color} compact />
                    <Caption>{ray.damage.parts.filter((p) => !p.persistent).map((p) => `${p.label} ${p.total}`).join(' · ')}</Caption>
                    {ray.damage.crit && <Caption color={gold.bright}><b>{tr('Crítico: ', 'Critical: ')}{ray.damage.crit.total}</b></Caption>}
                </Box>
            )
        })}
        <Divider sx={{ borderColor: `${gold.main}99`, my: 0.75 }} />
        <Typography sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.15rem' }}>
            {tr('Total dos ', 'Total of the ')}{rays.length} {RAYS_TEXT[kind].many}: {rayTotal(rays)}
        </Typography>
        <Caption color={gold.bright}>
            <b>{tr('Se todos forem críticos: ', 'If all are critical: ')}{rayCritTotal(rays)}</b>
        </Caption>
        <Caption>{tr('Some só ', 'Add only ')}{RAYS_TEXT[kind].hit}.</Caption>
    </Box>
    )
}

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
                color: onFrame.page,
                pointerEvents: 'auto',
            }}
        >
            <IconButton
                size="small"
                aria-label={tr("Fechar rolagem", 'Close roll')}
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    color: `${onFrame.page}CC`,
                    '&:hover': { color: onFrame.page, backgroundColor: `${onFrame.page}1A` },
                }}
            >
                <CloseIcon fontSize="small" />
            </IconButton>
            {/* Recuo dos dois lados para o título centrado não passar por baixo do ×. */}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: gold.bright, fontWeight: 700, px: 3.5 }}>
                {roll.by || tr('Alguém', 'Someone')} · {roll.title}
            </Typography>
            {roll.sub && <Caption>{roll.sub}</Caption>}
            {roll.note && <Caption>{roll.note}</Caption>}

            {roll.check && (
                <Box sx={{ mt: 0.75 }}>
                    <DiceTray dice={[{ faces: 20, value: roll.check.d20 }]} flat={roll.check.mod} total={roll.check.total} color={roll.color} />
                    {roll.check.mythic && <Caption color={MYTHIC_ON_DARK}>{tr('✦ proficiência mítica', '✦ mythic proficiency')}</Caption>}
                    {roll.check.parts.length > 0 && <Caption>{partsLine(roll.check.parts)}</Caption>}
                </Box>
            )}

            {roll.damage && dmg && (
                <Box sx={{ mt: 1 }}>
                    {roll.check && <Divider sx={{ borderColor: `${gold.main}55`, mb: 0.75 }} />}
                    <Caption color={gold.bright}>{roll.check ? tr('Dano se acertar', 'Damage on a hit') : tr('Dano', 'Damage')}</Caption>
                    <DiceTray dice={dmg.dice} flat={dmg.flat} total={roll.damage.total} color={roll.color} compact={!!roll.check} />
                    <Caption>{roll.damage.parts.filter((p) => !p.persistent).map((p) => `${p.label} ${p.total}`).join(' · ')}</Caption>
                    {persistent.map((p, i) => (
                        <Caption key={i}>+ {p.label}: {p.total} {tr(' no fim de cada turno', ' at the end of each turn')}</Caption>
                    ))}
                    {roll.damage.crit && (
                        <Caption color={gold.bright}>
                            <b>{tr('Crítico: ', 'Critical: ')}{roll.damage.crit.total}</b>
                            {roll.damage.crit.note ? ` (${roll.damage.crit.note})` : ''}
                        </Caption>
                    )}
                    {roll.damage.basic && <Caption>{basicSaveLine(roll.damage.total)}</Caption>}
                </Box>
            )}

            {roll.rays && <RaysBlock rays={roll.rays} color={roll.color} kind={raysKind(roll)} />}

            {roll.use && (
                <Typography sx={{ mt: 0.75, textAlign: 'center', fontWeight: 800, fontSize: '1.15rem' }}>
                    {roll.use.text}
                </Typography>
            )}
            {roll.use?.desc && (
                <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-line', fontSize: '0.8rem', lineHeight: 1.4, color: `${onFrame.page}E6` }}>
                    {roll.use.desc}
                </Typography>
            )}

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
                // Abaixo do cabeçalho do celular; no desktop, centrado no conteúdo (fora da sidebar,
                // aberta ou recolhida: `--sidebar-w` vem do MainLayout).
                top: { xs: 72, md: 16 },
                left: { xs: '50%', md: 'calc(50% + var(--sidebar-w, 0px) / 2)' },
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
    at ? new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''

/** Uma linha das últimas rolagens: sem animação, com a conta inteira. Também a do histórico de rolagens. */
export const HistoryRow = ({ roll }: { roll: TableRoll }) => (
    <Box sx={{ py: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700 }}>{roll.by || tr('Alguém', 'Someone')}</Typography>
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
                    {roll.check.mythic && <Chip size="small" label={tr("✦ mítico", '✦ mythic')} variant="outlined" sx={{ height: 20, color: MYTHIC_COLOR, borderColor: MYTHIC_COLOR }} />}
                </Stack>
                {roll.check.parts.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{partsLine(roll.check.parts)}</Typography>
                )}
            </Box>
        )}
        {roll.damage && (
            <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2">
                    <b>{tr('Dano ', 'Damage ')}{roll.damage.total}</b>
                    {' — '}
                    {roll.damage.parts.map((p) => `${p.label}: ${partFormula(p)} = ${p.total}${p.persistent ? tr(' (persistente)', ' (persistent)') : ''}`).join(' · ')}
                </Typography>
                {roll.damage.crit && (
                    <Typography variant="body2" sx={{ color: gold.deep }}>
                        {tr('Crítico ', 'Critical ')}{roll.damage.crit.total}{roll.damage.crit.note ? ` (${roll.damage.crit.note})` : ''}
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
                        <b>{`${raysLabel(roll)} ${i + 1}`}:</b> {tr(' ataque ', ' attack ')}{ray.check.total} (d20 {ray.check.d20} {signed(ray.check.mod)}) · <b>{tr('dano ', 'damage ')}{ray.damage.total}</b>
                        {' — '}
                        {ray.damage.parts.map((p) => `${p.label}: ${partFormula(p)} = ${p.total}${p.persistent ? tr(' (persistente)', ' (persistent)') : ''}`).join(' · ')}
                        {ray.damage.crit ? tr(` · crítico ${ray.damage.crit.total}${ray.damage.crit.note ? ` (${ray.damage.crit.note})` : ''}`, ` · critical ${ray.damage.crit.total}${ray.damage.crit.note ? ` (${ray.damage.crit.note})` : ''}`) : ''}
                    </Typography>
                ))}
                <Typography variant="body2"><b>Total {rayTotal(roll.rays)}</b> {tr(' · todos críticos ', ' · all critical ')}{rayCritTotal(roll.rays)}</Typography>
            </Box>
        )}
        {roll.use && <Typography variant="body2" sx={{ mt: 0.5 }}><b>{roll.use.text}</b></Typography>}
        {roll.use?.desc && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-line' }}>{roll.use.desc}</Typography>}
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
    const navigate = useNavigate()
    return (
        <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 'min(400px, 100vw)' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>{tr('Últimas rolagens', 'Latest rolls')}</Typography>
                <IconButton aria-label={tr("Fechar", 'Close')} onClick={onClose}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ px: 2, overflowY: 'auto' }}>
                {rolls.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 3, fontStyle: 'italic' }}>
                        {ready ? tr('Ninguém rolou nada nas últimas 24 horas.', 'Nobody rolled anything in the last 24 hours.') : tr('Carregando…', 'Loading…')}
                    </Typography>
                ) : (
                    <Stack divider={<Divider flexItem />}>
                        {rolls.map((r) => <HistoryRow key={r.id} roll={r} />)}
                    </Stack>
                )}
                <Button fullWidth sx={{ my: 1.5 }} onClick={() => { onClose(); navigate('/historico') }}>
                    {tr('Ver o histórico completo', 'See the full history')}</Button>
            </Box>
        </Drawer>
    )
}
