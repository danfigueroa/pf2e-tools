import { useMemo, useState } from 'react';
import { Box, Button, ButtonBase, Chip, Collapse, Drawer, InputBase, Stack, TextField, Typography } from '@mui/material';
import { displayFont, gold, green, greenInk, ink, parchment, rule } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { STARTING_GOLD, type ResolvedItem } from '../engine/equipment';
import type { RuleEntry } from '../rules/types';
import type { BuildState, InventoryEntry } from '../types';
import { useTraitLabels } from '../../character-viewer/components/useTraitLabels';
import { ActionGlyph, ContentBadge, Label, Notice, Pill, SectionHead } from '../components/ui';
import { cardSx, goldButtonSx, signed, tint, warmShadow } from '../components/uiTokens';
import { GroupBar, Gauge, InvestPips, ItemGlyph, Meter, Segmented, Sockets, Stepper, StrokeIcon, WherePill, type SocketLook } from '../components/equipUi';
import {
  catalogItems, customItemId, formatBulk, formatGp, groupByKind, groupByPlace, ICON_PATH, inUse, isContainer, isRunic, itemDisplayName, itemLevel,
  itemTraits, itemKind, newInventoryKey, stacks, whereLabel, type ItemKind,
} from '../components/equipmentModel';
import { ItemBench } from '../components/ItemBench';
import { ItemCatalog, type BagLine } from '../components/ItemCatalog';
import { RunePicker } from '../components/RunePicker';
import { RelicPanel } from '../components/RelicPanel';
import { activeRuneGifts } from '../../../pathbuilder/playerRelic';
import { relicViews } from '../components/relicView';
import type { BuildInfo } from '../../../pathbuilder/types';
import type { SectionProps } from './types';

const COINS: (keyof BuildState['money'])[] = ['pp', 'gp', 'sp', 'cp']; // i18n-ok: chaves do dinheiro
const COIN_LABEL: Record<string, string> = {
  pp: tr('PL (platina)', 'pp'), gp: tr('PO (ouro)', 'gp'), sp: tr('PP (prata)', 'sp'), cp: tr('PC (cobre)', 'cp'),
};
const USE_KICKER: Partial<Record<ItemKind, string>> = {
  weapon: tr('Mãos', 'Hands'), shield: tr('Escudo', 'Shield'), armor: tr('Armadura', 'Armor'), worn: tr('Vestido', 'Worn'),
};

export interface EquipmentProps extends SectionProps {
  /** Todas as entradas carregadas (itens e companheiros entre elas). */
  entries: RuleEntry[];
  wealth?: { levels: Record<string, { currency: number; lumpSum: number }>; source?: string };
  /** O retrato de agora (o que a Ficha vai ler): as relíquias casam por ele, com o catálogo da Ficha. */
  sheet?: () => { build: BuildInfo } | null;
}

/** Os encaixes do item: fundamentais em ouro, propriedade em verde, espaço livre tracejado, runa a mais em âmbar. */
function socketsOf(it: ResolvedItem, kind: ItemKind, level: number): SocketLook[] {
  if (!isRunic(kind)) return [];
  const r = it.inv.runes ?? {};
  if (kind === 'shield') return r.reinforcing ? ['f'] : [];
  const out: SocketLook[] = [];
  if (r.potency) out.push('f');
  if (kind === 'weapon' ? r.striking : r.resilient) out.push('f');
  const slots = r.potency ?? 0;
  const gifts = it.inv.relic?.allowEtching && (kind === 'armor' || kind === 'weapon') ? activeRuneGifts(it.inv.relic, level, kind).length : 0;
  const prop = (r.property?.length ?? 0) + gifts;
  for (let i = 0; i < Math.max(slots, prop); i++) out.push(i < prop ? (i < slots ? 'p' : 'x') : 'e');
  return out;
}

/**
 * Aba Equipamento (redesign "Mochila e bancada"): três medidores (dinheiro, volume com a marca de sobrecarga e
 * investidos), os cartões do que está em uso com os encaixes de runa, a mochila por tipo ou por onde está (consumível
 * muda a quantidade ali mesmo), a bancada do item, o catálogo com sacola e o "Gravar runa". Os números vêm do motor
 * (`engine/equipment.ts`) e os itens do catálogo importado; nada aqui consulta a AON.
 */
export function EquipmentSection({ state, update, compiled, canEdit, mesaRules, entries, wealth, index, sheet }: EquipmentProps) {
  const [view, setView] = useState<'kind' | 'place'>('kind');
  const [query, setQuery] = useState('');
  const [benchKey, setBenchKey] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<'catalog' | 'custom' | null>(null);
  const [etchFor, setEtchFor] = useState<string | null>(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const eq = compiled.equipment;
  const bagTraits = useMemo(() => new Map(eq.items.map((it) => [it.key, itemTraits(it.entry, it.base, it.inv.weapon?.extraTraits)])), [eq.items]);
  const traitText = useTraitLabels([...bagTraits.values()].flat().concat(eq.strikes.flatMap((s) => s.traits)));
  const level = compiled.level;

  const items = useMemo(() => entries.filter((e) => e.item), [entries]);
  const catalogList = useMemo(() => catalogItems(items), [items]);
  const materials = useMemo(() => items.filter((e) => /^materials?/i.test(e.item?.category ?? '') && !e.item?.parent).sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const kinds = useMemo(() => new Map(eq.items.map((it) => [it.key, itemKind(it.entry, it.base, it.inv)])), [eq.items]);
  const kindOf = (it: ResolvedItem) => kinds.get(it.key) ?? 'gear';
  const containers = useMemo(() => eq.items.filter((it) => isContainer(it.entry)), [eq.items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- o retrato muda com o compilado
  const relics = useMemo(() => relicViews(sheet?.()?.build ?? null, eq.items), [sheet, compiled]);

  const setInventory = (fn: (inv: InventoryEntry[]) => InventoryEntry[]) => update((s) => ({ ...s, inventory: fn(s.inventory) }));
  const patch = (key: string, p: Partial<InventoryEntry>) => setInventory((inv) => inv.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const remove = (key: string) => { setBenchKey(null); setInventory((inv) => inv.filter((i) => i.key !== key).map((i) => (i.container === key ? { ...i, container: undefined } : i))); };
  const duplicate = (key: string) => setInventory((inv) => {
    const src = inv.find((i) => i.key === key);
    return src ? [...inv, { ...structuredClone(src), relic: undefined, key: newInventoryKey(), equipped: undefined, worn: undefined, invested: undefined }] : inv;
  });
  const transfer = (from: string, to: string) => setInventory((inv) => {
    const runes = inv.find((i) => i.key === from)?.runes;
    return inv.map((i) => (i.key === to ? { ...i, runes } : i.key === from ? { ...i, runes: undefined } : i));
  });
  const setMoney = (coin: keyof BuildState['money'], value: number) => update((s) => ({ ...s, money: { ...s.money, [coin]: Math.max(0, Math.floor(value) || 0) } }));

  /** Põe a sacola na mochila: consumível igual empilha; a primeira arma vai para as mãos e a primeira armadura é vestida. */
  const addLines = (lines: BagLine[]) => setInventory((inv) => {
    const next = [...inv];
    let armorWorn = eq.items.some((i) => kindOf(i) === 'armor' && i.inv.worn);
    let weaponHeld = eq.items.some((i) => kindOf(i) === 'weapon' && i.inv.equipped);
    for (const l of lines) {
      const entry = index.get(l.id) ?? items.find((e) => e.id === l.id) ?? null;
      const kind = itemKind(entry, entry);
      const same = stacks(kind) ? next.findIndex((i) => i.item === l.id && i.acquired === l.acquired && !i.runes && !i.relic && (i.container ?? '') === (l.container ?? '')) : -1;
      if (same >= 0) { next[same] = { ...next[same], qty: Math.min(999, next[same].qty + l.qty) }; continue; }
      const row: InventoryEntry = { key: newInventoryKey(), item: l.id, qty: l.qty, acquired: l.acquired, container: l.container };
      if (kind === 'armor' && !armorWorn) { row.worn = true; armorWorn = true; }
      if (kind === 'weapon' && !weaponHeld) { row.equipped = true; weaponHeld = true; }
      next.push(row);
    }
    return next;
  });
  const addCustom = (name: string, qty: number, acquired: 'bought' | 'given') =>
    setInventory((inv) => [...inv, { key: newInventoryKey(), item: customItemId(name), qty, acquired, customName: name }]);

  const levelWealth = wealth?.levels[String(level)];
  const term = query.trim().toLowerCase();
  const shown = term ? eq.items.filter((it) => it.name.toLowerCase().includes(term) || itemDisplayName(it).toLowerCase().includes(term)) : eq.items;
  const groups = view === 'kind' ? groupByKind(shown) : groupByPlace(shown);
  const using = eq.items.filter((it) => inUse(kindOf(it), it.inv) && kindOf(it) !== 'worn');
  const investedNames = eq.items.filter((it) => it.inv.invested).map((it) => it.name);
  const bench = benchKey ? eq.items.find((i) => i.key === benchKey) ?? null : null;
  const etchItem = etchFor ? eq.items.find((i) => i.key === etchFor) ?? null : null;
  const etchRunes = useMemo(() => {
    if (!etchItem) return [];
    const weapon = !!etchItem.base?.item?.weapon;
    return catalogList.filter((e) => new RegExp(weapon ? 'weapon property' : 'armor property', 'i').test(e.item?.subcategory ?? ''));
  }, [etchItem, catalogList]);

  const moneyTone = eq.money.remaining < 0 ? 'error' : 'ok';
  const bulkTone = eq.bulk.total > eq.bulk.max ? 'error' : eq.bulk.total > eq.bulk.encumberedAt ? 'warn' : 'ok';
  const investTone = eq.invested > 10 ? 'warn' : 'ok';
  const openCatalog = (tab: 'catalog' | 'custom' = 'catalog') => setCatalog(tab);
  const loadingItems = !items.length;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Box component="h2" sx={{ m: 0, font: `700 20px ${displayFont}`, flex: 1 }}>{tr('Equipamento', 'Equipment')}</Box>
        {eq.items.length > 0 && (
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, height: 40, width: 220, px: 1.25, border: `1px solid ${rule}`, borderRadius: '6px', bgcolor: parchment.paper, '&:focus-within': { borderColor: greenInk.mid } }}>
            <StrokeIcon d={ICON_PATH.search} size={16} sx={{ color: ink.secondary }} />
            <InputBase fullWidth value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Buscar na mochila', 'Search the pack')} inputProps={{ 'aria-label': tr('Buscar na mochila', 'Search the pack') }} sx={{ fontSize: 14 }} />
          </Box>
        )}
        {canEdit && (
          <Button onClick={() => openCatalog()} startIcon={<StrokeIcon d={ICON_PATH.plus} size={16} />} sx={[goldButtonSx, { display: { xs: 'none', md: 'inline-flex' } }]}>
            {tr('Adicionar item', 'Add item')}</Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: '1.1fr 1fr 0.9fr' }, gap: { xs: 1, sm: 1.25 } }}>
        <Gauge icon={ICON_PATH.coin} label={tr('Dinheiro livre', 'Money left')} tone={moneyTone} value={formatGp(eq.money.remaining)}
          foot={eq.money.start > 0
            ? tr(`gasto ${formatGp(eq.money.spent)} de ${formatGp(eq.money.start)}${levelWealth && level > 1 ? ` · referência do nível ${level}: ${formatGp(levelWealth.lumpSum)}` : ''}`,
              `spent ${formatGp(eq.money.spent)} of ${formatGp(eq.money.start)}${levelWealth && level > 1 ? ` · level ${level} reference: ${formatGp(levelWealth.lumpSum)}` : ''}`)
            : tr('toque para lançar as moedas', 'tap to enter the coins')}
          onClick={canEdit ? () => setMoneyOpen((v) => !v) : undefined}>
          <Meter label={tr('Dinheiro gasto', 'Money spent')} tone={moneyTone} fraction={eq.money.start > 0 ? eq.money.spent / eq.money.start : 0} />
        </Gauge>
        <Gauge icon={ICON_PATH.bulk} label={tr('Volume', 'Bulk')} tone={bulkTone} value={eq.bulk.total.toLocaleString(locale)}
          small={tr(`/ ${eq.bulk.encumberedAt} · máx. ${eq.bulk.max}`, `/ ${eq.bulk.encumberedAt} · max ${eq.bulk.max}`)}
          foot={tr(`sobrecarregado acima de ${eq.bulk.encumberedAt} (5 + FOR)`, `encumbered over ${eq.bulk.encumberedAt} (5 + STR)`)}>
          <Meter label={tr('Volume carregado', 'Bulk carried')} tone={bulkTone} fraction={eq.bulk.max > 0 ? eq.bulk.total / eq.bulk.max : 1} mark={eq.bulk.max > 0 ? eq.bulk.encumberedAt / eq.bulk.max : undefined} />
        </Gauge>
        <Gauge icon={ICON_PATH.invested} label={tr('Investidos', 'Invested')} tone={investTone} value={String(eq.invested)} small="/ 10"
          foot={investedNames.length ? investedNames.join(', ') : tr('nenhum item investido', 'no invested item')}>
          <InvestPips used={eq.invested} />
        </Gauge>
      </Box>

      <Collapse in={moneyOpen} unmountOnExit>
        <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
          <SectionHead note={tr(`total ${formatGp(eq.money.start)}`, `total ${formatGp(eq.money.start)}`)}>{tr('Moedas', 'Coins')}</SectionHead>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1 }}>
            {COINS.map((c) => (
              <TextField key={c} size="small" type="number" label={COIN_LABEL[c]} value={state.money[c]} disabled={!canEdit}
                onChange={(e) => setMoney(c, Number(e.target.value))} slotProps={{ htmlInput: { min: 0 } }} />
            ))}
          </Box>
          <Typography variant="caption" component="p" sx={{ color: ink.secondary }}>
            {level === 1 || !levelWealth
              ? tr(`Riqueza inicial no nível 1: ${STARTING_GOLD} po (Player Core pg. 10).`, `Starting wealth at level 1: ${STARTING_GOLD} gp (Player Core pg. 10).`)
              : tr(`Referência para o nível ${level}: ${levelWealth.lumpSum} po em dinheiro, ou itens + ${levelWealth.currency} po (${wealth?.source ?? 'GM Core'}).`,
                `Reference for level ${level}: ${levelWealth.lumpSum} gp lump sum, or items + ${levelWealth.currency} gp (${wealth?.source ?? 'GM Core'}).`)}
            {mesaRules?.wealth === 'free' ? tr(' A mesa usa riqueza livre.', ' The table uses free wealth.') : ''}
            {tr(' Comprado sai do dinheiro (item e runas); ganho não.', ' Bought comes out of the money (item and runes); given does not.')}
          </Typography>
          {canEdit && eq.money.start === 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {level === 1 && <Button size="small" variant="outlined" onClick={() => update((s) => ({ ...s, money: { pp: 0, gp: STARTING_GOLD, sp: 0, cp: 0 } }))}>{tr(`Começar com ${STARTING_GOLD} po`, `Start with ${STARTING_GOLD} gp`)}</Button>}
              {level > 1 && levelWealth && <Button size="small" variant="outlined" onClick={() => update((s) => ({ ...s, money: { pp: 0, gp: levelWealth.lumpSum, sp: 0, cp: 0 } }))}>{tr(`Usar a referência: ${levelWealth.lumpSum} po`, `Use the reference: ${levelWealth.lumpSum} gp`)}</Button>}
            </Box>
          )}
        </Box>
      </Collapse>

      {(eq.money.remaining < 0 || bulkTone !== 'ok' || eq.invested > 10) && (
        <Stack spacing={1}>
          {eq.money.remaining < 0 && (
            <Notice tone="error"><span><b>{tr(`Compras passam do dinheiro em ${formatGp(-eq.money.remaining)}.`, `Purchases exceed the money by ${formatGp(-eq.money.remaining)}.`)}</b>{' '}
              {tr('Marque como "Ganho" o que veio da mesa, ou lance mais moedas.', 'Mark what came from the table as "Given", or enter more coins.')}</span></Notice>
          )}
          {bulkTone !== 'ok' && (
            <Notice tone="warn">{eq.bulk.total > eq.bulk.max
              ? tr(`Volume ${eq.bulk.total} passa do máximo de ${eq.bulk.max} (Player Core pg. 269).`, `Bulk ${eq.bulk.total} is over the maximum of ${eq.bulk.max} (Player Core pg. 269).`)
              : tr(`Volume ${eq.bulk.total} acima de ${eq.bulk.encumberedAt}: sobrecarregado (desajeitado 1, −10 pés).`, `Bulk ${eq.bulk.total} over ${eq.bulk.encumberedAt}: encumbered (clumsy 1, −10 feet).`)}</Notice>
          )}
          {eq.invested > 10 && <Notice tone="warn">{tr(`${eq.invested} itens investidos; o limite é 10 (GM Core pg. 219).`, `${eq.invested} invested items; the limit is 10 (GM Core pg. 219).`)}</Notice>}
          <Box sx={{ fontSize: 12, color: ink.secondary }}>{tr('Nada aqui impede salvar ou aplicar na mesa.', 'Nothing here stops saving or applying to the table.')}</Box>
        </Stack>
      )}

      {eq.items.length === 0 ? (
        <Box sx={[cardSx, { p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1.5 }]}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: tint.gold, color: gold.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StrokeIcon d={ICON_PATH.bag} size={32} />
          </Box>
          <Box sx={{ font: `700 20px ${displayFont}` }}>{tr('A mochila está vazia', 'The pack is empty')}</Box>
          <Box sx={{ fontSize: 14, color: ink.secondary, maxWidth: 340 }}>
            {eq.money.start > 0
              ? tr(`Você tem ${formatGp(eq.money.remaining)} para gastar. Compre do catálogo ou marque o que ganhou na mesa.`, `You have ${formatGp(eq.money.remaining)} to spend. Buy from the catalog or mark what you got at the table.`)
              : level === 1
                ? tr(`No nível 1 são ${STARTING_GOLD} po para gastar. Compre do catálogo ou marque o que ganhou na mesa.`, `At level 1 you get ${STARTING_GOLD} gp to spend. Buy from the catalog or mark what you got at the table.`)
                : tr('Lance as moedas no medidor de dinheiro, compre do catálogo ou marque o que ganhou na mesa.', 'Enter the coins in the money gauge, buy from the catalog or mark what you got at the table.')}
          </Box>
          {canEdit && (
            <>
              <Button onClick={() => openCatalog()} startIcon={<StrokeIcon d={ICON_PATH.plus} size={16} />} sx={[goldButtonSx, { width: 260, maxWidth: 1 }]}>{tr('Abrir o catálogo', 'Open the catalog')}</Button>
              <Button size="small" onClick={() => openCatalog('custom')}>{tr('Item caseiro', 'Homebrew item')}</Button>
            </>
          )}
        </Box>
      ) : (
        <>
          {using.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Label>{tr('Em uso', 'In use')}</Label>
              <Box sx={{
                display: { xs: 'flex', sm: 'grid' }, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.25,
                overflowX: { xs: 'auto', sm: 'visible' }, mx: { xs: -1.5, sm: 0 }, px: { xs: 1.5, sm: 0 }, pb: { xs: 0.5, sm: 0 },
              }}>
                {using.map((it) => {
                  const kind = kindOf(it);
                  const strike = eq.strikes.find((s) => s.key === it.key);
                  const ac = eq.armor?.item.key === it.key ? compiled.stats.ac.total : null;
                  const shieldAc = it.base?.item?.shield;
                  const rw = relics.byItem.get(it.key)?.weapon;
                  const meta = rw ? tr(`Golpe ${signed(rw.attack)} · ${rw.dice}${rw.die}${rw.damageBonus ? signed(rw.damageBonus) : ''}`, `Strike ${signed(rw.attack)} · ${rw.dice}${rw.die}${rw.damageBonus ? signed(rw.damageBonus) : ''}`)
                    : strike ? tr(`Golpe ${signed(strike.attack)} · ${strike.dice}${strike.die}${strike.damageBonus ? signed(strike.damageBonus) : ''}`, `Strike ${signed(strike.attack)} · ${strike.dice}${strike.die}${strike.damageBonus ? signed(strike.damageBonus) : ''}`)
                    : ac !== null ? tr(`CA ${ac}${it.inv.runes?.resilient ? ` · salvaguardas +${it.inv.runes.resilient}` : ''}`, `AC ${ac}${it.inv.runes?.resilient ? ` · saves +${it.inv.runes.resilient}` : ''}`)
                      : shieldAc ? tr(`+${shieldAc.ac ?? 0} CA erguido · dureza ${shieldAc.hardness ?? '—'}`, `+${shieldAc.ac ?? 0} AC raised · hardness ${shieldAc.hardness ?? '—'}`) : '';
                  const on = benchKey === it.key;
                  return (
                    <ButtonBase key={it.key} onClick={() => setBenchKey(it.key)} data-view="" sx={{
                      flex: { xs: '0 0 170px', sm: 'initial' }, bgcolor: parchment.paper, border: `1px solid ${on ? greenInk.mid : rule}`, outline: on ? `1px solid ${greenInk.mid}` : 'none',
                      borderRadius: '8px', boxShadow: warmShadow, p: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.625, textAlign: 'left', minWidth: 0,
                    }}>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary }}>
                        <ItemGlyph kind={kind} size={20} />{USE_KICKER[kind] ?? ''}
                      </Box>
                      <Box component="span" sx={{ fontWeight: 700, fontSize: { xs: 14, sm: 15 }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{relics.byItem.get(it.key)?.relic.name ?? strike?.display ?? itemDisplayName(it)}</Box>
                      <Box component="span" sx={{ fontSize: { xs: 12, sm: 13 }, color: ink.secondary, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Sockets looks={socketsOf(it, kind, level)} />{meta}
                      </Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>
          )}

          <Box sx={[cardSx, { overflow: 'hidden' }]}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderBottom: `1px solid ${rule}`, flexWrap: 'wrap' }}>
              <Box component="h3" sx={{ m: 0, font: `700 15px ${displayFont}`, flex: 1, whiteSpace: 'nowrap' }}>
                {tr('Mochila', 'Pack')} <Box component="span" sx={{ font: '500 13px "Source Sans 3", sans-serif', color: ink.secondary }}>
                  · {tr(`${eq.items.length} ite${eq.items.length === 1 ? 'm' : 'ns'}`, `${eq.items.length} item${eq.items.length === 1 ? '' : 's'}`)}</Box>
              </Box>
              <Box sx={{ width: { xs: 1, sm: 240 }, order: { xs: 2, sm: 0 } }}>
                <Segmented label={tr('Agrupar', 'Group')} height={32} value={view} onChange={setView}
                  options={[{ value: 'kind', label: tr('Por tipo', 'By type') }, { value: 'place', label: tr('Onde está', 'Where it is') }]} />
              </Box>
              <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1, height: 40, width: 1, order: 3, px: 1.25, border: `1px solid ${rule}`, borderRadius: '6px' }}>
                <StrokeIcon d={ICON_PATH.search} size={16} sx={{ color: ink.secondary }} />
                <InputBase fullWidth value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Buscar na mochila', 'Search the pack')} inputProps={{ 'aria-label': tr('Buscar na mochila', 'Search the pack') }} sx={{ fontSize: 14 }} />
              </Box>
            </Box>
            {groups.map((g) => (
              <Box key={g.key}>
                <GroupBar title={g.title} count={g.items.length} right={g.value > 0 ? formatGp(g.value) : undefined} />
                {g.items.map((it) => {
                  const kind = kindOf(it);
                  const where = whereLabel(kind, it.inv);
                  const step = stacks(kind) && canEdit;
                  const each = it.qty > 1 && it.entry?.item?.price ? tr(`${formatGp(it.entry.item.price.gp)} cada`, `${formatGp(it.entry.item.price.gp)} each`) : null;
                  const meta = [
                    relics.byItem.has(it.key) ? itemDisplayName(it) : null,
                    itemLevel(it) !== undefined ? tr(`nível ${itemLevel(it)}`, `level ${itemLevel(it)}`) : null,
                    it.inv.acquired === 'given' ? tr('ganho', 'given') : each ?? (it.price + it.runePrice ? formatGp(it.price + it.runePrice) : null),
                    it.entry?.item?.bulk !== undefined ? tr(`volume ${formatBulk(it.entry.item.bulk)}`, `bulk ${formatBulk(it.entry.item.bulk)}`) : null,
                    !stacks(kind) && it.qty > 1 ? `×${it.qty}` : null,
                    it.inv.item.startsWith('custom:') ? tr('caseiro', 'homebrew') : null,
                    !it.entry && !it.inv.item.startsWith('custom:') ? tr('fora do catálogo', 'not in catalog') : null,
                  ].filter(Boolean).join(' · ');
                  const on = benchKey === it.key;
                  return (
                    <Box key={it.key} sx={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${rule}`, bgcolor: on ? tint.green : 'transparent', boxShadow: on ? `inset 3px 0 0 ${greenInk.mid}` : 'none' }}>
                      <ButtonBase onClick={() => setBenchKey(it.key)} data-view="" aria-label={tr(`Abrir ${itemDisplayName(it)} na bancada`, `Open ${itemDisplayName(it)} on the workbench`)} sx={{
                        flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', gap: 1.5, alignItems: 'center', textAlign: 'left',
                        pl: 1.5, pr: step ? 0.5 : 1, py: 1.125, minHeight: 62, justifyContent: 'stretch',
                      }}>
                        <ItemGlyph kind={kind} />
                        <Box component="span" sx={{ minWidth: 0 }}>
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontWeight: 600, fontSize: 15, lineHeight: 1.25 }}>
                            <Box component="span" sx={{ overflowWrap: 'anywhere' }}>{relics.byItem.get(it.key)?.relic.name ?? itemDisplayName(it)}</Box>
                            {(it.inv.relic || relics.byItem.has(it.key)) && <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: gold.deep, border: `1px solid ${gold.main}`, borderRadius: '4px', px: 0.625, lineHeight: '18px' }}>{tr('Relíquia', 'Relic')}</Box>}
                            <Sockets looks={socketsOf(it, kind, level)} />
                          </Box>
                          <Box component="span" sx={{ display: 'block', fontSize: 13, color: ink.secondary, mt: '2px' }}>{meta}</Box>
                          <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {bagTraits.get(it.key)?.map((t) => <ContentBadge key={t} kind="trait">{traitText(t)}</ContentBadge>)}
                          </Box>
                        </Box>
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {where && <Box component="span" sx={{ display: { xs: step ? 'none' : 'inline-flex', sm: 'inline-flex' } }}><WherePill text={where.text} tone={where.tone} /></Box>}
                          {!step && <StrokeIcon d={ICON_PATH.chevron} size={16} sx={{ color: ink.secondary }} />}
                        </Box>
                      </ButtonBase>
                      {step && <Box sx={{ pr: 1.25 }}><Stepper label={tr(`Quantidade de ${it.name}`, `${it.name} quantity`)} value={it.qty} min={1} onChange={(n) => patch(it.key, { qty: n })} /></Box>}
                    </Box>
                  );
                })}
              </Box>
            ))}
            {groups.length === 0 && <Box sx={{ p: 2, fontSize: 14, color: ink.secondary }}>{tr('Nada na mochila com essa busca.', 'Nothing in the pack for this search.')}</Box>}
          </Box>
        </>
      )}

      {relics.loose.length > 0 && (
        <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
          <SectionHead note={tr('do catálogo da Ficha', "from the Sheet's catalog")}>{tr('Relíquias', 'Relics')}</SectionHead>
          {relics.loose.map((v) => <Box key={v.relic.id}>
            <RelicPanel view={v} />
            {canEdit && <Button onClick={() => {
              const key = newInventoryKey();
              setInventory((inv) => [...inv, { key, item: customItemId(v.relic.name), customName: v.relic.name, qty: 1, acquired: 'given',
                relic: { legacyId: v.relic.id, aspects: v.relic.aspects ?? [], gifts: {} } }]);
              setBenchKey(key);
            }}>{tr('Editar na mochila', 'Edit in pack')}</Button>}
          </Box>)}
        </Box>
      )}

      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead note={tr('calculados das armas', 'from the weapons')}>{tr('Golpes', 'Strikes')}</SectionHead>
        {eq.strikes.map((raw) => {
          const rv = relics.byItem.get(raw.key);
          // Arma de relíquia: o golpe como a Ficha mostra, com as runas das dádivas e da regra da mesa.
          const s = rv?.weapon ? { ...raw, display: rv.relic.name, attack: rv.weapon.attack, damageBonus: rv.weapon.damageBonus, dice: rv.weapon.dice } : raw;
          return (
          <ButtonBase key={s.key} disabled={s.key === 'fist'} onClick={() => setBenchKey(s.key)} data-view="" sx={{ display: 'flex', gap: 1.25, alignItems: 'center', textAlign: 'left', justifyContent: 'flex-start', borderRadius: '6px', py: 0.5, '&.Mui-disabled': { opacity: 1 } }}>
            <ActionGlyph actions="1" />
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Box component="b" sx={{ overflowWrap: 'anywhere' }}>{s.display}</Box>
              <Box component="span" sx={{ fontSize: 12, color: ink.secondary }} title={s.damageParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}>
                {s.dice}{s.die}{s.damageBonus ? signed(s.damageBonus) : ''} {s.damageType}{(rv?.weapon?.extraDamage ?? s.extraDamage).length ? ` + ${(rv?.weapon?.extraDamage ?? s.extraDamage).join(' + ')}` : ''}{s.traits.length ? ` · ${s.traits.map(traitText).join(', ')}` : ''}</Box>
            </Box>
            <Box component="b" sx={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }} title={s.attackParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}>{signed(s.attack)}</Box>
            <Box component="span" sx={{ fontSize: 13, color: ink.secondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {(s.traits.some((t) => /^agile$/i.test(t)) ? [4, 8] : [5, 10]).map((m) => signed(s.attack - m)).join(' / ')}</Box>
          </ButtonBase>
          );
        })}
        {eq.strikes.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nenhuma arma ainda.', 'No weapon yet.')}</Box>}
      </Box>

      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead>{tr('Livro de fórmulas', 'Formula book')}</SectionHead>
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {state.formulas.map((id) => (
            <Chip key={id} size="small" label={items.find((e) => e.id === id)?.name ?? id}
              onDelete={canEdit ? () => update((s) => ({ ...s, formulas: s.formulas.filter((x) => x !== id) })) : undefined} />
          ))}
          {canEdit && <Pill look="add" onClick={() => setFormulaOpen(true)}>{tr('+ Adicionar', '+ Add')}</Pill>}
        </Stack>
      </Box>

      {canEdit && (
        <ButtonBase onClick={() => openCatalog()} data-view="" aria-label={tr('Adicionar item', 'Add item')} sx={{
          display: { xs: 'flex', md: 'none' }, position: 'fixed', right: 16, bottom: 'calc(var(--tabbar-h) + 72px)', zIndex: 1049,
          height: 52, px: 2.25, gap: 1, borderRadius: 26, bgcolor: gold.bright, color: green.deepest, border: `1px solid ${gold.main}`,
          fontWeight: 700, fontSize: 15, boxShadow: '0 8px 20px #00000040',
        }}>
          <StrokeIcon d={ICON_PATH.plus} size={20} />{tr('Adicionar', 'Add')}
        </ButtonBase>
      )}

      <Drawer anchor="right" open={!!bench} onClose={() => setBenchKey(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, maxWidth: '100%', bgcolor: parchment.paper } } }}>
        {bench && (
          <ItemBench item={bench} compiled={compiled} index={index} materials={materials} canEdit={canEdit}
            containers={containers}
            transferTargets={eq.items.filter((o) => o.key !== bench.key && kindOf(o) === kindOf(bench))}
            patch={(p) => patch(bench.key, p)}
            onEtch={() => setEtchFor(bench.key)}
            onRemoveRune={(i) => patch(bench.key, { runes: { ...bench.inv.runes, property: (bench.inv.runes?.property ?? []).filter((_, j) => j !== i) } })}
            onTransfer={(to) => transfer(bench.key, to)}
            onDuplicate={() => duplicate(bench.key)}
            onRemove={() => remove(bench.key)}
            onClose={() => setBenchKey(null)} relic={relics.byItem.get(bench.key)} />
        )}
      </Drawer>

      <RunePicker open={!!etchItem} item={etchItem} runes={etchRunes} level={level} mesaRules={mesaRules} onClose={() => setEtchFor(null)}
        onPick={(id) => etchItem && patch(etchItem.key, { runes: { ...etchItem.inv.runes, property: [...(etchItem.inv.runes?.property ?? []), id] } })} />

      {catalog && (
        <ItemCatalog open startTab={catalog} entries={catalogList} level={level} remaining={eq.money.remaining} mesaRules={mesaRules}
          containers={containers} loading={loadingItems} onAdd={addLines} onAddCustom={addCustom} onClose={() => setCatalog(null)} />
      )}

      <ContentPicker open={formulaOpen} title={tr('Fórmula', 'Formula')} entries={catalogList}
        onPick={(id) => update((s) => ({ ...s, formulas: s.formulas.includes(id) ? s.formulas : [...s.formulas, id] }))}
        onClose={() => setFormulaOpen(false)} mesaRules={mesaRules}
        secondary={(e) => [e.level !== undefined ? tr(`nível ${e.level}`, `level ${e.level}`) : null, e.item?.price ? formatGp(e.item.price.gp) : null].filter(Boolean).join(' · ')} />
    </Stack>
  );
}
