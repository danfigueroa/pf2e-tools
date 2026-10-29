import { memo, useRef, useState } from 'react'
import { Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material'
import { Close as CloseIcon, Send as SendIcon } from '@mui/icons-material'
import { gold, green, parchment, rule } from '../../../theme'
import { LOG_TAG_LABEL, LOG_TAGS, MAX_LOG, newId, type LogEntry, type LogTag } from '../doc'

// Registro durante o jogo: anotações rápidas com hora (o que aconteceu, decisões,
// saques, pistas). Enter grava; a etiqueta escolhida fica para a próxima, porque
// numa luta o GM anota várias coisas do mesmo tipo seguidas.

const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayOf = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

interface Props {
    log: LogEntry[]
    onChange: (log: LogEntry[]) => void
}

export const SessionLog = memo(function SessionLog({ log, onChange }: Props) {
    const [text, setText] = useState('')
    const [tag, setTag] = useState<LogTag | null>(null)
    const [filter, setFilter] = useState<LogTag | null>(null)
    const input = useRef<HTMLInputElement | null>(null)

    const add = () => {
        const t = text.trim()
        if (!t) return
        onChange([...log, { id: newId('r'), at: Date.now(), tag, text: t }].slice(-MAX_LOG))
        setText('')
        input.current?.focus()
    }

    const shown = [...log].reverse().filter((e) => !filter || e.tag === filter)
    const days = new Set(log.map((e) => dayOf(e.at)))

    return (
        <Stack spacing={1.5}>
            <Box sx={{ p: 1.5, border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.page }}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    {LOG_TAGS.map((t) => (
                        <Chip
                            key={t}
                            size="small"
                            label={LOG_TAG_LABEL[t]}
                            onClick={() => setTag((cur) => (cur === t ? null : t))}
                            variant={tag === t ? 'filled' : 'outlined'}
                            sx={tag === t ? { bgcolor: green.mid, color: parchment.paper } : undefined}
                        />
                    ))}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                        inputRef={input}
                        size="small"
                        fullWidth
                        placeholder="O que aconteceu? (Enter grava)"
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, 2000))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
                        slotProps={{ htmlInput: { 'aria-label': 'Nova anotação do registro' } }}
                    />
                    <Button variant="contained" onClick={add} disabled={!text.trim()} aria-label="Gravar anotação" sx={{ minWidth: 0, px: 1.5 }}>
                        <SendIcon fontSize="small" />
                    </Button>
                </Stack>
            </Box>

            {log.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                    <Typography variant="caption" color="text.secondary">Mostrar:</Typography>
                    <Chip size="small" label="Tudo" variant={filter ? 'outlined' : 'filled'} onClick={() => setFilter(null)} />
                    {LOG_TAGS.filter((t) => log.some((e) => e.tag === t)).map((t) => (
                        <Chip key={t} size="small" label={LOG_TAG_LABEL[t]} variant={filter === t ? 'filled' : 'outlined'} onClick={() => setFilter(t)} />
                    ))}
                </Stack>
            )}

            {shown.length === 0 && (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {log.length ? 'Nada com essa etiqueta.' : 'Nada anotado ainda. Durante o jogo, anote aqui o que acontece.'}
                </Typography>
            )}
            <Stack component="ol" spacing={0} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {shown.map((e) => (
                    <Box component="li" key={e.id} sx={{
                        display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.75, borderBottom: `1px solid ${rule}`,
                    }}>
                        <Typography variant="caption" sx={{ color: gold.deep, fontWeight: 700, minWidth: 44, pt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                            {days.size > 1 ? `${dayOf(e.at)} ` : ''}{time(e.at)}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {e.tag && <Chip size="small" label={LOG_TAG_LABEL[e.tag]} sx={{ mr: 0.75, height: 20 }} />}
                            <Typography component="span" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text}</Typography>
                        </Box>
                        <IconButton size="small" aria-label="Apagar anotação" onClick={() => onChange(log.filter((x) => x.id !== e.id))}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                ))}
            </Stack>
        </Stack>
    )
})
