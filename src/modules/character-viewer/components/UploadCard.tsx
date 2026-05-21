import { useRef, useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CircularProgress,
    Divider,
    Stack,
    Typography,
    Alert,
} from '@mui/material'
import { CloudUpload as UploadIcon, Person as PersonIcon } from '@mui/icons-material'
import { CAMPAIGN_PRESETS } from '../campaignPresets'

interface Props {
    onJson: (data: unknown) => void
    error: string | null
}

export const UploadCard = ({ onJson, error }: Props) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [loadingPreset, setLoadingPreset] = useState<string | null>(null)

    const handleFile = async (file: File) => {
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            onJson(json)
        } catch {
            onJson({ __invalid: true })
        }
    }

    const handlePreset = async (filename: string) => {
        setLoadingPreset(filename)
        try {
            const res = await fetch(`/characters/${filename}`)
            const json = await res.json()
            onJson(json)
        } catch {
            onJson({ __invalid: true })
        } finally {
            setLoadingPreset(null)
        }
    }

    return (
        <Card sx={{ maxWidth: 600, mx: 'auto', mt: { xs: 2, md: 6 } }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
                    Ficha Virtual
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.6, textAlign: 'center' }}>
                    Selecione um personagem da campanha ou carregue seu próprio arquivo JSON.
                </Typography>

                <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    Fichas da Campanha
                </Typography>

                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                    {CAMPAIGN_PRESETS.map((preset) => (
                        <Card
                            key={preset.filename}
                            variant="outlined"
                            sx={{ flex: '1 1 140px', minWidth: 130 }}
                        >
                            <CardActionArea
                                onClick={() => handlePreset(preset.filename)}
                                disabled={loadingPreset !== null}
                                sx={{ p: 1.5, textAlign: 'center' }}
                            >
                                {loadingPreset === preset.filename ? (
                                    <CircularProgress size={28} sx={{ mb: 0.5 }} />
                                ) : (
                                    <PersonIcon sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                                )}
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {preset.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {preset.class} {preset.level}
                                </Typography>
                            </CardActionArea>
                        </Card>
                    ))}
                </Stack>

                <Divider sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                        ou carregue sua própria ficha
                    </Typography>
                </Divider>

                <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFile(f)
                        if (inputRef.current) inputRef.current.value = ''
                    }}
                />

                <Box sx={{ textAlign: 'center' }}>
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<UploadIcon />}
                        onClick={() => inputRef.current?.click()}
                        disabled={loadingPreset !== null}
                    >
                        Escolher arquivo JSON
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mt: 3, fontSize: '0.78rem', color: 'text.secondary', textAlign: 'left' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        Formatos suportados:
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                        • Export do Pathbuilder 2e (campo <code>build</code>)
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    )
}
