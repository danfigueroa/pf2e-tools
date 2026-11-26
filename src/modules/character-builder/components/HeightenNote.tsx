import { TrendingUpRounded as UpIcon } from '@mui/icons-material';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { SpellCast } from './descriptionRequest';
import { Notice } from './ui';
import { heightenGain } from '../engine/spells';

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
  const gain = cast.auto ? null : heightenGain(entry, cast.rank);
  // Espaço sem ganho é permitido (o rank sobe e conta para contra-atacar), mas a pessoa precisa saber.
  const body = gain && !gain.gains
    ? tr(`Neste rank a elevação não dá nada${gain.next ? `: o próximo ganho é no rank ${gain.next}` : ''}. O rank da magia sobe mesmo assim, o que conta para contra-atacar (Player Core pg. 297).`,
      `Heightening gives nothing at this rank${gain.next ? `: the next benefit is at rank ${gain.next}` : ''}. The spell's rank still rises, which matters for counteracting (Player Core pg. 297).`)
    : cast.rank > base
      ? tr('Os números destacados na descrição já estão calculados para este rank.', 'The highlighted numbers in the description are already calculated for this rank.')
      : tr('Ainda no rank base: sobe com a metade do nível, arredondada para cima.', 'Still at its base rank: it rises with half your level, rounded up.');
  return (
    <Notice tone={gain && !gain.gains ? 'warn' : 'info'} icon={<UpIcon />}>
      <b>{title}</b>
      <span>{body}</span>
    </Notice>
  );
}
