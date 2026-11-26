import { useState, type ReactNode } from 'react';
import { Box, Button, ButtonBase, Collapse, IconButton, Menu, MenuItem, TextField } from '@mui/material';
import { displayFont, gold, greenInk, ink, parchment, rule, status } from '../../../theme';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { AttributeKey, Compiled, RulesIndex } from '../engine/types';
import type { InventoryEntry } from '../types';
import { FUNDAMENTAL_TIERS, fundamentalRune, type FundamentalKind, type ResolvedItem, type RuneLine } from '../engine/equipment';
import { useTraitLabels } from '../../character-viewer/components/useTraitLabels';
import { ActionGlyph, BandHead, ContentBadge, Label } from './ui';
import { RelicPanel } from './RelicPanel';
import { relicRuneLabel, type RelicView } from './relicView';
import { signed, tint } from './uiTokens';
import { Gem, ItemGlyph, Segmented, Stepper, StrokeIcon, TierPicker, type TierOption } from './equipUi';
import {
  canUse, formatBulk, handsText, itemDisplayName, itemLevel, itemTraits, formatGp, ICON_PATH, inUse, isInvestable, isRunic, itemKind, USE_LABEL, patchForUse, type ItemKind,
} from './equipmentModel';

const TIER_LABEL: Record<FundamentalKind, string[]> = {
  potency: ['—', '+1', '+2', '+3'],
  armorPotency: ['—', '+1', '+2', '+3'],
  striking: ['—', 'Striking', tr('Maior', 'Greater'), tr('Superior', 'Major')],
  resilient: ['—', tr('Resiliente', 'Resilient'), tr('Maior', 'Greater'), tr('Superior', 'Major')],
  reinforcing: ['—', tr('Mínimo', 'Minor'), tr('Menor', 'Lesser'), tr('Moderado', 'Moderate'), tr('Maior', 'Greater'), tr('Superior', 'Major'), tr('Supremo', 'Supreme')],
};

const ATTR: { value: AttributeKey | ''; label: string }[] = [
  { value: '', label: tr('Automático', 'Automatic') }, { value: 'str', label: tr('Força', 'Strength') }, { value: 'dex', label: tr('Destreza', 'Dexterity') },
];

export interface ItemBenchProps {
  item: ResolvedItem;
  compiled: Compiled;
  index: RulesIndex;
  /** Materiais preciosos do catálogo (os grupos, sem as barras e lingotes). */
  materials: RuleEntry[];
  /** Contêineres da mochila (onde guardar). */
  containers: ResolvedItem[];
  /** Itens do mesmo tipo que podem receber as runas. */
  transferTargets: ResolvedItem[];
  canEdit: boolean;
  patch: (p: Partial<InventoryEntry>) => void;
  onEtch: () => void;
  onRemoveRune: (index: number) => void;
  onTransfer: (targetKey: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
  /** A relíquia que mora neste item (catálogo da Ficha), com o golpe como a Ficha mostra. */
  relic?: RelicView;
}

/**
 * Bancada do item (redesign): onde ele está, as runas fundamentais em degraus com nível e preço do catálogo, os encaixes
 * de propriedade (um por ponto de potência, GM Core pg. 224), material, ajustes do golpe, o golpe ou a CA calculados na
 * hora e o custo com Comprado/Ganho. Acima do nível do personagem vira ⚠, nunca trava.
 */
export function ItemBench({ item, compiled, index, materials, containers, transferTargets, canEdit, patch, onEtch, onRemoveRune, onTransfer, onDuplicate, onRemove, onClose, relic }: ItemBenchProps) {
  const [tune, setTune] = useState(false);
  const [transferAnchor, setTransferAnchor] = useState<HTMLElement | null>(null);
  const inv = item.inv;
  const entry = item.entry;
  const kind: ItemKind = itemKind(entry, item.base, inv);
  const runic = isRunic(kind);
  const level = compiled.level;
  const strike = compiled.equipment.strikes.find((s) => s.key === item.key);
  const wornArmor = compiled.equipment.armor?.item.key === item.key;
  const runes = inv.runes ?? {};
  const setRunes = (p: Partial<NonNullable<InventoryEntry['runes']>>) => patch({ runes: { ...runes, ...p } });

  const tiers = (kind2: FundamentalKind): TierOption[] => Array.from({ length: FUNDAMENTAL_TIERS(kind2) + 1 }, (_, t) => {
    if (!t) return { tier: 0, label: '—', sub: tr('sem runa', 'no rune') };
    const e = fundamentalRune(index, kind2, t);
    const lv = e?.level;
    const high = lv !== undefined && lv > level;
    const price = e?.item?.price ? formatGp(e.item.price.gp) : tr('fora do catálogo', 'not in catalog');
    return { tier: t, label: TIER_LABEL[kind2][t], sub: high ? tr(`⚠ nív. ${lv}`, `⚠ lv. ${lv}`) : lv !== undefined ? tr(`nív. ${lv} · ${price}`, `lv. ${lv} · ${price}`) : price, high };
  });

  const potencyKind: FundamentalKind = kind === 'armor' ? 'armorPotency' : 'potency';
  const potency = runes.potency ?? 0;
  const property = runes.property ?? [];
  const slots = kind === 'shield' ? 0 : potency;
  const propertyLines = item.runes.filter((r) => r.kind === 'property');
  const traits = itemTraits(entry, item.base, inv.weapon?.extraTraits);
  const traitText = useTraitLabels(traits);
  const lvl = itemLevel(item);
  const w = item.base?.item?.weapon;
  const a = item.base?.item?.armor;
  const meta = [
    w ? [w.category, w.group].filter(Boolean).join(' · ') : a ? [a.category, a.group].filter(Boolean).join(' · ') : entry?.item?.category,
    entry?.item?.hands ? handsText(entry.item.hands) : null,
    tr(`volume ${formatBulk(entry?.item?.bulk)}`, `bulk ${formatBulk(entry?.item?.bulk)}`),
    lvl !== undefined ? tr(`nível ${lvl}`, `level ${lvl}`) : null,
  ].filter(Boolean).join(' · ');
  const use = USE_LABEL(kind);
  const unknownPrice = item.runes.some((r) => !r.known);
  const runeMeta = (r: RuneLine) => [r.level !== undefined ? tr(`nível ${r.level}`, `level ${r.level}`) : null, r.known ? formatGp(r.price) : tr('preço fora do catálogo', 'price not in catalog')].filter(Boolean).join(' · ');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: 1, bgcolor: parchment.paper }}>
      <BandHead right={
        <IconButton size="small" aria-label={tr('Fechar a bancada', 'Close the workbench')} onClick={onClose} sx={{ color: 'inherit' }}>
          <StrokeIcon d={ICON_PATH.close} size={18} />
        </IconButton>
      }>{tr('Bancada', 'Workbench')}</BandHead>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 1.75, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <ItemGlyph kind={kind} size={48} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box component="h2" sx={{ m: 0, font: `700 18px/1.2 ${displayFont}`, overflowWrap: 'anywhere' }}>{relic?.relic.name ?? strike?.display ?? itemDisplayName(item)}</Box>
            <Box sx={{ fontSize: 13, color: ink.secondary, mt: 0.25 }}>{relic ? tr(`Relíquia — ${itemDisplayName(item)} · `, `Relic — ${itemDisplayName(item)} · `) : ''}{meta}</Box>
          </Box>
        </Box>
        {(traits.length > 0 || entry?.homebrew || entry?.rarity && entry.rarity !== 'common') && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(entry?.rarity === 'uncommon' || entry?.rarity === 'rare' || entry?.rarity === 'unique') && <ContentBadge kind={entry.rarity} />}
            {entry?.homebrew && <ContentBadge kind="mesa" />}
            {traits.map((t) => <ContentBadge key={t} kind="trait">{traitText(t)}</ContentBadge>)}
          </Box>
        )}
        {!entry && inv.item.startsWith('custom:') && (
          <Box sx={{ fontSize: 13, color: ink.secondary, bgcolor: tint.gold, borderRadius: '6px', p: 1.25 }}>
            {inv.custom
              ? tr('Item caseiro com os números da Ficha (dado, tipo e categoria); preço e volume não entram.', 'Homebrew item with the Sheet numbers (die, type and category); price and bulk are not in.')
              : tr('Item caseiro: preço, volume e efeitos não entram nos números.', 'Homebrew item: price, bulk and effects are not in the numbers.')}</Box>
        )}

        {relic && <RelicPanel view={relic} compact />}

        {canUse(kind, entry) && (
          <Segmented label={tr('Onde está', 'Where it is')} value={inUse(kind, inv) ? 'on' : 'off'} disabled={!canEdit}
            options={[{ value: 'on', label: use.on }, { value: 'off', label: use.off }]}
            onChange={(v) => patch(patchForUse(kind, v === 'on'))} />
        )}
        {isInvestable(entry) && (
          <Segmented label={tr('Investido', 'Invested')} value={inv.invested ? 'on' : 'off'} disabled={!canEdit}
            options={[{ value: 'on', label: tr('✦ Investido', '✦ Invested') }, { value: 'off', label: tr('Não investido', 'Not invested') }]}
            onChange={(v) => patch({ invested: v === 'on' })} />
        )}

        {runic && kind !== 'shield' && (
          <Field label={tr('Potência', 'Potency')} note={tr('+1 espaço de propriedade por ponto', '+1 property slot per point')}>
            <TierPicker label={tr('Potência', 'Potency')} value={potency} options={tiers(potencyKind)} disabled={!canEdit} onChange={(t) => setRunes({ potency: t })} />
          </Field>
        )}
        {kind === 'weapon' && (
          <Field label="Striking" note={tr('dados de dano', 'damage dice')}>
            <TierPicker label="Striking" value={runes.striking ?? 0} options={tiers('striking')} disabled={!canEdit} onChange={(t) => setRunes({ striking: t })} />
          </Field>
        )}
        {kind === 'armor' && (
          <Field label={tr('Resiliente', 'Resilient')} note={tr('bônus nas salvaguardas', 'bonus to saves')}>
            <TierPicker label={tr('Resiliente', 'Resilient')} value={runes.resilient ?? 0} options={tiers('resilient')} disabled={!canEdit} onChange={(t) => setRunes({ resilient: t })} />
          </Field>
        )}
        {kind === 'shield' && (
          <Field label={tr('Reforço', 'Reinforcing')} note={tr('escudo não leva runa de propriedade', "shields don't take property runes")}>
            <TierPicker label={tr('Reforço', 'Reinforcing')} value={runes.reinforcing ?? 0} options={tiers('reinforcing')} disabled={!canEdit} onChange={(t) => setRunes({ reinforcing: t })} />
          </Field>
        )}

        {runic && kind !== 'shield' && (
          <Field label={tr('Propriedade', 'Property')} note={
            <Box component="span" sx={{ color: property.length > slots ? status.warning : gold.deep, fontWeight: 700 }}>
              {property.length > slots ? '⚠ ' : ''}{tr(`${property.length} de ${slots} espaço${slots === 1 ? '' : 's'}`, `${property.length} of ${slots} slot${slots === 1 ? '' : 's'}`)}
            </Box>
          }>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {propertyLines.map((r, i) => (
                <Box key={`${r.id}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 6px 8px 10px', border: `1px solid ${i >= slots ? status.warning : rule}`, borderRadius: '8px', bgcolor: i >= slots ? tint.warn : parchment.paper, minHeight: 54 }}>
                  <Box sx={{ width: 28, display: 'flex', justifyContent: 'center' }}><Gem look={i >= slots ? 'x' : 'p'} size={16} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box component="b" sx={{ fontSize: 15 }}>{r.name}</Box>
                    <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>
                      {runeMeta(r)}{r.level !== undefined && r.level > level ? <Box component="span" sx={{ color: status.warning, fontWeight: 700 }}>{tr(' · ⚠ acima do nível', ' · ⚠ above level')}</Box> : null}
                      {i >= slots ? <Box component="span" sx={{ color: status.warning, fontWeight: 700 }}>{tr(' · sem espaço (dormente)', ' · no slot (dormant)')}</Box> : null}
                    </Box>
                  </Box>
                  {canEdit && (
                    <IconButton aria-label={tr(`Tirar ${r.name}`, `Remove ${r.name}`)} title={tr('Tirar a runa', 'Remove the rune')} onClick={() => onRemoveRune(i)}>
                      <StrokeIcon d={ICON_PATH.close} size={16} />
                    </IconButton>
                  )}
                </Box>
              ))}
              {relic?.runeGifts.filter((g) => g.gift.rune?.property?.length).map((g) => (
                <Box key={`relic-${g.gift.id}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 10px', border: `1px solid ${gold.main}`, borderRadius: '8px', bgcolor: tint.gold, minHeight: 54 }}>
                  <Box sx={{ width: 28, display: 'flex', justifyContent: 'center' }}><Gem look="f" size={16} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box component="b" sx={{ fontSize: 15 }}>{relicRuneLabel(g.gift.rune!)}</Box>
                    <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr('dádiva da relíquia · não ocupa espaço nem sai do dinheiro', 'relic gift · takes no slot and costs nothing')}</Box>
                  </Box>
                </Box>
              ))}
              {canEdit && Array.from({ length: Math.max(0, slots - property.length) }, (_, i) => (
                <ButtonBase key={`free-${i}`} onClick={onEtch} data-view="" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 10px', border: `1.5px dashed ${gold.main}`, borderRadius: '8px', bgcolor: tint.gold, minHeight: 54, justifyContent: 'flex-start', textAlign: 'left' }}>
                  <Box sx={{ width: 28, display: 'flex', justifyContent: 'center' }}><Gem look="e" size={16} /></Box>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box component="b" sx={{ fontSize: 15, color: gold.deep }}>{tr('Gravar runa', 'Etch a rune')}</Box>
                    <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr(`espaço livre · liberado pela potência +${potency}`, `free slot · from potency +${potency}`)}</Box>
                  </Box>
                  <StrokeIcon d={ICON_PATH.plus} sx={{ color: gold.deep }} />
                </ButtonBase>
              ))}
              {slots === 0 && property.length === 0 && (
                <Box sx={{ fontSize: 13, color: ink.secondary, p: 1.25, border: `1px dashed ${rule}`, borderRadius: '8px' }}>
                  {tr('Grave uma runa de potência para liberar o primeiro espaço.', 'Etch a potency rune to open the first slot.')}</Box>
              )}
            </Box>
          </Field>
        )}

        {(kind === 'weapon' || kind === 'armor' || kind === 'shield') && (
          <Box sx={{ display: 'grid', gridTemplateColumns: kind === 'weapon' ? 'repeat(auto-fit, minmax(150px, 1fr))' : '1fr', gap: 1 }}>
            <TextField select size="small" label={tr('Material', 'Material')} value={inv.material?.id ?? ''} disabled={!canEdit}
              onChange={(e) => patch({ material: e.target.value ? { id: e.target.value, grade: inv.material?.grade ?? 'standard' } : undefined })}
              helperText={inv.material ? tr('custo do material não somado', 'material cost not added') : undefined}>
              <MenuItem value="">{tr('Nenhum', 'None')}</MenuItem>
              {materials.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
            </TextField>
            {inv.material && (
              <TextField select size="small" label={tr('Grau', 'Grade')} value={inv.material.grade ?? 'standard'} disabled={!canEdit}
                onChange={(e) => patch({ material: { id: inv.material!.id, grade: e.target.value as 'low' | 'standard' | 'high' } })}>
                <MenuItem value="low">{tr('Baixo', 'Low')}</MenuItem>
                <MenuItem value="standard">{tr('Padrão', 'Standard')}</MenuItem>
                <MenuItem value="high">{tr('Alto', 'High')}</MenuItem>
              </TextField>
            )}
            {kind === 'weapon' && (
              <ButtonBase onClick={() => setTune((v) => !v)} aria-expanded={tune} data-view="" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 40, border: `1px solid ${rule}`, borderRadius: '6px', justifyContent: 'flex-start', textAlign: 'left' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Label>{tr('Ajustes do golpe', 'Strike tweaks')}</Label>
                  <Box component="span" sx={{ fontSize: 14 }}>{inv.weapon?.attackAttribute || inv.weapon?.overrides ? tr('Personalizado', 'Custom') : tr('Padrão', 'Default')}</Box>
                </Box>
                <StrokeIcon d={ICON_PATH.chevron} size={16} sx={{ transform: tune ? 'rotate(90deg)' : 'none', color: ink.secondary }} />
              </ButtonBase>
            )}
          </Box>
        )}
        {kind === 'weapon' && (
          <Collapse in={tune} unmountOnExit>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
              <TextField select size="small" label={tr('Atributo do ataque', 'Attack attribute')} value={inv.weapon?.attackAttribute ?? ''} disabled={!canEdit}
                onChange={(e) => patch({ weapon: { ...inv.weapon, attackAttribute: (e.target.value || undefined) as AttributeKey | undefined } })}>
                {ATTR.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              <OverrideField label={tr('Ataque à mão', 'Attack by hand')} value={inv.weapon?.overrides?.attack} disabled={!canEdit}
                onChange={(v) => patch({ weapon: { ...inv.weapon, overrides: { ...inv.weapon?.overrides, attack: v } } })} />
              <OverrideField label={tr('Bônus de dano à mão', 'Damage bonus by hand')} value={inv.weapon?.overrides?.damage} disabled={!canEdit}
                onChange={(v) => patch({ weapon: { ...inv.weapon, overrides: { ...inv.weapon?.overrides, damage: v } } })} />
            </Box>
          </Collapse>
        )}

        {relic?.weapon && (!strike || relic.weapon.attack !== strike.attack || relic.weapon.dice !== strike.dice || relic.weapon.damageBonus !== strike.damageBonus) && (
          <Box sx={{ bgcolor: tint.gold, border: `1px solid ${gold.main}`, borderRadius: '8px', p: '10px 12px', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <ActionGlyph actions="1" />
              <Box component="b" sx={{ flex: 1 }}>{tr('Golpe na Ficha (com a relíquia)', 'Strike on the Sheet (with the relic)')}</Box>
              <Box component="b" sx={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{signed(relic.weapon.attack)}</Box>
            </Box>
            <Box sx={{ fontSize: 13, color: ink.secondary }}>
              <Box component="b" sx={{ color: ink.primary }}>{relic.weapon.dice}{relic.weapon.die}{relic.weapon.damageBonus ? signed(relic.weapon.damageBonus) : ''}</Box>
              {relic.weapon.extraDamage.length > 0 && ` + ${relic.weapon.extraDamage.join(' + ')}`}
              {relic.weapon.runes.length > 0 && tr(` · runas: ${relic.weapon.runes.join(', ')}`, ` · runes: ${relic.weapon.runes.join(', ')}`)}
            </Box>
          </Box>
        )}
        {strike && (
          <Box sx={{ bgcolor: parchment.sunken, borderRadius: '8px', p: '10px 12px', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <ActionGlyph actions="1" />
              <Box component="b" sx={{ flex: 1 }}>{tr('Golpe', 'Strike')}</Box>
              <Box component="b" sx={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }} title={strike.attackParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}>{signed(strike.attack)}</Box>
              <Box component="span" sx={{ fontSize: 13, color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
                {(strike.traits.some((t) => /^agile$/i.test(t)) ? [4, 8] : [5, 10]).map((m) => signed(strike.attack - m)).join(' / ')}</Box>
            </Box>
            <Box sx={{ fontSize: 13, color: ink.secondary }}>
              {strike.attackParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')} — {tr('dano', 'damage')}{' '}
              <Box component="b" sx={{ color: ink.primary }}>{strike.dice}{strike.die}{strike.damageBonus ? signed(strike.damageBonus) : ''}</Box> {strike.damageType}
              {strike.extraDamage.length > 0 && <Box component="span" sx={{ color: ink.primary, fontWeight: 600 }}>{` + ${strike.extraDamage.join(' + ')}`}</Box>}
            </Box>
          </Box>
        )}
        {wornArmor && (
          <Box sx={{ bgcolor: parchment.sunken, borderRadius: '8px', p: '10px 12px', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box component="b" sx={{ flex: 1 }}>{tr('Classe de Armadura', 'Armor Class')}</Box>
            <Box component="b" sx={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }} title={compiled.stats.ac.parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}>{compiled.stats.ac.total}</Box>
            {(runes.resilient ?? 0) > 0 && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr(`salvaguardas +${runes.resilient}`, `saves +${runes.resilient}`)}</Box>}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Label sx={{ flex: 1 }}>{tr('Quantidade', 'Quantity')}</Label>
            <Stepper label={tr('Quantidade', 'Quantity')} value={inv.qty} min={0} disabled={!canEdit} onChange={(n) => patch({ qty: n })} />
          </Box>
          {containers.length > 0 && !inUse(kind, inv) && (
            <TextField select size="small" label={tr('Guardar em', 'Store in')} value={inv.container ?? ''} disabled={!canEdit}
              onChange={(e) => patch({ container: e.target.value || undefined })}>
              <MenuItem value="">{tr('Carregado (solto)', 'Carried (loose)')}</MenuItem>
              {containers.filter((c) => c.key !== item.key).map((c) => <MenuItem key={c.key} value={c.key}>{c.name}</MenuItem>)}
            </TextField>
          )}
        </Box>

        <Box sx={{ borderTop: `1px solid ${rule}`, pt: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 160px', fontSize: 14 }}>
              {item.runePrice > 0
                ? tr(`Item ${formatGp(item.price)} + runas ${formatGp(item.runePrice)} = `, `Item ${formatGp(item.price)} + runes ${formatGp(item.runePrice)} = `)
                : ''}
              <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatGp(item.price + item.runePrice)}</Box>
              {unknownPrice && <Box component="span" sx={{ display: 'block', fontSize: 12, color: status.warning }}>{tr('⚠ alguma runa está fora do catálogo carregado', '⚠ some rune is not in the loaded catalog')}</Box>}
            </Box>
            <Box sx={{ flex: '0 1 200px', minWidth: 170 }}>
              <Segmented label={tr('Como entrou', 'How it came')} height={30} value={inv.acquired} disabled={!canEdit}
                options={[{ value: 'bought', label: tr('Comprado', 'Bought') }, { value: 'given', label: tr('Ganho', 'Given') }]}
                onChange={(v) => patch({ acquired: v })} />
            </Box>
          </Box>
          {canEdit && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {runic && transferTargets.length > 0 && item.runes.length > 0 && (
                <Button size="small" startIcon={<StrokeIcon d={ICON_PATH.transfer} size={16} />} onClick={(e) => setTransferAnchor(e.currentTarget)}>
                  {tr('Transferir runas', 'Transfer runes')}</Button>
              )}
              <Button size="small" onClick={onDuplicate}>{tr('Duplicar', 'Duplicate')}</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" color="error" onClick={onRemove}>{tr('Remover', 'Remove')}</Button>
            </Box>
          )}
        </Box>
      </Box>

      <Menu anchorEl={transferAnchor} open={!!transferAnchor} onClose={() => setTransferAnchor(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: 320, fontSize: 13, color: ink.secondary }}>
          {tr('Passa as runas para outro item. Na mesa, custa 10% do preço da runa e 1 dia (GM Core pg. 224); o app não desconta.',
            'Moves the runes to another item. At the table it costs 10% of the rune Price and 1 day (GM Core pg. 224); the app does not charge it.')}
        </Box>
        {transferTargets.map((t) => (
          <MenuItem key={t.key} onClick={() => { setTransferAnchor(null); onTransfer(t.key); }}>{itemDisplayName(t)}</MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

function Field({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
        <Label>{label}</Label>
        {note && <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: ink.secondary, textAlign: 'right' }}>{note}</Box>}
      </Box>
      {children}
    </Box>
  );
}

function OverrideField({ label, value, onChange, disabled }: { label: string; value?: number; onChange: (v: number | undefined) => void; disabled?: boolean }) {
  return (
    <TextField size="small" type="number" label={label} value={value ?? ''} disabled={disabled} placeholder={tr('automático', 'automatic')}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(-20, Math.min(60, Math.round(Number(e.target.value)) || 0)))}
      slotProps={{ inputLabel: { shrink: true } }} sx={{ '& input': { color: value !== undefined ? greenInk.main : undefined } }} />
  );
}
