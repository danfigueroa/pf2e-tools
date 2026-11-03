import { useRef, useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CircularProgress,
    Divider,
    LinearProgress,
    Typography,
    Alert,
} from '@mui/material'
import { CloudUpload as UploadIcon } from '@mui/icons-material'
import { CAMPAIGN_PRESETS, loadPresetJson, type CharacterPreset } from '../campaignPresets'
import { usePublishedSheets } from '../usePublishedSheets'
import { fetchPublished, type PublishedSheet, type SheetDraft } from '../../../services/sheets'
import { usePreparation } from '../../../services/sheetPreparation'
import { canEditSheet, useRole } from '../../../services/auth'
import { charSlugFromName } from '../charId'
import { TokenBadge } from '../../battle-map/components/TokenBadge'
import { tr } from '../../../i18n'

/** De onde veio o JSON: arquivo enviado agora abre o diálogo de publicar. */
export type JsonOrigin =
    | { kind: 'file' }
    | { kind: 'preset'; published: PublishedSheet | null }

interface Props {
    onJson: (data: unknown, origin: JsonOrigin) => void
    error: string | null
    /** Reabre o preparo de uma publicação (o diálogo com a barra). */
    onResume: (draft: SheetDraft) => void
}

const TOKEN_SIZE = 56

/**
 * O token do personagem no cartão — o mesmo que o jogador enviou na ficha e que
 * vai para o mapa (iniciais enquanto não há imagem). Carregando, o círculo
 * gira por cima em vez de sumir, para o cartão não pular.
 */
const CardToken = ({ loading, slug, name }: { loading: boolean; slug: string; name: string }) => (
    <Box sx={{ position: 'relative', width: TOKEN_SIZE, height: TOKEN_SIZE, mx: 'auto', mb: 0.75 }}>
        <TokenBadge slug={slug} name={name} size={TOKEN_SIZE} />
        {loading && (
            <CircularProgress
                size={TOKEN_SIZE + 8}
                thickness={2.5}
                sx={{ position: 'absolute', top: -4, left: -4 }}
            />
        )}
    </Box>
)

/**
 * Uma publicação em preparo: o andamento e, para quem pode conduzi-la (quem enviou, o dono da ficha, o
 * GM), "Continuar" — que reabre o diálogo e retoma o preparo neste aparelho.
 */
const DraftRow = ({ draft, canDrive, onResume }: { draft: SheetDraft; canDrive: boolean; onResume: () => void }) => {
    // Rodando nesta aba, o andamento é o daqui (mais novo que o da lista).
    const live = usePreparation(draft.slug)
    // Terminou nesta aba: a lista relê e a linha sai (sem esperar o aviso da mesa).
    if (live?.phase === 'ready' || live?.phase === 'gone') return null
    const progress = live?.draft?.progress ?? draft.progress
    const pct = Math.round((100 * progress.done) / Math.max(1, progress.total))
    return (
        <Card variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TokenBadge slug={draft.slug} name={draft.name} size={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                    {draft.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {draft.className} {draft.level} · {tr(`em preparo · ${pct}%`, `being prepared · ${pct}%`)}
                </Typography>
                <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 4, borderRadius: 2 }} />
            </Box>
            {canDrive ? (
                <Button size="small" variant="outlined" onClick={onResume}>{tr('Continuar', 'Continue')}</Button>
            ) : null}
        </Card>
    )
}

export const UploadCard = ({ onJson, error, onResume }: Props) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [loadingPreset, setLoadingPreset] = useState<string | null>(null)

    const { levelOf, find, extras, drafts, draftOf, ownerOf } = usePublishedSheets()
    const role = useRole()
    // O mesmo portão do servidor (`draft-step`): quem enviou, o dono da ficha que já existe, o GM.
    const canDrive = (d: SheetDraft) =>
        (role.userId !== null && d.createdBy === role.userId) || canEditSheet(role, ownerOf(d.slug))

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
                    {tr('Ficha Virtual', 'Virtual Sheet')}</Typography>
                <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.6, textAlign: 'center' }}>
                    {tr('Selecione um personagem da campanha ou carregue seu próprio arquivo JSON.', 'Select a campaign character or load your own JSON file.')}</Typography>

                {drafts.length > 0 && (
                    <>
                        <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                            {tr('Em preparo', 'Being prepared')}</Typography>
                        <Box sx={{ display: 'grid', gap: 1, mb: 3 }}>
                            {drafts.map((d) => (
                                <DraftRow key={d.slug} draft={d} canDrive={canDrive(d)} onResume={() => onResume(d)} />
                            ))}
                        </Box>
                    </>
                )}

                {/* Mesa nova, sem preset nem ficha publicada ainda: sem o título de uma lista vazia. */}
                {CAMPAIGN_PRESETS.length + extras.length > 0 && (
                    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                        {tr('Fichas da Campanha', 'Campaign Sheets')}</Typography>
                )}

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                        gap: 1.5,
                        mb: 3,
                    }}
                >
                    {CAMPAIGN_PRESETS.map((preset) => (
                        <Card
                            key={preset.filename}
                            variant="outlined"
                        >
                            <CardActionArea
                                onClick={() => handlePreset(preset)}
                                disabled={loadingPreset !== null}
                                sx={{ p: 1.5, textAlign: 'center', height: '100%' }}
                            >
                                <CardToken
                                    loading={loadingPreset === preset.filename}
                                    slug={charSlugFromName(preset.sheetName)}
                                    name={preset.name}
                                />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                    {preset.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {preset.class} {levelOf(preset)}
                                </Typography>
                                {draftOf(charSlugFromName(preset.sheetName)) ? (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                        {tr('nova versão em preparo', 'new version being prepared')}</Typography>
                                ) : find(preset) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontWeight: 600 }}>
                                        {tr('atualizada pela mesa', 'updated by the table')}</Typography>
                                )}
                            </CardActionArea>
                        </Card>
                    ))}
                    {extras.map((sheet) => (
                        <Card key={sheet.slug} variant="outlined">
                            <CardActionArea
                                onClick={() => handlePublished(sheet.slug)}
                                disabled={loadingPreset !== null}
                                sx={{ p: 1.5, textAlign: 'center', height: '100%' }}
                            >
                                <CardToken loading={loadingPreset === sheet.slug} slug={sheet.slug} name={sheet.name} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                    {sheet.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {sheet.className} {sheet.level}
                                </Typography>
                                {draftOf(sheet.slug) ? (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                        {tr('nova versão em preparo', 'new version being prepared')}</Typography>
                                ) : (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontWeight: 600 }}>
                                        {tr('publicada pela mesa', 'published by the table')}</Typography>
                                )}
                            </CardActionArea>
                        </Card>
                    ))}
                </Box>

                <Divider sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                        {tr('atualizou no Pathbuilder? envie o JSON', 'updated in Pathbuilder? upload the JSON')}</Typography>
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
                        {tr('Escolher arquivo JSON', 'Choose JSON file')}</Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mt: 3, fontSize: '0.78rem', color: 'text.secondary', textAlign: 'left' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        {tr('Formatos suportados:', 'Supported formats:')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                        {tr('• Export do Pathbuilder 2e (campo ', '• Pathbuilder 2e export (field ')}<code>build</code>)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                        {tr('• Enviar a ficha de um personagem da mesa permite publicar a versão nova para todos', '• Uploading the sheet of a character at the table lets you publish the new version for everyone')}</Typography>
                </Box>
            </CardContent>
        </Card>
    )
}
