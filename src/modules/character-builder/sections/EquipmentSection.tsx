import { useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, DeleteOutline as DeleteIcon, AutoFixHigh as RunesIcon } from '@mui/icons-material';
import { displayFont, greenInk, ink, parchment, rule, status } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { STARTING_GOLD, resilientName, strikingName } from '../engine/equipment';
import type { RuleEntry } from '../rules/types';
import type { BuildState, InventoryEntry } from '../types';
import { ActionGlyph, ContentBadge, Pill, SectionHead } from '../components/ui';
import { cardSx } from '../components/uiTokens';
import type { SectionProps } from './types';

const CATEGORY_LABEL: Record<string, string> = {
  weapons: tr('Armas', 'Weapons'), armor: tr('Armaduras', 'Armor'), shields: tr('Escudos', 'Shields'), worn: tr('Vestíveis', 'Worn'),
  held: tr('Empunhados', 'Held'), consumables: tr('Consumíveis', 'Consumables'), gear: tr('Equipamento', 'Gear'),
  'staves-wands': tr('Cajados e varinhas', 'Staves and wands'), runes: tr('Runas', 'Runes'), materials: tr('Materiais', 'Materials'),
  relics: tr('Relíquias', 'Relics'),
};
const COINS: (keyof BuildState['money'])[] = ['pp', 'gp', 'sp', 'cp']; // i18n-ok: chaves do dinheiro
const COIN_LABEL: Record<string, string> = {
  pp: tr('PL (platina)', 'pp'), gp: tr('PO (ouro)', 'gp'), sp: tr('PP (prata)', 'sp'), cp: tr('PC (cobre)', 'cp'),
};

export interface EquipmentProps extends SectionProps {
  /** Todas as entradas carregadas (itens e companheiros entre elas). */
  entries: RuleEntry[];
  wealth?: { levels: Record<string, { currency: number; lumpSum: number }>; source?: string };
}

let seq = 0;
const newKey = () => `inv-${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Aba Equipamento (UX §1.2): dinheiro e riqueza inicial, volume e investidos, inventário com runas e os golpes que saem
 * dele; abaixo, companheiros e o livro de fórmulas.
 */
export function EquipmentSection({ state, update, compiled, canEdit, mesaRules, entries, wealth }: EquipmentProps) {
  const [category, setCategory] = useState('weapons');
  const [picking, setPicking] = useState<'item' | 'formula' | 'rune' | null>(null);
  const [runesFor, setRunesFor] = useState<string | null>(null);
  const eq = compiled.equipment;

  const items = useMemo(() => entries.filter((e) => e.item), [entries]);
  const inCategory = useMemo(() => items.filter((e) => {
    const c = (e.item?.category ?? '').toLowerCase();
    const map: Record<string, (c: string, e: RuleEntry) => boolean> = {
      weapons: (c) => c.startsWith('weapon'), armor: (c) => c.startsWith('armor'), shields: (c) => c.startsWith('shield'),
      worn: (c) => c.startsWith('worn'), held: (c) => c.startsWith('held'), consumables: (c) => /consumable|alchemical|potion|scroll|talisman|oil|ammunition|snare|bomb/.test(c),
      gear: (c) => /adventuring gear|gear|tool|kit|clothing|container|services|animals/.test(c), 'staves-wands': (c) => /staff|staves|wand/.test(c),
      runes: (c) => c.startsWith('rune'), materials: (c) => c.startsWith('material'), relics: (c) => c.startsWith('relic'),
    };
    return (map[category] ?? (() => true))(c, e);
  }), [items, category]);

  const setInventory = (fn: (inv: InventoryEntry[]) => InventoryEntry[]) => update((s) => ({ ...s, inventory: fn(s.inventory) }));
  const patch = (key: string, p: Partial<InventoryEntry>) => setInventory((inv) => inv.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const addItem = (id: string) => setInventory((inv) => [...inv, { key: newKey(), item: id, qty: 1, acquired: 'bought' }]);
  const remove = (key: string) => setInventory((inv) => inv.filter((i) => i.key !== key));
  const setMoney = (coin: keyof BuildState['money'], value: number) => update((s) => ({ ...s, money: { ...s.money, [coin]: Math.max(0, Math.floor(value) || 0) } }));

  const levelWealth = wealth?.levels[String(compiled.level)];
  const runesItem = runesFor ? state.inventory.find((i) => i.key === runesFor) : undefined;
  const runesBase = runesFor ? eq.items.find((i) => i.key === runesFor)?.base : undefined;
  const isWeapon = !!runesBase?.item?.weapon;
  const setRunes = (p: Partial<NonNullable<InventoryEntry['runes']>>) => runesItem && patch(runesItem.key, { runes: { ...(runesItem.runes ?? {}), ...p } });

  return (
    <Stack spacing={2}>
      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead note={levelWealth && compiled.level > 1 ? tr(`referência do nível: ${levelWealth.lumpSum.toLocaleString(locale)} po`, `level reference: ${levelWealth.lumpSum.toLocaleString(locale)} gp`) : undefined}>
          {tr('Dinheiro', 'Money')}</SectionHead>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Box component="b" sx={{ font: `700 26px ${displayFont}`, fontVariantNumeric: 'tabular-nums', color: eq.money.remaining < 0 ? status.error : ink.primary }}>
            {tr(`${eq.money.remaining.toLocaleString(locale)} po`, `${eq.money.remaining.toLocaleString(locale)} gp`)}</Box>
          <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>
            {tr(`livres · ${eq.money.spent.toLocaleString(locale)} po em itens`, `left · ${eq.money.spent.toLocaleString(locale)} gp in items`)}</Box>
        </Box>
        {eq.money.start > 0 && (
          <Box role="progressbar" aria-valuenow={Math.round(100 * Math.min(1, eq.money.spent / eq.money.start))} aria-valuemin={0} aria-valuemax={100}
            aria-label={tr('Dinheiro gasto', 'Money spent')} sx={{ height: 8, borderRadius: 999, bgcolor: parchment.sunken, overflow: 'hidden' }}>
            <Box sx={{ height: 1, width: `${Math.round(100 * Math.min(1, eq.money.spent / eq.money.start))}%`, bgcolor: eq.money.remaining < 0 ? status.error : greenInk.mid, borderRadius: 999 }} />
          </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, mt: 0.5 }}>
          {COINS.map((c) => (
            <TextField key={c} size="small" type="number" label={COIN_LABEL[c]} value={state.money[c]} disabled={!canEdit}
              onChange={(e) => setMoney(c, Number(e.target.value))} slotProps={{ htmlInput: { min: 0 } }} />
          ))}
        </Box>
        <Typography variant="body2" color={eq.money.remaining < 0 ? 'error.main' : 'text.secondary'}>
          {tr(`Total ${eq.money.start.toLocaleString(locale)} po · compras ${eq.money.spent.toLocaleString(locale)} po · sobra ${eq.money.remaining.toLocaleString(locale)} po`,
            `Total ${eq.money.start.toLocaleString(locale)} gp · purchases ${eq.money.spent.toLocaleString(locale)} gp · left ${eq.money.remaining.toLocaleString(locale)} gp`)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {compiled.level === 1 || !levelWealth
            ? tr(`Riqueza inicial no nível 1: ${STARTING_GOLD} po (Player Core pg. 10).`, `Starting wealth at level 1: ${STARTING_GOLD} gp (Player Core pg. 10).`)
            : tr(`Referência para o nível ${compiled.level}: ${levelWealth.lumpSum} po em dinheiro, ou itens + ${levelWealth.currency} po (${wealth?.source ?? 'GM Core'}).`,
              `Reference for level ${compiled.level}: ${levelWealth.lumpSum} gp lump sum, or items + ${levelWealth.currency} gp (${wealth?.source ?? 'GM Core'}).`)}
          {mesaRules?.wealth === 'free' ? tr(' A mesa usa riqueza livre.', ' The table uses free wealth.') : ''}
        </Typography>
        {canEdit && compiled.level === 1 && eq.money.start === 0 && (
          <Button size="small" sx={{ mt: 1 }} onClick={() => update((s) => ({ ...s, money: { pp: 0, gp: STARTING_GOLD, sp: 0, cp: 0 } }))}>
            {tr(`Começar com ${STARTING_GOLD} po`, `Start with ${STARTING_GOLD} gp`)}</Button>
        )}
      </Box>

      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 } }]}>
        <Box sx={{ mb: 1 }}>
          <SectionHead note={<Box component="span" sx={{ color: eq.bulk.total > eq.bulk.encumberedAt ? status.warning : 'inherit' }}>
            {tr(`Volume ${eq.bulk.total} / ${eq.bulk.encumberedAt} (máx. ${eq.bulk.max}) · investidos ${eq.invested}/10`, `Bulk ${eq.bulk.total} / ${eq.bulk.encumberedAt} (max ${eq.bulk.max}) · invested ${eq.invested}/10`)}
          </Box>}>{tr('Inventário', 'Inventory')}</SectionHead>
        </Box>
        <Stack spacing={1}>
          {eq.items.map((it) => {
            const inv = it.inv;
            const runic = !!(it.base?.item?.weapon || it.base?.item?.armor);
            const runeText = [inv.runes?.potency ? `+${inv.runes.potency}` : '', inv.runes?.striking ? strikingName(inv.runes.striking) : '', inv.runes?.resilient ? resilientName(inv.runes.resilient) : '']
              .filter(Boolean).join(' ');
            return (
              <Box key={it.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', borderTop: `1px solid ${rule}`, pt: 1 }}>
                <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box component="span" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{runeText ? `${runeText} ${it.name}` : it.name}</Box>
                    {inv.worn && <ContentBadge kind="trait">{it.base?.item?.armor ? tr('vestido', 'worn') : tr('em uso', 'in use')}</ContentBadge>}
                    {inv.invested && <ContentBadge kind="trait">{tr('investido', 'invested')}</ContentBadge>}
                    {it.entry?.homebrew && <ContentBadge kind="mesa" />}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {[it.entry?.level !== undefined ? tr(`nível ${it.entry.level}`, `level ${it.entry.level}`) : null, it.price ? tr(`${it.price} po`, `${it.price} gp`) : null, it.bulk ? tr(`volume ${it.bulk}`, `bulk ${it.bulk}`) : null].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <TextField size="small" type="number" label={tr('Qtd', 'Qty')} value={inv.qty} disabled={!canEdit} sx={{ width: 76 }}
                  onChange={(e) => patch(it.key, { qty: Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
                <TextField size="small" select label={tr('Origem', 'Source')} value={inv.acquired} disabled={!canEdit} sx={{ width: 120 }}
                  onChange={(e) => patch(it.key, { acquired: e.target.value === 'given' ? 'given' : 'bought' })}>
                  <MenuItem value="bought">{tr('Comprado', 'Bought')}</MenuItem>
                  <MenuItem value="given">{tr('Ganho', 'Given')}</MenuItem>
                </TextField>
                <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                  {(it.base?.item?.armor || it.base?.item?.shield || it.entry?.item?.usage?.startsWith('worn')) && (
                    <Chip size="small" label={tr('Vestido', 'Worn')} color={inv.worn ? 'primary' : 'default'} variant={inv.worn ? 'filled' : 'outlined'}
                      onClick={canEdit ? () => patch(it.key, { worn: !inv.worn }) : undefined} />
                  )}
                  {(it.entry?.traits ?? []).includes('Invested') && (
                    <Chip size="small" label={tr('Investido', 'Invested')} color={inv.invested ? 'primary' : 'default'} variant={inv.invested ? 'filled' : 'outlined'}
                      onClick={canEdit ? () => patch(it.key, { invested: !inv.invested }) : undefined} />
                  )}
                </Stack>
                {runic && canEdit && <IconButton aria-label={tr('Runas', 'Runes')} title={tr('Runas', 'Runes')} onClick={() => setRunesFor(it.key)}><RunesIcon /></IconButton>}
                {canEdit && <IconButton aria-label={tr('Remover', 'Remove')} title={tr('Remover', 'Remove')} onClick={() => remove(it.key)}><DeleteIcon /></IconButton>}
              </Box>
            );
          })}
          {eq.items.length === 0 && <Typography variant="body2" color="text.secondary">{tr('Nenhum item ainda.', 'No items yet.')}</Typography>}
        </Stack>
        {canEdit && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
            <TextField select size="small" label={tr('Categoria', 'Category')} value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 200 }}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setPicking('item')} disabled={!items.length}>
              {items.length ? tr('Adicionar item', 'Add item') : tr('Carregando itens…', 'Loading items…')}</Button>
            <TextField size="small" label={tr('Item caseiro (nome)', 'Homebrew item (name)')} sx={{ minWidth: 180 }}
              slotProps={{ htmlInput: { maxLength: 80 } }}
              onKeyDown={(e) => {
                const input = e.target as HTMLInputElement;
                if (e.key !== 'Enter' || !input.value.trim()) return;
                const name = input.value.trim();
                const id = `custom:${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'}`;
                setInventory((inv) => [...inv, { key: newKey(), item: id, qty: 1, acquired: 'given', customName: name }]);
                input.value = '';
              }}
              helperText={tr('Enter para adicionar; não entra nos números.', 'Enter to add; not in the numbers.')} />
          </Stack>
        )}
      </Box>

      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead note={tr('calculados das armas', 'from the weapons')}>{tr('Golpes', 'Strikes')}</SectionHead>
        {eq.strikes.map((s) => (
          <Box key={s.key} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <ActionGlyph actions="1" />
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Box component="b" sx={{ overflowWrap: 'anywhere' }}>{s.display}</Box>
              <Box component="span" sx={{ fontSize: 12, color: ink.secondary }} title={s.damageParts.map((p) => `${p.label} ${p.value >= 0 ? '+' : ''}${p.value}`).join(' · ')}>
                {s.dice}{s.die}{s.damageBonus ? `${s.damageBonus > 0 ? '+' : ''}${s.damageBonus}` : ''} {s.damageType}{s.traits.length ? ` · ${s.traits.slice(0, 3).join(', ')}` : ''}</Box>
            </Box>
            <Box component="b" sx={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }} title={s.attackParts.map((p) => `${p.label} ${p.value >= 0 ? '+' : ''}${p.value}`).join(' · ')}>
              {s.attack >= 0 ? '+' : ''}{s.attack}</Box>
            <Box component="span" sx={{ fontSize: 13, color: ink.secondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {(s.traits.some((t) => /^agile$/i.test(t)) ? [4, 8] : [5, 10]).map((m) => `${s.attack - m >= 0 ? '+' : ''}${s.attack - m}`).join(' / ')}</Box>
          </Box>
        ))}
        {eq.strikes.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nenhuma arma ainda.', 'No weapon yet.')}</Box>}
      </Box>

      <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead>{tr('Livro de fórmulas', 'Formula book')}</SectionHead>
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {state.formulas.map((id) => (
            <Chip key={id} size="small" label={items.find((e) => e.id === id)?.name ?? id}
              onDelete={canEdit ? () => update((s) => ({ ...s, formulas: s.formulas.filter((x) => x !== id) })) : undefined} />
          ))}
          {canEdit && <Pill look="add" onClick={() => setPicking('formula')}>{tr('+ Adicionar', '+ Add')}</Pill>}
        </Stack>
      </Box>

      <ContentPicker open={picking === 'item' || picking === 'formula'} title={picking === 'formula' ? tr('Fórmula', 'Formula') : CATEGORY_LABEL[category]}
        entries={picking === 'formula' ? items : inCategory}
        onPick={(id) => (picking === 'formula' ? update((s) => ({ ...s, formulas: s.formulas.includes(id) ? s.formulas : [...s.formulas, id] })) : addItem(id))}
        onClose={() => setPicking(null)} mesaRules={mesaRules}
        secondary={(e) => [e.level !== undefined ? tr(`nível ${e.level}`, `level ${e.level}`) : null, e.item?.price ? tr(`${e.item.price.gp} po`, `${e.item.price.gp} gp`) : null].filter(Boolean).join(' · ')} />
      <ContentPicker open={picking === 'rune'} title={tr('Runa de propriedade', 'Property rune')}
        entries={items.filter((e) => /property rune/i.test(e.item?.subcategory ?? '') && (isWeapon ? /weapon/i.test(e.item?.subcategory ?? '') : /armor/i.test(e.item?.subcategory ?? '')))}
        onPick={(id) => setRunes({ property: [...(runesItem?.runes?.property ?? []), id] })} onClose={() => setPicking(null)} mesaRules={mesaRules} />

      <Dialog open={!!runesItem && picking !== 'rune'} onClose={() => setRunesFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('Runas', 'Runes')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField select size="small" label={tr('Potência', 'Potency')} value={runesItem?.runes?.potency ?? 0} onChange={(e) => setRunes({ potency: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((n) => <MenuItem key={n} value={n}>{n ? `+${n}` : '—'}</MenuItem>)}
            </TextField>
            {isWeapon ? (
              <TextField select size="small" label="Striking" value={runesItem?.runes?.striking ?? 0} onChange={(e) => setRunes({ striking: Number(e.target.value) })}>
                {[0, 1, 2, 3].map((n) => <MenuItem key={n} value={n}>{strikingName(n) || '—'}</MenuItem>)}
              </TextField>
            ) : (
              <TextField select size="small" label={tr('Resiliente', 'Resilient')} value={runesItem?.runes?.resilient ?? 0} onChange={(e) => setRunes({ resilient: Number(e.target.value) })}>
                {[0, 1, 2, 3].map((n) => <MenuItem key={n} value={n}>{resilientName(n) || '—'}</MenuItem>)}
              </TextField>
            )}
            <Typography variant="body2" color="text.secondary">
              {tr(`Runas de propriedade: até ${runesItem?.runes?.potency ?? 0} (uma por ponto de potência, GM Core pg. 226 e 236).`, `Property runes: up to ${runesItem?.runes?.potency ?? 0} (one per potency point, GM Core pg. 226 and 236).`)}
            </Typography>
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {(runesItem?.runes?.property ?? []).map((id, i) => (
                <Chip key={`${id}-${i}`} size="small" label={items.find((e) => e.id === id)?.name ?? id}
                  onDelete={() => setRunes({ property: (runesItem?.runes?.property ?? []).filter((_, j) => j !== i) })} />
              ))}
              <Chip size="small" icon={<AddIcon />} label={tr('Adicionar', 'Add')} variant="outlined" onClick={() => setPicking('rune')} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setRunesFor(null)}>{tr('Fechar', 'Close')}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
