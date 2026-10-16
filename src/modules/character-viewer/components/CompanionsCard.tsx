import { useRef, useState } from 'react'
import { Alert, Box, Button, ButtonBase, Card, CardContent, Chip, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { Add as AddIcon, Close as RemoveIcon, PhotoCamera as CameraIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../character-sheet/types'
import { TOKEN_MAX_SIDE, deleteImage, imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { searchCreatures } from '../../../services/creatures'
import { initials } from '../../battle-map/geometry'
import { MAP_BACKDROP, TOKEN_NPC, parchment } from '../../../theme'
import { MAX_COMPANIONS, type Companion } from '../companions'
import { charSlug, companionsKeyFor } from '../charId'
import { useCompanions } from './useCompanions'

/** O token da criatura: toque para enviar ou trocar a imagem (permanente, pasta `tokens/`). */
const CompanionToken = ({ slug, companion, onChange }: { slug: string; companion: Companion; onChange: (url: string | null) => void }) => {
    const src = useImageUrl(companion.token?.url)
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const upload = async (file: File) => {
        setBusy(true)
        setError(null)
        try {
            // Recorte quadrado do centro, como o token do personagem; o GM ainda pode enquadrar no mapa.
            const { blob } = await shrinkImage(file, TOKEN_MAX_SIDE, true)
            const url = await uploadImage(blob, 'tokens', `${slug}-${companion.name}`)
            const old = companion.token?.url
            onChange(url)
            if (old && old !== url) void deleteImage(old)
        } catch (e) {
            setError(imageErrorText(e))
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ''
        }
    }

    return (
        <Box sx={{ flexShrink: 0 }}>
            <Tooltip title={companion.token ? 'Trocar o token' : 'Enviar o token'}>
                <ButtonBase
                    onClick={() => input.current?.click()}
                    disabled={busy}
                    aria-label={`${companion.token ? 'Trocar' : 'Enviar'} o token de ${companion.name}`}
                    sx={{
                        position: 'relative',
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        border: `3px solid ${TOKEN_NPC}`,
                        backgroundColor: MAP_BACKDROP,
                        overflow: 'hidden',
                        color: parchment.page,
                        fontWeight: 700,
                        fontSize: '1.3rem',
                    }}
                >
                    {src
                        ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials(companion.name)}
                    <Box sx={{
                        position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: '50%',
                        bgcolor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {busy ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <CameraIcon sx={{ fontSize: 14 }} />}
                    </Box>
                </ButtonBase>
            </Tooltip>
            <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
            />
            {error && <Typography variant="caption" color="error" sx={{ display: 'block', maxWidth: 90 }}>{error}</Typography>}
        </Box>
    )
}

interface Props { build: BuildInfo }

/**
 * Criaturas que entram no combate junto com o personagem. O nome é o da AON — é
 * por ele que a Iniciativa busca a ficha — e o token fica guardado aqui, uma vez
 * só, como o do personagem.
 */
export const CompanionsCard = ({ build }: Props) => {
    const slug = charSlug(build)
    const companions = useCompanions(companionsKeyFor(build))
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [suggestions, setSuggestions] = useState<string[]>([])

    const full = companions.list.length >= MAX_COMPANIONS

    const submit = async (typed = name) => {
        const wanted = typed.trim()
        if (wanted.length < 2) return
        setBusy(true)
        setError(null)
        setSuggestions([])
        const { results } = await searchCreatures(wanted, 6)
        setBusy(false)
        // O nome tem de ser o da AON, senão a Iniciativa não acha a ficha na hora de entrar.
        const exact = results.find((r) => r.name.toLowerCase() === wanted.toLowerCase())
        if (exact) {
            companions.add(exact.name)
            setName('')
            return
        }
        setError(results.length === 0 ? `Não achei "${wanted}" na AON.` : `Não achei exatamente "${wanted}". Quis dizer:`)
        setSuggestions(results.map((r) => r.name))
    }

    return (
        <Card>
            <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Companheiros de combate
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Criaturas da AON que entram no encontro (e no mapa) sozinhas quando {build.name} entra. O token é enviado uma vez só.
                </Typography>

                <Stack spacing={1.25}>
                    {companions.list.map((c) => (
                        <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <CompanionToken slug={slug} companion={c} onChange={(url) => companions.setToken(c.id, url)} />
                            <Typography sx={{ flex: 1, fontWeight: 700, minWidth: 0 }}>{c.name}</Typography>
                            <Tooltip title="Remover">
                                <IconButton
                                    size="small"
                                    aria-label={`Remover ${c.name}`}
                                    onClick={() => { companions.remove(c.id); if (c.token?.url) void deleteImage(c.token.url) }}
                                >
                                    <RemoveIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                    {companions.list.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Nenhum ainda.
                        </Typography>
                    )}
                </Stack>

                <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Criatura (nome na AON, ex.: Animated Armor)"
                        value={name}
                        disabled={full || busy}
                        onChange={(e) => { setName(e.target.value); setError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                    />
                    <Button variant="contained" startIcon={<AddIcon />} disabled={full || busy || name.trim().length < 2} onClick={() => void submit()} sx={{ flexShrink: 0, height: 40 }}>
                        Adicionar
                    </Button>
                </Box>
                {error && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                        {error}
                        {suggestions.length > 0 && (
                            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {suggestions.map((s) => (
                                    <Chip key={s} label={s} size="small" onClick={() => void submit(s)} />
                                ))}
                            </Stack>
                        )}
                    </Alert>
                )}
                {full && <Typography variant="caption" color="text.secondary">Limite de {MAX_COMPANIONS} companheiros.</Typography>}
            </CardContent>
        </Card>
    )
}
