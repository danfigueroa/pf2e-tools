import { useContext, useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import {
  ArrowUpwardRounded as UpIcon, CheckRounded as DoneIcon, ChevronRight as OpenIcon, WarningAmberRounded as WarnIcon,
} from '@mui/icons-material';
import { displayFont, gold, greenInk, ink, status } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { evaluatePrereqs } from '../engine/prereqs';
import { featKindLabel, fitsSlot, type FeatSlot } from '../engine/slots';
import type { ChildSlot } from '../engine/feats';
import type { Compiled } from '../engine/types';
import type { RuleEntry } from '../rules/types';
import { ruleListSlug } from '../rules';
import { pickerEditions } from '../remaster';
import { BuildExceptions } from '../hooks/buildExceptions';
import { ChildRow, ContentBadge, LevelDisc, PendCount, RibbonCell, SlotCard, type RibbonLook } from '../components/ui';
import { cardSx, goldButtonSx, tint } from '../components/uiTokens';
import type { DiffRow } from '../components/levelDiff';
import { setChoice, type SectionProps } from './types';

const SAVES = [
  { value: 'fortitude', label: tr('Fortitude', 'Fortitude') },
  { value: 'reflex', label: tr('Reflexos', 'Reflex') },
  { value: 'will', label: tr('Vontade', 'Will') },
];

/** Rótulo de opção de ChoiceSet: o Foundry manda chave de tradução ("PF2E.SavesWill"); o valor é mais legível. */
function optionLabel(o: { value: string; label: string }): string {
  if (o.label === 'PF2E.TraitArcane') return tr('Arcana', 'Arcane');
  if (o.label === 'PF2E.TraitDivine') return tr('Divina', 'Divine');
  if (!o.label.startsWith('PF2E.')) return o.label;
  const fromPath = /\.(fortitude|reflex|will|perception|[a-z]+)\.rank$/.exec(o.value)?.[1];
  const raw = fromPath ?? o.value.split('.').pop() ?? o.value;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type Picking =
  | { kind: 'feat'; slot: FeatSlot }
  | { kind: 'child'; child: ChildSlot }
  | { kind: 'classChoice'; key: string }
  | null;

export interface ProgressionProps extends SectionProps {
  feats: RuleEntry[];
  archetypes: RuleEntry[];
  /** Arquétipo que o seletor está navegando (carrega a lista dele). */
  browseArchetype: string | null;
  setBrowseArchetype: (name: string | null) => void;
  /** Slot a abrir direto (vindo de "Trocar talento" na Ficha ou de uma pendência). */
  initialSlot?: string | null;
  /** Muda a cada pedido, para reabrir o mesmo slot. */
  focusNonce?: number;
  /** O personagem um nível acima (para o cartão "próximo nível"). */
  next?: { compiled: Compiled; diff: DiffRow[] } | null;
  onLevelUp?: () => void;
  /** Nome curto do personagem para o subtítulo do seletor. */
  who: string;
}

const levelId = (n: number) => `plano-nivel-${n}`; // i18n-ok: id de âncora

/**
 * Plano (redesign): a trilha 1–20 é a casa do personagem. Em cima, a trilha (pronto, atual, próximo, planejado, com o
 * ponto de pendência) e o "Subir de nível"; depois o cartão do próximo nível (o que ele pede e o que muda sozinho) e a linha
 * do tempo do nível atual para baixo, com os cartões de slot. Os níveis futuros ficam recolhidos até a pessoa pedir.
 */
export function ProgressionSection(props: ProgressionProps) {
  const { state, update, compiled, mesaRules, canEdit, index, feats, archetypes, browseArchetype, setBrowseArchetype, initialSlot, focusNonce, next, onLevelUp, who } = props;
  const initial = initialSlot ? compiled.featSlots.find((s) => s.key === initialSlot) : undefined;
  const [picking, setPicking] = useState<Picking>(initial && canEdit ? { kind: 'feat', slot: initial } : null);
  const [showFuture, setShowFuture] = useState(!!initial && initial.level > compiled.level + 1);

  const takenBySlot = useMemo(() => new Map(compiled.taken.map((t) => [t.slot, t])), [compiled.taken]);
  const takenById = useMemo(() => new Map(compiled.taken.map((t) => [t.entry.id, t])), [compiled.taken]);
  const pendingLevels = useMemo(() => new Set(compiled.pending.map((p) => p.level)), [compiled.pending]);
  const exceptions = useContext(BuildExceptions);
  const className = index.get(state.class.id)?.name;
  const level = compiled.level;

  // Uma pendência aberta de fora (painel) que cai num slot: abre o seletor dele e rola até o nível.
  useEffect(() => {
    if (!initialSlot) return;
    const slot = compiled.featSlots.find((s) => s.key === initialSlot);
    const target = slot?.level ?? compiled.featChildren.find((c) => c.key === initialSlot)?.level ?? compiled.classChoices.find((c) => c.key === initialSlot)?.level;
    if (target && target > level + 1) setShowFuture(true);
    if (slot && canEdit) setPicking({ kind: 'feat', slot });
    if (target) requestAnimationFrame(() => document.getElementById(levelId(target))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlot, focusNonce]);

  /** Candidatos de um slot: pelo tipo, até o teto de nível; o arquétipo navegado entra nos slots de classe e arquétipo. */
  const candidates = (kind: FeatSlot['kind'], cap: number, filter?: ChildSlot['filter']) => feats.filter((f) => {
    if ((f.level ?? 0) > cap) return false;
    if (filter) {
      const traits = (f.traits ?? []).map((t) => t.toLowerCase());
      if (filter.category === 'ancestry' && !fitsSlot(f, 'ancestry', { ancestryTraits: compiled.ancestryTraits })) return false;
      if (filter.category === 'class' && !fitsSlot(f, 'class', { className, ancestryTraits: [] })) return false;
      if (filter.category === 'general' && !traits.includes('general')) return false;
      if (filter.category === 'skill' && !traits.includes('skill')) return false;
      return filter.traits.every((t) => t.includes('{') || traits.includes(t));
    }
    return fitsSlot(f, kind, { className, ancestryTraits: compiled.ancestryTraits });
  });

  const prereq = (e: RuleEntry) => evaluatePrereqs(e.prerequisites?.text, compiled.prereq);
  const takenNote = (slotKey: string) => (e: RuleEntry) => {
    const t = takenById.get(e.id);
    return t && t.slot !== slotKey ? tr(`já no nível ${t.level}`, `already at level ${t.level}`) : undefined;
  };

  const pickFeat = (slotKey: string, id: string) => {
    const entry = feats.find((f) => f.id === id);
    const archetype = entry?.feat?.archetype?.[0];
    // O arquétipo vai no qualificador: é ele que diz qual lista baixar ao reabrir o personagem.
    setChoice(update, slotKey, { id, ...(archetype ? { qualifier: `archetype:${ruleListSlug(archetype)}` } : {}) });
  };

  const subtitle = (lvl: number) => tr(`Nível ${lvl} · ${who}`, `Level ${lvl} · ${who}`);
  const picker = (() => {
    if (!picking) return null;
    if (picking.kind === 'feat') {
      const { slot } = picking;
      const entries = candidates(slot.kind, slot.maxLevel ?? slot.level);
      const raw = state.choices[slot.key];
      return (
        <ContentPicker open title={`${slot.maxLevel ? `${slot.label} (≤ ${slot.maxLevel})` : featKindLabel(slot.kind)} — ${tr(`nível ${slot.level}`, `level ${slot.level}`)}`}
          subtitle={subtitle(slot.level)} entries={entries}
          value={raw && 'id' in raw ? raw.id : undefined} onPick={(id) => pickFeat(slot.key, id)} onClose={() => setPicking(null)}
          mesaRules={mesaRules} prereq={prereq} note={takenNote(slot.key)} />
      );
    }
    if (picking.kind === 'child') {
      const { child } = picking;
      const entries = candidates('general', child.filter?.maxLevel ?? child.level, child.filter);
      return (
        <ContentPicker open title={child.label} subtitle={subtitle(child.level)} entries={entries} value={child.chosen}
          onPick={(id) => setChoice(update, child.key, { id })} onClose={() => setPicking(null)} mesaRules={mesaRules}
          prereq={prereq} note={takenNote(child.key)} />
      );
    }
    const slot = compiled.classChoices.find((c) => c.key === picking.key);
    if (!slot) return null;
    return (
      <ContentPicker open title={slot.label} subtitle={subtitle(slot.level)} entries={slot.options} value={slot.chosen}
        onPick={(id) => setChoice(update, slot.key, { id })} onClose={() => setPicking(null)} mesaRules={mesaRules} />
    );
  })();

  const chevron = <OpenIcon fontSize="small" sx={{ color: ink.secondary }} />;

  const childRow = (child: ChildSlot) => {
    if (child.kind === 'feat') {
      const chosen = child.chosen ? index.get(child.chosen)?.name ?? child.chosen : undefined;
      return (
        <ChildRow key={child.key}>
          <SlotCard kicker={child.label} name={chosen ?? tr('Escolher', 'Choose')} look={chosen ? 'filled' : 'todo'}
            trailing={chosen ? chevron : <PendCount n={1} />} onClick={canEdit ? () => setPicking({ kind: 'child', child }) : undefined} />
        </ChildRow>
      );
    }
    return (
      <ChildRow key={child.key}>
        <TextField select size="small" fullWidth label={child.label} value={child.chosen ?? ''} disabled={!canEdit}
          error={!child.chosen} onChange={(e) => setChoice(update, child.key, e.target.value ? { value: e.target.value } : null)}>
          <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
          {(child.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{optionLabel(o)}</MenuItem>)}
        </TextField>
      </ChildRow>
    );
  };

  /** Os cartões de um nível (slots, escolhas de classe e as características automáticas). */
  const levelBody = (lvl: number) => {
    const planned = lvl > level;
    const features = compiled.classFeatures.filter((f) => f.level === lvl);
    const slots = compiled.featSlots.filter((s) => s.level === lvl);
    const classChoices = compiled.classChoices.filter((c) => c.level === lvl);
    const saveChoices = compiled.saveChoices.filter((c) => c.level === lvl);
    const groupChoices = compiled.groupChoices.filter((c) => c.level === lvl);
    const children = compiled.featChildren.filter((c) => c.level === lvl);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
          {classChoices.map((c) => {
            const name = c.chosen ? c.options.find((o) => o.id === c.chosen)?.name ?? index.get(c.chosen)?.name : undefined;
            return (
              <SlotCard key={c.key} kicker={c.label} name={name ?? (planned ? tr('Planejado', 'Planned') : tr('Escolher', 'Choose'))}
                look={c.fixed ? 'auto' : name ? 'filled' : planned ? 'plan' : 'todo'}
                trailing={c.fixed ? <ContentBadge kind="trait">{tr('concedida', 'granted')}</ContentBadge> : !name && !planned ? <PendCount n={1} /> : chevron}
                onClick={canEdit && !c.fixed ? () => setPicking({ kind: 'classChoice', key: c.key }) : undefined} />
            );
          })}
          {slots.map((slot) => {
            const taken = takenBySlot.get(slot.key);
            const raw = state.choices[slot.key];
            const name = taken?.entry.name ?? (raw && 'id' in raw ? index.get(raw.id)?.name ?? raw.id : undefined);
            const bad = taken && taken.prereq.result !== 'ok';
            const archetype = taken?.entry.feat?.archetype?.[0];
            const kicker = slot.maxLevel ? `${slot.label} (≤ ${slot.maxLevel})` : featKindLabel(slot.kind);
            const why = bad ? (
              <><WarnIcon sx={{ fontSize: 14, color: status.warning }} />
                {taken!.prereq.result === 'fail'
                  ? taken!.prereq.parts.filter((p) => p.result === 'fail').map((p) => p.reason ?? p.text).join('; ') || tr('pré-requisito não cumprido', 'prerequisite not met')
                  : tr('confira o pré-requisito', 'check the prerequisite')}</>
            ) : undefined;
            return (
              <SlotCard key={slot.key} kicker={kicker} why={why}
                name={name ?? (planned ? tr('Planejado', 'Planned') : tr('Escolher talento', 'Choose a feat'))}
                look={name ? (bad ? 'warn' : 'filled') : planned ? 'plan' : 'todo'}
                trailing={archetype ? <ContentBadge kind="trait">{archetype}</ContentBadge> : !name && !planned ? <PendCount n={1} /> : name ? chevron : undefined}
                onClick={canEdit ? () => setPicking({ kind: 'feat', slot }) : undefined} />
            );
          })}
          {features.map((f) => (
            <SlotCard key={`${f.name}-${f.id ?? ''}`} look="auto" kicker={tr('Automático', 'Automatic')} name={<Box component="span" sx={{ fontSize: 14 }}>{f.name}</Box>} />
          ))}
        </Box>
        {slots.map((slot) => {
          const required = index.get(slot.requiredFeat);
          const raw = state.choices[slot.key];
          return required && canEdit && !(raw && 'id' in raw && raw.id === required.id) ? (
            <Button key={`req-${slot.key}`} size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => pickFeat(slot.key, required.id)}>
              {tr(`Escolher ${required.name}`, `Choose ${required.name}`)}
            </Button>
          ) : null;
        })}
        {saveChoices.map((c) => (
          <TextField key={c.key} select size="small" label={c.label} value={c.chosen ?? ''} disabled={!canEdit} error={!c.chosen && !planned}
            onChange={(e) => setChoice(update, c.key, e.target.value ? { value: e.target.value } : null)}>
            <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
            {SAVES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </TextField>
        ))}
        {groupChoices.map((c) => (
          <TextField key={c.key} size="small" label={`${c.label}: ${tr('grupo de arma', 'weapon group')}`} defaultValue={c.chosen ?? ''}
            disabled={!canEdit} error={!c.chosen && !planned} helperText={tr('Em inglês, como na AON (ex.: hammer, sword, bow).', 'As on AON (e.g. hammer, sword, bow).')}
            onBlur={(e) => setChoice(update, c.key, e.target.value.trim() ? { value: e.target.value.trim().toLowerCase() } : null)} />
        ))}
        {children.map(childRow)}
      </Box>
    );
  };

  const hasContent = (lvl: number) => compiled.classFeatures.some((f) => f.level === lvl) || compiled.featSlots.some((s) => s.level === lvl)
    || compiled.classChoices.some((c) => c.level === lvl) || compiled.saveChoices.some((c) => c.level === lvl) || compiled.groupChoices.some((c) => c.level === lvl);

  const look = (n: number): RibbonLook => (n < level ? 'done' : n === level ? 'cur' : n === level + 1 ? 'next' : 'plan');
  const goTo = (n: number) => {
    if (n > level + 1) setShowFuture(true);
    requestAnimationFrame(() => document.getElementById(levelId(n))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  const levelRow = (lvl: number, last: boolean) => {
    const missing = compiled.pending.filter((p) => p.level === lvl).length;
    const lk = look(lvl);
    const note = lk === 'cur' ? [tr('atual', 'current'), missing ? tr(`${missing} pendente${missing > 1 ? 's' : ''}`, `${missing} to do`) : null].filter(Boolean).join(' · ')
      : lk === 'plan' || lk === 'next' ? tr('planejado', 'planned') : missing ? tr(`${missing} pendente${missing > 1 ? 's' : ''}`, `${missing} to do`) : '';
    return (
      <Box key={lvl} id={levelId(lvl)} component="section" aria-label={tr(`Nível ${lvl}`, `Level ${lvl}`)}
        sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', gap: 1.5, scrollMarginTop: { xs: 72, md: 16 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', '&::after': last ? undefined : { content: '""', flex: 1, width: '2px', bgcolor: 'divider', mt: 0.5 } }}>
          <LevelDisc n={lvl} look={lk === 'next' ? 'plan' : lk} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: last ? 0 : 2, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 }}>
            <Box component="h3" sx={{ m: 0, font: `600 17px ${displayFont}` }}>{tr(`Nível ${lvl}`, `Level ${lvl}`)}</Box>
            {note && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{note}</Box>}
            {lk === 'done' && !missing && <DoneIcon aria-label={tr('pronto', 'done')} sx={{ fontSize: 18, color: greenInk.mid }} />}
          </Box>
          {levelBody(lvl)}
        </Box>
      </Box>
    );
  };

  const past = Array.from({ length: level }, (_, i) => level - i).filter(hasContent);
  const future = Array.from({ length: Math.max(0, 20 - level - 1) }, (_, i) => level + 2 + i).filter(hasContent);
  const nextLevel = level < 20 ? level + 1 : null;
  const nextAsks = nextLevel ? compiled.featSlots.filter((s) => s.level === nextLevel) : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Box component="h2" sx={{ m: 0, flex: 1, font: `700 17px ${displayFont}` }}>{tr('Trilha 1–20', 'Track 1–20')}</Box>
          <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{tr('pronto · atual · próximo · planejado', 'done · current · next · planned')}</Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: '4px', '@media (min-width: 600px)': { gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' } }}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <RibbonCell key={n} n={n} look={look(n)} pending={n <= level && pendingLevels.has(n)} onClick={() => goTo(n)} />
          ))}
        </Box>
        {canEdit && nextLevel && onLevelUp && (
          <Button variant="contained" onClick={onLevelUp} startIcon={<UpIcon />} fullWidth
            sx={[goldButtonSx, { display: { md: 'none' } }]}>
            {tr(`Subir para o nível ${nextLevel}`, `Level up to ${nextLevel}`)}
          </Button>
        )}
      </Box>

      {compiled.featSlots.some((s) => s.kind === 'archetype' || s.kind === 'class') && canEdit && (
        <TextField select size="small" label={tr('Arquétipo para navegar (dedicações e talentos)', 'Archetype to browse (dedications and feats)')}
          value={browseArchetype ?? ''} onChange={(e) => setBrowseArchetype(e.target.value || null)} sx={{ maxWidth: 420 }}>
          <MenuItem value="">{tr('Nenhum', 'None')}</MenuItem>
          {pickerEditions(archetypes, mesaRules, exceptions).map((a) => <MenuItem key={a.id} value={a.name}>{a.name}</MenuItem>)}
        </TextField>
      )}

      {nextLevel && (
        <Box id={levelId(nextLevel)} sx={{ border: `1.5px dashed ${gold.main}`, bgcolor: tint.gold, borderRadius: '6px', p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5, scrollMarginTop: { xs: 72, md: 16 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <LevelDisc n={nextLevel} look="next" size={36} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box component="b" sx={{ font: `600 17px ${displayFont}` }}>{tr(`Nível ${nextLevel}`, `Level ${nextLevel}`)}</Box>{' '}
              <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr('próximo', 'next')}</Box>
            </Box>
            {canEdit && onLevelUp && (
              <Button size="small" variant="contained" onClick={onLevelUp} startIcon={<UpIcon />}
                sx={goldButtonSx}>
                {tr(`Subir para o nível ${nextLevel}`, `Level up to ${nextLevel}`)}
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary }}>{tr('Pede', 'Asks for')}</Box>
              {nextAsks.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nenhum talento novo.', 'No new feat.')}</Box>}
              {nextAsks.map((s) => (
                <SlotCard key={s.key} look="plan" sx={{ minHeight: 44 }} name={s.maxLevel ? `${s.label} (≤ ${s.maxLevel})` : featKindLabel(s.kind)}
                  onClick={canEdit ? () => setPicking({ kind: 'feat', slot: s }) : undefined} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary }}>{tr('Muda sozinho', 'Changes on its own')}</Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(next?.diff ?? []).filter((d) => d.label !== tr('Nível', 'Level')).map((d) => (
                  <Box key={d.label} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 30, px: 1.25, borderRadius: 999, border: 1, borderColor: 'divider', bgcolor: 'background.paper', fontSize: 13 }}>
                    {d.label}
                    {d.from && <Box component="span" sx={{ color: ink.secondary, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{d.from}</Box>}
                    <Box component="b" sx={{ color: greenInk.main, fontVariantNumeric: 'tabular-nums' }}>{d.from ? d.to : d.delta}</Box>
                  </Box>
                ))}
                {next?.compiled.classFeatures.filter((f) => f.level === nextLevel).map((f) => (
                  <ContentBadge key={f.name} kind="trait">{f.name}</ContentBadge>
                ))}
                {next && !next.diff.length && !next.compiled.classFeatures.some((f) => f.level === nextLevel) && (
                  <Box sx={{ fontSize: 14, color: ink.secondary }}>—</Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {past.map((lvl, i) => levelRow(lvl, i === past.length - 1 && !showFuture))}
      </Box>

      {future.length > 0 && (
        showFuture ? (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {future.map((lvl, i) => levelRow(lvl, i === future.length - 1))}
            <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setShowFuture(false)}>{tr('Recolher o plano', 'Collapse the plan')}</Button>
          </Box>
        ) : (
          <Button variant="outlined" onClick={() => setShowFuture(true)} sx={{ alignSelf: 'flex-start' }}>
            {tr(`Planejar os níveis ${level + 2} a 20`, `Plan levels ${level + 2} to 20`)}
          </Button>
        )
      )}
      {picker}
    </Box>
  );
}
