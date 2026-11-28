import { lazy, Suspense, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, IconButton, InputBase, useMediaQuery, useTheme } from '@mui/material';
import { displayFont, greenInk, ink, parchment, rule, status } from '../../../theme';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { MesaRules } from '../types';
import type { ResolvedItem } from '../engine/equipment';
import { allowedAtTable } from '../mesaRules';
import { BandHead, ContentBadge, LevelBox, Pill } from './ui';
import { tint } from './uiTokens';
import { Gem, StrokeIcon } from './equipUi';
import { formatGp, ICON_PATH, itemDisplayName, runeFits, type Fit } from './equipmentModel';
import { descriptionRequest } from './descriptionRequest';

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
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const titleId = useId();
  const detailId = useId();
  const [q, setQ] = useState('');
  const [fitsOnly, setFitsOnly] = useState(true);
  const [capLevel, setCapLevel] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const returnFocus = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

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

  const pick = rows.find((r) => r.e.id === selected) ?? null;
  const reading = !wide && !!pick;
  useLayoutEffect(() => {
    if (!returnFocus.current) return;
    if (reading) {
      heading.current?.focus({ preventScroll: true });
    } else {
      if (open) returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open, reading]);

  if (!item) return null;
  const slotNo = (item.inv.runes?.property?.length ?? 0) + 1;
  const slots = item.inv.runes?.potency ?? 0;
  const bought = item.inv.acquired === 'bought';
  const back = () => setSelected(null);
  const close = () => { back(); onClose(); };
  const pickWarning = pick && whyOf(pick.fit, (pick.e.level ?? 0) > level, etched.has(pick.e.id), level);

  return (
    <Dialog open={open} onClose={reading ? back : close} fullScreen={phone} fullWidth maxWidth="md" aria-labelledby={titleId}
      slotProps={{ paper: { sx: { bgcolor: parchment.paper, height: phone ? undefined : '84dvh', overflow: 'hidden' } } }}>
      <BandHead right={
        <IconButton size="small" aria-label={tr('Fechar', 'Close')} onClick={close} sx={{ color: 'inherit', minWidth: { xs: 40, sm: 32 }, minHeight: { xs: 40, sm: 32 } }}><StrokeIcon d={ICON_PATH.close} size={18} /></IconButton>
      }><span id={titleId}>{tr('Gravar runa', 'Etch a rune')}</span></BandHead>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.75, px: 2, py: 1.25, borderBottom: `1px solid ${rule}` }}>
        <Box component="b" sx={{ font: `700 16px ${displayFont}`, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{itemDisplayName(item)}</Box>
        <Box component="span" sx={{ fontSize: 13, color: slotNo > slots ? status.warning : ink.secondary, flex: 'none' }}>
          {slotNo > slots ? tr('⚠ sem espaço livre', '⚠ no free slot') : tr(`espaço ${slotNo} de ${slots}`, `slot ${slotNo} of ${slots}`)}</Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 340px) minmax(0, 1fr)' } }}>
        <Box sx={{ display: reading ? 'none' : 'flex', flexDirection: 'column', minHeight: 0, borderRight: { md: `1px solid ${rule}` } }}>
          <Box sx={{ px: 2, py: 1.25, display: 'grid', gap: 1, borderBottom: `1px solid ${rule}` }}>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 42, px: 1.25, border: `1px solid ${rule}`, borderRadius: '6px', '&:focus-within': { borderColor: greenInk.mid } }}>
              <StrokeIcon d={ICON_PATH.search} size={16} sx={{ color: ink.secondary }} />
              <InputBase autoFocus={!phone} fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder={item.base?.item?.weapon ? tr('Buscar runa de arma', 'Search weapon runes') : tr('Buscar runa de armadura', 'Search armor runes')}
                inputProps={{ 'aria-label': tr('Buscar runa', 'Search runes') }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Pill look={fitsOnly ? 'sel' : 'default'} onClick={() => setFitsOnly((v) => !v)}>{tr('Cabe neste item', 'Fits this item')}</Pill>
              <Pill look={capLevel ? 'sel' : 'default'} onClick={() => setCapLevel((v) => !v)}>{tr(`Até o nível ${level}`, `Up to level ${level}`)}</Pill>
            </Box>
          </Box>

          <Box role="group" aria-label={tr('Runas', 'Runes')} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.slice(0, MAX_ROWS).map(({ e, fit }) => {
              const sel = e.id === selected;
              const why = whyOf(fit, (e.level ?? 0) > level, etched.has(e.id), level);
              return (
                <ButtonBase key={e.id} aria-pressed={wide ? sel : undefined} onClick={(event) => {
                  if (!wide) returnFocus.current = event.currentTarget;
                  setSelected(e.id);
                }} data-view="" sx={{
                  display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto auto', gap: 1.25, alignItems: 'center', width: 1, textAlign: 'left',
                  minHeight: 56, px: 1.75, py: 1.25, borderBottom: `1px solid ${rule}`, justifyContent: 'stretch',
                  bgcolor: sel ? tint.green : 'transparent', outlineOffset: -2, opacity: fit.ok === false ? 0.8 : 1,
                  '&:hover': { bgcolor: tint.green },
                  '&.Mui-focusVisible': { outline: `2px solid ${greenInk.mid}` },
                  ...(sel && { outline: `2px solid ${greenInk.mid}` }),
                }}>
                  <Gem look={fit.ok === false ? 'e' : 'p'} size={14} />
                  <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowWrap: 'anywhere' }}>
                    <Box component="span" sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Box component="span" sx={{ fontWeight: 600, fontSize: 15, color: ink.primary }}>{e.name}</Box>
                      <RuneBadges entry={e} mesaRules={mesaRules} />
                    </Box>
                    {e.item?.price && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{formatGp(e.item.price.gp)}</Box>}
                    {why && <RuneWarning warning={why} />}
                  </Box>
                  <LevelBox level={e.level} rarity={e.rarity} />
                  <StrokeIcon d={ICON_PATH.chevron} size={14} sx={{ color: ink.secondary }} />
                </ButtonBase>
              );
            })}
            {rows.length === 0 && (
              <Box role="status" sx={{ p: 3, textAlign: 'center', color: ink.secondary, fontSize: 14 }}>
                {runes.length ? tr('Nenhuma runa com esses filtros.', 'No rune with these filters.') : tr('Carregando as runas do catálogo…', 'Loading runes from the catalog…')}</Box>
            )}
            {rows.length > MAX_ROWS && <Box sx={{ p: 1.5, fontSize: 13, color: ink.secondary, textAlign: 'center' }}>{tr(`Mostrando ${MAX_ROWS} de ${rows.length}; refine a busca.`, `Showing ${MAX_ROWS} of ${rows.length}; refine the search.`)}</Box>}
          </Box>
        </Box>

        {pick ? (
          <Box component="section" aria-labelledby={detailId} sx={{
            display: 'grid', gridTemplateRows: reading ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto', minHeight: 0, minWidth: 0,
          }}>
            {reading && <Box sx={{ px: 2, py: 0.5, borderBottom: `1px solid ${rule}` }}>
              <Button startIcon={<StrokeIcon d={ICON_PATH.back} size={16} />} onClick={back}>{tr('Voltar às runas', 'Back to runes')}</Button>
            </Box>}
            <Box key={pick.e.id} tabIndex={0} sx={{ overflowY: 'auto', overflowWrap: 'anywhere', px: { xs: 2, md: 3 }, py: 2, outlineOffset: -2 }}>
              <Box component="h3" ref={heading} tabIndex={-1} id={detailId} sx={{ m: 0, mb: 1, fontFamily: displayFont }}>{pick.e.name}</Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1.5, fontSize: 13, color: ink.secondary }}>
                {pick.e.homebrew && pick.e.level !== undefined && <span>{tr(`Nível ${pick.e.level}`, `Level ${pick.e.level}`)}</span>}
                <RuneBadges entry={pick.e} mesaRules={mesaRules} />
                {pickWarning && <RuneWarning warning={pickWarning} />}
              </Box>
              <RuneDescription entry={pick.e} />
            </Box>
            <Box sx={{ borderTop: `1px solid ${rule}`, px: { xs: 2, md: 3 }, pt: 1.25, pb: 'calc(12px + env(safe-area-inset-bottom))',
              display: 'flex', flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1 }}>
              <Box sx={{ flex: { sm: '1 1 160px' }, fontSize: 13, color: ink.secondary }}>
                {bought
                  ? tr(`${formatGp(pick.e.item?.price?.gp ?? 0)} saem do dinheiro (o item está como Comprado)`, `${formatGp(pick.e.item?.price?.gp ?? 0)} comes out of the money (item is Bought)`)
                  : tr('Sem custo: o item está como Ganho', 'No cost: the item is Given')}
              </Box>
              <Button variant="contained" onClick={() => { onPick(pick.e.id); close(); }}>{tr(`Gravar ${pick.e.name}`, `Etch ${pick.e.name}`)}</Button>
            </Box>
          </Box>
        ) : wide && (
          <Box sx={{ display: 'grid', placeItems: 'center', p: 3, textAlign: 'center', color: ink.secondary, bgcolor: parchment.page }}>
            {tr('Selecione uma runa para ler seus efeitos.', 'Select a rune to read its effects.')}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

function RuneDescription({ entry }: { entry: RuleEntry }) {
  const request = useMemo(() => descriptionRequest(entry), [entry]);
  if (entry.homebrew) {
    return <Box sx={{ whiteSpace: 'pre-wrap' }}>{entry.summary || tr('Descrição não informada.', 'No description provided.')}</Box>;
  }
  return (
    <Suspense fallback={<Box role="status" sx={{ color: ink.secondary }}>{tr('Carregando descrição…', 'Loading description…')}</Box>}>
      <DescriptionContent embedded request={request} onClose={() => {}} />
    </Suspense>
  );
}

function RuneBadges({ entry, mesaRules }: { entry: RuleEntry; mesaRules: MesaRules | null }) {
  return <>
    {entry.homebrew && <ContentBadge kind="mesa" />}
    {allowedAtTable(entry, mesaRules) === false && <ContentBadge kind="out" />}
  </>;
}

function RuneWarning({ warning }: { warning: NonNullable<ReturnType<typeof whyOf>> }) {
  return <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: warning.tone === 'no' ? status.error : warning.tone === 'warn' ? status.warning : ink.secondary }}>
    {warning.text}
  </Box>;
}

function whyOf(fit: Fit, high: boolean, already: boolean, level: number): { text: string; tone: 'no' | 'warn' | 'q' } | null {
  if (fit.ok === false) return { text: `✗ ${fit.why}`, tone: 'no' };
  if (already) return { text: tr('já gravada: só a de maior nível vale', 'already etched: only the highest level applies'), tone: 'warn' };
  if (high) return { text: tr(`⚠ acima do nível ${level}`, `⚠ above level ${level}`), tone: 'warn' };
  if (fit.ok === 'unknown') return { text: `? ${fit.why}`, tone: 'q' };
  return null;
}
