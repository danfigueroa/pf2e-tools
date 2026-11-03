import { useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material'
import { CheckCircle as DoneIcon, RadioButtonUnchecked as PendingIcon } from '@mui/icons-material'
import { EmbedDialog } from './EmbedDialog'
import { discardDraft, DRAFT_STEPS, type DraftStep, type DraftWaitReason, type PublishedSheet, type SheetDraft } from '../../../services/sheets'
import { startPreparation, stopPreparation, usePreparation } from '../../../services/sheetPreparation'
import { tr } from '../../../i18n'

interface Props {
    slug: string
    name: string
    /** O andamento que já se conhece (o da lista), para a barra não começar do zero. */
    initial?: SheetDraft | null
    onClose: () => void
    /** A ficha foi promovida: abre-a. */
    onReady: (sheet: PublishedSheet) => void
    onDiscarded: () => void
}

const STEP_LABEL: Record<DraftStep, () => string> = {
    lookups: () => tr('Armas, armaduras e itens (AON)', 'Weapons, armor and items (AON)'),
    companions: () => tr('Companheiros', 'Companions'),
    'desc-pt': () => tr('Descrições em português', 'Descriptions in Portuguese'),
    'desc-en': () => tr('Descrições em inglês', 'Descriptions in English'),
    'guide-pt': () => tr('Guia "Como Jogar" em português', '"How to Play" guide in Portuguese'),
    'guide-en': () => tr('Guia "Como Jogar" em inglês', '"How to Play" guide in English'),
    finish: () => tr('Conferência e publicação', 'Final check and publishing'),
}

const WAIT_TEXT: Record<DraftWaitReason, () => string> = {
    translation: () => tr('O serviço de tradução está no limite de uso', 'The translation service is at its usage limit'),
    guide: () => tr('A IA não devolveu um guia válido', 'The AI didn\'t return a valid guide'),
    aon: () => tr('A AON não respondeu tudo', 'AON didn\'t answer everything'),
    busy: () => tr('Outra aba está trabalhando nesta ficha', 'Another tab is working on this sheet'),
    network: () => tr('Sem resposta do servidor', 'No answer from the server'),
}

/**
 * O preparo de uma publicação (ver `services/sheetPreparation.ts`): a barra, os passos e, quando a IA
 * ou a AON não avançam, quanto falta para a próxima tentativa. Fechar não para o preparo — ele segue
 * nesta aba e, se ela fechar, retoma pelo cartão "Em preparo" da Ficha Virtual.
 */
export const PreparingDialog = ({ slug, name, initial = null, onClose, onReady, onDiscarded }: Props) => {
    const view = usePreparation(slug)
    const [confirmDiscard, setConfirmDiscard] = useState(false)
    const [discarding, setDiscarding] = useState(false)
    const [discardError, setDiscardError] = useState<string | null>(null)

    // Abrir o diálogo é retomar: o laço começa se ainda não roda nesta aba.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o `initial` só semeia a primeira pintura
    useEffect(() => { startPreparation(slug, initial) }, [slug])

    const readyFired = useRef(false)
    useEffect(() => {
        if (view?.phase === 'ready' && view.sheet && !readyFired.current) {
            readyFired.current = true
            onReady(view.sheet)
        }
    }, [view, onReady])

    // Contagem regressiva da próxima tentativa.
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (view?.phase !== 'waiting') return
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [view?.phase])

    const progress = view?.draft?.progress ?? initial?.progress ?? null
    const pct = progress ? Math.round((100 * progress.done) / progress.total) : 0
    const current = progress?.step ?? null
    const seconds = view?.retryAt ? Math.max(0, Math.ceil((view.retryAt - now) / 1000)) : null

    const discard = async () => {
        setDiscarding(true)
        setDiscardError(null)
        try {
            stopPreparation(slug)
            await discardDraft(slug)
            onDiscarded()
        } catch (e) {
            setDiscardError(e instanceof Error ? e.message : tr('Falha ao descartar', 'Failed to discard'))
            setDiscarding(false)
        }
    }

    return (
        <EmbedDialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{tr(`Preparando ${name}`, `Preparing ${name}`)}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <LinearProgress
                        variant={progress ? 'determinate' : 'indeterminate'}
                        value={pct}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        aria-label={tr('Andamento do preparo', 'Preparation progress')}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                        {pct}%
                    </Typography>
                </Box>

                <Stack spacing={0.75} component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {DRAFT_STEPS.map((step) => {
                        const done = progress?.steps[step] === 'done'
                        const active = !done && step === current && view?.phase !== 'error'
                        const left = progress?.remaining[step]
                        return (
                            <Box component="li" key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {done ? (
                                    <DoneIcon fontSize="small" color="success" />
                                ) : active ? (
                                    <CircularProgress size={18} thickness={5} />
                                ) : (
                                    <PendingIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                                )}
                                <Typography variant="body2" sx={{ fontWeight: active ? 700 : 400, color: done || active ? 'text.primary' : 'text.secondary' }}>
                                    {STEP_LABEL[step]()}
                                    {active && typeof left === 'number' && left > 0 ? tr(` · faltam ${left}`, ` · ${left} left`) : ''}
                                </Typography>
                            </Box>
                        )
                    })}
                </Stack>

                {view?.phase === 'waiting' && view.reason && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        {WAIT_TEXT[view.reason]()}
                        {seconds !== null ? tr(` — tentando de novo em ${seconds} s.`, ` — trying again in ${seconds} s.`) : '.'}
                    </Alert>
                )}
                {view?.phase === 'error' && (
                    <Alert
                        severity="error"
                        sx={{ mt: 2 }}
                        action={<Button color="inherit" size="small" onClick={() => startPreparation(slug)}>{tr('Tentar de novo', 'Try again')}</Button>}
                    >
                        {view.error}
                    </Alert>
                )}
                {view?.phase === 'gone' && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        {tr('Este preparo não existe mais (foi descartado em outro aparelho).', 'This preparation no longer exists (it was discarded on another device).')}</Alert>
                )}
                {discardError && <Alert severity="error" sx={{ mt: 2 }}>{discardError}</Alert>}

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {tr('A ficha só abre quando estiver completa, e a mesa a vê "em preparo" até lá. Pode fechar esta janela: o preparo continua nesta aba e, se você sair, retoma de onde parou quando voltar à Ficha Virtual.', 'The sheet only opens once it is complete, and the table sees it "being prepared" until then. You can close this window: the preparation keeps going in this tab and, if you leave, resumes where it stopped when you come back to the Virtual Sheet.')}</Typography>
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                {confirmDiscard ? (
                    <>
                        <Typography variant="body2" sx={{ mr: 'auto' }}>
                            {tr('Descartar o preparo? A ficha enviada não será publicada.', 'Discard the preparation? The uploaded sheet won\'t be published.')}</Typography>
                        <Button onClick={() => setConfirmDiscard(false)} disabled={discarding}>{tr('Voltar', 'Back')}</Button>
                        <Button color="error" onClick={discard} disabled={discarding}>{tr('Descartar', 'Discard')}</Button>
                    </>
                ) : (
                    <>
                        <Button color="error" onClick={() => setConfirmDiscard(true)} sx={{ mr: 'auto' }}>{tr('Descartar', 'Discard')}</Button>
                        <Button variant="contained" onClick={onClose}>{tr('Fechar', 'Close')}</Button>
                    </>
                )}
            </DialogActions>
        </EmbedDialog>
    )
}
