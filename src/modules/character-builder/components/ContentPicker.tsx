import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, ButtonBase, Dialog, Drawer, IconButton, InputBase, Menu, MenuItem, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon, ExpandMore as MoreIcon, HelpOutlineRounded as UnknownIcon, InfoOutlined as InfoIcon, Search as SearchIcon,
  CheckCircleOutline as OkIcon, CloseRounded as FailIcon,
} from '@mui/icons-material';
import { chrome, displayFont, gold, green, greenInk, ink, parchment, rule, status } from '../../../theme';
import { locale, tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { MesaRules } from '../types';
import type { PrereqPart, PrereqResult } from '../engine/prereqs';
import { allowedAtTable } from '../mesaRules';
import { useTraitLabels } from '../../character-viewer/components/useTraitLabels';
import { pickerEditions } from '../remaster';
import { BuildExceptions } from '../hooks/buildExceptions';
import { ActionGlyph, ContentBadge, LevelBox, Notice, PrereqMark, SectionHead } from './ui';
import { rarityBadge, tint, warmShadow } from './uiTokens';

const PAGE = 150;

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

type RarityFilter = 'all' | 'common' | 'uncommon' | 'rare';

const RARITY_LABEL: Record<string, string> = {
  common: tr('Comum', 'Common'), uncommon: tr('Incomum', 'Uncommon'), rare: tr('Raro', 'Rare'), unique: tr('Único', 'Unique'),
};

type Eligibility = { result: PrereqResult; parts: PrereqPart[] };

export interface ContentPickerProps {
  open: boolean;
  title: string;
  /** Linha de baixo do cabeçalho ("Nível 8 · Loki"). */
  subtitle?: string;
  entries: RuleEntry[];
  value?: string;
  /** Sem `onPick`, só navega (9.7): sem botão de escolher. */
  onPick?: (id: string) => void;
  onClose: () => void;
  mesaRules: MesaRules | null;
  /** Fatos mecânicos no detalhe (PV, boosts, proficiências…). */
  facts?: (entry: RuleEntry) => React.ReactNode;
  /** Linha secundária da lista (traços, nível…); sem ela, os traços. */
  secondary?: (entry: RuleEntry) => string | undefined;
  /** Pré-requisitos avaliados (talentos): ordena os elegíveis primeiro e escreve o motivo na linha. */
  prereq?: (entry: RuleEntry) => Eligibility;
  /** Selo curto na linha ("já no nível 4"). */
  note?: (entry: RuleEntry) => string | undefined;
  /** Teto de nível do slot: vira o filtro "Até nível N". */
  levelCap?: number;
}

/** O pedido de descrição de uma entrada do catálogo (o mesmo pipeline da Ficha). */
const descriptionRequest = (e: RuleEntry) => e.type === 'spell' ? { type: 'spell' as const, name: e.name }
  : e.type === 'feat' ? { type: 'feat' as const, name: e.name, level: e.level }
    : ['equipment', 'weapon', 'armor', 'shield'].includes(e.type) ? { type: 'item' as const, name: e.name }
      : { type: 'special' as const, name: e.name };

const traitsOf = (e: RuleEntry) => (e.traits ?? []).filter((t) => !['common', 'uncommon', 'rare', 'unique'].includes(t.toLowerCase()));

/** "Requer: Perito em Atletismo" — o motivo de inelegibilidade, escrito na própria linha. */
function whyText(el: Eligibility): { text: string; unknown: boolean } | null {
  if (el.result === 'ok') return null;
  const fails = el.parts.filter((p) => p.result === 'fail');
  if (el.result === 'fail') {
    if (fails.length === 1) return { text: tr(`Requer: ${fails[0].text}`, `Requires: ${fails[0].text}`), unknown: false };
    return { text: tr(`${fails.length} requisitos não cumpridos`, `${fails.length} prerequisites not met`), unknown: false };
  }
  const unknown = el.parts.filter((p) => p.result === 'unknown').length;
  return { text: unknown > 1 ? tr(`${unknown} requisitos o GM confere`, `${unknown} prerequisites for the GM to check`) : tr('1 requisito o GM confere', '1 prerequisite for the GM to check'), unknown: true };
}

/**
 * Seletor do Criador (redesign): cabeçalho verde, busca e filtros, a lista com ações, nome, selos, o motivo de
 * inelegibilidade e o nível na cor da raridade, e o detalhe com os pré-requisitos ✓ ✗ ?. Inelegível continua tocável
 * ("Escolher mesmo assim" vira aviso). Celular: lista em tela cheia e o detalhe numa folha que sobe. Desktop: as duas
 * colunas. ↑/↓ andam, Enter escolhe, Esc fecha. A descrição completa (pt/en) vem do pipeline de descrições, sob demanda.
 */
export function ContentPicker({ open, title, subtitle, entries, value, onPick, onClose, mesaRules, facts, secondary, prereq, note, levelCap }: ContentPickerProps) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [rarityMenu, setRarityMenu] = useState<HTMLElement | null>(null);
  const [onlyAllowed, setOnlyAllowed] = useState(true);
  const [capOn, setCapOn] = useState(true);
  const [focusId, setFocusId] = useState<string | undefined>(value);
  const [detailOpen, setDetailOpen] = useState(false);
  // Listas longas (1.700 consumíveis) desenham em páginas: o celular não monta milhares de linhas de uma vez.
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setFocusId(value);
    setDetailOpen(false);
    setLimit(PAGE);
  }, [open, value]);

  const exceptions = useContext(BuildExceptions);
  const editions = useMemo(() => open ? pickerEditions(entries, mesaRules, exceptions) : [], [open, entries, mesaRules, exceptions]);
  const eligibility = useMemo(() => {
    const map = new Map<string, Eligibility>();
    if (prereq && open) for (const e of editions) map.set(e.id, prereq(e));
    return map;
  }, [prereq, editions, open]);
  const blocked = (e: RuleEntry) => !exceptions.has(e.id) && allowedAtTable(e, mesaRules) === false;
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rank = (e: RuleEntry) => ({ ok: 0, unknown: 1, fail: 2 }[eligibility.get(e.id)?.result ?? 'ok']);
    return editions
      .filter((e) => !term || e.name.toLowerCase().includes(term) || [...(e.legacyNames ?? []), ...(e.previousNames ?? [])].some((n) => n.toLowerCase().includes(term)))
      .filter((e) => rarity === 'all' || e.rarity === rarity || (rarity === 'rare' && e.rarity === 'unique') || (rarity === 'common' && !e.rarity))
      .filter((e) => !onlyAllowed || exceptions.has(e.id) || allowedAtTable(e, mesaRules) !== false)
      .filter((e) => !capOn || levelCap === undefined || (e.level ?? 0) <= levelCap)
      .sort((a, b) => (prereq ? rank(a) - rank(b) : 0) || a.name.localeCompare(b.name, locale));
  }, [editions, exceptions, q, rarity, onlyAllowed, mesaRules, eligibility, prereq, capOn, levelCap]);
  const traitText = useTraitLabels(useMemo(() => [...new Set([...shown.slice(0, limit), ...(focusId ? editions.filter((e) => e.id === focusId) : [])]
    .flatMap((e) => traitsOf(e).slice(0, 8)))], [shown, limit, focusId, editions]));
  const eligibleCount = prereq ? shown.filter((e) => eligibility.get(e.id)?.result === 'ok').length : null;

  const focused = shown.find((e) => e.id === focusId) ?? (wide ? shown[0] : undefined);

  const move = (delta: number) => {
    const i = Math.max(0, shown.findIndex((e) => e.id === focused?.id));
    const next = shown[Math.min(shown.length - 1, Math.max(0, i + delta))];
    if (next) {
      setFocusId(next.id);
      listRef.current?.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  };
  const choose = (entry: RuleEntry) => {
    if (!onPick) return;
    onPick(entry.id);
    onClose();
  };

  const countLabel = tr(`${shown.length.toLocaleString(locale)} ${shown.length === 1 ? 'item' : 'itens'}`, `${shown.length.toLocaleString(locale)} ${shown.length === 1 ? 'item' : 'items'}`)
    + (eligibleCount !== null ? tr(` · ${eligibleCount.toLocaleString(locale)} elegíveis`, ` · ${eligibleCount.toLocaleString(locale)} eligible`) : '');

  const chip = (on: boolean, label: React.ReactNode, onClick: (e: React.MouseEvent<HTMLElement>) => void, pressed?: boolean) => (
    <ButtonBase onClick={onClick} aria-pressed={pressed} data-view="" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, minHeight: { xs: 36, md: 40 }, px: 1.375, borderRadius: 999, fontSize: 14, whiteSpace: 'nowrap', flex: 'none',
      border: `1px solid ${on ? greenInk.main : rule}`, bgcolor: on ? greenInk.main : parchment.paper, color: on ? parchment.paper : ink.primary, fontWeight: on ? 600 : 400,
    }}>{label}</ButtonBase>
  );

  const head = (
    <Box sx={{ bgcolor: green.main, color: chrome.text, borderBottom: `2px solid ${gold.main}`, display: 'flex', alignItems: 'center', gap: 0.5, pl: { xs: 0.5, md: 2.75 }, pr: 1, py: { xs: 0.5, md: 1.5 }, flex: 'none' }}>
      <IconButton aria-label={tr('Fechar seletor', 'Close picker')} onClick={onClose} sx={{ color: chrome.text, display: { md: 'none' } }}><CloseIcon /></IconButton>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box component="h2" sx={{ m: 0, font: `600 17px ${displayFont}`, fontSize: { md: 20 }, overflowWrap: 'anywhere' }}>{title}</Box>
        {subtitle && <Box sx={{ fontSize: { xs: 12, md: 13 }, color: chrome.textSoft }}>{subtitle}</Box>}
      </Box>
      <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose} sx={{ color: chrome.text, display: { xs: 'none', md: 'inline-flex' } }}><CloseIcon /></IconButton>
    </Box>
  );

  const filters = (
    <Box sx={{ px: { xs: 2, md: 2.75 }, py: { xs: 1.5, md: 1.75 }, bgcolor: parchment.paper, borderBottom: `1px solid ${rule}`, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.25, alignItems: { md: 'center' }, flex: 'none', flexWrap: 'wrap' }}>
      <Box component="label" sx={{
        display: 'flex', alignItems: 'center', gap: 1, height: 46, px: '11px', border: `1px solid ${rule}`, borderRadius: '6px', bgcolor: parchment.paper,
        color: ink.secondary, flex: { md: 1 }, minWidth: { md: 280 }, cursor: 'text', transition: 'border-color 120ms, box-shadow 120ms',
        '&:hover': { borderColor: ink.secondary },
        // Focado: borda verde de 2px e halo, para a pessoa ver que já pode digitar.
        '&:focus-within': { borderColor: greenInk.mid, boxShadow: `0 0 0 1px ${greenInk.mid}, 0 0 0 4px ${tint.green}`, color: greenInk.mid },
      }}>
        <SearchIcon aria-hidden />
        <InputBase autoFocus fullWidth value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={tr(`Buscar entre ${editions.length.toLocaleString(locale)}`, `Search ${editions.length.toLocaleString(locale)}`)}
          inputProps={{ 'aria-label': tr('Buscar', 'Search') }} sx={{ color: ink.primary }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            if (e.key === 'Enter' && focused) { e.preventDefault(); choose(focused); }
          }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 }, pb: { xs: 0.25, md: 0 } }}>
        {levelCap !== undefined && chip(capOn, tr(`Até nível ${levelCap}`, `Up to level ${levelCap}`), () => setCapOn(!capOn), capOn)}
        {mesaRules && chip(onlyAllowed, tr('Só o liberado', 'Only allowed'), () => setOnlyAllowed(!onlyAllowed), onlyAllowed)}
        {chip(rarity !== 'all', <>{rarity === 'all' ? tr('Raridade', 'Rarity') : RARITY_LABEL[rarity]}<MoreIcon sx={{ fontSize: 16 }} /></>, (e) => setRarityMenu(e.currentTarget))}
      </Box>
      <Menu anchorEl={rarityMenu} open={!!rarityMenu} onClose={() => setRarityMenu(null)}>
        {(['all', 'common', 'uncommon', 'rare'] as const).map((r) => (
          <MenuItem key={r} selected={rarity === r} onClick={() => { setRarity(r); setRarityMenu(null); }}>{r === 'all' ? tr('Todas', 'All') : RARITY_LABEL[r]}</MenuItem>
        ))}
      </Menu>
    </Box>
  );

  const row = (e: RuleEntry) => {
    const el = eligibility.get(e.id);
    const why = el ? whyText(el) : null;
    const isOut = blocked(e);
    const sel = wide ? e.id === focused?.id : e.id === value;
    const badges = [
      e.homebrew ? <ContentBadge key="m" kind="mesa" /> : null,
      !e.remaster && !e.homebrew ? <ContentBadge key="l" kind="legacy" /> : null,
      rarityBadge(e.rarity) ? <ContentBadge key="r" kind={rarityBadge(e.rarity)!} /> : null,
      isOut ? <ContentBadge key="o" kind="out" /> : null,
      note?.(e) ? <ContentBadge key="n" kind="trait">{note(e)}</ContentBadge> : null,
      e.id === value ? <ContentBadge key="v" kind="trait">{tr('escolhido', 'chosen')}</ContentBadge> : null,
    ].filter(Boolean);
    const meta = secondary ? secondary(e) : traitsOf(e).slice(0, 4).map(traitText).join(' · ');
    return (
      <ButtonBase key={e.id} data-id={e.id} role="option" aria-selected={e.id === value}
        onClick={() => { setFocusId(e.id); if (!wide) setDetailOpen(true); }} onDoubleClick={() => choose(e)}
        sx={{
          display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) auto', gap: 1.25, alignItems: 'start', py: 1.25, px: 1.75, width: 1, textAlign: 'left',
          borderBottom: `1px solid ${rule}`, justifyContent: 'stretch', color: 'inherit',
          ...(sel && { bgcolor: tint.green, outline: `2px solid ${greenInk.mid}`, outlineOffset: '-2px' }),
          ...(note?.(e) && { opacity: 0.72 }),
        }}>
        <Box component="span" sx={{ pt: '3px' }}><ActionGlyph actions={e.actions} /></Box>
        <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
          <Box component="span" sx={{ fontWeight: 600, fontSize: 15, color: el && el.result !== 'ok' ? ink.secondary : ink.primary, overflowWrap: 'anywhere' }}>{e.name}</Box>
          {meta && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{meta}</Box>}
          {badges.length > 0 && <Box component="span" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{badges}</Box>}
          {why && (
            <Box component="span" sx={{ fontSize: 13, color: why.unknown ? ink.secondary : status.error, display: 'flex', gap: 0.625, alignItems: 'center', fontWeight: 600 }}>
              {why.unknown ? <UnknownIcon sx={{ fontSize: 14 }} /> : <FailIcon sx={{ fontSize: 14 }} />}{why.text}
            </Box>
          )}
        </Box>
        <LevelBox level={e.level ?? (e.spell?.rank ?? '—')} rarity={e.rarity} title={e.rarity ? RARITY_LABEL[e.rarity] : undefined} />
      </ButtonBase>
    );
  };

  const list = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: { xs: 2, md: 1.75 }, py: 1, fontSize: 13, color: ink.secondary, borderBottom: `1px solid ${rule}`, flex: 'none' }}>
        <span>{countLabel}</span>
        {prereq && <span>{tr('Elegíveis primeiro', 'Eligible first')}</span>}
      </Box>
      <Box ref={listRef} role="listbox" aria-label={title} sx={{ overflowY: 'auto', flex: 1, minHeight: 0, bgcolor: parchment.paper }}>
        {shown.slice(0, limit).map(row)}
        {shown.length > limit && (
          <Box sx={{ p: 1.5, textAlign: 'center' }}>
            <Box sx={{ fontSize: 14, color: ink.secondary, mb: 1 }}>
              {tr(`Mostrando ${limit} de ${shown.length}. Refine a busca ou`, `Showing ${limit} of ${shown.length}. Refine the search or`)}
            </Box>
            <Button size="small" data-view="" onClick={() => setLimit((n) => n + PAGE)}>{tr('Mostrar mais', 'Show more')}</Button>
          </Box>
        )}
        {shown.length === 0 && <Box sx={{ p: 2, fontSize: 14, color: ink.secondary }}>{tr('Nada encontrado.', 'Nothing found.')}</Box>}
      </Box>
    </Box>
  );

  const detail = (e: RuleEntry) => {
    const el = eligibility.get(e.id);
    const isOut = blocked(e);
    const met = el ? el.parts.filter((p) => p.result === 'ok').length : 0;
    const risky = (el && el.result !== 'ok') || isOut;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box component="h3" sx={{ m: 0, flex: 1, font: `700 24px/1.1 ${displayFont}`, fontSize: { md: 30 }, overflowWrap: 'anywhere' }}>{e.name}</Box>
              {e.actions && <ActionGlyph actions={e.actions} size={16} />}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <LevelBox level={e.level ?? e.spell?.rank ?? '—'} rarity={e.rarity} />
              <Box component="span" sx={{ fontWeight: 600, fontSize: 14 }}>{RARITY_LABEL[e.rarity ?? 'common'] ?? e.rarity}</Box>
              {e.homebrew && <ContentBadge kind="mesa" />}
              {!e.remaster && !e.homebrew && <ContentBadge kind="legacy" />}
              {isOut && <ContentBadge kind="out" />}
            </Box>
            {traitsOf(e).length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {traitsOf(e).slice(0, 8).map((t) => <ContentBadge key={t} kind="trait">{traitText(t)}</ContentBadge>)}
              </Box>
            )}
          </Box>
          {!e.homebrew && e.source.page ? <Box component="span" sx={{ fontSize: 13, color: ink.secondary, pt: 1.25, whiteSpace: 'nowrap' }}>{tr(`pg. ${e.source.page}`, `p. ${e.source.page}`)}</Box> : null}
        </Box>
        {el?.result === 'ok' && el.parts.length > 0 && (
          <Notice tone="ok" icon={<OkIcon />}><b>{tr('Elegível — todos os pré-requisitos cumpridos.', 'Eligible — all prerequisites met.')}</b></Notice>
        )}
        {facts && <Box sx={{ fontSize: 14 }}>{facts(e)}</Box>}
        {el && el.parts.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SectionHead note={tr(`${met} de ${el.parts.length} cumprido${el.parts.length > 1 ? 's' : ''}`, `${met} of ${el.parts.length} met`)}>{tr('Pré-requisitos', 'Prerequisites')}</SectionHead>
            {el.parts.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.35 }}>
                <PrereqMark result={p.result} />
                <Box component="span">
                  <b>{p.text}</b>
                  {p.result === 'fail' && p.reason && <><br /><Box component="span" sx={{ color: ink.secondary }}>{p.reason}</Box></>}
                  {p.result === 'unknown' && <><br /><Box component="span" sx={{ color: ink.secondary }}>{tr('o app não sabe conferir; combine com o GM', 'the app can\'t check this; ask the GM')}</Box></>}
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {!el && e.prerequisites?.text && (
          <Box sx={{ fontSize: 14 }}><Box component="span" sx={{ color: ink.secondary }}>{tr('Pré-requisitos', 'Prerequisites')}: </Box>{e.prerequisites.text}</Box>
        )}
        {e.homebrew ? (e.summary && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <SectionHead note={tr('Conteúdo da mesa', 'Table content')}>{tr('Descrição', 'Description')}</SectionHead>
            <Box component="p" sx={{ m: 0, fontSize: { xs: 15, md: 16 }, maxWidth: 680, whiteSpace: 'pre-line' }}>{e.summary}</Box>
          </Box>
        )) : (
          // A descrição completa (pt/en) já no detalhe: nada de abrir outra tela para ler o talento ou a magia.
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SectionHead>{tr('Descrição', 'Description')}</SectionHead>
            <Box sx={{ maxWidth: 720 }}>
              <Suspense fallback={<Box sx={{ fontSize: 14, color: ink.secondary }}>{e.summary ?? tr('Carregando…', 'Loading…')}</Box>}>
                <DescriptionContent key={e.id} embedded request={descriptionRequest(e)} onClose={() => {}} />
              </Suspense>
            </Box>
          </Box>
        )}
        {risky && onPick && (
          <Box sx={{ fontSize: 13, color: ink.secondary, display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <InfoIcon sx={{ fontSize: 16 }} />{tr('Escolher assim vira aviso; o GM pode liberar.', 'Choosing this becomes a warning; the GM can allow it.')}
          </Box>
        )}
      </Box>
    );
  };

  const chooseLabel = (e: RuleEntry) => {
    const el = eligibility.get(e.id);
    if (e.id === value) return tr('Manter', 'Keep');
    if ((el && el.result !== 'ok') || blocked(e)) return tr('Escolher mesmo assim', 'Choose anyway');
    return wide ? tr(`Escolher ${e.name}`, `Choose ${e.name}`) : tr('Escolher', 'Choose');
  };

  const kbd = (k: string) => (
    <Box component="kbd" sx={{ display: 'inline-flex', minWidth: 24, height: 24, px: 0.75, border: `1px solid ${rule}`, borderBottomWidth: 2, borderRadius: '4px', fontSize: 12, fontWeight: 700, alignItems: 'center', justifyContent: 'center', bgcolor: parchment.paper, color: ink.primary, fontFamily: 'inherit' }}>{k}</Box>
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={!wide} fullWidth maxWidth="lg"
      slotProps={{ paper: { sx: { height: { md: '88vh' }, bgcolor: parchment.paper, borderRadius: { md: '10px' }, overflow: 'hidden', display: 'flex', flexDirection: 'column' } } }}>
      {head}
      {filters}
      {wide ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) minmax(0, 1fr)' }}>
          <Box sx={{ borderRight: `1px solid ${rule}`, display: 'flex', minHeight: 0 }}>{list}</Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3.5, py: 2.75 }}>{focused ? detail(focused) : null}</Box>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', borderTop: `1px solid ${rule}`, px: 3.5, py: 1.75, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', fontSize: 13, color: ink.secondary, flex: 1 }}>
                {kbd('↑')}{kbd('↓')} {tr('navegar', 'move')} {onPick && <>{kbd('Enter')} {tr('escolher', 'choose')}</>} {kbd('Esc')} {tr('fechar', 'close')}
              </Box>
              <Button variant="outlined" onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
              {onPick && focused && <Button variant="contained" onClick={() => choose(focused)}>{chooseLabel(focused)}</Button>}
            </Box>
          </Box>
        </Box>
      ) : list}

      {!wide && (
        <Drawer anchor="bottom" open={detailOpen && !!focused} onClose={() => setDetailOpen(false)}
          slotProps={{ paper: { sx: { maxHeight: '86vh', bgcolor: parchment.paper, borderRadius: '16px 16px 0 0', borderTop: `2px solid ${gold.main}`, boxShadow: warmShadow } } }}>
          {focused && (
            <Box role="dialog" aria-label={focused.name} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: rule, mx: 'auto', mt: 1, mb: 0.5, flex: 'none' }} />
              <Box sx={{ overflowY: 'auto', px: 2.25, pt: 0.75, pb: 1.5 }}>{detail(focused)}</Box>
              <Box sx={{ px: 2.25, pt: 1.5, pb: 'calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${rule}`, display: 'flex', gap: 1, flex: 'none' }}>
                <Button variant="outlined" sx={{ flex: 1 }} onClick={() => setDetailOpen(false)}>{tr('Voltar', 'Back')}</Button>
                {onPick && <Button variant="contained" sx={{ flex: 1.8 }} onClick={() => choose(focused)}>{chooseLabel(focused)}</Button>}
              </Box>
            </Box>
          )}
        </Drawer>
      )}

    </Dialog>
  );
}
