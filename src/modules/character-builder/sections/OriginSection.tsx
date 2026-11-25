import { useContext, useMemo, useState } from 'react';
import { Box, Chip, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import { displayFont } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { pickerEditions } from '../remaster';
import { BuildExceptions } from '../hooks/buildExceptions';
import { PickerField } from '../components/PickerField';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import type { RuleEntry } from '../rules/types';
import type { SectionProps } from './types';

type Picker = 'ancestry' | 'heritage' | 'background' | null;

const boostText = (list: (AttributeKey | 'free')[] | undefined) =>
  (list ?? []).map((b) => (b === 'free' ? tr('livre', 'free') : attributeLabel(b))).join(', ') || '—';

export const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>{label}: </Box>{value}</Typography>
);

const ancestryFacts = (e: RuleEntry) => (
  <Stack spacing={0.25}>
    <Fact label={tr('PV', 'HP')} value={e.ancestry?.hp ?? '—'} />
    <Fact label={tr('Tamanho', 'Size')} value={e.ancestry?.size ?? '—'} />
    <Fact label={tr('Deslocamento', 'Speed')} value={e.ancestry?.speed ? `${e.ancestry.speed} ft` : '—'} />
    <Fact label={tr('Boosts', 'Boosts')} value={boostText(e.ancestry?.boosts)} />
    {e.ancestry?.flaws?.length ? <Fact label={tr('Flaw', 'Flaw')} value={boostText(e.ancestry.flaws)} /> : null}
    <Fact label={tr('Idiomas', 'Languages')} value={(e.ancestry?.languages ?? []).join(', ') || '—'} />
    {e.ancestry?.senses?.length ? <Fact label={tr('Sentidos', 'Senses')} value={e.ancestry.senses.join(', ')} /> : null}
  </Stack>
);

const backgroundFacts = (e: RuleEntry) => (
  <Stack spacing={0.25}>
    <Fact label={tr('Boosts', 'Boosts')} value={e.background?.boosts?.length
      ? tr(`um entre ${boostText(e.background.boosts)} e um livre`, `one of ${boostText(e.background.boosts)} and one free`) : '—'} />
    <Fact label={tr('Perícias', 'Skills')} value={(e.background?.skills ?? []).join(', ') || '—'} />
    <Fact label={tr('Talento', 'Feat')} value={(e.background?.feats ?? []).join(', ') || '—'} />
  </Stack>
);

/** Aba Origem: ancestralidade → herança (da ancestralidade ou versátil) → background, e os idiomas. */
export function OriginSection({ state, update, core, mesaRules, compiled, canEdit, index }: SectionProps) {
  const [picker, setPicker] = useState<Picker>(null);
  const ancestry = index.get(state.origin.ancestry);
  const heritage = index.get(state.origin.heritage);
  const background = index.get(state.origin.background);

  // Heranças da ancestralidade escolhida e as versáteis (sem ancestralidade), que servem para qualquer uma.
  const heritages = useMemo(() => core.heritages.filter((h) => !h.heritage?.ancestry
    || !ancestry || h.heritage.ancestry.toLowerCase() === ancestry.name.toLowerCase()), [core.heritages, ancestry]);

  // A AON publica as heranças versáteis (Aiuvarin, Changeling…) também como página de ancestralidade: no seletor de
  // ancestralidade elas não entram, porque são escolhidas como herança.
  const ancestryList = useMemo(() => {
    const versatile = new Set(core.heritages.filter((h) => !h.heritage?.ancestry).map((h) => h.name.toLowerCase()));
    return core.ancestries.filter((a) => !versatile.has(a.name.toLowerCase()));
  }, [core.ancestries, core.heritages]);

  const setOrigin = (patch: Partial<typeof state.origin>) => update((s) => ({ ...s, origin: { ...s.origin, ...patch } }));
  const pick = (kind: Exclude<Picker, null>, id: string) => {
    if (kind === 'ancestry' && id !== state.origin.ancestry) {
      // Trocar de ancestralidade: a herança e os boosts livres dela deixam de valer (a escolha antiga não some: vira
      // "escolha sem lugar" só se o slot sumir).
      const keep = index.get(state.origin.heritage);
      const stillFits = keep && (!keep.heritage?.ancestry || keep.heritage.ancestry.toLowerCase() === index.get(id)?.name.toLowerCase());
      setOrigin({ ancestry: id, heritage: stillFits ? state.origin.heritage : undefined });
    } else setOrigin({ [kind]: id });
  };

  const languageSlots = compiled.languageSlots;
  const chosen = new Set(state.origin.languages ?? []);
  const fixedLanguages = new Set((ancestry?.ancestry?.languages ?? []).map((l) => l.toLowerCase()));
  const exceptions = useContext(BuildExceptions);
  const offered = new Set(pickerEditions(core.languages, mesaRules, exceptions).map((l) => l.id));
  const languages = core.languages.filter((l) => offered.has(l.id) || chosen.has(l.id))
    .filter((l) => !fixedLanguages.has(l.name.toLowerCase()))
    .sort((a, b) => (a.rarity === b.rarity ? 0 : a.rarity === 'common' ? -1 : 1) || a.name.localeCompare(b.name, locale));
  const toggleLanguage = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOrigin({ languages: [...next] });
  };

  const flaws = new Set(state.origin.voluntaryFlaws ?? []);
  const toggleFlaw = (a: AttributeKey) => {
    const next = new Set(flaws);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    setOrigin({ voluntaryFlaws: [...next] });
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
        <PickerField label={tr('Ancestralidade', 'Ancestry')} value={ancestry?.name} onOpen={() => setPicker('ancestry')} disabled={!canEdit}
          hint={ancestry ? tr(`${ancestry.ancestry?.hp ?? '—'} PV · ${ancestry.ancestry?.speed ?? '—'} ft`, `${ancestry.ancestry?.hp ?? '—'} HP · ${ancestry.ancestry?.speed ?? '—'} ft`) : undefined} />
        <PickerField label={tr('Herança', 'Heritage')} value={heritage?.name} onOpen={() => setPicker('heritage')} disabled={!canEdit}
          hint={heritage && !heritage.heritage?.ancestry ? tr('Herança versátil', 'Versatile heritage') : undefined} />
        <PickerField label={tr('Background', 'Background')} value={background?.name} onOpen={() => setPicker('background')} disabled={!canEdit} />
      </Box>

      {ancestry && (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700, mb: 1 }}>{tr('Boosts da ancestralidade', 'Ancestry boosts')}</Typography>
          <FormControlLabel disabled={!canEdit}
            control={<Switch checked={state.origin.alternateBoosts === true} onChange={(e) => setOrigin({ alternateBoosts: e.target.checked || undefined })} />}
            label={tr('Boosts alternativos: dois livres no lugar dos boosts e flaws da ancestralidade', 'Alternate boosts: two free boosts instead of the ancestry boosts and flaws')} />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>Player Core pg. 23</Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>{tr('Flaws voluntários (opcional, combine com a mesa):', 'Voluntary flaws (optional, check with your table):')}</Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {ATTRIBUTES.map((a) => (
              <Chip key={a} label={attributeLabel(a)} color={flaws.has(a) ? 'error' : 'default'} variant={flaws.has(a) ? 'filled' : 'outlined'}
                onClick={canEdit ? () => toggleFlaw(a) : undefined} />
            ))}
          </Stack>
        </Paper>
      )}

      {ancestry && (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700 }}>{tr('Idiomas', 'Languages')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tr(`Da ancestralidade: ${(ancestry.ancestry?.languages ?? []).join(', ') || '—'}. A INT dá mais ${languageSlots} (Player Core pg. 89); restam ${Math.max(0, languageSlots - chosen.size)}.`,
              `From the ancestry: ${(ancestry.ancestry?.languages ?? []).join(', ') || '—'}. INT grants ${languageSlots} more (Player Core pg. 89); ${Math.max(0, languageSlots - chosen.size)} left.`)}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {languages.map((l) => (
              <Chip key={l.id} size="small" label={l.rarity !== 'common' ? `${l.name} *` : l.name}
                color={chosen.has(l.id) ? 'primary' : 'default'} variant={chosen.has(l.id) ? 'filled' : 'outlined'}
                onClick={canEdit ? () => toggleLanguage(l.id) : undefined} />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {tr('* incomum: normalmente vem da região ou de um talento; combine com o GM.', '* uncommon: usually from your region or a feat; check with the GM.')}
          </Typography>
        </Paper>
      )}

      <ContentPicker open={picker === 'ancestry'} title={tr('Ancestralidade', 'Ancestry')} entries={ancestryList} value={state.origin.ancestry}
        onPick={(id) => pick('ancestry', id)} onClose={() => setPicker(null)} mesaRules={mesaRules} facts={ancestryFacts}
        secondary={(e) => (e.ancestry ? `${e.ancestry.hp ?? '—'} ${tr('PV', 'HP')} · ${boostText(e.ancestry.boosts)}` : undefined)} />
      <ContentPicker open={picker === 'heritage'} title={tr('Herança', 'Heritage')} entries={heritages} value={state.origin.heritage}
        onPick={(id) => pick('heritage', id)} onClose={() => setPicker(null)} mesaRules={mesaRules}
        secondary={(e) => (e.heritage?.ancestry ? e.heritage.ancestry : tr('versátil', 'versatile'))} />
      <ContentPicker open={picker === 'background'} title={tr('Background', 'Background')} entries={core.backgrounds} value={state.origin.background}
        onPick={(id) => pick('background', id)} onClose={() => setPicker(null)} mesaRules={mesaRules} facts={backgroundFacts}
        secondary={(e) => boostText(e.background?.boosts)} />
    </Stack>
  );
}
