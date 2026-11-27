import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import { tr } from '../../../i18n';
import { RELIC_ASPECTS, RELIC_STAGES, type PlayerRelic } from '../../../pathbuilder/playerRelic';
import { RELIC_OPTIONS } from '../../../pathbuilder/relicOptions';
import type { RulesIndex } from '../engine/types';
import { formatGp, type ItemKind } from './equipmentModel';
import { Label } from './ui';
import { relicAspectLabel } from './relicView';
import { RelicAspectTags, RelicGiftDescription, RelicGiftPicker } from './RelicGiftPicker';
import { VIEW_OK } from '../../character-viewer/sheetAccess';

const tiers = { minor: tr('menor', 'minor'), major: tr('maior', 'major'), grand: tr('grandiosa', 'grand') };
const nativeSelect = { select: { native: true }, inputLabel: { shrink: true } };

export function PlayerRelicEditor({ seed, level, kind, index, canEdit, change, preset }: {
  seed?: PlayerRelic; level: number; kind: ItemKind; index: RulesIndex; canEdit: boolean;
  preset?: { id: string; aspects?: string[]; gifts: { name: string; kind: 'power' | 'rune'; description?: string }[] };
  change: (value?: PlayerRelic) => void;
}) {
  const [browsing, setBrowsing] = useState<number | null>(null);
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
        onClick={() => change({ ...seed, aspects: seed.aspects.includes(a) ? seed.aspects.filter((v) => v !== a) : [...seed.aspects, a] })}>{relicAspectLabel(a)}</Button>)}
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
      const inherited = !value ? preset?.gifts[slotIndex] : undefined;
      const displayed = gift ?? (inherited && RELIC_OPTIONS.find((g) => g.name === inherited.name && !!g.rune === (inherited.kind === 'rune')));
      const name = displayed?.name ?? inherited?.name;
      const choose = (id: string) => {
        const gifts = { ...seed.gifts };
        if (id) gifts[stage.level] = id;
        else delete gifts[stage.level];
        change({ ...seed, gifts });
        setBrowsing(null);
      };
      return <Stack spacing={1} key={stage.level}>
        <Label>{label}</Label>
        {(name || value) && <Box component="strong">{name ?? value}</Box>}
        {displayed && <RelicAspectTags names={displayed.aspects} />}
        {inherited?.description ? <Box sx={{ whiteSpace: 'pre-line' }}>{inherited.description}</Box> : name &&
          <RelicGiftDescription name={name} rune={displayed?.rune ?? (inherited?.kind === 'rune' ? inherited.name : undefined)} />}
        <Button {...VIEW_OK} variant="outlined" onClick={() => setBrowsing(stage.level)}
          aria-label={tr(`Consultar opções de ${label}`, `Browse options for ${label}`)}>
          {tr('Consultar dádivas', 'Browse gifts')}
        </Button>
        {canEdit && value && <Button onClick={() => choose('')}>{preset?.gifts[slotIndex]
          ? tr('Restaurar dádiva da mesa', 'Restore table gift') : tr('Limpar escolha', 'Clear choice')}</Button>}
        {browsing === stage.level && <RelicGiftPicker title={label} options={options} value={value}
          onPick={canEdit ? choose : undefined} onClose={() => setBrowsing(null)} />}
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
        </>}
      </Stack>;
    })}
    {(kind === 'weapon' || kind === 'armor') && <FormControlLabel control={<Checkbox checked={!!seed.allowEtching} disabled={!canEdit}
      onChange={(_, checked) => change({ ...seed, allowEtching: checked })} />} label={tr('O GM permite gravar propriedades. As runas de dádiva também ocupam espaços.', 'The GM allows etching property runes. Gift runes also use slots.')} />}
    {canEdit && <Button onClick={() => change(undefined)}>{preset ? tr('Restaurar dádivas da mesa', 'Restore table gifts') : tr('Remover relíquia do item', 'Remove relic from item')}</Button>}
  </Stack>;
}
