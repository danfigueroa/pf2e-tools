import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import type { ConditionModifiers } from '../conditions'
import { costLabel } from '../activities'
import {
    giftActivity, giftMinLevel, giftUnlocked, giftUseKey, relicLevel, relicsOf,
    type RelicEntry, type RelicGift, type RelicTier,
} from '../relics'
import { ActivityBody } from './ActivityButton'
import type { DescriptionRequest } from './DescriptionDrawer'
import type { MythicPointsApi } from './useMythicPoints'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    onSelect: (req: DescriptionRequest) => void
}

const TIER_LABEL: Record<RelicTier, string> = { minor: 'Dádiva menor', major: 'Dádiva maior', grand: 'Dádiva grandiosa' }

/** O custo para mostrar — inclusive a ação livre sem limite, que não ganha botão. */
const activationLabel = (gift: RelicGift): string => {
    const info = giftActivity({ ...gift, activation: { ...gift.activation!, limited: true } })
    return info ? costLabel(info) : ''
}

const Gift = ({ relic, gift, index, build, mods, mythicPoints, onSelect }: Props & { relic: RelicEntry; gift: RelicGift; index: number }) => {
    const level = relicLevel(build)
    const unlocked = giftUnlocked(gift, index, level)
    const info = unlocked ? giftActivity(gift) : null
    const act = gift.activation

    return (
        <Box sx={{ py: 1.25, opacity: unlocked ? 1 : 0.55 }}>
            <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                <Typography sx={{ fontWeight: 600, minWidth: 0, mr: 'auto' }}>{gift.name}</Typography>
                <Chip label={TIER_LABEL[gift.tier]} size="small" variant="outlined" />
                <Chip label={gift.kind === 'rune' ? 'Runa' : 'Poder'} size="small" />
                {!unlocked && <Chip label={`libera no nível ${giftMinLevel(gift, index)}`} size="small" />}
            </Stack>
            {act && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {[
                        activationLabel(gift),
                        act.frequency,
                        act.trigger ? `gatilho: ${act.trigger}` : null,
                    ].filter(Boolean).join(' · ')}
                </Typography>
            )}
            {gift.description && (
                <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-line' }}>{gift.description}</Typography>
            )}
            <Stack direction="row" alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap', gap: 1 }}>
                {!gift.description && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onSelect({ type: gift.kind === 'rune' ? 'item' : 'special', name: gift.name })}
                    >
                        Ver descrição
                    </Button>
                )}
                {info && (
                    <ActivityBody
                        build={build}
                        mods={mods}
                        mythicPoints={mythicPoints}
                        name={`${relic.name}: ${gift.name}`}
                        usedKey={giftUseKey(relic, gift)}
                        info={info}
                    />
                )}
            </Stack>
        </Box>
    )
}

/** A relíquia do personagem, com as dádivas (poderes e runas) e o botão de usar cada ativação. */
export const RelicsCard = (props: Props) => {
    const relics = relicsOf(props.build)
    if (relics.length === 0) return null
    const level = relicLevel(props.build)

    return (
        <>
            {relics.map((relic) => (
                <Card key={relic.id}>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Relíquia · nível {level}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{relic.name}</Typography>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                            {relic.on?.kind === 'weapon' && <Chip label={relic.on.weapon} size="small" variant="outlined" />}
                            {relic.on?.kind === 'armor' && <Chip label="Armadura" size="small" variant="outlined" />}
                            {relic.on?.kind === 'item' && <Chip label={relic.on.name} size="small" variant="outlined" />}
                            {relic.aspects?.map((a) => <Chip key={a} label={a} size="small" />)}
                        </Stack>
                        {relic.description && (
                            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{relic.description}</Typography>
                        )}
                        <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />} sx={{ mt: 1 }}>
                            {relic.gifts.map((gift, idx) => (
                                <Gift key={gift.id} {...props} relic={relic} gift={gift} index={idx} />
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            ))}
        </>
    )
}
