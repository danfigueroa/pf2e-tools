import { useEffect, useState, useSyncExternalStore } from 'react'
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material'
import { Sync as SyncIcon, CloudOff as OfflineIcon } from '@mui/icons-material'
import { gold, status as statusColor } from '../../../theme/palette'
import { getStatus, refresh, subscribeStatus } from '../../../services/tableState'
import { charSlug } from '../charId'
import type { BuildInfo } from '../../character-sheet/types'

/** Estado da sincronia com a mesa, sem polling de rede. */
const useSyncStatus = () => useSyncExternalStore(subscribeStatus, getStatus, getStatus)

/** "agora", "há 2 min", "há 1 h" — sem dependência de biblioteca de datas. */
function agoLabel(at: number, now: number): string {
    const secs = Math.max(0, Math.round((now - at) / 1000))
    if (secs < 45) return 'agora'
    const mins = Math.round(secs / 60)
    if (mins < 60) return `há ${mins} min`
    return `há ${Math.round(mins / 60)} h`
}

interface Props {
    build: BuildInfo
}

/**
 * Botão "Atualizar" + indicador. A sincronia é sob demanda: puxa ao abrir a
 * ficha e aqui — nada de polling nem conexão persistente.
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
        label = 'Só neste aparelho'
        tone = statusColor.warning
        hint = 'Sem contato com o servidor. As alterações ficam salvas aqui e sobem quando a conexão voltar.'
    } else if (!sync.storeReady) {
        label = 'Só neste aparelho'
        tone = statusColor.warning
        hint = 'O servidor está sem armazenamento configurado, então o estado não é compartilhado.'
    } else if (saving) {
        label = 'Salvando…'
        tone = gold.deep
        hint = 'Enviando a alteração para a mesa.'
    } else if (sync.lastSyncedAt) {
        label = `Sincronizado ${agoLabel(sync.lastSyncedAt, now)}`
        tone = gold.deep
        hint = 'PV, slots e condições são os mesmos para todos os jogadores.'
    } else {
        label = 'Sincronizando…'
        tone = gold.deep
        hint = 'Buscando o estado da mesa.'
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                onClick={handleRefresh}
                disabled={loading}
                sx={{ flexShrink: 0 }}
            >
                Atualizar
            </Button>
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
