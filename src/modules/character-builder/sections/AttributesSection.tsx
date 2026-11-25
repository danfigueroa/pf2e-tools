import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { Lock as FixedIcon } from '@mui/icons-material';
import { displayFont } from '../../../theme';
import { tr } from '../../../i18n';
import { attributeLabel, attributeScore, type BoostGroup } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import { setChoice, type SectionProps } from './types';

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

/**
 * Aba Atributos (UX §1.4): cada grupo de boosts numa linha de seis botões, com "Restam N". Os fixos da ancestralidade
 * aparecem travados. Em cima, os modificadores finais (com o parcial pendente marcado).
 */
export function AttributesSection({ state, update, compiled, canEdit }: SectionProps) {
  const { mod, partial } = compiled.attributes;

  const toggle = (group: BoostGroup, a: AttributeKey) => {
    if (group.key === 'class-key') {
      update((s) => ({ ...s, class: { ...s.class, keyAttribute: a } }));
      return;
    }
    const current = group.chosen;
    const next = current.includes(a) ? current.filter((x) => x !== a) : [...current, a];
    setChoice(update, group.key, next.length ? { boosts: next } : null);
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.5 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
          {ATTRIBUTES.map((a) => (
            <Box key={a} sx={{ textAlign: 'center' }} title={tr(`Pontuação no export: ${attributeScore(mod[a], partial[a])}`, `Export score: ${attributeScore(mod[a], partial[a])}`)}>
              <Typography variant="caption" color="text.secondary" component="p">{attributeLabel(a)}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>{signed(mod[a])}{partial[a] ? '½' : ''}</Typography>
            </Box>
          ))}
        </Box>
        {ATTRIBUTES.some((a) => partial[a]) && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, textAlign: 'center' }}>
            {tr('½ = boost parcial: o próximo boost sobe +1 (Player Core pg. 17).', '½ = partial boost: the next boost raises it by 1 (Player Core pg. 17).')}
          </Typography>
        )}
      </Paper>

      {compiled.boostGroups.filter((g) => g.count > 0 || g.fixed.length > 0).map((group) => {
        const left = Math.max(0, group.count - group.chosen.length);
        return (
          <Paper key={group.key} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700, flex: 1, minWidth: 0 }}>{group.label}</Typography>
              {group.count > 0 && (
                <Typography variant="body2" color={left ? 'warning.main' : 'text.secondary'}>
                  {left ? tr(`Restam ${left}`, `${left} left`) : tr('Completo', 'Done')}
                </Typography>
              )}
            </Stack>
            {group.oneOf && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {tr(`Um boost entre ${group.options.map(attributeLabel).join(' ou ')}, e um livre.`, `One boost to ${group.options.map(attributeLabel).join(' or ')}, and one free.`)}
              </Typography>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 0.75 }}>
              {ATTRIBUTES.map((a) => {
                const fixed = group.fixed.includes(a);
                const on = fixed || group.chosen.includes(a);
                const offered = group.key === 'class-key' ? group.options.includes(a) : !fixed;
                return (
                  <Chip key={a} label={attributeLabel(a)} icon={fixed ? <FixedIcon /> : undefined}
                    color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                    disabled={!offered && !on}
                    onClick={canEdit && offered && group.count > 0 ? () => toggle(group, a) : undefined}
                    sx={{ minHeight: 40 }} />
                );
              })}
            </Box>
          </Paper>
        );
      })}

      {state.origin.alternateBoosts && (
        <Typography variant="body2" color="text.secondary">{tr('Boosts alternativos da ancestralidade ligados (aba Origem).', 'Alternate ancestry boosts on (Origin tab).')}</Typography>
      )}
    </Stack>
  );
}
