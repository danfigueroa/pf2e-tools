import { useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { Edit as EditIcon, Undo as UndoIcon } from '@mui/icons-material'
import { EmbedDialog } from './EmbedDialog'
import {
    FIX_FIELDS,
    getFixRecord,
    originalOf,
    saveFix,
    useFixesVersion,
    type FixFields,
    type FixKind,
} from '../../../services/translationFixes'
import { status as statusColor } from '../../../theme/palette'

const FIELD_LABEL: Record<string, string> = {
    description: 'Descrição',
    prerequisites: 'Pré-requisitos',
    trigger: 'Gatilho',
    requirements: 'Requisitos',
    frequency: 'Frequência',
    cost: 'Custo',
    access: 'Acesso',
}

interface Props {
    kind: FixKind
    name: string
    /** A descrição como está na tela (já com a correção, se houver). */
    payload: object
}

const textOf = (payload: object, field: string): string => {
    const value = (payload as Record<string, unknown>)[field]
    return typeof value === 'string' ? value : ''
}

/**
 * "Corrigir tradução" no pé da descrição: a mesa conserta o texto uma vez, para
 * todos os aparelhos e mesas, e o LLM nunca o desfaz (ver services/translationFixes).
 * Sem login, qualquer um corrige; a salvaguarda é o "Desfazer" (a versão de antes da
 * última mudança) e o "Voltar à tradução automática".
 */
export const TranslationFix = ({ kind, name, payload }: Props) => {
    useFixesVersion()
    const record = getFixRecord(kind, name)
    const active = !!record && Object.keys(record.fields).length > 0
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)

    const run = async (fields: FixFields) => {
        setBusy(true)
        setFailed(false)
        const saved = await saveFix(kind, name, fields)
        setBusy(false)
        if (!saved) setFailed(true)
        return !!saved
    }

    return (
        <Box sx={{ mt: 1.5 }}>
            {active && (
                <Typography variant="caption" sx={{ display: 'block', color: statusColor.success, fontWeight: 600, mb: 0.5 }}>
                    Tradução corrigida pela mesa
                </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => { setFailed(false); setOpen(true) }}>
                    Corrigir tradução
                </Button>
                {/* A primeira correção não tem anterior: desfazê-la é voltar à tradução automática. */}
                {record && (active || record.previous) && (
                    <Button size="small" startIcon={busy ? <CircularProgress size={14} /> : <UndoIcon />} disabled={busy}
                        onClick={() => { void run(record.previous ?? {}) }}>
                        Desfazer última correção
                    </Button>
                )}
            </Stack>
            {failed && !open && (
                <Typography variant="caption" sx={{ display: 'block', color: statusColor.error, mt: 0.5 }}>
                    Não deu para salvar. Confira a conexão e tente de novo.
                </Typography>
            )}
            {open && (
                <FixDialog
                    kind={kind}
                    name={name}
                    payload={payload}
                    active={active}
                    busy={busy}
                    failed={failed}
                    onSave={async (fields) => { if (await run(fields)) setOpen(false) }}
                    onClose={() => setOpen(false)}
                />
            )}
        </Box>
    )
}

interface DialogProps {
    kind: FixKind
    name: string
    payload: object
    active: boolean
    busy: boolean
    failed: boolean
    onSave: (fields: FixFields) => void
    onClose: () => void
}

const FixDialog = ({ kind, name, payload, active, busy, failed, onSave, onClose }: DialogProps) => {
    const original = originalOf(payload)
    // Só os campos que a descrição tem: o editor não oferece "Gatilho" a quem não tem gatilho.
    const fields = FIX_FIELDS[kind].filter((f) => textOf(original, f) || textOf(payload, f))
    // Campos NÃO controlados, lidos só ao salvar: com o valor no estado, cada tecla repintava o diálogo e o
    // textarea do MUI se remedia — digitado rápido (um robô de teste), passava do limite de atualizações do React.
    const inputs = useRef<Record<string, HTMLTextAreaElement | null>>({})

    // Grava só o que difere da tradução automática: o resto continua acompanhando o LLM.
    const changes = (): FixFields => Object.fromEntries(fields.flatMap((f) => {
        const text = (inputs.current[f]?.value ?? '').trim()
        return text && text !== textOf(original, f).trim() ? [[f, text]] : []
    }))

    return (
        <EmbedDialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ pb: 1 }}>Corrigir tradução · {name}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    A correção vale para todos os aparelhos e as duas mesas, e a tradução automática nunca a
                    desfaz. Campo apagado volta à tradução automática.
                </Typography>
                {kind === 'spell' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Mantenha os dados (2d6, 1d8…) como estão: é por eles que o app mostra a magia elevada.
                    </Alert>
                )}
                <Stack spacing={2}>
                    {fields.map((f) => (
                        <TextField
                            key={f}
                            label={FIELD_LABEL[f] ?? f}
                            defaultValue={textOf(payload, f)}
                            inputRef={(el: HTMLTextAreaElement | null) => { inputs.current[f] = el }}
                            multiline
                            minRows={f === 'description' ? 6 : 1}
                            fullWidth
                            slotProps={{ htmlInput: { maxLength: 8000 } }}
                        />
                    ))}
                </Stack>
                {failed && (
                    <Alert severity="error" sx={{ mt: 2 }}>Não deu para salvar. Confira a conexão e tente de novo.</Alert>
                )}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                {active && (
                    <Button color="inherit" disabled={busy} onClick={() => onSave({})} sx={{ mr: 'auto' }}>
                        Voltar à tradução automática
                    </Button>
                )}
                <Button onClick={onClose} disabled={busy}>Cancelar</Button>
                <Button variant="contained" disabled={busy} onClick={() => onSave(changes())}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    Salvar para a mesa
                </Button>
            </DialogActions>
        </EmbedDialog>
    )
}
