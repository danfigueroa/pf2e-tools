import { lazy, Suspense, useMemo, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, IconButton, InputBase, useMediaQuery, useTheme } from '@mui/material';
import { displayFont, gold, greenInk, ink, parchment, rule, status } from '../../../theme';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { MesaRules } from '../types';
import type { ResolvedItem } from '../engine/equipment';
import { allowedAtTable } from '../mesaRules';
import { BandHead, ContentBadge, LevelBox, Pill } from './ui';
import { tint } from './uiTokens';
import { Gem, StrokeIcon } from './equipUi';
import { formatGp, ICON_PATH, itemDisplayName, runeFits, type Fit } from './equipmentModel';

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

const MAX_ROWS = 200;

/**
 * "Gravar runa": as runas de propriedade do catálogo que servem para o tipo do item, com nível, preço e efeito. O que não
 * cabe (Returning numa arma que não é de arremesso) aparece com ✗ e o motivo; acima do nível, ⚠; já gravada, avisado.
 * Tudo continua escolhível: o app conta e avisa, não trava.
 */
export function RunePicker({ open, item, runes, level, mesaRules, onPick, onClose }: {
  open: boolean;
  item: ResolvedItem | null;
  /** Runas de propriedade do tipo certo (arma ou armadura), já sem os grupos sem preço. */
  runes: RuleEntry[];
  level: number;
  mesaRules: MesaRules | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [q, setQ] = useState('');
  const [fitsOnly, setFitsOnly] = useState(true);
  const [capLevel, setCapLevel] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fullText, setFullText] = useState(false);

  const etched = useMemo(() => new Set(item?.inv.runes?.property ?? []), [item]);
  const rows = useMemo(() => {
    if (!item) return [];
    const term = q.trim().toLowerCase();
    return runes
      .map((e) => ({ e, fit: runeFits(e, item.base) }))
      .filter(({ e, fit }) => (!term || e.name.toLowerCase().includes(term) || (e.summary ?? '').toLowerCase().includes(term))
        && (!fitsOnly || fit.ok !== false) && (!capLevel || (e.level ?? 0) <= level))
      .sort((a, b) => (a.e.level ?? 0) - (b.e.level ?? 0) || a.e.name.localeCompare(b.e.name));
  }, [runes, item, q, fitsOnly, capLevel, level]);

  if (!item) return null;
  const slotNo = (item.inv.runes?.property?.length ?? 0) + 1;
  const slots = item.inv.runes?.potency ?? 0;
  const pick = rows.find((r) => r.e.id === selected) ?? null;
  const bought = item.inv.acquired === 'bought';
  const close = () => { setSelected(null); setFullText(false); onClose(); };

  return (
    <Dialog open={open} onClose={close} fullScreen={phone} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { bgcolor: parchment.paper, height: phone ? undefined : '82vh', display: 'flex', flexDirection: 'column' } } }}>
      <BandHead right={
        <IconButton size="small" aria-label={tr('Fechar', 'Close')} onClick={close} sx={{ color: 'inherit' }}><StrokeIcon d={ICON_PATH.close} size={18} /></IconButton>
      }>{tr('Gravar runa', 'Etch a rune')}</BandHead>
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25, borderBottom: `1px solid ${rule}` }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Box component="b" sx={{ font: `700 16px ${displayFont}`, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{itemDisplayName(item)}</Box>
          <Box component="span" sx={{ fontSize: 13, color: slotNo > slots ? status.warning : ink.secondary, flex: 'none' }}>
            {slotNo > slots ? tr('⚠ sem espaço livre', '⚠ no free slot') : tr(`espaço ${slotNo} de ${slots}`, `slot ${slotNo} of ${slots}`)}</Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 42, px: 1.25, border: `1px solid ${rule}`, borderRadius: '6px', bgcolor: parchment.paper, '&:focus-within': { borderColor: greenInk.mid } }}>
          <StrokeIcon d={ICON_PATH.search} size={16} sx={{ color: ink.secondary }} />
          <InputBase autoFocus={!phone} fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder={item.base?.item?.weapon ? tr('Buscar runa de arma', 'Search weapon runes') : tr('Buscar runa de armadura', 'Search armor runes')}
            inputProps={{ 'aria-label': tr('Buscar runa', 'Search runes') }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Pill look={fitsOnly ? 'sel' : 'default'} onClick={() => setFitsOnly((v) => !v)}>{tr('Cabe neste item', 'Fits this item')}</Pill>
          <Pill look={capLevel ? 'sel' : 'default'} onClick={() => setCapLevel((v) => !v)}>{tr(`Até o nível ${level}`, `Up to level ${level}`)}</Pill>
        </Box>
      </Box>

      <Box role="listbox" aria-label={tr('Runas', 'Runes')} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.slice(0, MAX_ROWS).map(({ e, fit }) => {
          const sel = e.id === selected;
          const high = (e.level ?? 0) > level;
          const already = etched.has(e.id);
          const why = whyOf(fit, high, already, level);
          return (
            <ButtonBase key={e.id} role="option" aria-selected={sel} onClick={() => { setSelected(e.id); setFullText(false); }} data-view="" sx={{
              display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 1.25, alignItems: 'center', width: 1, textAlign: 'left',
              px: 1.75, py: 1.25, borderBottom: `1px solid ${rule}`, justifyContent: 'stretch',
              bgcolor: sel ? tint.green : 'transparent', outline: sel ? `2px solid ${greenInk.mid}` : 'none', outlineOffset: -2, opacity: fit.ok === false ? 0.8 : 1,
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}><Gem look={fit.ok === false ? 'e' : 'p'} size={14} /></Box>
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box component="span" sx={{ fontWeight: 600, fontSize: 15, color: fit.ok === false ? ink.secondary : ink.primary }}>{e.name}</Box>
                  {e.homebrew && <ContentBadge kind="mesa" />}
                  {allowedAtTable(e, mesaRules) === false && <ContentBadge kind="out" />}
                </Box>
                <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>
                  {[e.item?.price ? formatGp(e.item.price.gp) : null, e.summary ? clip(e.summary, 90) : null].filter(Boolean).join(' · ')}</Box>
                {why && <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: why.tone === 'no' ? status.error : why.tone === 'warn' ? status.warning : ink.secondary }}>{why.text}</Box>}
              </Box>
              <LevelBox level={e.level} rarity={e.rarity} />
            </ButtonBase>
          );
        })}
        {rows.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center', color: ink.secondary, fontSize: 14 }}>
            {runes.length ? tr('Nenhuma runa com esses filtros.', 'No rune with these filters.') : tr('Carregando as runas do catálogo…', 'Loading runes from the catalog…')}</Box>
        )}
        {rows.length > MAX_ROWS && <Box sx={{ p: 1.5, fontSize: 13, color: ink.secondary, textAlign: 'center' }}>{tr(`Mostrando ${MAX_ROWS} de ${rows.length}; refine a busca.`, `Showing ${MAX_ROWS} of ${rows.length}; refine the search.`)}</Box>}
      </Box>

      {pick && (
        <Box sx={{ borderTop: `2px solid ${gold.main}`, bgcolor: parchment.paper, px: 2, pt: 1.25, pb: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '45vh', overflowY: 'auto' }}>
          {pick.e.summary && <Box sx={{ fontSize: 14 }}>{pick.e.summary}</Box>}
          <Box>
            <Button size="small" onClick={() => setFullText((v) => !v)}>{fullText ? tr('Esconder texto completo', 'Hide full text') : tr('Ver texto completo ›', 'See full text ›')}</Button>
          </Box>
          {fullText && (
            <Suspense fallback={null}>
              <DescriptionContent key={pick.e.id} embedded request={{ type: 'item', name: pick.e.name }} onClose={() => setFullText(false)} />
            </Suspense>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 160px', fontSize: 13, color: ink.secondary }}>
              {bought
                ? tr(`${formatGp(pick.e.item?.price?.gp ?? 0)} saem do dinheiro (o item está como Comprado)`, `${formatGp(pick.e.item?.price?.gp ?? 0)} comes out of the money (item is Bought)`)
                : tr('Sem custo: o item está como Ganho', 'No cost: the item is Given')}
            </Box>
            <Button variant="contained" onClick={() => { onPick(pick.e.id); close(); }}>{tr(`Gravar ${pick.e.name}`, `Etch ${pick.e.name}`)}</Button>
          </Box>
        </Box>
      )}
    </Dialog>
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function whyOf(fit: Fit, high: boolean, already: boolean, level: number): { text: string; tone: 'no' | 'warn' | 'q' } | null {
  if (fit.ok === false) return { text: `✗ ${fit.why}`, tone: 'no' };
  if (already) return { text: tr('já gravada: só a de maior nível vale', 'already etched: only the highest level applies'), tone: 'warn' };
  if (high) return { text: tr(`⚠ acima do nível ${level}`, `⚠ above level ${level}`), tone: 'warn' };
  if (fit.ok === 'unknown') return { text: `? ${fit.why}`, tone: 'q' };
  return null;
}
