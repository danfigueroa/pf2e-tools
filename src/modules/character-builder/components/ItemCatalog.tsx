import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, Drawer, IconButton, InputBase, MenuItem, TextField, useMediaQuery, useTheme } from '@mui/material';
import { chrome, displayFont, gold, green, greenInk, ink, parchment, rule, status } from '../../../theme';
import { locale, tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { MesaRules } from '../types';
import type { ResolvedItem } from '../engine/equipment';
import { allowedAtTable } from '../mesaRules';
import { ActionGlyph, ContentBadge, Label, LevelBox, Pill } from './ui';
import { goldButtonSx, tint } from './uiTokens';
import { ItemGlyph, PlusButton, Segmented, Stepper, StrokeIcon } from './equipUi';
import { CATALOG_CATEGORIES, catalogSubtypes, formatBulk, formatGp, ICON_PATH, isMagicalItem, itemFacts, itemKind } from './equipmentModel';

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

const PAGE = 120;

export interface BagLine {
  id: string;
  qty: number;
  acquired: 'bought' | 'given';
  container?: string;
}

type Sort = 'level' | 'name' | 'price';
const SORT_LABEL: Record<Sort, string> = { level: tr('nível', 'level'), name: tr('nome', 'name'), price: tr('preço', 'price') };
const NEXT_SORT: Record<Sort, Sort> = { level: 'name', name: 'price', price: 'level' };

/**
 * Catálogo com sacola: categorias, filtros por tipo, busca, "até o nível", "permitido na mesa" e
 * ordem; o "+" põe na sacola e vira contador; a ficha do item tem quantidade, Comprar/Ganhei e onde guardar. A sacola
 * mostra o total e quanto sobra, e adiciona tudo de uma vez. Ficar sem dinheiro avisa, não trava.
 */
export function ItemCatalog({ open, entries, level, remaining, mesaRules, containers, loading, startTab = 'catalog', onAdd, onAddCustom, onClose }: {
  open: boolean;
  /** Abre direto em "Item caseiro". */
  startTab?: 'catalog' | 'custom';
  /** Itens do catálogo (já sem os grupos sem preço). */
  entries: RuleEntry[];
  level: number;
  /** Dinheiro livre agora, em po. */
  remaining: number;
  mesaRules: MesaRules | null;
  containers: ResolvedItem[];
  loading?: boolean;
  onAdd: (lines: BagLine[]) => void;
  onAddCustom: (name: string, qty: number, acquired: 'bought' | 'given') => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState<'catalog' | 'custom'>(startTab);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(CATALOG_CATEGORIES[0]);
  const [subtype, setSubtype] = useState('');
  const [magic, setMagic] = useState('');
  const [capLevel, setCapLevel] = useState(true);
  const [tableOnly, setTableOnly] = useState(true);
  const [sort, setSort] = useState<Sort>('level');
  const [limit, setLimit] = useState(PAGE);
  const resultList = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bag, setBag] = useState<BagLine[]>([]);
  const [draft, setDraft] = useState<{ qty: number; acquired: 'bought' | 'given'; container: string }>({ qty: 1, acquired: 'bought', container: '' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const customName = useRef<HTMLInputElement>(null);
  const [customQty, setCustomQty] = useState(1);
  const [customAcq, setCustomAcq] = useState<'bought' | 'given'>('given');

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const term = q.trim().toLowerCase();
  const matched = useMemo(() => entries.filter((e) => (
    (!capLevel || (e.level ?? 0) <= level) && (!tableOnly || allowedAtTable(e, mesaRules) !== false) &&
    (!term || e.name.toLowerCase().includes(term) || (e.previousNames ?? []).some((n) => n.toLowerCase().includes(term)))
  )), [entries, capLevel, level, tableOnly, mesaRules, term]);
  const counts = useMemo(() => new Map(CATALOG_CATEGORIES.map((c) => [c.key, matched.filter(c.test).length])), [matched]);
  const subtypes = useMemo(() => catalogSubtypes(category.key, entries.filter(category.test)), [category, entries]);
  const typeFilter = subtypes.find((c) => c.key === subtype);
  const showMagic = category.key === 'armor' || category.key === 'weapons';
  const results = useMemo(() => {
    const list = matched.filter((e) => category.test(e) && (!typeFilter || typeFilter.test(e)) &&
      (!magic || isMagicalItem(e) === (magic === 'magical')));
    const starts = (e: RuleEntry) => (term && e.name.toLowerCase().startsWith(term) ? 0 : 1);
    const cmp = sort === 'name' ? (a: RuleEntry, b: RuleEntry) => a.name.localeCompare(b.name)
      : sort === 'price' ? (a: RuleEntry, b: RuleEntry) => (a.item?.price?.gp ?? 0) - (b.item?.price?.gp ?? 0) || a.name.localeCompare(b.name)
        : (a: RuleEntry, b: RuleEntry) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name);
    return list.sort((a, b) => starts(a) - starts(b) || cmp(a, b));
  }, [matched, category, typeFilter, magic, sort, term]);

  const resetResults = () => {
    setLimit(PAGE);
    if (resultList.current) resultList.current.scrollTop = 0;
  };
  const changeCategory = (next: typeof category) => {
    if (next === category) return;
    setCategory(next);
    setSubtype('');
    setMagic('');
    resetResults();
  };

  const lineOf = (id: string) => bag.find((l) => l.id === id);
  const setLine = (id: string, patch: Partial<BagLine> | null) => setBag((prev) => {
    if (patch === null) return prev.filter((l) => l.id !== id);
    const cur = prev.find((l) => l.id === id);
    if (!cur) return [...prev, { id, qty: 1, acquired: 'bought', ...patch }];
    const next = { ...cur, ...patch };
    return next.qty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? next : l));
  });
  const cost = bag.reduce((s, l) => s + (l.acquired === 'bought' ? (byId.get(l.id)?.item?.price?.gp ?? 0) * l.qty : 0), 0);
  const after = Math.round((remaining - cost) * 100) / 100;
  const count = bag.reduce((s, l) => s + l.qty, 0);
  const sel = selected ? byId.get(selected) ?? null : null;

  const choose = (id: string) => {
    setSelected(id);
    const l = lineOf(id);
    setDraft({ qty: l?.qty ?? 1, acquired: l?.acquired ?? 'bought', container: l?.container ?? '' });
    if (phone) setSheetOpen(true);
  };
  const commitDraft = () => {
    if (!sel) return;
    setLine(sel.id, { qty: draft.qty, acquired: draft.acquired, container: draft.container || undefined });
    setSheetOpen(false);
  };
  const finish = () => {
    if (bag.length) onAdd(bag);
    setBag([]);
    onClose();
  };
  const close = () => { setBag([]); setSelected(null); onClose(); };
  const addCustom = () => {
    const name = customName.current?.value.trim();
    if (!name) return;
    onAddCustom(name, customQty, customAcq);
    if (customName.current) customName.current.value = '';
    setCustomQty(1);
  };

  const detail = sel && (
    <ItemDetail entry={sel} level={level} draft={draft} setDraft={setDraft} containers={containers} inBag={!!lineOf(sel.id)} onCommit={commitDraft} />
  );

  return (
    <Dialog open={open} onClose={close} fullScreen={phone} fullWidth maxWidth="lg"
      slotProps={{ paper: { sx: { bgcolor: parchment.paper, height: phone ? undefined : '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: `3px solid ${gold.main}` } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2.5 }, pt: 1.5, pb: 1.25, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Box component="h2" sx={{ m: 0, font: `700 20px ${displayFont}` }}>{tr('Adicionar à mochila', 'Add to the pack')}</Box>
          <Box sx={{ fontSize: 13, color: ink.secondary }}>{tr(`Nível ${level} · ${formatGp(remaining)} livres`, `Level ${level} · ${formatGp(remaining)} free`)}</Box>
        </Box>
        <Box sx={{ flex: '0 1 280px', minWidth: 200, order: { xs: 3, sm: 0 }, width: { xs: 1, sm: 'auto' } }}>
          <Segmented label={tr('Origem do item', 'Item source')} value={tab} onChange={setTab}
            options={[{ value: 'catalog', label: tr('Catálogo', 'Catalog') }, { value: 'custom', label: tr('Item caseiro', 'Homebrew item') }]} />
        </Box>
        <IconButton aria-label={tr('Fechar', 'Close')} onClick={close}><StrokeIcon d={ICON_PATH.close} /></IconButton>
      </Box>

      {tab === 'custom' ? (
        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}>
          <Box sx={{ fontSize: 14, color: ink.secondary }}>
            {tr('Para o que não está no catálogo (um presente da mesa, um item inventado). Entra no inventário e na Ficha, mas preço, volume e efeitos não entram nos números.',
              'For what is not in the catalog (a gift from the table, an invented item). It goes to the inventory and the Sheet, but price, bulk and effects are not in the numbers.')}
          </Box>
          <TextField inputRef={customName} label={tr('Nome do item', 'Item name')} slotProps={{ htmlInput: { maxLength: 80 } }}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Label sx={{ flex: 1 }}>{tr('Quantidade', 'Quantity')}</Label>
            <Stepper large label={tr('Quantidade', 'Quantity')} value={customQty} min={1} onChange={setCustomQty} />
          </Box>
          <Segmented label={tr('Como entra', 'How it comes')} value={customAcq} onChange={setCustomAcq}
            options={[{ value: 'given', label: tr('Ganhei', 'Given') }, { value: 'bought', label: tr('Comprei', 'Bought') }]} />
          <Button variant="contained" onClick={addCustom}>{tr('Adicionar item caseiro', 'Add homebrew item')}</Button>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: { xs: 1.5, sm: 2.5 }, pb: 1.25, borderBottom: `1px solid ${rule}`, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 1, height: 42, px: 1.25, border: `1px solid ${rule}`, borderRadius: '6px', bgcolor: parchment.paper, '&:focus-within': { borderColor: greenInk.mid, boxShadow: `0 0 0 2px ${tint.green}` } }}>
              <StrokeIcon d={ICON_PATH.search} size={16} sx={{ color: ink.secondary }} />
              <InputBase autoFocus={!phone} fullWidth value={q} onChange={(e) => { setQ(e.target.value); resetResults(); }} placeholder={tr('Buscar item (healing, longsword…)', 'Search items (healing, longsword…)')}
                inputProps={{ 'aria-label': tr('Buscar item', 'Search items') }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Pill look={capLevel ? 'sel' : 'default'} onClick={() => { setCapLevel((v) => !v); resetResults(); }}>{tr(`Até o nível ${level}`, `Up to level ${level}`)}</Pill>
              <Pill look={tableOnly ? 'sel' : 'default'} onClick={() => { setTableOnly((v) => !v); resetResults(); }}>{tr('Permitido na mesa', 'Allowed at the table')}</Pill>
              <Pill onClick={() => { setSort(NEXT_SORT[sort]); resetResults(); }}>{tr(`Ordem: ${SORT_LABEL[sort]}`, `Sort: ${SORT_LABEL[sort]}`)}</Pill>
            </Box>
          </Box>

          {phone && (
            <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', px: 1.5, py: 1, borderBottom: `1px solid ${rule}`, flex: 'none' }}>
              {CATALOG_CATEGORIES.filter((c) => c === category || c.key === 'all' || (counts.get(c.key) ?? 0) > 0).map((c) => (
                <Pill key={c.key} look={category === c ? 'sel' : 'default'} onClick={() => changeCategory(c)}>
                  {c.label}{c.key !== 'all' ? ` · ${counts.get(c.key) ?? 0}` : ''}</Pill>
              ))}
            </Box>
          )}

          <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '210px minmax(0, 1fr) 360px' } }}>
            {!phone && (
              <Box component="nav" aria-label={tr('Categorias', 'Categories')} sx={{ borderRight: `1px solid ${rule}`, p: 1, display: 'flex', flexDirection: 'column', gap: '2px', bgcolor: parchment.page, overflowY: 'auto' }}>
                {CATALOG_CATEGORIES.map((c) => {
                  const on = category === c;
                  const n = counts.get(c.key) ?? 0;
                  return (
                    <ButtonBase key={c.key} onClick={() => changeCategory(c)} aria-current={on ? 'true' : undefined} data-view="" sx={{
                      display: 'flex', alignItems: 'center', gap: 1, minHeight: 40, px: 1.25, borderRadius: '6px', justifyContent: 'flex-start',
                      bgcolor: on ? greenInk.main : 'transparent', color: on ? parchment.paper : n ? ink.primary : ink.disabled, fontWeight: on ? 700 : 500, fontSize: 14,
                    }}>
                      <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{c.label}</Box>
                      <Box component="span" sx={{ fontSize: 12, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            )}

            <Box ref={resultList} sx={{ minWidth: 0, overflowY: 'auto' }}>
              {(subtypes.length > 0 || showMagic) && (
                <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: parchment.paper, borderBottom: `1px solid ${rule}`, p: 1.5, pt: 2,
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 1 }}>
                  {subtypes.length > 0 && (
                    <TextField select size="small" label={category.key === 'weapons' ? tr('Grupo de armas', 'Weapon group') : tr('Tipo', 'Type')}
                      value={typeFilter?.key ?? ''} onChange={(e) => { setSubtype(e.target.value); resetResults(); }}
                      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                      <option value="">{tr('Qualquer tipo', 'Any type')}</option>
                      {subtypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                    </TextField>
                  )}
                  {showMagic && (
                    <TextField select size="small" label={tr('Magia', 'Magic')} value={magic}
                      onChange={(e) => { setMagic(e.target.value); resetResults(); }}
                      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                      <option value="">{tr('Qualquer', 'Any')}</option>
                      <option value="magical">{tr('Mágicos', 'Magical')}</option>
                      <option value="mundane">{tr('Mundanos', 'Mundane')}</option>
                    </TextField>
                  )}
                </Box>
              )}
              <Box sx={{ fontSize: 13, color: ink.secondary, px: 2, pt: 1.25, pb: 0.75 }}>
                {loading && !entries.length ? tr('Carregando o catálogo de itens…', 'Loading the item catalog…')
                  : tr(`${category.label} · ${results.length.toLocaleString(locale)} resultado${results.length === 1 ? '' : 's'}`,
                    `${category.label} · ${results.length.toLocaleString(locale)} result${results.length === 1 ? '' : 's'}`)}
              </Box>
              {results.slice(0, limit).map((e) => {
                const line = lineOf(e.id);
                const on = e.id === selected;
                const high = (e.level ?? 0) > level;
                const kind = itemKind(e, e);
                return (
                  <Box key={e.id} sx={{
                    display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', gap: 1.5, alignItems: 'center', pl: 2, pr: 1.5, py: 1, minHeight: 62,
                    borderBottom: `1px solid ${rule}`, bgcolor: on ? tint.green : 'transparent', boxShadow: on ? `inset 3px 0 0 ${greenInk.mid}` : 'none',
                  }}>
                    <ItemGlyph kind={kind} />
                    <ButtonBase onClick={() => choose(e.id)} data-view="" sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', py: 0.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Box component="span" sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.25 }}>{e.name}</Box>
                        {e.homebrew && <ContentBadge kind="mesa" />}
                        {allowedAtTable(e, mesaRules) === false && <ContentBadge kind="out" />}
                      </Box>
                      <Box component="span" sx={{ fontSize: 13, color: ink.secondary, display: 'flex', gap: '4px 8px', alignItems: 'center', flexWrap: 'wrap', mt: '2px' }}>
                        <LevelBox level={e.level ?? 0} rarity={e.rarity} />
                        {[e.item?.price ? formatGp(e.item.price.gp) : tr('sem preço', 'no price'), formatBulk(e.item?.bulk)].join(' · ')}
                        {high && <Box component="span" sx={{ color: status.warning, fontWeight: 700 }}>{tr(`⚠ acima do nível ${level}`, `⚠ above level ${level}`)}</Box>}
                      </Box>
                    </ButtonBase>
                    {line
                      ? <Stepper label={tr(`Quantidade de ${e.name} na sacola`, `${e.name} in the bag`)} value={line.qty} onChange={(n) => setLine(e.id, { qty: n })} />
                      : <PlusButton label={tr(`Pôr ${e.name} na sacola`, `Put ${e.name} in the bag`)} onClick={() => setLine(e.id, { qty: 1 })} />}
                  </Box>
                );
              })}
              {results.length > limit && (
                <Box sx={{ p: 1.5, textAlign: 'center' }}><Button onClick={() => setLimit((n) => n + PAGE)}>{tr(`Mostrar mais (${results.length - limit})`, `Show more (${results.length - limit})`)}</Button></Box>
              )}
              {!loading && results.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center', color: ink.secondary, fontSize: 14 }}>
                  {tr('Nenhum item encontrado. Experimente ajustar a busca ou os filtros.', 'No items found. Try adjusting your search or filters.')}</Box>
              )}
            </Box>

            {!phone && (
              <Box component="aside" sx={{ borderLeft: `1px solid ${rule}`, overflowY: 'auto', p: 2 }}>
                {detail ?? <Box sx={{ color: ink.secondary, fontSize: 14, pt: 4, textAlign: 'center' }}>{tr('Escolha um item para ver os detalhes.', 'Pick an item to see the details.')}</Box>}
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2 }, py: 1.25, pb: 'calc(10px + env(safe-area-inset-bottom))', bgcolor: green.main, color: chrome.text, borderTop: `2px solid ${gold.main}` }}>
            <StrokeIcon d={ICON_PATH.bag} size={22} sx={{ color: gold.bright, display: { xs: 'none', sm: 'block' } }} />
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.75, overflow: 'hidden', flex: 1, minWidth: 0 }}>
              {bag.length === 0 && <Box component="span" sx={{ fontSize: 13, color: chrome.textSoft }}>{tr('A sacola está vazia: use o + para juntar vários itens.', 'The bag is empty: use + to gather several items.')}</Box>}
              {bag.map((l) => (
                <ButtonBase key={l.id} onClick={() => choose(l.id)} title={tr('Ver o item', 'See the item')} sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center', flex: 'none', height: 30, px: 1.25, borderRadius: 999, bgcolor: chrome.active, border: `1px solid ${chrome.lineStrong}`, color: chrome.text, fontSize: 13 }}>
                  <Box component="b" sx={{ color: gold.bright, fontVariantNumeric: 'tabular-nums' }}>{l.qty}×</Box>{byId.get(l.id)?.name ?? l.id}
                  {l.acquired === 'given' && <Box component="span" sx={{ color: chrome.textSoft }}>{tr(' (ganho)', ' (given)')}</Box>}
                </ButtonBase>
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: { xs: 1, md: 'none' }, minWidth: 0, textAlign: { md: 'right' } }}>
              <Box component="b" sx={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                {phone ? tr(`Sacola · ${count} ite${count === 1 ? 'm' : 'ns'}`, `Bag · ${count} item${count === 1 ? '' : 's'}`) : `−${formatGp(cost)}`}</Box>
              <Box component="span" sx={{ fontSize: 12, color: after < 0 ? status.warning : chrome.textSoft, fontWeight: after < 0 ? 700 : 400 }}>
                {phone ? `−${formatGp(cost)} · ` : ''}{after < 0 ? tr(`⚠ passa em ${formatGp(-after)}`, `⚠ over by ${formatGp(-after)}`) : tr(`sobra ${formatGp(after)}`, `${formatGp(after)} left`)}</Box>
            </Box>
            {bag.length > 0 && !phone && (
              <Button size="small" onClick={() => setBag([])} sx={{ color: chrome.text, borderColor: chrome.lineStrong }} variant="outlined">{tr('Esvaziar', 'Empty')}</Button>
            )}
            <Button disabled={!bag.length} onClick={finish} sx={[goldButtonSx, { minHeight: 44, px: 2, '&.Mui-disabled': { bgcolor: chrome.active, color: chrome.textMuted, borderColor: chrome.line } }]}>
              {count ? tr(`Adicionar ${count} ite${count === 1 ? 'm' : 'ns'}`, `Add ${count} item${count === 1 ? '' : 's'}`) : tr('Adicionar', 'Add')}</Button>
          </Box>
        </>
      )}

      {phone && (
        <Drawer anchor="bottom" open={sheetOpen && !!sel} onClose={() => setSheetOpen(false)}
          slotProps={{ paper: { sx: { maxHeight: '88vh', bgcolor: parchment.paper, borderRadius: '16px 16px 0 0', borderTop: `2px solid ${gold.main}`, p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' } } }}>
          <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: rule, mx: 'auto', mt: -1, mb: 1.5 }} />
          {detail}
        </Drawer>
      )}
    </Dialog>
  );
}

function ItemDetail({ entry, level, draft, setDraft, containers, inBag, onCommit }: {
  entry: RuleEntry;
  level: number;
  draft: { qty: number; acquired: 'bought' | 'given'; container: string };
  setDraft: (d: { qty: number; acquired: 'bought' | 'given'; container: string }) => void;
  containers: ResolvedItem[];
  inBag: boolean;
  onCommit: () => void;
}) {
  const [fullText, setFullText] = useState(false);
  const traits = (entry.traits ?? []).filter((t) => !['common', 'uncommon', 'rare', 'unique'].includes(t.toLowerCase()));
  const price = entry.item?.price?.gp ?? 0;
  const high = (entry.level ?? 0) > level;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <ItemGlyph kind={itemKind(entry, entry)} size={52} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box component="h3" sx={{ m: 0, font: `700 19px/1.2 ${displayFont}`, overflowWrap: 'anywhere' }}>{entry.name}</Box>
          <Box sx={{ fontSize: 13, color: ink.secondary }}>{[tr(`Item ${entry.level ?? 0}`, `Item ${entry.level ?? 0}`), entry.item?.category, entry.item?.subcategory].filter(Boolean).join(' · ')}</Box>
        </Box>
      </Box>
      {high && <Box sx={{ fontSize: 13, color: status.warning, fontWeight: 700 }}>{tr(`⚠ Acima do nível ${level}: dá para adicionar, a mesa decide.`, `⚠ Above level ${level}: you can add it, the table decides.`)}</Box>}
      {traits.length > 0 && <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>{traits.map((t) => <ContentBadge key={t} kind="trait">{t}</ContentBadge>)}</Box>}
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 14px', fontSize: 14 }}>
        {itemFacts(entry).map((f) => (
          <Box key={f.k} sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ color: ink.secondary }}>{f.k}</Box>
            <Box component="dd" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{f.v}</Box>
          </Box>
        ))}
        {entry.actions && (
          <Box sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ color: ink.secondary }}>{tr('Ativar', 'Activate')}</Box>
            <Box component="dd" sx={{ m: 0 }}><ActionGlyph actions={entry.actions} /></Box>
          </Box>
        )}
      </Box>
      {entry.summary && <Box sx={{ fontSize: 14 }}>{entry.summary}</Box>}
      <Box>
        <Button size="small" sx={{ px: 0 }} onClick={() => setFullText((v) => !v)}>{fullText ? tr('Esconder texto completo', 'Hide full text') : tr('Ver texto completo ›', 'See full text ›')}</Button>
      </Box>
      {fullText && (
        <Suspense fallback={null}>
          <DescriptionContent key={entry.id} embedded request={{ type: 'item', name: entry.name }} onClose={() => setFullText(false)} />
        </Suspense>
      )}
      <Box sx={{ borderTop: `1px solid ${rule}`, pt: 1.5, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '12px 14px', alignItems: 'center' }}>
        <Label>{tr('Quantidade', 'Quantity')}</Label>
        <Box><Stepper large label={tr('Quantidade', 'Quantity')} value={draft.qty} min={1} onChange={(n) => setDraft({ ...draft, qty: n })} /></Box>
        <Label>{tr('Como entra', 'How it comes')}</Label>
        <Segmented label={tr('Como entra', 'How it comes')} height={36} value={draft.acquired} onChange={(v) => setDraft({ ...draft, acquired: v })}
          options={[{ value: 'bought', label: tr(`Comprar · ${formatGp(price * draft.qty)}`, `Buy · ${formatGp(price * draft.qty)}`) }, { value: 'given', label: tr('Ganhei', 'Given') }]} />
        {containers.length > 0 && (
          <>
            <Label>{tr('Guardar em', 'Store in')}</Label>
            <TextField select size="small" value={draft.container} onChange={(e) => setDraft({ ...draft, container: e.target.value })}
              slotProps={{ htmlInput: { 'aria-label': tr('Guardar em', 'Store in') } }}>
              <MenuItem value="">{tr('Carregado (solto)', 'Carried (loose)')}</MenuItem>
              {containers.map((c) => <MenuItem key={c.key} value={c.key}>{c.name}</MenuItem>)}
            </TextField>
          </>
        )}
      </Box>
      <Button variant="contained" fullWidth onClick={onCommit}>
        {inBag ? tr(`Atualizar na sacola · ${draft.qty}×`, `Update in the bag · ${draft.qty}×`) : tr(`Pôr ${draft.qty} na sacola`, `Put ${draft.qty} in the bag`)}</Button>
    </Box>
  );
}
