import { useEffect, useState, useSyncExternalStore } from 'react'
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material'
import { Sync as SyncIcon, CloudOff as OfflineIcon } from '@mui/icons-material'
import { gold, status as statusColor } from '../../../theme/palette'
import { getStatus, refresh, subscribeStatus } from '../../../services/tableState'
import { charSlug } from '../charId'
import type { BuildInfo } from '../../../pathbuilder/types'
import { VIEW_OK } from '../sheetAccess'
import { tr } from '../../../i18n'

/** Estado da sincronia com a mesa (o Realtime avisa; nada de polling aqui). */
const useSyncStatus = () => useSyncExternalStore(subscribeStatus, getStatus, getStatus)

/** "agora", "há 2 min", "há 1 h" — sem dependência de biblioteca de datas. */
function agoLabel(at: number, now: number): string {
    const secs = Math.max(0, Math.round((now - at) / 1000))
    if (secs < 45) return tr('agora', 'now')
    const mins = Math.round(secs / 60)
    if (mins < 60) return tr(`há ${mins} min`, `${mins} min ago`)
    return tr(`há ${Math.round(mins / 60)} h`, `${Math.round(mins / 60)} h ago`)
}

interface Props {
    build: BuildInfo
}

/**
 * Indicador da sincronia + botão "Atualizar". Com o Realtime aberto ("Ao vivo")
 * a mesa chega sozinha e o botão some; sem ele, a sincronia volta a ser sob
 * demanda — ao abrir a ficha e aqui.
 */
export const SyncStatus = ({ build }: Props) => {
    const sync = useSyncStatus()
    const [busy, setBusy] = useState(false)

    // Só para o rótulo "há N min" envelhecer sozinho; não fala com o servidor.
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(id)
    }, [])

    const handleRefresh = async () => {
        setBusy(true)
        try {
            await refresh(charSlug(build))
            setNow(Date.now())
        } finally {
            setBusy(false)
        }
    }

    const offline = sync.phase === 'offline'
    const saving = sync.phase === 'saving'
    const loading = busy || sync.phase === 'loading'

    let label: string
    let tone: string
    let hint: string

    if (offline) {
        label = tr('Só neste aparelho', 'Only on this device')
        tone = statusColor.warning
        hint = tr('Sem contato com o servidor. As alterações ficam salvas aqui e sobem quando a conexão voltar.', 'No contact with the server. Changes are saved here and go up when the connection comes back.')
    } else if (!sync.storeReady) {
        label = tr('Só neste aparelho', 'Only on this device')
        tone = statusColor.warning
        hint = tr('O servidor está sem armazenamento configurado, então o estado não é compartilhado.', 'The server has no storage configured, so the state isn\'t shared.')
    } else if (saving) {
        label = tr('Salvando…', 'Saving…')
        tone = gold.deep
        hint = tr('Enviando a alteração para a mesa.', 'Sending the change to the table.')
    } else if (sync.live) {
        label = tr('Ao vivo', 'Live')
        tone = statusColor.success
        hint = tr('PV, slots e condições são os mesmos para todos os jogadores, e o que mudar em outro aparelho aparece aqui na hora.', 'HP, slots and conditions are the same for every player, and what changes on another device shows up here right away.')
    } else if (sync.lastSyncedAt) {
        label = tr(`Sincronizado ${agoLabel(sync.lastSyncedAt, now)}`, `Synced ${agoLabel(sync.lastSyncedAt, now)}`)
        tone = gold.deep
        hint = tr('PV, slots e condições são os mesmos para todos os jogadores.', 'HP, slots and conditions are the same for every player.')
    } else {
        label = tr('Sincronizando…', 'Syncing…')
        tone = gold.deep
        hint = tr('Buscando o estado da mesa.', 'Fetching the table state.')
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {!sync.live && (
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                    onClick={handleRefresh}
                    disabled={loading}
                    sx={{ flexShrink: 0 }}
                    {...VIEW_OK}
                >
                    {tr('Atualizar', 'Refresh')}</Button>
            )}
            <Tooltip title={hint} enterDelay={400}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    {(offline || !sync.storeReady) && (
                        <OfflineIcon sx={{ fontSize: '1rem', color: tone, flexShrink: 0 }} />
                    )}
                    <Typography
                        variant="caption"
                        sx={{ color: tone, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                        {label}
                    </Typography>
                </Box>
            </Tooltip>
        </Box>
    )
}
