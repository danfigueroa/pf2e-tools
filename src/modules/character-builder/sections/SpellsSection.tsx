import { useMemo, useState, type ReactNode } from 'react';
import { Box, ButtonBase, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Close as CloseIcon, MenuBookOutlined as BookIcon } from '@mui/icons-material';
import { displayFont, gold, ink, parchment, rule, status, TRADITION_COLORS } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { SpellDetailDialog } from '../components/SpellDetailDialog';
import { spellKind, spellName } from '../components/spellText';
import type { SpellCast } from '../components/descriptionRequest';
import { attributeLabel } from '../engine/attributes';
import { rankName } from '../engine/compile';
import { heightenGain, type Caster } from '../engine/spells';
import type { RuleEntry } from '../rules/types';
import type { CasterChoices } from '../types';
import { ActionGlyph, BandHead, Label, PendCount, Pill, SectionHead, SlotCard } from '../components/ui';
import { cardSx, signed, tint } from '../components/uiTokens';
import { setChoice, type SectionProps } from './types';

const TRADITION_LABEL: Record<string, string> = {
  arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Oculta', 'Occult'), primal: tr('Primal', 'Primal'),
};

type Field = 'repertoire' | 'prepared' | 'spellbook' | 'focus0' | 'focus1' | 'rituals' | 'browse' | 'focusChoice';
type SlotField = 'repertoire' | 'prepared';
/** `choice`: a chave `focus-choice:<aon_id>` quando a escolha é de uma concessão com opções. */
type Picking = { caster: string; field: Field; rank: number; choice?: string } | null;
type Viewing = { id: string; cast?: SpellCast; onRemove?: () => void; removeLabel?: string } | null;

export interface SpellsProps extends SectionProps {
  /** Todas as magias carregadas (listas da tradição, de foco e rituais). */
  spells: RuleEntry[];
}

const isCantrip = (s: RuleEntry) => !!(s.spell?.cantrip || (s.traits ?? []).includes('Cantrip'));
const rankOf = (s: RuleEntry) => (isCantrip(s) ? 0 : s.spell?.rank ?? s.level ?? 0);
const isRitual = (s: RuleEntry) => !!s.spell?.ritual || s.type === 'ritual';

/** Player Core p. 297–298: espaços por rank, com truques preparados ou conhecidos contados à parte. */
const slotLimit = (caster: Caster, field: SlotField, rank: number) =>
  (field === 'repertoire' ? caster.known?.perRank?.[rank] : undefined) ?? caster.perDay[rank] ?? 0;

const ACTION_LEGEND = [
  { action: '1', label: tr('1 ação', '1 action') },
  { action: '2', label: tr('2 ações', '2 actions') },
  { action: '3', label: tr('3 ações', '3 actions') },
  { action: 'reaction', label: tr('Reação', 'Reaction') },
  { action: 'free', label: tr('Ação livre', 'Free action') },
  { action: undefined, label: tr('Tempo de conjuração na descrição', 'Casting time in the description') },
];

/** Magia escolhida: tocar no nome abre a descrição; o × à parte tira. */
function SpellChip({ name, onOpen, onRemove, up, from }: { name: string; onOpen: () => void; onRemove?: () => void; up?: { rank: number; gains: boolean; next?: number }; from?: string }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'stretch', minHeight: { xs: 40, sm: 32 }, borderRadius: 999, border: `1px solid ${rule}`,
      bgcolor: parchment.paper, overflow: 'hidden', maxWidth: 1,
    }}>
      <ButtonBase onClick={onOpen} title={tr('Ler a descrição', 'Read the description')} data-view=""
        sx={{ pl: 1.375, pr: onRemove ? 0.75 : 1.375, fontSize: 14, font: 'inherit', color: ink.primary, gap: 0.5, minWidth: 0, '&:hover': { bgcolor: parchment.sunken } }}>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
        {from && <Box component="span" sx={{ fontSize: 12, color: ink.secondary, whiteSpace: 'nowrap' }}>· {from}</Box>}
        {up !== undefined && (
          <Box component="span" title={up.gains ? tr(`Elevada ao rank ${up.rank}`, `Heightened to rank ${up.rank}`)
            : tr(`Rank ${up.rank} sem ganho da elevação${up.next ? `; o próximo é no rank ${up.next}` : ''}`, `Rank ${up.rank} with no heightening benefit${up.next ? `; the next is at rank ${up.next}` : ''}`)}
            sx={{ fontSize: 11, fontWeight: 800, borderRadius: '4px', px: 0.5, lineHeight: 1.5, flex: 'none',
              ...(up.gains ? { color: gold.deep, bgcolor: tint.gold, border: `1px solid ${gold.main}` } : { color: status.warning, border: `1px dashed ${status.warning}` }) }}>
            ↑{up.rank}{up.gains ? '' : ' ⚠'}
          </Box>
        )}
      </ButtonBase>
      {onRemove && (
        <ButtonBase onClick={onRemove} aria-label={tr(`Tirar ${name}`, `Remove ${name}`)} title={tr('Tirar', 'Remove')}
          sx={{ px: 0.875, borderLeft: `1px solid ${rule}`, color: ink.secondary, minWidth: { xs: 40, sm: 32 }, '&:hover': { color: status.error, bgcolor: parchment.sunken } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </ButtonBase>
      )}
    </Box>
  );
}

/** Cabeçalho de uma fileira: título, linha de apoio e o contador "2/3". */
function RowHead({ title, note, count, full, over }: { title: ReactNode; note?: ReactNode; count?: string; full?: boolean; over?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
      <Box component="b" sx={{ font: `700 15px ${displayFont}` }}>{title}</Box>
      {note && <Box component="span" sx={{ fontSize: 13, color: ink.secondary, flex: 1 }}>{note}</Box>}
      {count && <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: over ? status.warning : full ? status.success : gold.deep, ml: 'auto' }}>
        {count}{over ? tr(' · acima do limite', ' · over limit') : full ? ' ✓' : ''}</Box>}
    </Box>
  );
}

/**
 * Aba Magias (UX §1.2): por conjurador, a tradição, o atributo, CD e ataque com a conta; depois as magias CONHECIDAS
 * (lista inteira, grimório/familiar/dirge ou repertório, pela regra da classe) e, nos preparados, as PREPARADAS nos
 * espaços do dia. Embaixo, foco e rituais. Tocar numa magia escolhida abre a descrição; tirar é o × à parte.
 */
export function SpellsSection({ state, update, compiled, canEdit, index, mesaRules, spells: entries }: SpellsProps) {
  const [picking, setPicking] = useState<Picking>(null);
  const [viewing, setViewing] = useState<Viewing>(null);
  const spells = useMemo(() => [...new Map(entries.map((entry) => [entry.id, entry])).values()], [entries]);
  const entryOf = (id: string) => index.get(id) ?? spells.find((s) => s.id === id);
  const name = (id: string) => { const entry = entryOf(id); return entry ? spellName(entry) : id; };
  /** Truques e magias de foco sobem sozinhos à metade do nível, para cima (texto "Spellcasting" de cada classe). */
  const autoRank = compiled.focus.heightened;
  /** Rank em que a magia é lançada: o do espaço, ou o automático em truque e foco. Sem espaço (livro, lista), nada. */
  const castFor = (e: RuleEntry | undefined, slotRank?: number): SpellCast | undefined => {
    if (!e) return undefined;
    if (isCantrip(e) || e.spell?.focus) return { rank: autoRank, auto: true };
    return slotRank ? { rank: slotRank } : undefined;
  };
  /** O "↑4" do chip: só quando o espaço está acima do rank base. */
  const upOf = (id: string, slotRank?: number) => {
    const e = entryOf(id);
    const c = castFor(e, slotRank);
    if (!c || !e || c.auto || c.rank <= rankOf(e)) return undefined;
    const gain = heightenGain(e, c.rank);
    return { rank: c.rank, gains: gain ? gain.gains : true, next: gain?.next };
  };

  const lists = (key: string): CasterChoices => state.spellcasting[key] ?? {};
  const changeList = (key: string, field: SlotField | 'spellbook', rank: number, change: (ids: string[]) => string[]) =>
    update((s) => {
      const current = { ...(s.spellcasting[key] ?? {}) };
      const previous = (field === 'spellbook' ? current.spellbook : current[field]?.[String(rank)]) ?? [];
      const next = change(previous);
      if (previous === next) return s;
      if (field === 'spellbook') current.spellbook = next;
      else current[field] = { ...(current[field] ?? {}), [String(rank)]: next };
      return { ...s, spellcasting: { ...s.spellcasting, [key]: current } };
    });
  /** Grimório e rituais: escolher de novo tira (o seletor fica aberto para marcar vários). */
  const toggleBook = (key: string, id: string) => changeList(key, 'spellbook', 0,
    (prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const add = (p: NonNullable<Picking>, id: string) => {
    if (p.field === 'browse') return;
    if (p.field === 'focusChoice') {
      if (p.choice) setChoice(update, p.choice, { id });
      return;
    }
    if (p.field === 'rituals') return toggleBook('rituals', id);
    if (p.field === 'spellbook') return toggleBook(p.caster, id);
    if (p.field === 'focus0' || p.field === 'focus1') {
      const rank = p.field === 'focus0' ? 0 : 1;
      changeList('focus', 'repertoire', rank, (prev) => prev.includes(id) ? prev : [...prev, id]);
      return;
    }
    const caster = compiled.casters.find((c) => c.key === p.caster);
    if (!caster) return;
    const limit = slotLimit(caster, p.field, p.rank);
    const unique = p.field === 'repertoire' || p.rank === 0;
    changeList(p.caster, p.field, p.rank, (prev) => prev.length >= limit || (unique && prev.includes(id)) ? prev : [...prev, id]);
  };
  const removeAt = (caster: string, field: SlotField | 'spellbook', rank: number, i: number) =>
    changeList(caster, field, rank, (prev) => prev.filter((_, j) => j !== i));

  const topRank = (caster: Caster) => caster.perDay.reduce((m, n, r) => (n > 0 ? r : m), 0);
  const ofTradition = (caster: Caster) => spells.filter((s) => s.type === 'spell' && !s.spell?.focus && !isRitual(s)
    && (!caster.tradition || (s.spell?.traditions ?? []).some((t) => t.toLowerCase() === caster.tradition)));
  /** Preparado de livro (grimório, familiar, dirge): prepara do que está no livro, se o livro já tem algo. */
  const bookEntries = (caster: Caster) => (lists(caster.key).spellbook ?? []).map(entryOf).filter((e): e is RuleEntry => !!e);
  const fromBook = (caster: Caster) => caster.spellbook || (caster.known?.kind === 'book' && bookEntries(caster).length > 0);

  /** Candidatos: da tradição, até o rank (truque só no 0); preparado de livro escolhe do livro. */
  const candidates = (p: NonNullable<Picking>): RuleEntry[] => {
    if (p.field === 'rituals') return spells.filter(isRitual);
    if (p.field === 'focusChoice') {
      const options = compiled.focus.choices.find((c) => c.key === p.choice)?.options ?? [];
      return options.map(entryOf).filter((e): e is RuleEntry => !!e);
    }
    if (p.field === 'focus0' || p.field === 'focus1') {
      const wantCantrip = p.field === 'focus0';
      return spells.filter((s) => (s.spell?.focus || (s.traits ?? []).includes('Focus')) && isCantrip(s) === wantCantrip);
    }
    const caster = compiled.casters.find((c) => c.key === p.caster);
    if (!caster) return [];
    const fits = (s: RuleEntry) => (p.rank === 0) === isCantrip(s) && rankOf(s) <= Math.max(p.rank, 1);
    const chosen = lists(caster.key)[p.field === 'repertoire' ? 'repertoire' : 'prepared']?.[String(p.rank)] ?? [];
    const available = (s: RuleEntry) => fits(s) && (!(p.field === 'repertoire' || p.rank === 0) || !chosen.includes(s.id));
    if (p.field === 'prepared' && fromBook(caster)) return bookEntries(caster).filter(available);
    if (p.field === 'spellbook' || p.field === 'browse') return ofTradition(caster).filter((s) => rankOf(s) <= topRank(caster));
    return ofTradition(caster).filter(available);
  };

  const view = (id: string, onRemove?: () => void, removeLabel?: string, slotRank?: number) =>
    setViewing({ id, cast: castFor(entryOf(id), slotRank), onRemove: canEdit ? onRemove : undefined, removeLabel });
  /** As magias escolhidas e um botão para preencher uma vaga livre. */
  const spellChips = (ids: string[], onRemove: (i: number) => void, onAdd: () => void, empty = 1, slotRank?: number) => (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {ids.map((id, i) => (
        <SpellChip key={`${id}-${i}`} name={name(id)} up={upOf(id, slotRank)} onOpen={() => view(id, () => onRemove(i), undefined, slotRank)} onRemove={canEdit ? () => onRemove(i) : undefined} />
      ))}
      {canEdit && empty > 0 && <Pill look="add" onClick={onAdd}>{tr('+ Escolher', '+ Choose')}</Pill>}
    </Box>
  );

  const knownBlock = (caster: Caster) => {
    const known = caster.known;
    const c = lists(caster.key);
    const head = (title: string, right?: ReactNode) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Label>{tr('Magias conhecidas', 'Known spells')}</Label>
          <Box component="b" sx={{ font: `700 17px ${displayFont}` }}>{title}</Box>
        </Box>
        {right}
      </Box>
    );
    const foot = (note?: string, source?: string) => (note || source) && (
      <Box sx={{ fontSize: 12, color: ink.secondary }}>{[note, source].filter(Boolean).join(' · ')}</Box>
    );
    const wrap = (children: ReactNode) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.5, borderRadius: '8px', border: `1px solid ${rule}`, bgcolor: parchment.page }}>{children}</Box>
    );

    if (known?.kind === 'list') {
      const tradition = caster.tradition ? TRADITION_LABEL[caster.tradition] : null;
      return wrap(<>
        {head(tradition ? tr(`Todas da lista ${tradition}`, `The whole ${tradition} list`) : tr('Todas da lista da tradição', 'The whole tradition list'),
          caster.tradition && <Pill onClick={() => setPicking({ caster: caster.key, field: 'browse', rank: 0 })}><BookIcon sx={{ fontSize: 16 }} />{tr('Ver a lista', 'See the list')}</Pill>)}
        <Box sx={{ fontSize: 14 }}>
          {tr(`Você conhece toda magia comum da lista, até o rank ${topRank(caster)}, e escolhe a cada manhã quais preparar. Incomuns e raras só com acesso (Aprender Magia, com o GM).`,
            `You know every common spell on the list, up to rank ${topRank(caster)}, and choose each morning which to prepare. Uncommon and rare spells need access (Learn a Spell, with the GM).`)}
        </Box>
        {foot(undefined, known.source)}
      </>);
    }

    if (known?.kind === 'book' || (!known && caster.spellbook)) {
      const book = c.spellbook ?? [];
      const entries = book.map((id) => ({ id, e: entryOf(id) }));
      const cantrips = entries.filter((x) => x.e && isCantrip(x.e)).length;
      const leveled = book.length - cantrips;
      const ranks = [...new Set(entries.map((x) => (x.e ? rankOf(x.e) : 1)))].sort((a, b) => a - b);
      const bookName = known?.name ?? tr('Grimório', 'Spellbook');
      const count = (have: number, want?: number) => (want !== undefined ? `${have}/${want}` : `${have}`);
      return wrap(<>
        {head(bookName, (
          <Box sx={{ display: 'flex', gap: 1.5, fontSize: 13 }}>
            <span><Box component="b" sx={{ color: known && cantrips >= (known.cantrips ?? 0) ? status.success : gold.deep }}>{count(cantrips, known?.cantrips)}</Box> {tr('truques', 'cantrips')}</span>
            <span><Box component="b" sx={{ color: known && leveled >= (known.spells ?? 0) ? status.success : gold.deep }}>{count(leveled, known?.spells)}</Box> {tr('magias', 'spells')}</span>
          </Box>
        ))}
        {ranks.map((r) => (
          <Box key={r} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: ink.secondary }}>{r === 0 ? tr('Truques', 'Cantrips') : tr(`Rank ${r}`, `Rank ${r}`)}</Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {entries.map((x, i) => ({ ...x, i })).filter((x) => (x.e ? rankOf(x.e) : 1) === r).map((x) => (
                <SpellChip key={`${x.id}-${x.i}`} name={name(x.id)} onOpen={() => view(x.id, () => removeAt(caster.key, 'spellbook', 0, x.i), tr(`Tirar do ${bookName.toLowerCase()}`, `Remove from ${bookName.toLowerCase()}`))}
                  onRemove={canEdit ? () => removeAt(caster.key, 'spellbook', 0, x.i) : undefined} />
              ))}
            </Box>
          </Box>
        ))}
        {book.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nada anotado ainda. As preparadas saem daqui.', 'Nothing recorded yet. Prepared spells come from here.')}</Box>}
        {canEdit && <Box><Pill look="add" onClick={() => setPicking({ caster: caster.key, field: 'spellbook', rank: 0 })}>{tr(`+ Anotar no ${bookName.toLowerCase()}`, `+ Add to ${bookName.toLowerCase()}`)}</Pill></Box>}
        {foot(known?.note, known?.source ? tr(`Regra: ${known.source}`, `Rule: ${known.source}`) : undefined)}
      </>);
    }

    if (caster.type === 'spontaneous') {
      const rows = caster.perDay.map((n, r) => ({ n, r, want: slotLimit(caster, 'repertoire', r) }))
        .filter(({ n, r, want }) => n > 0 || want > 0 || c.repertoire?.[String(r)]?.length);
      return wrap(<>
        {head(known?.name ?? tr('Repertório', 'Repertoire'))}
        <Box sx={{ fontSize: 14 }}>{tr('Escolha as magias que você conhece em cada rank. Para trocar uma escolha, use × e preencha a vaga que abriu.',
          'Choose the spells you know at each rank. To replace a choice, use × and fill the space it leaves.')}</Box>
        {rows.map(({ n, r, want }) => {
          const chosen = c.repertoire?.[String(r)] ?? [];
          const left = want - chosen.length;
          return (
            <Box key={r} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <RowHead title={r === 0 ? tr('Truques', 'Cantrips') : tr(`Rank ${r}`, `Rank ${r}`)}
                note={r > 0 ? tr(`${n} espaço${n === 1 ? '' : 's'} por dia`, `${n} slot${n === 1 ? '' : 's'} per day`) : tr(`à vontade · elevados ao rank ${autoRank}`, `at will · heightened to rank ${autoRank}`)}
                count={`${chosen.length}/${want}`} full={left === 0} over={left < 0} />
              {spellChips(chosen, (i) => removeAt(caster.key, 'repertoire', r, i), () => setPicking({ caster: caster.key, field: 'repertoire', rank: r }), left, r || undefined)}
            </Box>
          );
        })}
        {foot(known?.note, known?.source ? tr(`Regra: ${known.source}`, `Rule: ${known.source}`) : undefined)}
      </>);
    }
    return null;
  };

  const preparedBlock = (caster: Caster) => {
    const c = lists(caster.key);
    const ranks = caster.perDay.map((n, r) => ({ n, r })).filter(({ n, r }) => n > 0 || c.prepared?.[String(r)]?.length);
    const book = caster.known?.kind === 'book' || caster.spellbook;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Label>{tr('Preparadas hoje', 'Prepared today')}</Label>
          <Box sx={{ fontSize: 13, color: ink.secondary }}>
            {book && !fromBook(caster)
              ? tr(`Anote magias no ${(caster.known?.name ?? tr('Grimório', 'Spellbook')).toLowerCase()} para preparar só delas; por ora, a lista toda.`, `Add spells to your ${(caster.known?.name ?? 'spellbook').toLowerCase()} to prepare only from it; for now, the whole list.`)
              : book ? tr(`Escolha uma magia por vaga do ${(caster.known?.name ?? tr('Grimório', 'Spellbook')).toLowerCase()}.`, `Choose one spell from your ${(caster.known?.name ?? 'spellbook').toLowerCase()} per slot.`)
                : tr('Escolha uma magia da lista por vaga.', 'Choose one spell from the list per slot.')}
            {' '}{tr('Escolha truques diferentes. Magias de rank 1 ou maior podem ocupar mais de uma vaga.', 'Choose distinct cantrips. Spells of rank 1 or higher can fill more than one slot.')}
            {' '}{tr('Magia de rank menor num espaço maior sobe para o rank do espaço (↑).', 'A lower-rank spell in a higher slot is heightened to the slot\'s rank (↑).')}
            {' '}{tr('Use × para liberar uma vaga.', 'Use × to free up a slot.')}
          </Box>
        </Box>
        {ranks.map(({ n, r }) => {
          const chosen = c.prepared?.[String(r)] ?? [];
          const left = n - chosen.length;
          return (
            <Box key={r} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <RowHead title={r === 0 ? tr('Truques', 'Cantrips') : tr(`Rank ${r}`, `Rank ${r}`)}
                note={r > 0 ? tr(`${n} por dia`, `${n} per day`) : tr(`${n} preparados · elevados ao rank ${autoRank}`, `${n} prepared · heightened to rank ${autoRank}`)} count={`${chosen.length}/${n}`} full={left === 0} over={left < 0} />
              {spellChips(chosen, (i) => removeAt(caster.key, 'prepared', r, i), () => setPicking({ caster: caster.key, field: 'prepared', rank: r }), left, r || undefined)}
            </Box>
          );
        })}
      </Box>
    );
  };

  const casterCard = (caster: Caster) => {
    const needsTradition = compiled.pending.some((p) => p.key === 'spell-tradition') || (index.get(state.class.id)?.class?.casting?.traditions.length ?? 0) > 1;
    const color = caster.tradition ? TRADITION_COLORS[caster.tradition] : ink.secondary;
    return (
      <Box key={caster.key} sx={[cardSx, { overflow: 'hidden' }]}>
        <BandHead right={caster.tradition ? TRADITION_LABEL[caster.tradition] : tr('tradição a escolher', 'tradition to choose')}>{caster.name}</BandHead>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center', py: 1.25, px: 0.5, borderBottom: `1px solid ${rule}` }}>
          <Box title={`10 + ${rankName(caster.rank)} + ${attributeLabel(caster.attribute)}`}>
            <Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{caster.dc}</Box><Label>{tr('CD', 'DC')}</Label>
          </Box>
          <Box><Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{signed(caster.attack)}</Box><Label>{tr('Ataque', 'Attack')}</Label></Box>
          <Box><Box sx={{ fontSize: 15, fontWeight: 700, pt: 0.5 }}>{caster.type === 'prepared' ? tr('Preparado', 'Prepared') : tr('Espontâneo', 'Spontaneous')}</Box><Label>{tr('Lista', 'List')}</Label></Box>
          <Box><Box sx={{ fontSize: 15, fontWeight: 700, pt: 0.5, color }}>{attributeLabel(caster.attribute)}</Box><Label>{tr('Atributo', 'Attribute')}</Label></Box>
        </Box>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          {needsTradition && (
            <TextField select size="small" label={tr('Tradição (pela subclasse)', 'Tradition (from the subclass)')} sx={{ minWidth: 220, alignSelf: 'flex-start' }}
              value={caster.tradition ?? ''} disabled={!canEdit}
              onChange={(e) => setChoice(update, 'spell-tradition', e.target.value ? { value: e.target.value } : null)}>
              <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
              {(index.get(state.class.id)?.class?.casting?.traditions ?? []).map((t) => <MenuItem key={t} value={t}>{TRADITION_LABEL[t] ?? t}</MenuItem>)}
            </TextField>
          )}
          {caster.source && <Box sx={{ fontSize: 12, color: ink.secondary }}>{tr(`Tabela: ${caster.source} · ${rankName(caster.rank)}`, `Table: ${caster.source} · ${rankName(caster.rank)}`)}</Box>}
          {knownBlock(caster)}
          {caster.type === 'prepared' && preparedBlock(caster)}
        </Box>
      </Box>
    );
  };

  const focus = compiled.focus;
  const focusChoices = lists('focus').repertoire ?? {};
  const learned = lists('rituals').spellbook ?? [];
  const pickingCaster = picking && compiled.casters.find((c) => c.key === picking.caster);
  const bookOf = (p: NonNullable<Picking>) => new Set((p.field === 'rituals' ? learned : lists(p.caster).spellbook) ?? []);
  const pickerTitle = (p: NonNullable<Picking>) => {
    if (p.field === 'rituals') return tr('Rituais', 'Rituals');
    if (p.field === 'browse') return pickingCaster?.known?.name ?? tr('Lista', 'List');
    if (p.field === 'spellbook') return pickingCaster?.known?.name ?? tr('Grimório', 'Spellbook');
    if (p.field === 'focusChoice') return tr(`Magia de foco — ${compiled.focus.choices.find((c) => c.key === p.choice)?.from ?? ''}`, `Focus spell — ${compiled.focus.choices.find((c) => c.key === p.choice)?.from ?? ''}`);
    if (p.field.startsWith('focus')) return tr('Magias de foco', 'Focus spells');
    if (p.field === 'repertoire') return p.rank === 0 ? tr('Repertório — truques', 'Repertoire — cantrips') : tr(`Repertório — rank ${p.rank}`, `Repertoire — rank ${p.rank}`);
    return p.rank === 0 ? tr('Preparar — truques', 'Prepare — cantrips') : tr(`Preparar — rank ${p.rank}`, `Prepare — rank ${p.rank}`);
  };
  const toggling = picking && (picking.field === 'rituals' || picking.field === 'spellbook');
  const selectedRank = picking && (picking.field === 'prepared' || picking.field === 'repertoire') ? picking.rank : 0;
  const rankGroups = selectedRank > 1 ? Array.from({ length: selectedRank }, (_, i) => {
    const rank = selectedRank - i;
    return { key: rank, label: rank === selectedRank ? tr(`Rank ${rank}`, `Rank ${rank}`) : tr(`Rank ${rank} ↑`, `Rank ${rank} ↑`),
      matches: (e: RuleEntry) => rankOf(e) === rank };
  }) : undefined;
  return (
    <Stack spacing={1.5}>
      <Box sx={[cardSx, { px: 1.5, py: 1.25 }]}>
        <Label>{tr('Símbolos de conjuração', 'Cast symbols')}</Label>
        <Box component="ul" sx={{ m: 0, mt: 0.5, p: 0, listStyle: 'none', display: 'flex', gap: '4px 16px', flexWrap: 'wrap', fontSize: 13 }}>
          {ACTION_LEGEND.map(({ action, label }) => (
            <Box component="li" key={label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Box component="span" aria-hidden><ActionGlyph actions={action} /></Box>{label}
            </Box>
          ))}
        </Box>
      </Box>
      {compiled.casters.length === 0 && (
        <Typography color="text.secondary">{tr('Esta classe não conjura magias por espaço. Magias de foco ficam abaixo.', 'This class has no spell slots. Focus spells are below.')}</Typography>
      )}
      {compiled.casters.map(casterCard)}

      <Box sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Label>{tr('Magias de foco', 'Focus spells')}</Label>
            <Box component="b">{tr(`Lançadas no rank ${focus.heightened}`, `Cast at rank ${focus.heightened}`)}</Box>
          </Box>
          <Box component="span" role="img" aria-label={tr(`${focus.points} ponto(s) de foco`, `${focus.points} focus point(s)`)} sx={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Box key={i} component="span" sx={{ width: 14, height: 14, borderRadius: '4px', border: `1px solid ${i < focus.points ? TRADITION_COLORS.divine : rule}`, bgcolor: i < focus.points ? TRADITION_COLORS.divine : 'transparent' }} />
            ))}
          </Box>
          <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{focus.points}</Box>
        </Box>
        <Box sx={{ fontSize: 12, color: ink.secondary }}>
          {tr('Um ponto por magia de foco, até 3 (Player Core pg. 298).', 'One point per focus spell, up to 3 (Player Core pg. 298).')}
        </Box>
        {focus.choices.filter((c) => !c.chosen).map((c) => (
          <SlotCard key={c.key} look="todo" kicker={tr(`Nível ${c.level || 1} · ${c.from}`, `Level ${c.level || 1} · ${c.from}`)}
            name={tr(`Escolher entre ${c.options.length} magias de foco`, `Choose one of ${c.options.length} focus spells`)} trailing={<PendCount n={1} />}
            onClick={() => setPicking({ caster: 'focus', field: 'focusChoice', rank: 0, choice: c.key })} />
        ))}
        {([['focus0', tr('Truques de foco (não contam no pool)', 'Focus cantrips (not counted in the pool)')], ['focus1', tr('Magias de foco', 'Focus spells')]] as const).map(([f, label]) => {
          const wantCantrip = f === 'focus0';
          // Concedidas pela classe, subclasse e talentos (texto da AON): sem ×; a escolha de uma concessão tira pela escolha.
          const granted = focus.granted.filter((g) => { const e = entryOf(g.id); return e ? isCantrip(e) === wantCantrip : !wantCantrip; });
          const own = focusChoices[wantCantrip ? '0' : '1'] ?? [];
          return (
            <Box key={f} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Box>
              {granted.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {granted.map((g) => {
                    const choice = focus.choices.find((c) => c.chosen === g.id);
                    const clear = choice ? () => setChoice(update, choice.key, null) : undefined;
                    return (
                      <SpellChip key={g.id} name={name(g.id)} from={g.from} onOpen={() => view(g.id, clear, tr('Trocar a escolha', 'Change the choice'))}
                        onRemove={canEdit && clear ? clear : undefined} />
                    );
                  })}
                </Box>
              )}
              {spellChips(own, (i) => removeAt('focus', 'repertoire', wantCantrip ? 0 : 1, i), () => setPicking({ caster: 'focus', field: f, rank: 0 }), granted.length ? 0 : 1)}
            </Box>
          );
        })}
        <Box sx={{ fontSize: 12, color: ink.secondary }}>
          {tr('As da classe, da subclasse e dos talentos entram sozinhas (texto da AON). Use "+ Escolher" para o que vier de outro lugar.',
            'Spells from your class, subclass and feats are added automatically (AON text). Use "+ Choose" for anything from elsewhere.')}
        </Box>
      </Box>

      <Box sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead note={tr(`${learned.length} aprendido${learned.length === 1 ? '' : 's'}`, `${learned.length} learned`)}>{tr('Rituais', 'Rituals')}</SectionHead>
        <Box sx={{ fontSize: 14, color: ink.secondary }}>
          {tr('Os rituais aprendidos vão para a Ficha. Abra a lista para ler cada um e marcar o que o personagem aprendeu.', 'Learned rituals go to the sheet. Open the list to read each one and mark what the character learned.')}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {learned.map((id, i) => (
            <SpellChip key={`${id}-${i}`} name={name(id)} onOpen={() => view(id, () => removeAt('rituals', 'spellbook', 0, i), tr('Esquecer', 'Forget'))}
              onRemove={canEdit ? () => removeAt('rituals', 'spellbook', 0, i) : undefined} />
          ))}
          <Pill look={canEdit ? 'add' : 'default'} onClick={() => setPicking({ caster: 'rituals', field: 'rituals', rank: 0 })}>
            <BookIcon sx={{ fontSize: 16 }} />{canEdit ? tr('Ver rituais e marcar', 'Browse and mark rituals') : tr('Ver rituais', 'Browse rituals')}
          </Pill>
        </Box>
      </Box>

      {picking && (
        <ContentPicker open title={pickerTitle(picking)} entries={candidates(picking)} entryName={spellName} groups={rankGroups} spellColumns mesaRules={mesaRules} onClose={() => setPicking(null)}
          subtitle={picking.field === 'spellbook' ? tr('Escolher marca; escolher de novo tira. O seletor fica aberto.', 'Choosing adds; choosing again removes. The picker stays open.')
            : picking.field === 'rituals' ? tr('Marque os rituais que o personagem aprendeu.', 'Mark the rituals the character learned.')
              : rankGroups ? tr(`↑ eleva a magia ao rank ${selectedRank} desta vaga.`, `↑ heightens the spell to this slot’s rank ${selectedRank}.`) : undefined}
          onPick={canEdit && picking.field !== 'browse' ? (id) => add(picking, id) : undefined}
          keepOpen={!!toggling}
          picked={toggling ? (e) => (bookOf(picking).has(e.id) ? (picking.field === 'rituals' ? tr('aprendido', 'learned') : tr('anotada', 'recorded')) : undefined) : undefined}
          pickLabel={toggling ? (e) => (bookOf(picking).has(e.id)
            ? (picking.field === 'rituals' ? tr('Esquecer', 'Forget') : tr('Tirar', 'Remove'))
            : (picking.field === 'rituals' ? tr('Aprendi', 'Learned it') : tr('Anotar', 'Add'))) : undefined}
          initialFilters={(picking.field === 'focus0' || picking.field === 'focus1') && index.get(state.class.id)?.name
            && spells.some((e) => e.spell?.focus && (e.traits ?? []).includes(index.get(state.class.id)!.name)) ? { traits: [index.get(state.class.id)!.name] } : undefined}
          cast={picking.field === 'rituals' ? undefined : (e) => castFor(e, picking.field === 'prepared' || picking.field === 'repertoire' ? picking.rank || undefined : undefined)}
          secondary={(e) => {
            const slot = picking.field === 'prepared' || picking.field === 'repertoire' ? picking.rank : 0;
            const gain = slot > 0 && !isCantrip(e) && rankOf(e) < slot ? heightenGain(e, slot) : null;
            const up = slot > 0 && !isCantrip(e) && rankOf(e) < slot
              ? gain && !gain.gains
                ? tr(`↑ rank ${slot} sem ganho${gain.next ? ` (próximo no ${gain.next})` : ''}`, `↑ rank ${slot}, no benefit${gain.next ? ` (next at ${gain.next})` : ''}`)
                : tr(`↑ sobe ao rank ${slot}`, `↑ heightened to rank ${slot}`)
              : null;
            return [spellKind(e), up, (e.spell?.traditions ?? []).map((t) => TRADITION_LABEL[t.toLowerCase()] ?? t).join('/')].filter(Boolean).join(' · ');
          }} />
      )}
      {viewing && (
        <SpellDetailDialog entry={entryOf(viewing.id) ?? null} cast={viewing.cast} onClose={() => setViewing(null)} onRemove={viewing.onRemove} removeLabel={viewing.removeLabel} />
      )}
    </Stack>
  );
}
