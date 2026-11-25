import { useContext, useMemo, useState } from 'react';
import { Box, Stack, Switch, Typography } from '@mui/material';
import {
  ChevronRight as OpenIcon, FaceOutlined as AncestryIcon, ForestOutlined as HeritageIcon, HistoryEduOutlined as BackgroundIcon,
} from '@mui/icons-material';
import { ink } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { pickerEditions } from '../remaster';
import { BuildExceptions } from '../hooks/buildExceptions';
import { ContentBadge, Folio, Label, OptionRow, Pill } from '../components/ui';
import { cardSx, rarityBadge } from '../components/uiTokens';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import type { RuleEntry } from '../rules/types';
import type { SectionProps } from './types';

type Picker = 'ancestry' | 'heritage' | 'background' | null;

/** "2 boosts livres", "FOR, DES e 1 livre". */
const boostSummary = (list: (AttributeKey | 'free')[] | undefined) => {
  const free = (list ?? []).filter((b) => b === 'free').length;
  const fixed = (list ?? []).filter((b): b is AttributeKey => b !== 'free').map(attributeLabel);
  if (!fixed.length) return free ? tr(`${free} boost${free > 1 ? 's' : ''} livre${free > 1 ? 's' : ''}`, `${free} free boost${free > 1 ? 's' : ''}`) : null;
  return tr(`${fixed.join(', ')}${free ? ` e ${free} livre${free > 1 ? 's' : ''}` : ''}`, `${fixed.join(', ')}${free ? ` and ${free} free` : ''}`);
};

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

  const [flawsOpen, setFlawsOpen] = useState(flaws.size > 0);
  const [languagePicker, setLanguagePicker] = useState(false);
  const left = Math.max(0, languageSlots - chosen.size);
  const ancestryMeta = ancestry?.ancestry
    ? [ancestry.ancestry.hp !== undefined ? tr(`${ancestry.ancestry.hp} PV`, `${ancestry.ancestry.hp} HP`) : null, ancestry.ancestry.size,
      ancestry.ancestry.speed ? tr(`${ancestry.ancestry.speed} pés`, `${ancestry.ancestry.speed} ft`) : null, boostSummary(ancestry.ancestry.boosts)].filter(Boolean).join(' · ')
    : undefined;
  const backgroundMeta = background?.background
    ? [background.background.boosts?.some((b) => b !== 'free')
      ? tr(`${background.background.boosts.filter((b): b is AttributeKey => b !== 'free').map(attributeLabel).join('/')} e 1 livre`, `${background.background.boosts.filter((b): b is AttributeKey => b !== 'free').map(attributeLabel).join('/')} and 1 free`)
      : boostSummary(background.background.boosts), (background.background.skills ?? []).join(', '), (background.background.feats ?? []).join(', ')].filter(Boolean).join(' · ')
    : undefined;
  const chevron = <OpenIcon sx={{ color: ink.secondary }} />;

  return (
    <Stack spacing={1.25}>
      <Folio icon={<AncestryIcon />} label={tr('Ancestralidade', 'Ancestry')} todo={!ancestry} disabled={!canEdit} onClick={() => setPicker('ancestry')}
        name={ancestry?.name ?? tr('Escolher ancestralidade', 'Choose an ancestry')}
        meta={ancestryMeta ?? tr('PV, tamanho, deslocamento, boosts e idiomas', 'HP, size, speed, boosts and languages')} trailing={ancestry ? chevron : undefined} />
      <Folio icon={<HeritageIcon />} label={tr('Herança', 'Heritage')} todo={!heritage} disabled={!canEdit} onClick={() => setPicker('heritage')}
        name={heritage?.name ?? tr('Escolher herança', 'Choose a heritage')}
        meta={heritage ? (heritage.heritage?.ancestry ? heritage.summary?.slice(0, 90) : tr('Herança versátil', 'Versatile heritage')) : tr('Da ancestralidade ou versátil', 'From the ancestry or versatile')}
        trailing={heritage ? chevron : undefined} />
      <Folio icon={<BackgroundIcon />} label={tr('Background', 'Background')} todo={!background} disabled={!canEdit} onClick={() => setPicker('background')}
        name={background?.name ?? tr('Escolher background', 'Choose a background')}
        meta={backgroundMeta ?? tr('2 boosts, 1 perícia e 1 talento de perícia', '2 boosts, 1 skill and 1 skill feat')} trailing={background ? chevron : undefined} />

      {ancestry && (
        <Box sx={[cardSx, { px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }]}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Label>{tr('Idiomas', 'Languages')}</Label>
            <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>
              {tr(`da ancestralidade + ${languageSlots} pela INT (Player Core pg. 89)`, `from the ancestry + ${languageSlots} from INT (Player Core pg. 89)`)}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(ancestry.ancestry?.languages ?? []).map((l) => <Pill key={l} look="lock">{l}</Pill>)}
            {languages.filter((l) => chosen.has(l.id)).map((l) => (
              <Pill key={l.id} look="sel" onClick={canEdit ? () => toggleLanguage(l.id) : undefined}
                title={canEdit ? tr('Tocar para tirar', 'Tap to remove') : undefined}>
                {l.name}{l.rarity !== 'common' && <ContentBadge kind={rarityBadge(l.rarity) ?? 'uncommon'} />}
              </Pill>
            ))}
            {canEdit && (left > 0 || languages.length > chosen.size) && (
              <Pill look="add" onClick={() => setLanguagePicker(true)}>
                {left > 0 ? tr(`+ Idioma · ${left} restante${left > 1 ? 's' : ''}`, `+ Language · ${left} left`) : tr('+ Idioma', '+ Language')}
              </Pill>
            )}
          </Box>
          <Box sx={{ fontSize: 12, color: ink.secondary }}>
            {tr('Idioma incomum normalmente vem da região ou de um talento; combine com o GM.', 'An uncommon language usually comes from your region or a feat; check with the GM.')}
          </Box>
        </Box>
      )}

      {ancestry && (
        <Box sx={[cardSx, { display: 'flex', flexDirection: 'column', overflow: 'hidden' }]}>
          <OptionRow label={<>{tr('Boosts alternativos', 'Alternate boosts')}<Box component="span" sx={{ display: 'block', fontSize: 12, color: ink.secondary }}>
            {tr('Dois livres no lugar dos boosts e flaws da ancestralidade · Player Core pg. 23', 'Two free boosts instead of the ancestry boosts and flaws · Player Core pg. 23')}</Box></>}
            control={<Switch checked={state.origin.alternateBoosts === true} disabled={!canEdit}
              onChange={(e) => setOrigin({ alternateBoosts: e.target.checked || undefined })} slotProps={{ input: { 'aria-label': tr('Boosts alternativos', 'Alternate boosts') } }} />} />
          <OptionRow label={tr('Flaw voluntário', 'Voluntary flaw')} last={!flawsOpen}
            value={flaws.size ? [...flaws].map(attributeLabel).join(', ') : tr('nenhum', 'none')}
            onClick={() => setFlawsOpen(!flawsOpen)} control={<OpenIcon sx={{ color: ink.secondary, transform: flawsOpen ? 'rotate(90deg)' : 'none' }} />} />
          {flawsOpen && (
            <Box sx={{ px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ fontSize: 13, color: ink.secondary }}>{tr('Opcional, combine com a mesa.', 'Optional, check with your table.')}</Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 0.5 }}>
                {ATTRIBUTES.map((a) => (
                  <Pill key={a} look={flaws.has(a) ? 'sel' : 'default'} onClick={canEdit ? () => toggleFlaw(a) : undefined} sx={{ px: 0, fontSize: 13 }}>{attributeLabel(a)}</Pill>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <ContentPicker open={languagePicker} title={tr('Idioma', 'Language')} entries={languages.filter((l) => !chosen.has(l.id))}
        onPick={(id) => toggleLanguage(id)} onClose={() => setLanguagePicker(false)} mesaRules={mesaRules}
        secondary={(e) => (e.rarity && e.rarity !== 'common' ? tr('combine com o GM', 'check with the GM') : undefined)} />
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
