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
import { CAMPAIGN_PRESETS, loadPresetJson, type CharacterPreset } from '../campaignPresets'
import { usePublishedSheets } from '../usePublishedSheets'
import { fetchPublished, type PublishedSheet } from '../../../services/sheets'

/** De onde veio o JSON: arquivo enviado agora abre o diálogo de publicar. */
export type JsonOrigin =
    | { kind: 'file' }
    | { kind: 'preset'; published: PublishedSheet | null }

interface Props {
    onJson: (data: unknown, origin: JsonOrigin) => void
    error: string | null
}

export const UploadCard = ({ onJson, error }: Props) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [loadingPreset, setLoadingPreset] = useState<string | null>(null)

    const { levelOf, find, extras } = usePublishedSheets()

    const handleFile = async (file: File) => {
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            onJson(json, { kind: 'file' })
        } catch {
            onJson({ __invalid: true }, { kind: 'file' })
        }
    }

    const handlePreset = async (preset: CharacterPreset) => {
        setLoadingPreset(preset.filename)
        try {
            const { json, published } = await loadPresetJson(preset)
            onJson(json, { kind: 'preset', published })
        } catch {
            onJson({ __invalid: true }, { kind: 'preset', published: null })
        } finally {
            setLoadingPreset(null)
        }
    }

    // Personagem novo que alguém publicou — não existe arquivo fixo dele.
    const handlePublished = async (slug: string) => {
        setLoadingPreset(slug)
        try {
            const published = await fetchPublished(slug)
            onJson(published?.json ?? { __invalid: true }, { kind: 'preset', published })
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
                                onClick={() => handlePreset(preset)}
                                disabled={loadingPreset !== null}
                                sx={{ p: 1.5, textAlign: 'center' }}
                            >
                                {loadingPreset === preset.filename ? (
                                    <CircularProgress size={28} sx={{ mb: 0.5 }} />
                                ) : (
                                    <PersonIcon sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                                )}
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                    {preset.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {preset.class} {levelOf(preset)}
                                </Typography>
                                {find(preset) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontWeight: 600 }}>
                                        atualizada pela mesa
                                    </Typography>
                                )}
                            </CardActionArea>
                        </Card>
                    ))}
                    {extras.map((sheet) => (
                        <Card key={sheet.slug} variant="outlined" sx={{ flex: '1 1 140px', minWidth: 130 }}>
                            <CardActionArea
                                onClick={() => handlePublished(sheet.slug)}
                                disabled={loadingPreset !== null}
                                sx={{ p: 1.5, textAlign: 'center' }}
                            >
                                {loadingPreset === sheet.slug ? (
                                    <CircularProgress size={28} sx={{ mb: 0.5 }} />
                                ) : (
                                    <PersonIcon sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                                )}
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                    {sheet.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {sheet.className} {sheet.level}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontWeight: 600 }}>
                                    publicada pela mesa
                                </Typography>
                            </CardActionArea>
                        </Card>
                    ))}
                </Stack>

                <Divider sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                        atualizou no Pathbuilder? envie o JSON
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
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                        • Enviar a ficha de um personagem da mesa permite publicar a versão nova para todos
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    )
}
