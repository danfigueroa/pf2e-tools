import { lazy, Suspense, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import { tr } from '../../../i18n';
import { RELIC_ASPECTS, RELIC_STAGES, type PlayerRelic } from '../../../pathbuilder/playerRelic';
import { RELIC_OPTIONS } from '../../../pathbuilder/relicOptions';
import type { RulesIndex } from '../engine/types';
import { formatGp, type ItemKind } from './equipmentModel';
import { Label } from './ui';

const Description = lazy(() => import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));
const tiers = { minor: tr('menor', 'minor'), major: tr('maior', 'major'), grand: tr('grandiosa', 'grand') };
const nativeSelect = { select: { native: true }, inputLabel: { shrink: true } };

export function PlayerRelicEditor({ seed, level, kind, index, canEdit, change, preset }: {
  seed?: PlayerRelic; level: number; kind: ItemKind; index: RulesIndex; canEdit: boolean;
  preset?: { id: string; aspects?: string[]; gifts: { name: string }[] };
  change: (value?: PlayerRelic) => void;
}) {
  const [reading, setReading] = useState<number | null>(null);
  if (!seed) return canEdit && <Button variant="outlined" onClick={() => change({ legacyId: preset?.id, aspects: preset?.aspects ?? [], gifts: {} })}>
    {preset ? tr('Escolher dádivas desta relíquia', 'Choose gifts for this relic') : tr('Criar relíquia neste item', 'Create relic from this item')}
  </Button>;
  const matches = (aspects: string[]) => aspects.some((a) => seed.aspects.includes(a));
  return <Stack spacing={1.5}>
    <Label>{tr(`Relíquia · nível ${level}`, `Relic · level ${level}`)}</Label>
    <Box>{tr('Escolha os aspectos da semente, normalmente dois. Você pode planejar as dádivas dos próximos níveis.', 'Choose the seed’s aspects, usually two. You can plan gifts for later levels.')}</Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {[...new Set([...RELIC_ASPECTS, ...seed.aspects])].map((a) => <Button key={a} size="small" variant={seed.aspects.includes(a) ? 'contained' : 'outlined'}
        disabled={!canEdit} aria-pressed={seed.aspects.includes(a)}
        onClick={() => change({ ...seed, aspects: seed.aspects.includes(a) ? seed.aspects.filter((v) => v !== a) : [...seed.aspects, a] })}>{a}</Button>)}
    </Box>
    {(kind === 'weapon' || kind === 'armor') && <small>{tr('A mesa permite escolher uma runa no lugar da dádiva. O GM Core recomenda reservar essa opção às relíquias conduzidas pelo GM.', 'This table allows a rune instead of a gift. GM Core recommends reserving that option for GM-driven relics.')}</small>}
    {RELIC_STAGES.map((stage, slotIndex) => {
      const value = seed.gifts[stage.level] ?? '';
      const gift = RELIC_OPTIONS.find((g) => g.id === value);
      const at = seed.levels?.[stage.level] ?? stage.level;
      const options = RELIC_OPTIONS.filter((g) => g.tier === stage.tier && (!g.host || g.host === kind || g.id === value))
        .sort((a, b) => Number(matches(b.aspects)) - Number(matches(a.aspects)) || a.name.localeCompare(b.name));
      const rune = gift?.catalogId ? index.get(gift.catalogId) : undefined;
      const label = tr(`Dádiva ${tiers[stage.tier]} · nível ${stage.level}`, `${tiers[stage.tier]} gift · level ${stage.level}`);
      return <Stack spacing={0.5} key={stage.level}>
        <TextField select size="small" slotProps={nativeSelect} label={label} value={value} disabled={!canEdit}
          onChange={(e) => {
            const gifts = { ...seed.gifts };
            if (e.target.value) gifts[stage.level] = e.target.value;
            else delete gifts[stage.level];
            change({ ...seed, gifts });
          }}>
          {value && !gift && <option value={value}>{tr('Escolha fora do catálogo', 'Choice outside the catalog')} · {value}</option>}
          <option value="">{preset?.gifts[slotIndex]?.name ?? tr('Escolher…', 'Choose…')}</option>
          {[false, true].map((isRune) => <optgroup key={String(isRune)} label={isRune ? tr('Runa no lugar do poder', 'Rune instead of a power') : tr('Poder', 'Power')}>
            {options.filter((g) => !!g.rune === isRune).map((g) => <option key={g.id} value={g.id}>{g.name} · {g.aspects.join(', ')}</option>)}
          </optgroup>)}
        </TextField>
        {gift && <>
          <TextField select size="small" label={tr('Nível de despertar', 'Awakening level')} slotProps={nativeSelect} value={at} disabled={!canEdit}
            onChange={(e) => change({ ...seed, levels: { ...seed.levels, [stage.level]: Number(e.target.value) } })}>
            {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </TextField>
          {at > level && <small>{tr(`Planejada para o nível ${at}`, `Planned for level ${at}`)}</small>}
          {!matches(gift.aspects) && <small>{tr('Confira o aspecto com o GM.', 'Check the aspect with the GM.')}</small>}
          {gift.host && gift.host !== kind && <small>{tr('Confira o tipo do item com o GM.', 'Check the item type with the GM.')}</small>}
          {gift.prerequisite && <small>{tr('Pré-requisito', 'Prerequisite')} · {gift.prerequisite}</small>}
          <small>{tr('Ajuste do tesouro da mesa', 'Party treasure adjustment')} · {gift.rune
            ? rune?.item?.price && rune.level !== undefined ? tr(`nível ${rune.level} · ${formatGp(rune.item.price.gp)}`, `level ${rune.level} · ${formatGp(rune.item.price.gp)}`)
              : tr('confira o nível e o preço da runa', 'check the rune’s level and Price')
            : formatGp(stage.gp)}</small>
          <Button size="small" onClick={() => setReading(reading === stage.level ? null : stage.level)}>
            {reading === stage.level ? tr('Recolher descrição', 'Hide description') : tr('Ver descrição', 'View description')}</Button>
          {reading === stage.level && <Suspense><Description embedded request={{ type: gift.rune ? 'item' : 'special', name: gift.rune ?? `${gift.name} [relic]` }} onClose={() => setReading(null)} /></Suspense>}
        </>}
      </Stack>;
    })}
    {(kind === 'weapon' || kind === 'armor') && <FormControlLabel control={<Checkbox checked={!!seed.allowEtching} disabled={!canEdit}
      onChange={(_, checked) => change({ ...seed, allowEtching: checked })} />} label={tr('O GM permite gravar propriedades. As runas de dádiva também ocupam espaços.', 'The GM allows etching property runes. Gift runes also use slots.')} />}
    {canEdit && <Button onClick={() => change(undefined)}>{preset ? tr('Restaurar dádivas da mesa', 'Restore table gifts') : tr('Remover relíquia do item', 'Remove relic from item')}</Button>}
  </Stack>;
}
