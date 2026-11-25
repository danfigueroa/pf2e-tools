import { Box, Paper, Typography } from '@mui/material';
import { tr } from '../../../i18n';
import type { Compiled, Stat } from '../engine/types';

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

const STATS: { key: keyof Compiled['stats']; label: string; dc?: boolean }[] = [
  { key: 'hp', label: tr('PV', 'HP'), dc: true },
  { key: 'ac', label: tr('CA', 'AC'), dc: true },
  { key: 'fortitude', label: tr('FORT', 'FORT') },
  { key: 'reflex', label: tr('REF', 'REF') },
  { key: 'will', label: tr('VON', 'WILL') },
  { key: 'perception', label: tr('Percepção', 'Perception') },
  { key: 'classDC', label: tr('CD', 'DC'), dc: true },
  { key: 'speed', label: tr('Desloc.', 'Speed'), dc: true },
];

/** "Treinado +3 · SAB +2": a memória de cálculo no `title` (dica nativa, sem popper no chunk). */
const explain = (stat: Stat) => stat.parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ');

/**
 * Resumo ao vivo (UX §1.2): os números principais do personagem compilado, com a conta de cada um ao passar o mouse ou
 * segurar o dedo. No celular, uma grade compacta de 4 colunas.
 */
export function StatusHeader({ compiled }: { compiled: Compiled }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.5 }, mb: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(8, 1fr)' }, gap: { xs: 0.5, sm: 1 } }}>
        {STATS.map(({ key, label, dc }) => {
          const stat = compiled.stats[key];
          const value = !stat ? '—' : key === 'speed' ? (stat.total ? `${stat.total} ft` : '—') : dc ? String(stat.total) : signed(stat.total);
          return (
            <Box key={key} title={stat ? explain(stat) : undefined} sx={{ textAlign: 'center', minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" component="p" noWrap>{label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }} noWrap>{value}</Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
