import { Box, Chip, Typography } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import { gold, ink, parchment, rule } from '../../../theme'
import type { StaffInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from './DescriptionDrawer'

interface Props {
    staff: StaffInfo
    accent: string
    /** Abre a magia no próprio drawer. Sem isso, as linhas não são clicáveis. */
    onNavigate?: (req: DescriptionRequest) => void
}

/**
 * Magias de um bastão, agrupadas por rank.
 *
 * Antes o drawer mostrava a prosa crua do AON, que empilha a família inteira
 * (base, Greater, Major e True) num parágrafo só — quem tem o Greater lia
 * *regenerate* e preço de 9.200 po no meio do texto. Aqui só entra o degrau que
 * a ficha possui, e as magias vêm do backend já acumuladas para baixo
 * (`staff-parse.js`).
 *
 * O custo em cargas é exibido junto do rank porque é o número que se consulta
 * na mesa: conjurar gasta cargas iguais ao rank da magia, e truque não gasta
 * nada (GM Core p. 278).
 */
export const StaffSpellList = ({ staff, accent, onNavigate }: Props) => {
    const tierByLevel = new Map(staff.tiers.map((t) => [t.level, t.name]))

    return (
        <Box sx={{ mb: 2.5 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    mb: 1,
                }}
            >
                <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: '0.06em', color: gold.deep }}
                >
                    MAGIAS DO BASTÃO
                </Typography>
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                    {`Item ${staff.tierLevel}`}
                    {staff.price ? ` · ${formatPrice(staff.price)}` : ''}
                </Typography>
            </Box>

            {staff.effect && (
                <Typography variant="body2" sx={{ mb: 1.25, color: ink.primary }}>
                    {staff.effect}
                </Typography>
            )}

            <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, overflow: 'hidden' }}>
                {staff.ranks.map(({ rank, spells }) => (
                    <Box key={rank}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                px: 1.5,
                                py: 0.5,
                                backgroundColor: parchment.sunken,
                                borderBottom: `1px solid ${rule}`,
                            }}
                        >
                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                {rank === 0
                                    ? (spells.length > 1 ? 'TRUQUES' : 'TRUQUE')
                                    : `NÍVEL ${rank}`}
                            </Typography>
                            <Typography variant="caption" sx={{ color: ink.secondary }}>
                                {chargeLabel(rank)}
                            </Typography>
                        </Box>

                        {spells.map(({ name, tierLevel }) => {
                            const badge = tierLevel === staff.tierLevel
                                ? null
                                : tierBadge(tierByLevel.get(tierLevel))
                            // Truque não leva rank: o bastão o eleva ao rank dos
                            // truques de quem conjura, e o drawer não sabe o nível
                            // do personagem — melhor sem número do que com o errado.
                            const open = onNavigate
                                ? () => onNavigate(rank === 0
                                    ? { type: 'spell', name }
                                    : { type: 'spell', name, level: rank })
                                : undefined
                            return (
                                <Box
                                    key={`${rank}-${name}`}
                                    {...(open
                                        ? {
                                            role: 'button',
                                            tabIndex: 0,
                                            onClick: open,
                                            onKeyDown: (e: React.KeyboardEvent) => {
                                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
                                            },
                                        }
                                        : {})}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 1.5,
                                        py: 0.85,
                                        backgroundColor: parchment.paper,
                                        borderBottom: `1px solid ${rule}88`,
                                        '&:last-of-type': { borderBottom: 'none' },
                                        ...(open
                                            ? {
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                                '&:hover': { backgroundColor: parchment.sunken + '99' },
                                                '&:focus-visible': { backgroundColor: parchment.sunken, outline: 'none' },
                                            }
                                            : {}),
                                    }}
                                >
                                    <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                                        {name}
                                    </Typography>
                                    {badge && (
                                        <Chip
                                            label={badge}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                height: 18,
                                                fontSize: '0.62rem',
                                                color: ink.secondary,
                                                borderColor: rule,
                                            }}
                                        />
                                    )}
                                    {open && (
                                        <ChevronIcon fontSize="small" sx={{ color: accent, flexShrink: 0 }} />
                                    )}
                                </Box>
                            )
                        })}
                    </Box>
                ))}
            </Box>

            <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.75, color: ink.secondary, lineHeight: 1.5 }}
            >
                Ao preparar, o bastão recebe cargas iguais ao rank do seu slot mais alto — conjurador
                preparado pode gastar um slot para somar o rank dele. Conjurar da lista exige ter a
                magia na sua própria lista.
            </Typography>
        </Box>
    )
}

/**
 * Moeda é vocabulário mecânico, então é traduzida no render (como o resto do
 * módulo): "1,800 gp" → "1.800 po". O backend guarda o preço canônico do AON.
 */
const COIN_PT: Record<string, string> = { pp: 'pl', gp: 'po', sp: 'pp', cp: 'pc' }
const formatPrice = (price: string) =>
    price
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/\b(pp|gp|sp|cp)\b/gi, (m) => COIN_PT[m.toLowerCase()] ?? m)

/** RAW: conjurar gasta cargas iguais ao rank; truque sai de graça. */
const chargeLabel = (rank: number) =>
    rank === 0 ? 'sem cargas' : `${rank} ${rank === 1 ? 'carga' : 'cargas'}`

/**
 * Magia herdada de um degrau inferior ganha etiqueta com o qualificador dele
 * ("Greater"), ou "base" quando o degrau inferior é o bastão sem qualificador.
 */
const tierBadge = (tierName: string | undefined): string | null => {
    if (!tierName) return null
    const qualifier = tierName.match(/\(([^)]+)\)\s*$/)
    return qualifier ? qualifier[1] : 'base'
}
