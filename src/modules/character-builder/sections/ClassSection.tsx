import { useState } from 'react';
import { Box, Button, ButtonBase, Stack } from '@mui/material';
import { CheckRounded as DoneIcon, ChevronRight as OpenIcon, ShieldOutlined as ClassIcon, AutoAwesomeOutlined as SubclassIcon } from '@mui/icons-material';
import { greenInk, ink, parchment } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { ContentBadge, Folio, Label, PendCount, Pill, ProfPill, SectionHead } from '../components/ui';
import { cardSx, warmShadow } from '../components/uiTokens';
import { attributeLabel } from '../engine/attributes';
import { rankName } from '../engine/compile';
import type { FeatSlot } from '../engine/slots';
import type { Rank } from '../engine/types';
import type { RuleEntry } from '../rules/types';
import { Fact } from './OriginSection';
import { adjustedClass, CLASS_ARCHETYPE, CLASS_ARCHETYPES, selectedClassArchetype } from '../engine/classArchetypes';
import { setChoice, type SectionProps } from './types';

const ranks = (record: Partial<Record<string, number>> | undefined, labels: Record<string, string>) =>
  Object.entries(record ?? {}).filter(([, r]) => (r ?? 0) > 0)
    .map(([k, r]) => `${labels[k] ?? k} ${rankName((r ?? 0) as Rank).toLowerCase()}`).join(', ') || '—';

const ATTACKS: Record<string, string> = { simple: tr('simples', 'simple'), martial: tr('marciais', 'martial'), advanced: tr('avançadas', 'advanced'), unarmed: tr('desarmado', 'unarmed') };
const DEFENSES: Record<string, string> = { light: tr('leve', 'light'), medium: tr('média', 'medium'), heavy: tr('pesada', 'heavy'), unarmored: tr('sem armadura', 'unarmored') };
const SAVES: Record<string, string> = { fortitude: tr('Fortitude', 'Fortitude'), reflex: tr('Reflexos', 'Reflex'), will: tr('Vontade', 'Will') };

const classFacts = (e: RuleEntry) => {
  const c = e.class;
  return (
    <Stack spacing={0.25}>
      <Fact label={tr('PV por nível', 'HP per level')} value={c?.hp !== undefined ? tr(`${c.hp} + CON`, `${c.hp} + CON`) : '—'} />
      <Fact label={tr('Atributo-chave', 'Key attribute')} value={(c?.keyAttribute ?? []).map(attributeLabel).join(tr(' ou ', ' or ')) || '—'} />
      <Fact label={tr('Percepção', 'Perception')} value={c?.perception ? rankName(c.perception) : '—'} />
      <Fact label={tr('Salvaguardas', 'Saves')} value={ranks(c?.saves, SAVES)} />
      <Fact label={tr('Ataques', 'Attacks')} value={ranks(c?.attacks, ATTACKS)} />
      <Fact label={tr('Defesas', 'Defenses')} value={ranks(c?.defenses, DEFENSES)} />
      <Fact label={tr('Perícias', 'Skills')} value={tr(`${(c?.trainedSkills?.fixed ?? []).join(', ') || '—'} + ${c?.trainedSkills?.additional ?? 0} + INT`, `${(c?.trainedSkills?.fixed ?? []).join(', ') || '—'} + ${c?.trainedSkills?.additional ?? 0} + INT`)} />
    </Stack>
  );
};

const SAVE_KEYS = ['fortitude', 'reflex', 'will'] as const;

/** Seletor segmentado (atributo-chave): dois a três botões do mesmo tamanho. */
const Segmented = ({ options, value, onChange, disabled }: { options: { value: string; label: string }[]; value?: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <Box role="radiogroup" sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', bgcolor: parchment.sunken, borderRadius: '8px', p: '3px', gap: '3px' }}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <ButtonBase key={o.value} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.value)} data-view="" sx={{
          height: 40, borderRadius: '6px', fontSize: 14, fontWeight: 600, gap: 0.75, color: on ? ink.primary : ink.secondary,
          bgcolor: on ? parchment.paper : 'transparent', boxShadow: on ? warmShadow : 'none',
        }}>{on && <DoneIcon sx={{ fontSize: 16, color: greenInk.mid }} />}{o.label}</ButtonBase>
      );
    })}
  </Box>
);

/** Aba Classe: a classe, o atributo-chave (o boost da classe, Player Core pg. 17), a subclasse do 1º nível e o arquétipo de classe. */
export function ClassSection({ state, update, core, mesaRules, canEdit, index, compiled, freeArchetype, onChooseDedication }: SectionProps & {
  freeArchetype?: FeatSlot;
  onChooseDedication: (slot: FeatSlot) => void;
}) {
  const [picker, setPicker] = useState<'class' | 'archetype' | string | null>(null);
  const baseClass = index.get(state.class.id);
  const archetypeId = selectedClassArchetype(state.choices[CLASS_ARCHETYPE], baseClass);
  const archetype = index.get(archetypeId);
  const cls = adjustedClass(baseClass, archetypeId);
  const available = core.archetypes.filter((a) => cls && CLASS_ARCHETYPES[a.id]?.className === cls.name);
  const keys = cls?.class?.keyAttribute ?? [];
  const setClass = (patch: Partial<typeof state.class>) => update((s) => ({ ...s, class: { ...s.class, ...patch } }));
  const subclasses = compiled.classChoices.filter((c) => c.level === 1);
  const chevron = <OpenIcon sx={{ color: ink.secondary }} />;
  const c = cls?.class;
  const tradition = c?.casting?.traditions?.length ? c.casting.traditions.join('/') : null;
  const freeChoice = freeArchetype ? state.choices[freeArchetype.key] : undefined;
  const freeId = freeChoice && 'id' in freeChoice ? freeChoice.id : undefined;
  const freeName = freeId ? index.get(freeId)?.name ?? freeId : undefined;

  return (
    <Stack spacing={1.5}>
      <Folio icon={<ClassIcon />} label={tr('Classe', 'Class')} todo={!cls && canEdit} disabled={!canEdit && !cls} onClick={() => setPicker('class')}
        name={cls?.name ?? tr('Escolher classe', 'Choose a class')}
        meta={c ? [c.hp !== undefined ? tr(`${c.hp} PV + CON por nível`, `${c.hp} HP + CON per level`) : null, tradition ? tr(`magias (${tradition})`, `spells (${tradition})`) : null].filter(Boolean).join(' · ')
          : tr('PV, proficiências, perícias e talentos de classe', 'HP, proficiencies, skills and class feats')}
        trailing={cls ? chevron : undefined} />

      {cls && keys.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Label>{tr('Atributo-chave', 'Key attribute')}</Label>
          {keys.length > 1 ? (
            <Segmented options={keys.map((k) => ({ value: k, label: attributeLabel(k) }))} value={state.class.keyAttribute} disabled={!canEdit}
              onChange={(k) => setClass({ keyAttribute: k as typeof keys[number] })} />
          ) : (
            <Pill look="lock">{attributeLabel(keys[0])}</Pill>
          )}
        </Box>
      )}

      {subclasses.map((slot) => {
        const chosen = slot.chosen ? slot.options.find((o) => o.id === slot.chosen) ?? index.get(slot.chosen) : undefined;
        // Como a classe: o campo mostra a escolha e abre o seletor completo (lista, descrição e fatos de cada opção).
        return (
          <Box key={slot.key} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            <SectionHead note={tr('subclasse · nível 1', 'subclass · level 1')}>{slot.label}</SectionHead>
            <Folio icon={<SubclassIcon />} label={slot.label} todo={!chosen && canEdit} disabled={!!slot.fixed && !chosen}
              onClick={() => setPicker(slot.key)}
              name={chosen?.name ?? tr(`Escolher ${slot.label.toLowerCase()}`, `Choose ${slot.label.toLowerCase()}`)}
              meta={slot.fixed ? tr('Concedida pelo arquétipo de classe', 'Granted by the class archetype')
                : chosen ? (canEdit ? tr('Toque para ver a descrição ou trocar', 'Tap to read the description or change it') : tr('Toque para ver a descrição', 'Tap to read the description'))
                  : tr(`${slot.options.length} opções, com a descrição de cada uma`, `${slot.options.length} options, each with its description`)}
              trailing={slot.fixed ? <ContentBadge kind="trait">{tr('concedida', 'granted')}</ContentBadge> : chosen ? chevron : <PendCount n={1} />} />
          </Box>
        );
      })}

      {available.length > 0 && (
        <Folio label={tr('Arquétipo de classe · opcional', 'Class archetype · optional')} name={archetype?.name ?? tr('Nenhum', 'None')} disabled={!canEdit}
          onClick={() => setPicker('archetype')}
          meta={tr('A dedicação ocupa o talento de classe do nível 2.', 'Its dedication uses the 2nd-level class feat slot.')}
          trailing={canEdit && archetype ? <Button size="small" onClick={(e) => { e.stopPropagation(); setChoice(update, CLASS_ARCHETYPE, null); }}>{tr('Remover', 'Remove')}</Button> : chevron} />
      )}

      {freeArchetype && (
        <Folio label={tr(`Arquétipo livre · nível ${freeArchetype.level}`, `Free archetype · level ${freeArchetype.level}`)}
          name={freeName ?? tr('Escolher dedicação', 'Choose a dedication')} todo={!freeChoice && canEdit}
          onClick={canEdit ? () => onChooseDedication(freeArchetype) : undefined} trailing={canEdit ? chevron : undefined}
          meta={tr('Escolha a dedicação para a primeira vaga de Arquétipo Livre. Os próximos talentos ficam na aba Talentos.',
            'Choose a dedication for the first Free Archetype slot. Further feats are in the Feats tab.')} />
      )}

      {cls && c && (
        <Box sx={[cardSx, { px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }]}>
          <Label>{tr('O que a classe dá', 'What the class grants')}</Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 13, alignItems: 'center' }}>
            {c.perception !== undefined && <Box component="span" sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}>{tr('Percepção', 'Perception')} <ProfPill rank={c.perception} short /></Box>}
            {SAVE_KEYS.map((k) => c.saves?.[k] !== undefined && (
              <Box key={k} component="span" sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}>{SAVES[k]} <ProfPill rank={c.saves[k] as Rank} short /></Box>
            ))}
          </Box>
          <Box sx={{ fontSize: 13 }}>{classFacts(cls)}</Box>
        </Box>
      )}

      <ContentPicker open={picker === 'archetype'} title={tr('Arquétipo de classe', 'Class archetype')} entries={available}
        value={archetypeId} onPick={(id) => setChoice(update, CLASS_ARCHETYPE, { id })}
        onClose={() => setPicker(null)} mesaRules={mesaRules} />
      <ContentPicker open={picker === 'class'} title={tr('Classe', 'Class')} entries={core.classes} value={state.class.id}
        onPick={canEdit ? (id) => setClass({ id, keyAttribute: undefined }) : undefined} onClose={() => setPicker(null)} mesaRules={mesaRules} facts={classFacts}
        secondary={(e) => (e.class ? `${e.class.hp ?? '—'} ${tr('PV', 'HP')} · ${(e.class.keyAttribute ?? []).map(attributeLabel).join('/')}` : undefined)} />
      {subclasses.filter((sl) => sl.key === picker).map((sl) => (
        <ContentPicker key={sl.key} open title={sl.label} entries={sl.options} value={sl.chosen}
          onPick={canEdit && !sl.fixed ? (id) => setChoice(update, sl.key, { id }) : undefined} onClose={() => setPicker(null)} mesaRules={mesaRules} />
      ))}
    </Stack>
  );
}
