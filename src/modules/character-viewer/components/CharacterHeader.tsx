import { Box, Card, CardContent, Stack, Typography, Chip, Button, useTheme, useMediaQuery } from '@mui/material'
import { SwapHoriz as SwapIcon } from '@mui/icons-material'
import { SyncStatus } from './SyncStatus'
import { TokenAvatar } from './TokenAvatar'
import { charSlug } from '../charId'
import type { BuildInfo } from '../../../pathbuilder/types'
import { sizeLabel, type SizeEffectDef } from '../sizeEffects'

interface Props {
    build: BuildInfo
    onReset: () => void
    /** Enlarge/Shrink ligado: o chip de tamanho mostra o tamanho de agora. */
    sizeEffect?: SizeEffectDef | null
    /** Painel estreito (mapa): leiaute de celular, qualquer que seja a janela. */
    compact?: boolean
}

export const CharacterHeader = ({ build, onReset, sizeEffect, compact = false }: Props) => {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm')) || compact

    return (
        <Card
            sx={{
                mb: 3,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, transparent 60%)`,
                borderColor: theme.palette.secondary.main,
                borderTop: `4px solid ${theme.palette.primary.main}`,
            }}
        >
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack
                    direction={compact ? 'column' : { xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={compact ? 'flex-start' : { xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TokenAvatar slug={charSlug(build)} name={build.name} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant={isMobile ? 'h4' : 'h3'}
                                component="h1"
                                sx={{
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.02em',
                                    mb: 0.5,
                                    wordBreak: 'break-word',
                                }}
                            >
                                {build.name}
                            </Typography>
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                sx={{ mb: 1.5 }}
                            >
                                {[build.ancestry, build.heritage].filter(Boolean).join(' · ')}
                                {' · '}
                                {build.class}
                                {build.dualClass ? ` / ${build.dualClass}` : ''}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                <Chip
                                    label={`Nível ${build.level}`}
                                    color="primary"
                                    size="small"
                                    sx={{ fontWeight: 600 }}
                                />
                                {build.background && (
                                    <Chip label={build.background} size="small" variant="outlined" />
                                )}
                                {build.deity && build.deity !== 'Not set' && (
                                    <Chip label={build.deity} size="small" variant="outlined" />
                                )}
                                {build.alignment && (
                                    <Chip label={build.alignment} size="small" variant="outlined" />
                                )}
                                {sizeEffect ? (
                                    <Chip
                                        label={`${sizeLabel(sizeEffect.size)} (${sizeEffect.spell})`}
                                        size="small"
                                        color="primary"
                                    />
                                ) : build.sizeName && (
                                    <Chip label={build.sizeName} size="small" variant="outlined" />
                                )}
                            </Stack>
                        </Box>
                    </Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        useFlexGap
                        sx={{ flexWrap: 'wrap', gap: 1, flexShrink: 0 }}
                    >
                        <SyncStatus build={build} />
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SwapIcon />}
                            onClick={onReset}
                            sx={{ flexShrink: 0 }}
                        >
                            Trocar ficha
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}
