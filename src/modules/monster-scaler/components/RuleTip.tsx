// A caixinha de regra do stat block: passa o mouse (ou segura o dedo) num
// termo e a regra aparece, em inglês, direto do Archives of Nethys.
//
// POR QUE EM INGLÊS: a prosa das habilidades do monstro já é inglesa por
// decisão de produto, e uma caixa traduzida ao lado dela seria a mistura pior.
// Além disso, traduzir a cada hover estouraria o rate limit do tier gratuito —
// o mesmo motivo pelo qual a busca de criatura e a de magia não traduzem.
//
// A busca acontece ao ABRIR, nunca no render: uma ficha tem dezenas de termos e
// pré-carregar todos seria uma enxurrada de requisições para ler talvez uma.

import { useState, type ReactNode } from 'react'
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material'
import { fetchRule, type AonRule } from '../../../services/rules'
import type { RuleKind } from '../ruleTerms'

// Hex literal, como manda o stat block: este componente é desenhado DENTRO do
// subtree que o html2canvas rasteriza (ver MonsterStatBlock.tsx).
const GREEN = '#1B3B2A'
const GOLD_DEEP = '#7E611D'
const PARCHMENT = '#f7f2e7'
const INK = '#1a1a1a'
const MUTED = '#6b6152'

interface Props {
    /** O termo como o AON o registra ("Grab", "Frightened", "Fireball"). */
    name: string
    kind?: RuleKind
    /** Sem o tracejado, para termo que já se destaca sozinho (o chip de traço). */
    plain?: boolean
    children: ReactNode
}

function RuleBody({ rule, loading }: { rule: AonRule | null; loading: boolean }) {
    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} sx={{ color: GOLD_DEEP }} />
                <Typography variant="caption">Buscando a regra…</Typography>
            </Box>
        )
    }
    if (!rule) {
        return (
            <Typography variant="caption" sx={{ color: MUTED }}>
                O Archives of Nethys não tem entrada para este termo.
            </Typography>
        )
    }
    return (
        <Box>
            <Typography sx={{ fontWeight: 700, color: GREEN, fontSize: '0.85rem' }}>
                {rule.name}
                <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>
                    {rule.level !== null ? ` · rank ${rule.level}` : ''}
                    {rule.actions ? ` · ${rule.actions}` : ''}
                </Box>
            </Typography>
            {rule.traits.length > 0 && (
                <Typography sx={{ color: GOLD_DEEP, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
                    {rule.traits.join(', ')}
                </Typography>
            )}
            {/* `pre-line` preserva os parágrafos que o parse separou. */}
            <Typography sx={{ fontSize: '0.8rem', whiteSpace: 'pre-line', color: INK }}>
                {rule.text}
            </Typography>
        </Box>
    )
}

export function RuleTip({ name, kind, plain = false, children }: Props) {
    const [rule, setRule] = useState<AonRule | null>(null)
    const [loading, setLoading] = useState(false)
    const [asked, setAsked] = useState(false)

    const open = () => {
        if (asked) return
        setAsked(true)
        setLoading(true)
        void fetchRule(name, kind ?? null).then((found) => {
            setRule(found)
            setLoading(false)
        })
    }

    return (
        <Tooltip
            title={<RuleBody rule={rule} loading={loading} />}
            onOpen={open}
            arrow
            placement="top"
            enterDelay={250}
            // No celular não há mouse: o toque longo abre, e a caixa fica tempo
            // suficiente para ler um parágrafo antes de sumir sozinha.
            enterTouchDelay={300}
            leaveTouchDelay={15000}
            slotProps={{
                tooltip: {
                    sx: {
                        maxWidth: 420,
                        backgroundColor: PARCHMENT,
                        color: INK,
                        border: `1px solid ${GREEN}`,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        p: 1.25,
                    },
                },
                arrow: { sx: { color: PARCHMENT, '&::before': { border: `1px solid ${GREEN}` } } },
            }}
        >
            {/* O sublinhado pontilhado é o que diz que ali tem regra. Ele entra
                no PNG exportado de propósito: num stat block impresso, marcar o
                termo de glossário é o comportamento certo. */}
            <Box
                component="span"
                sx={{
                    borderBottom: plain ? 'none' : '1px dotted #a89a7c',
                    cursor: 'help',
                    // O tracejado não pode empurrar a linha de base do bloco.
                    lineHeight: 'inherit',
                }}
            >
                {children}
            </Box>
        </Tooltip>
    )
}
