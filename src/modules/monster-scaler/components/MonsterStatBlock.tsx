// O stat block desenhado — e o subtree que o html2canvas rasteriza no PNG.
//
// REGRA DESTE ARQUIVO: hex literal de 6 dígitos, nunca token de tema.
// O html2canvas 1.4.1 não entende `oklch`, `color-mix` nem `clamp()`, e o que
// ele não entende some em SILÊNCIO — a cor não é aplicada e ninguém vê erro.
// É o mesmo motivo pelo qual `StatBlockGenerator.tsx` mantém hex literal.

import { Box, Card, Typography } from '@mui/material'
import {
    actionGlyph,
    LABELS,
    translateDamageString,
    translateImmunity,
    translateSize,
    translateTrait,
} from '../../transformation-statblock/i18n'
import { formatSpellEntry, groupLabel } from '../spellcasting'
import type { ScaledMonster } from '../types'

// Paleta Remaster (pergaminho + verde + ouro), literal de propósito.
const GREEN = '#1B3B2A'
const GOLD = '#A8842C'
const GOLD_DEEP = '#7E611D' // texto dourado sobre pergaminho pede o tom escuro
const PARCHMENT = '#f7f2e7'
const TRAIT_BG = '#efe7d4'
const TRAIT_BORDER = '#C8A951'
const INK = '#1a1a1a'
const MUTED = '#6b6152'
const ITALIC = '#5a5044'

// O bloco também é lido no celular: no xs a margem interna encolhe.
const PAD_X = { xs: 1.25, sm: 2 }

const Label = ({ children }: { children: React.ReactNode }) => (
    <strong style={{ color: GREEN }}>{children}</strong>
)

const Rule = () => (
    <Box sx={{ height: '3px', bgcolor: GOLD, my: 1, borderRadius: '2px' }} />
)

const mod = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** `{ land: 25, fly: 40, max: 40 }` → "25 pés, voo 40 pés". */
function formatSpeed(speed: Record<string, number>): string {
    const parts: string[] = []
    const names: Record<string, string> = {
        land: '', climb: 'escalada', swim: 'natação', fly: 'voo', burrow: 'escavação',
    }
    for (const [type, value] of Object.entries(speed)) {
        // `max` é derivado pela AON, não é um deslocamento de verdade.
        if (type === 'max' || !value) continue
        const name = names[type] ?? type
        parts.push(`${name ? `${name} ` : ''}${value} pés`)
    }
    return parts.length > 0 ? parts.join(', ') : '—'
}

const formatDefense = (values: Record<string, number>): string =>
    Object.entries(values)
        .map(([type, value]) => `${translateImmunity(type)} ${value}`)
        .join(', ')

interface Props {
    monster: ScaledMonster
}

/**
 * Nomes de criatura, magia, golpe e a prosa das habilidades ficam em INGLÊS —
 * são a chave de busca na AON e, no caso da prosa, decisão de produto. O que se
 * traduz é o vocabulário mecânico: rótulos, traços, tipos de dano, tamanho.
 */
export function MonsterStatBlock({ monster }: Props) {
    const { source } = monster
    const statblock = source.statblock
    // As habilidades vêm do resultado da escala, não da ficha original: as CDs
    // da prosa acompanham o nível-alvo.
    const abilities = monster.abilities

    // O índice repete tamanho e raridade DENTRO de `traits`, então montar a
    // faixa somando os três produzia "MÉDIO" e "MEDIUM" lado a lado.
    const redundant = new Set(
        [source.size, source.rarity].filter(Boolean).map((t) => String(t).toLowerCase()),
    )
    const traitTags = [
        ...(source.rarity && source.rarity !== 'common' ? [capitalize(source.rarity)] : []),
        ...(source.size ? [translateSize(source.size)] : []),
        ...source.traits.filter((t) => !redundant.has(t.toLowerCase())).map(translateTrait),
    ]

    const skills = Object.entries(monster.skills)
    const attrs: Array<[string, number]> = [
        ['For', monster.attributes.strength],
        ['Des', monster.attributes.dexterity],
        ['Con', monster.attributes.constitution],
        ['Int', monster.attributes.intelligence],
        ['Sab', monster.attributes.wisdom],
        ['Car', monster.attributes.charisma],
    ]

    return (
        <Card sx={{ bgcolor: PARCHMENT, color: INK, border: `1px solid ${GREEN}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
            {/* Nome longo quebra para a linha de baixo em vez de espremer o
                "CRIATURA N", que precisa ficar inteiro. */}
            <Box sx={{ bgcolor: GREEN, color: PARCHMENT, px: PAD_X, py: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography component="h2" sx={{ fontWeight: 700, fontSize: { xs: '1.05rem', sm: '1.35rem' }, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.15, minWidth: 0, overflowWrap: 'break-word' }}>
                    {source.name}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.1rem' }, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {LABELS.creature} {monster.level}
                </Typography>
            </Box>

            <Box sx={{ px: PAD_X, py: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', bgcolor: TRAIT_BG }}>
                {traitTags.map((t, i) => (
                    <Box key={i} sx={{ bgcolor: GREEN, color: PARCHMENT, border: `1px solid ${TRAIT_BORDER}`, px: 1, py: 0.25, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {t}
                    </Box>
                ))}
            </Box>

            <Box sx={{ px: PAD_X, py: 1.5 }}>
                {source.level !== monster.level && (
                    <Typography variant="body2" sx={{ fontStyle: 'italic', color: ITALIC, mb: 1 }}>
                        Adaptado do nível {source.level} para o nível {monster.level}
                    </Typography>
                )}

                <Typography variant="body2">
                    <Label>{LABELS.perception}</Label> {mod(monster.perception)}
                    {statblock?.sensesRaw ? `; ${statblock.sensesRaw}` : ''}
                </Typography>

                {source.languages.length > 0 && (
                    <Typography variant="body2">
                        <Label>{LABELS.languages}</Label> {source.languages.join(', ')}
                    </Typography>
                )}

                {skills.length > 0 && (
                    <Typography variant="body2">
                        <Label>{LABELS.skills}</Label>{' '}
                        {skills.map(([name, value]) => `${capitalize(name)} ${mod(value)}`).join(', ')}
                    </Typography>
                )}

                <Typography variant="body2">
                    {attrs.map(([name, value], i) => (
                        <Box component="span" key={name}>
                            {i > 0 ? ', ' : ''}<Label>{name}</Label> {mod(value)}
                        </Box>
                    ))}
                </Typography>

                {source.items.length > 0 && (
                    <Typography variant="body2">
                        <Label>{LABELS.items}</Label> {source.items.join(', ')}
                    </Typography>
                )}

                <Rule />

                <Typography variant="body2">
                    <Label>{LABELS.ac}</Label> {monster.ac}; <Label>{LABELS.fort}</Label> {mod(monster.saves.fort)},{' '}
                    <Label>{LABELS.ref}</Label> {mod(monster.saves.ref)}, <Label>{LABELS.will}</Label> {mod(monster.saves.will)}
                </Typography>
                <Typography variant="body2">
                    <Label>{LABELS.hp}</Label> {monster.hp}
                    {source.immunities.length > 0 && (
                        <> ; <Label>{LABELS.immunities}</Label> {source.immunities.map(translateImmunity).join(', ')}</>
                    )}
                    {Object.keys(monster.weaknesses).length > 0 && (
                        <> ; <Label>{LABELS.weaknesses}</Label> {formatDefense(monster.weaknesses)}</>
                    )}
                    {Object.keys(monster.resistances).length > 0 && (
                        <> ; <Label>{LABELS.resistances}</Label> {formatDefense(monster.resistances)}</>
                    )}
                </Typography>

                {/* Defesa com ressalva nunca vira número — sai como está. */}
                {source.defenseNotes.map((note, i) => (
                    <Typography key={i} variant="body2" sx={{ color: MUTED }}>{note}</Typography>
                ))}

                <Rule />

                <Typography variant="body2">
                    <Label>{LABELS.speed}</Label> {formatSpeed(source.speed)}
                </Typography>

                {monster.strikes.map((strike, i) => (
                    <Typography key={i} variant="body2" sx={{ mt: 0.5 }}>
                        <Label>{strike.category === 'melee' ? LABELS.melee : LABELS.ranged}</Label>{' '}
                        <Box component="span" sx={{ color: GOLD_DEEP, fontWeight: 700 }}>
                            {actionGlyph(strike.actions) || '◆'}
                        </Box>{' '}
                        {strike.name} {mod(strike.bonus)}
                        {strike.traits.length > 0 && (
                            <Box component="span" sx={{ color: MUTED }}> ({strike.traits.map(translateTrait).join(', ')})</Box>
                        )}
                        {strike.damageFormula && (
                            <>
                                , <Label>{LABELS.damage}</Label> {strike.damageFormula}
                                {strike.damage?.type ? ` ${translateDamageString(strike.damage.type)}` : ''}
                            </>
                        )}
                        {/* Rider fica como veio: dano extra não segue a tabela. */}
                        {strike.damage?.riders && (
                            <Box component="span" sx={{ color: MUTED }}> {strike.damage.riders}</Box>
                        )}
                    </Typography>
                ))}

                {monster.spellcasting.map((block, i) => (
                    <Box key={i} sx={{ mt: 0.5 }}>
                        <Typography variant="body2">
                            <Label>{block.label}</Label>
                            {block.dc !== null ? ` CD ${block.dc}` : ''}
                            {block.attack !== null ? `, ataque ${mod(block.attack)}` : ''}
                        </Typography>
                        {block.groups.map((group, g) => (
                            <Typography key={g} variant="body2" sx={{ pl: 1.5 }}>
                                <Box component="span" sx={{ fontWeight: 700 }}>
                                    {groupLabel(group)}
                                </Box>
                                {/* A contagem de slots só é escrita onde a AON escreve:
                                    em espontânea. Em preparada, o número de magias
                                    preparadas JÁ é o número de slots. */}
                                {block.kind === 'spontaneous' && group.slots !== null && (
                                    <Box component="span" sx={{ color: MUTED }}>
                                        {' '}({group.slots} {group.slots === 1 ? 'slot' : 'slots'})
                                    </Box>
                                )}{' '}
                                {group.spells.map(formatSpellEntry).join(', ')}
                                {/* Slot que abriu com o nível novo fica visível e vazio:
                                    a ferramenta não escolhe magia pelo GM. */}
                                {group.empty > 0 && (
                                    <Box component="span" sx={{ color: MUTED, fontStyle: 'italic' }}>
                                        {group.spells.length > 0 ? ', ' : ''}
                                        {group.empty}{' '}
                                        {/* Onde a contagem de slots já foi escrita (espontânea),
                                            repeti-la aqui viraria "4 slots — 4 slots vazios". */}
                                        {block.kind === 'spontaneous' || group.spells.length > 0
                                            ? (group.empty === 1 ? 'vazio' : 'vazios')
                                            : (group.empty === 1 ? 'slot vazio' : 'slots vazios')}
                                    </Box>
                                )}
                            </Typography>
                        ))}
                    </Box>
                ))}

                {abilities.length > 0 && (
                    <>
                        <Rule />
                        {abilities.map((ability, i) => (
                            <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                                <Label>{ability.name}</Label>
                                {ability.actions && (
                                    <Box component="span" sx={{ color: GOLD_DEEP, fontWeight: 700 }}> {actionGlyph(ability.actions)}</Box>
                                )}
                                {ability.traits.length > 0 && (
                                    <Box component="span" sx={{ color: MUTED }}> ({ability.traits.map(translateTrait).join(', ')})</Box>
                                )}{' '}
                                {ability.text}
                            </Typography>
                        ))}
                    </>
                )}

                <Rule />

                <Typography variant="caption" sx={{ color: MUTED, display: 'block' }}>
                    {LABELS.source}: {source.source ?? 'Archives of Nethys'}
                    {source.family ? ` • ${source.family}` : ''}
                    {source.level !== monster.level ? ` • ficha original de nível ${source.level}` : ''}
                </Typography>
            </Box>
        </Card>
    )
}
