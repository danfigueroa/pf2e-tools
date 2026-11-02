import { memo } from 'react'
import { Box, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material'
import { greenInk } from '../../../theme/palette'
import type { BuildInfo, CompanionStats, Pet } from '../../../pathbuilder/types'
import { signed } from '../helpers'
import {
    computeCompanion,
    rankLabel,
    stageLabel,
    translateSkill,
    translateSenses,
    type ComputedCompanion,
} from '../companionStats'
import { translateSize, translateDamageType, translateAttackName, translateTrait } from '../../transformation-statblock/i18n'
import { CompanionHpBar } from '../components/CompanionHpBar'
import { legacyPetKey, petKeyFor } from '../charId'
import { tr } from '../../../i18n'

interface Props { build: BuildInfo }

const ACCENT = greenInk.main

const PetsSectionView = ({ build }: Props) => {
    const pets = build.pets || []
    const familiars = build.familiars || []

    if (pets.length === 0 && familiars.length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {tr('Sem companheiros ou familiares.', 'No companions or familiars.')}</Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={2}>
            {pets.map((pet, idx) => (
                <PetCard
                    key={`${pet.name}-${idx}`}
                    pet={pet}
                    base={pet.animal ? build.petDescriptions?.[pet.animal] : undefined}
                    level={build.level || 1}
                    storageKey={petKeyFor(build, 'pet', pet.name, idx)}
                    legacyKey={legacyPetKey(build, 'pet', pet.name, idx)}
                />
            ))}

            {familiars.map((fam, idx) => (
                <Card key={`fam-${fam.name}-${idx}`}>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                            Familiar
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
                            {fam.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {fam.type}
                        </Typography>
                        {fam.abilities?.length && (
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                {fam.abilities.map((a) => (
                                    <Chip key={a} label={a} size="small" />
                                ))}
                            </Stack>
                        )}
                        {/* RAW: um familiar tem 5 PV por nível do mestre. */}
                        <CompanionHpBar
                            storageKey={petKeyFor(build, 'fam', fam.name, idx)}
                            legacyKey={legacyPetKey(build, 'fam', fam.name, idx)}
                            maxHp={5 * (build.level || 1)}
                        />
                    </CardContent>
                </Card>
            ))}
        </Stack>
    )
}

const PetCard = ({ pet, base, level, storageKey, legacyKey }: { pet: Pet; base?: CompanionStats; level: number; storageKey: string; legacyKey: string }) => {
    // `abilities` só existe no formato novo — protege contra um cache antigo
    // (formato v10) que ainda estivesse no localStorage do usuário.
    const stats = base?.abilities ? computeCompanion(base, pet, level) : null

    return (
        <Card>
            <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {pet.type}
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.25, flexWrap: 'wrap' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {pet.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {pet.animal} {tr('· Nível ', '· Level ')}{level}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {stats && (
                        <Chip
                            label={stageLabel(stats.stage)}
                            size="small"
                            sx={{ backgroundColor: ACCENT + '25', color: ACCENT, border: `1px solid ${ACCENT}60`, fontWeight: 700 }}
                        />
                    )}
                    {stats && <Chip label={translateSize(stats.size)} size="small" variant="outlined" />}
                    {pet.specializations?.map((s) => <Chip key={s} label={s} size="small" />)}
                    {pet.armor && <Chip label={pet.armor} size="small" variant="outlined" />}
                </Stack>

                {!stats && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                        {tr('Carregando a ficha do companheiro no Archives of Nethys…', 'Loading the companion\'s sheet from Archives of Nethys…')}</Typography>
                )}

                {stats && <CompanionHpBar storageKey={storageKey} legacyKey={legacyKey} maxHp={stats.hp} />}

                {stats && <CompanionSheet stats={stats} />}
            </CardContent>
        </Card>
    )
}

const CompanionSheet = ({ stats }: { stats: ComputedCompanion }) => (
    <Box sx={{ mt: 2 }}>
        {stats.summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                {stats.summary}
            </Typography>
        )}

        {/* Linha principal: CA, Percepção, Deslocamento (PV fica na barra acima) */}
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                gap: 1,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: ACCENT + '40',
                backgroundColor: ACCENT + '0a',
            }}
        >
            <BigStat label={tr("CA", 'AC')} value={String(stats.ac)} />
            <BigStat label={tr("Percepção", 'Perception')} value={signed(stats.perception.modifier)} hint={rankLabel(stats.perception.rank)} />
            <BigStat label={tr("Deslocamento", 'Speed')} value={formatSpeeds(stats)} />
        </Box>

        {/* Atributos */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5, mt: 1.5 }}>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
                <Box key={k} sx={{ textAlign: 'center', py: 0.75, borderRadius: 1, backgroundColor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.6rem' }}>
                        {ABILITY_LABELS[k]}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {signed(stats.abilities[k])}
                    </Typography>
                </Box>
            ))}
        </Box>

        {/* Salvamentos */}
        <Row label={tr("Salvamentos", 'Saves')}>
            <InlineList>
                {[stats.saves.fortitude, stats.saves.reflex, stats.saves.will].map((s) => (
                    <Typography key={s.name} variant="body2" component="span">
                        <Box component="span" sx={{ color: 'text.secondary' }}>{translateSkill(s.name)} </Box>
                        <Box component="span" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{signed(s.modifier)}</Box>
                    </Typography>
                ))}
            </InlineList>
        </Row>

        {stats.attacks.length > 0 && (
            <Row label={tr("Ataques", 'Attacks')}>
                <Stack spacing={0.5}>
                    {stats.attacks.map((a) => (
                        <Typography key={a.name} variant="body2">
                            <Box component="span" sx={{ fontWeight: 700 }}>{translateAttackName(a.name)}</Box>
                            <Box component="span" sx={{ fontFamily: 'monospace', color: ACCENT, fontWeight: 700, mx: 1 }}>
                                {signed(a.attack)}
                            </Box>
                            <Box component="span" sx={{ fontFamily: 'monospace' }}>
                                {a.damage} {translateDamageType(a.damageType)}
                            </Box>
                            {a.traits.length > 0 && (
                                <Box component="span" sx={{ color: 'text.secondary' }}>
                                    {' '}({a.traits.map(translateTrait).join(', ')})
                                </Box>
                            )}
                            {a.magical && (
                                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.8em' }}> {tr('· mágico', '· magical')}</Box>
                            )}
                        </Typography>
                    ))}
                </Stack>
            </Row>
        )}

        {stats.skills.length > 0 && (
            <Row label={tr("Perícias", 'Skills')}>
                <InlineList>
                    {stats.skills.map((s) => (
                        <Typography key={s.name} variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
                            <Box component="span" sx={{ color: 'text.secondary' }}>{translateSkill(s.name)} </Box>
                            <Box component="span" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{signed(s.modifier)}</Box>
                            {s.rank > 1 && (
                                <Box component="span" sx={{ color: ACCENT, fontSize: '0.75em' }}> ({rankLabel(s.rank)})</Box>
                            )}
                        </Typography>
                    ))}
                </InlineList>
            </Row>
        )}

        {stats.senses && <Row label={tr("Sentidos", 'Senses')}><Typography variant="body2">{translateSenses(stats.senses)}</Typography></Row>}

        {stats.barding && (
            <Row label={tr("Barda", 'Barding')}>
                <Typography variant="body2">
                    +{stats.barding.ac} {tr('CA · limite de Des +', 'AC · Dex cap +')}{stats.barding.dexCap} {tr('· penalidade ', '· penalty ')}{stats.barding.checkPenalty}
                </Typography>
            </Row>
        )}

        {stats.supportBenefit && (
            <Row label={tr("Benefício de apoio", 'Support benefit')}>
                <Typography variant="body2">{stats.supportBenefit}</Typography>
            </Row>
        )}

        {stats.advancedManeuver && (
            <Row label={tr("Manobra avançada", 'Advanced maneuver')}>
                <Typography variant="body2">
                    {stats.advancedManeuver}
                    {!stats.hasAdvancedManeuver && (
                        <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            {' '}{tr('— aprendida ao virar nimble ou savage', '— learned on becoming nimble or savage')}</Box>
                    )}
                </Typography>
            </Row>
        )}

        {stats.sourceBook && (
            <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">{stats.sourceBook}</Typography>
            </>
        )}
    </Box>
)

const ABILITY_LABELS = { str: 'For', dex: 'Des', con: 'Con', int: 'Int', wis: 'Sab', cha: 'Car' }

function formatSpeeds(stats: ComputedCompanion): string {
    const extra = Object.entries(stats.speeds)
        .filter(([k]) => k !== 'land')
        .map(([k, v]) => `${SPEED_LABELS[k] ?? k} ${v}`)
    return [tr(`${stats.speed} pés`, `${stats.speed} feet`), ...extra].join(', ')
}

const SPEED_LABELS: Record<string, string> = {
    fly: tr('voo', 'fly'), swim: tr('natação', 'swim'), climb: tr('escalada', 'climb'), burrow: tr('escavação', 'burrow'),
}

const BigStat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.04em' }}>
            {label}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
)

/**
 * Itens irmãos em JSX não têm espaço entre si, então uma lista de `<span>`
 * nunca ganha ponto de quebra e vaza para fora do card no celular — era o que
 * acontecia com as perícias do companheiro. Um flex com wrap resolve.
 */
const InlineList = ({ children }: { children: React.ReactNode }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        {children}
    </Box>
)

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
            {label}
        </Typography>
        {children}
    </Box>
)

export const PetsSection = memo(PetsSectionView)
