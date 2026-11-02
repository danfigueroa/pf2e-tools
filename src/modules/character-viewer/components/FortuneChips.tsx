import { Box, Chip, Typography } from '@mui/material'
import type { FortuneApi } from './useFortune'
import { tr } from '../../../i18n'

/** Os chips de fortuna do diálogo (o estado e o pagamento ficam no `useFortune`). */
interface Props {
    fortune: FortuneApi
    /** Outro efeito de fortuna já vale nesta rolagem (o estratagema de ataque): os chips ficam desligados. */
    blocked?: string | null
}

export function FortuneChips({ fortune, blocked }: Props) {
    if (fortune.sources.length === 0) return null
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">{tr('Fortuna · role 2d20 e fique com o maior', 'Fortune · roll 2d20 and keep the higher')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                {fortune.sources.map((s) => {
                    const used = s.id === 'wish-for-luck' && fortune.wishUsed
                    const on = fortune.picked === s.id && !blocked
                    const cost = s.id === 'sure-strike' && fortune.sureCast ? tr('já conjurada', 'already cast') : used ? tr('usado hoje', 'used today') : s.cost
                    return (
                        <Chip
                            key={s.id}
                            size="small"
                            label={`${s.label} · ${cost}`}
                            color={on ? 'primary' : 'default'}
                            variant={on ? 'filled' : 'outlined'}
                            disabled={used || !!blocked}
                            aria-pressed={on}
                            onClick={() => fortune.setPicked(on ? null : s.id)}
                            sx={{ minHeight: 28 }}
                        />
                    )
                })}
            </Box>
            {blocked ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{blocked}</Typography>
            ) : fortune.active && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {fortune.active.id === 'sure-strike'
                        ? (fortune.sureCast
                            ? tr('Rolar não cobra a magia de novo. ', 'Rolling doesn\'t charge the spell again. ')
                            : tr('Rolar conjura a magia (1 ação + o slot). ', 'Rolling casts the spell (1 action + the slot). '))
                            + tr('Ignora penalidades de circunstância no ataque e o teste simples de alvo oculto ou escondido — tire-as do ajuste.', 'It ignores circumstance penalties to the attack and the flat check for a concealed or hidden target — take them out of the adjustment.')
                        : tr('Gasta o uso do dia ao rolar. Não soma com outro efeito de fortuna.', 'Spends the daily use when rolling. Doesn\'t stack with another fortune effect.')}
                </Typography>
            )}
        </Box>
    )
}
