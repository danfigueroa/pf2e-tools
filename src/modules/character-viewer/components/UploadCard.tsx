import { useRef } from 'react'
import { Box, Button, Card, CardContent, Stack, Typography, Alert } from '@mui/material'
import { CloudUpload as UploadIcon } from '@mui/icons-material'

interface Props {
    onJson: (data: unknown) => void
    error: string | null
}

export const UploadCard = ({ onJson, error }: Props) => {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            onJson(json)
        } catch {
            onJson({ __invalid: true })
        }
    }

    return (
        <Card sx={{ maxWidth: 600, mx: 'auto', mt: { xs: 2, md: 6 } }}>
            <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
                <UploadIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                    Ficha Virtual
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Suba o JSON da sua ficha (Pathbuilder/Wanderer's Guide) e visualize o personagem
                    em uma interface moderna, otimizada para celular, tablet e computador.
                    Toque em qualquer talento, magia ou habilidade para ver a descrição completa.
                </Typography>

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

                <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<UploadIcon />}
                        onClick={() => inputRef.current?.click()}
                    >
                        Escolher arquivo JSON
                    </Button>
                </Stack>

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
