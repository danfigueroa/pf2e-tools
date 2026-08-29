// Exportação em PNG e envio para a Iniciativa.

import { useState } from 'react'
import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { Download as DownloadIcon, FormatListNumbered as InitiativeIcon } from '@mui/icons-material'
import html2canvas from 'html2canvas'
import type { ScaledMonster } from '../types'

interface Props {
    /** O nó que vira imagem — normalmente o wrapper do stat block. */
    target: React.RefObject<HTMLDivElement | null>
    monster: ScaledMonster
    onSendToInitiative: () => void
}

/**
 * `canvas.toBlob` é assíncrono e não devolve promessa.
 *
 * O `ExportOptions.tsx` do módulo de transformação chama sem esperar: o alerta
 * de sucesso aparece antes de o blob existir e uma falha do `toBlob` some sem
 * deixar rastro. Aqui a chamada é envolvida, para "Exportado" só aparecer
 * quando o arquivo realmente saiu.
 */
const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

export function MonsterExport({ target, monster, onSendToInitiative }: Props) {
    const [exporting, setExporting] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleExport = async () => {
        if (!target.current) return
        setExporting(true)
        setDone(false)
        setError(null)
        try {
            const canvas = await html2canvas(target.current, {
                // Sempre branco: o stat block é uma peça de impressão.
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
            })
            const blob = await toBlob(canvas)
            if (!blob) throw new Error('não foi possível gerar a imagem')

            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            const slug = monster.source.name.replace(/[^\w]+/g, '-').toLowerCase()
            link.download = `${slug}-nivel-${monster.level}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            setDone(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'falha ao exportar')
        } finally {
            setExporting(false)
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }}>
                <Button
                    variant="contained"
                    onClick={handleExport}
                    disabled={exporting}
                    startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                >
                    {exporting ? 'Gerando…' : 'Exportar PNG'}
                </Button>
                <Button variant="outlined" startIcon={<InitiativeIcon />} onClick={onSendToInitiative}>
                    Enviar para Iniciativa
                </Button>
            </Box>

            {done && <Alert severity="success" sx={{ mt: 1 }}>Imagem exportada.</Alert>}
            {error && <Alert severity="error" sx={{ mt: 1 }}>Não deu para exportar: {error}</Alert>}
        </Box>
    )
}
