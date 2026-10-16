import { memo, useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { DiceTray } from '../../../motion/DiceTray'
import { gold, mapChrome, parchment } from '../../../theme'
import { formulaText, rollSummary, sanitizeRoll, type SharedRoll } from '../dice'

interface Props {
    rolls: Record<string, unknown>
}

interface Shown { id: string; roll: SharedRoll }

/** Quanto a rolagem fica na tela de quem a recebe: animação (~1,3 s) + tempo de ler. */
const SHOW_MS = 7000
const MAX_SHOWN = 3

/**
 * Rolagens da mesa (rolador de dados), no centro da tela, para todos.
 *
 * Mesma regra do `PingLayer`: cada rolagem aparece UMA vez por aparelho,
 * decidida pelo id — as que já existiam quando o mapa abriu contam como vistas.
 * Quem rolou também a vê por aqui: `writeMapField` já sobrepõe o campo no
 * mapa local na hora, sem esperar a rede.
 *
 * Fica fora do "mundo" do mapa: tamanho fixo em qualquer zoom, e nenhum
 * gesto de pan/zoom a toca.
 */
export const DiceResultLayer = memo(function DiceResultLayer({ rolls }: Props) {
    const seen = useRef<Set<string> | null>(null)
    if (seen.current === null) seen.current = new Set(Object.keys(rolls))
    const [shown, setShown] = useState<Shown[]>([])
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

    useEffect(() => {
        const fresh: Shown[] = []
        for (const [id, raw] of Object.entries(rolls)) {
            if (seen.current!.has(id)) continue
            seen.current!.add(id)
            const roll = sanitizeRoll(raw)
            if (roll) fresh.push({ id, roll })
        }
        if (fresh.length === 0) return
        setShown((prev) => [...prev, ...fresh].slice(-MAX_SHOWN))
        for (const f of fresh) {
            timers.current.add(setTimeout(() => setShown((prev) => prev.filter((s) => s.id !== f.id)), SHOW_MS))
        }
    }, [rolls])

    useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

    if (shown.length === 0) return null
    return (
        <Box
            sx={{
                position: 'absolute',
                top: 96,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                alignItems: 'center',
                pointerEvents: 'none',
            }}
        >
            {shown.map(({ id, roll }) => (
                <Box
                    key={id}
                    sx={{
                        px: 2,
                        py: 1.25,
                        minWidth: 180,
                        borderRadius: 2,
                        backgroundColor: `${mapChrome.label}F2`,
                        border: `2px solid ${gold.main}`,
                        boxShadow: '0 6px 24px #00000080',
                        color: parchment.page,
                    }}
                >
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: gold.bright, fontWeight: 700, mb: 0.75 }}>
                        {roll.by || 'Alguém'} rolou {formulaText(roll.rolls.length, roll.faces, roll.flat)}
                    </Typography>
                    <DiceTray roll={roll} />
                    {/* Só o resultado vai para o leitor de tela; a bandeja é aria-hidden. */}
                    <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} role="status">
                        {rollSummary(roll)}
                    </Box>
                </Box>
            ))}
        </Box>
    )
})
