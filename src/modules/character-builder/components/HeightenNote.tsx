import { TrendingUpRounded as UpIcon } from '@mui/icons-material';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { SpellCast } from './descriptionRequest';
import { Notice } from './ui';

/**
 * O aviso de magia elevada: lançada acima do rank base (espaço maior, ou truque e foco que sobem sozinhos com a metade
 * do nível, como diz o "Spellcasting" de cada classe), os números da descrição já vêm no rank conjurado, em destaque.
 */
export function HeightenNote({ entry, cast }: { entry: RuleEntry; cast: SpellCast }) {
  const base = entry.spell?.cantrip ? 1 : entry.spell?.rank ?? entry.level ?? 1;
  if (cast.rank <= base && !cast.auto) return null;
  const title = cast.auto
    ? tr(`Elevada automaticamente ao rank ${cast.rank}`, `Automatically heightened to rank ${cast.rank}`)
    : tr(`Preparada no rank ${cast.rank} (base ${base})`, `Cast at rank ${cast.rank} (base ${base})`);
  const body = cast.rank > base
    ? tr('Os números destacados na descrição já estão calculados para este rank.', 'The highlighted numbers in the description are already calculated for this rank.')
    : tr('Ainda no rank base: sobe com a metade do nível, arredondada para cima.', 'Still at its base rank: it rises with half your level, rounded up.');
  return (
    <Notice tone="info" icon={<UpIcon />}>
      <b>{title}</b>
      <span>{body}</span>
    </Notice>
  );
}
