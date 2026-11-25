import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Skeleton,
  Stack, Switch, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { deleteHomebrew, fetchHomebrew, saveHomebrew, type HomebrewKind, type HomebrewRow } from '../../../services/builds';
import { displayFont } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import type { RuleEntry } from '../rules/types';

const KINDS: { value: HomebrewKind; label: string }[] = [
  { value: 'feat', label: tr('Talento', 'Feat') },
  { value: 'item', label: tr('Item', 'Item') },
  { value: 'rune', label: tr('Runa de propriedade', 'Property rune') },
  { value: 'background', label: tr('Background', 'Background') },
  { value: 'heritage', label: tr('Herança', 'Heritage') },
  { value: 'spell', label: tr('Magia', 'Spell') },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<HomebrewKind, string>;

/** O traço que encaixa o talento no slot (o seletor filtra por ele, como no catálogo oficial). */
const FEAT_SLOTS = [
  { value: 'General', label: tr('Geral', 'General') },
  { value: 'Skill', label: tr('Perícia (também é geral)', 'Skill (also general)') },
  { value: 'class', label: tr('Classe (o nome da classe)', 'Class (the class name)') },
  { value: 'ancestry', label: tr('Ancestralidade (o nome dela)', 'Ancestry (its name)') },
];
const RARITIES = [
  { value: 'common', label: tr('Comum', 'Common') }, { value: 'uncommon', label: tr('Incomum', 'Uncommon') },
  { value: 'rare', label: tr('Raro', 'Rare') }, { value: 'unique', label: tr('Único', 'Unique') },
];
const TRADITIONS = [
  { value: 'arcane', label: tr('Arcana', 'Arcane') }, { value: 'divine', label: tr('Divina', 'Divine') },
  { value: 'occult', label: tr('Oculta', 'Occult') }, { value: 'primal', label: tr('Primal', 'Primal') },
];
const ITEM_CATEGORIES = [
  { value: 'Adventuring Gear', label: tr('Equipamento', 'Gear') }, { value: 'Worn Items', label: tr('Vestido', 'Worn') },
  { value: 'Held Items', label: tr('Empunhado', 'Held') }, { value: 'Consumables', label: tr('Consumível', 'Consumable') },
];

interface Draft {
  id?: string;
  kind: HomebrewKind;
  name: string;
  level: string;
  rarity: string;
  traits: string;
  summary: string;
  effect: string;
  featSlot: string;
  slotName: string;
  actions: string;
  prerequisites: string;
  boosts: string[];
  skills: string;
  bgFeat: string;
  ancestry: string;
  rank: string;
  cantrip: boolean;
  traditions: string[];
  price: string;
  bulk: string;
  category: string;
  runeOn: 'weapon' | 'armor';
}

const empty = (kind: HomebrewKind = 'feat'): Draft => ({
  kind, name: '', level: kind === 'background' || kind === 'heritage' ? '0' : '1', rarity: 'common', traits: '', summary: '', effect: '',
  featSlot: 'General', slotName: '', actions: '', prerequisites: '', boosts: [], skills: '', bgFeat: '', ancestry: '', rank: '1',
  cantrip: false, traditions: [], price: '', bulk: '', category: 'Adventuring Gear', runeOn: 'weapon',
});

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** A linha gravada → o rascunho do formulário (o inverso de `toEntry`). */
function fromRow(row: HomebrewRow): Draft {
  const e = row.entry;
  const traits = e.traits ?? [];
  const slot = row.kind === 'feat' ? (traits.includes('Skill') ? 'Skill' : traits.includes('General') ? 'General' : 'other') : 'General';
  return {
    ...empty(row.kind), id: row.id, name: e.name, level: String(e.level ?? 0), rarity: e.rarity ?? 'common',
    traits: traits.filter((t) => !['General', 'Skill'].includes(t)).join(', '), summary: e.summary ?? '', effect: (e.unsupported ?? []).join('; '),
    featSlot: slot === 'other' ? 'class' : slot, slotName: '', actions: e.actions ?? '', prerequisites: e.prerequisites?.text ?? '',
    boosts: (e.background?.boosts ?? []).filter((b) => b !== 'free'), skills: (e.background?.skills ?? []).join(', '),
    bgFeat: e.background?.feats?.[0] ?? '', ancestry: e.heritage?.ancestry ?? '', rank: String(e.spell?.rank ?? 1),
    cantrip: !!e.spell?.cantrip, traditions: e.spell?.traditions ?? [], price: e.item?.price ? String(e.item.price.gp) : '',
    bulk: e.item?.bulk !== undefined ? String(e.item.bulk) : '', category: e.item?.category ?? 'Adventuring Gear',
    runeOn: /armor/i.test(e.item?.subcategory ?? '') ? 'armor' : 'weapon',
  };
}

/** O rascunho → o RuleEntry que o servidor sanitiza (o id é dele). */
function toEntry(d: Draft): Partial<RuleEntry> {
  const own = list(d.traits);
  const slotTrait = d.kind !== 'feat' ? [] : d.featSlot === 'Skill' ? ['General', 'Skill'] : d.featSlot === 'General' ? ['General'] : d.slotName.trim() ? [d.slotName.trim()] : [];
  const base: Partial<RuleEntry> = {
    name: d.name, level: Number(d.level) || 0, rarity: d.rarity, traits: [...slotTrait, ...own], summary: d.summary,
    ...(d.effect.trim() ? { unsupported: [tr(`Efeito caseiro: ${d.effect.trim()}`, `Homebrew effect: ${d.effect.trim()}`)] } : {}),
  };
  if (d.kind === 'feat') return { ...base, ...(d.actions ? { actions: d.actions as RuleEntry['actions'] } : {}), ...(d.prerequisites.trim() ? { prerequisites: { text: d.prerequisites.trim() } } : {}) };
  if (d.kind === 'background') return { ...base, background: { boosts: d.boosts as AttributeKey[], skills: list(d.skills), feats: d.bgFeat.trim() ? [d.bgFeat.trim()] : [] } };
  if (d.kind === 'heritage') return { ...base, heritage: d.ancestry.trim() ? { ancestry: d.ancestry.trim() } : {} };
  if (d.kind === 'spell') return { ...base, spell: { rank: Number(d.rank) || 1, traditions: d.traditions, ...(d.cantrip ? { cantrip: true } : {}) } };
  return {
    ...base,
    item: {
      category: d.kind === 'rune' ? 'rune' : d.category,
      ...(d.kind === 'rune' ? { subcategory: d.runeOn === 'armor' ? 'Armor Property Rune' : 'Weapon Property Rune' } : {}),
      ...(d.price.trim() ? { price: { gp: Number(d.price) } } : {}),
      ...(d.bulk.trim() ? { bulk: d.bulk.trim().toUpperCase() === 'L' ? 'L' as const : Number(d.bulk) } : {}),
    },
  };
}

/**
 * Conteúdo da mesa (9.1), na página `/mesa` (só o GM chega aqui): talentos, itens, runas, backgrounds, heranças e
 * magias caseiros. Entram no Criador com o selo "Da mesa" e valem sempre (as regras de livros não os barram). O que muda
 * número e o motor não calcula vai em "efeito" e vira aviso na ficha.
 */
export function HomebrewSection() {
  const [rows, setRows] = useState<HomebrewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<HomebrewRow | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchHomebrew(true).then((out) => {
      if (!alive) return;
      if (out.ok) setRows(out.value);
      else setError(out.error);
    });
    return () => { alive = false; };
  }, []);

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const out = await saveHomebrew({ ...(draft.id ? { id: draft.id } : {}), kind: draft.kind, entry: toEntry(draft) });
    setBusy(false);
    if (!out.ok) { setError(out.error); return; }
    setRows((prev) => [out.value, ...(prev ?? []).filter((r) => r.id !== out.value.id)]);
    setDraft(null);
  };
  const remove = async (row: HomebrewRow) => {
    setConfirmDelete(null);
    const out = await deleteHomebrew(row.id);
    if (out.ok) setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
    else setError(out.error);
  };

  const sorted = [...(rows ?? [])].sort((a, b) => a.kind.localeCompare(b.kind) || a.entry.name.localeCompare(b.entry.name, locale));
  const d = draft;

  return (
    <Paper id="conteudo" variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', flex: 1, minWidth: 0 }}>
          {tr('Conteúdo da mesa', 'Table homebrew')}</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setDraft(empty())}>{tr('Criar', 'Create')}</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {tr('Talentos, itens, runas, backgrounds, heranças e magias da casa. Aparecem no Criador com o selo "Da mesa" e valem mesmo fora dos livros liberados. Efeito que muda números vira aviso na ficha.',
          'House feats, items, runes, backgrounds, heritages and spells. They show up in the Builder tagged "Table homebrew" and are allowed even outside the selected books. Effects that change numbers become warnings on the sheet.')}
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}
      {!rows && !error && <Skeleton variant="rounded" height={64} />}
      {rows && rows.length === 0 && <Typography variant="body2" color="text.secondary">{tr('Nada criado ainda.', 'Nothing created yet.')}</Typography>}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {sorted.map((r) => (
          <Chip key={r.id} label={`${r.entry.name} · ${KIND_LABEL[r.kind]}`} onClick={() => setDraft(fromRow(r))} onDelete={() => setConfirmDelete(r)} />
        ))}
      </Stack>

      <Dialog open={!!d} onClose={() => !busy && setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{d?.id ? tr('Editar conteúdo da mesa', 'Edit table homebrew') : tr('Novo conteúdo da mesa', 'New table homebrew')}</DialogTitle>
        {d && (
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5, pt: 1 }}>
              <TextField select label={tr('Tipo', 'Kind')} value={d.kind} disabled={!!d.id} onChange={(e) => setDraft({ ...empty(e.target.value as HomebrewKind), name: d.name, summary: d.summary })}>
                {KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
              </TextField>
              <TextField label={tr('Nome', 'Name')} value={d.name} onChange={(e) => set({ name: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} />
              {d.kind !== 'spell' && <TextField type="number" label={tr('Nível', 'Level')} value={d.level} onChange={(e) => set({ level: e.target.value })} slotProps={{ htmlInput: { min: 0, max: 25 } }} />}
              <TextField select label={tr('Raridade', 'Rarity')} value={d.rarity} onChange={(e) => set({ rarity: e.target.value })}>
                {RARITIES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>

              {d.kind === 'feat' && (
                <>
                  <TextField select label={tr('Slot', 'Slot')} value={d.featSlot} onChange={(e) => set({ featSlot: e.target.value })}>
                    {FEAT_SLOTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                  </TextField>
                  {(d.featSlot === 'class' || d.featSlot === 'ancestry') && (
                    <TextField label={d.featSlot === 'class' ? tr('Classe (em inglês)', 'Class') : tr('Ancestralidade (em inglês)', 'Ancestry')}
                      placeholder={d.featSlot === 'class' ? 'Fighter' : 'Elf'} value={d.slotName} onChange={(e) => set({ slotName: e.target.value })} slotProps={{ htmlInput: { maxLength: 30 } }} />
                  )}
                  <TextField select label={tr('Ações', 'Actions')} value={d.actions} onChange={(e) => set({ actions: e.target.value })}>
                    <MenuItem value="">{tr('Nenhuma (passivo)', 'None (passive)')}</MenuItem>
                    {['1', '2', '3'].map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    <MenuItem value="reaction">{tr('Reação', 'Reaction')}</MenuItem>
                    <MenuItem value="free">{tr('Livre', 'Free')}</MenuItem>
                  </TextField>
                  <TextField label={tr('Pré-requisitos (em inglês, como na AON)', 'Prerequisites')} placeholder="trained in Athletics" value={d.prerequisites}
                    onChange={(e) => set({ prerequisites: e.target.value })} slotProps={{ htmlInput: { maxLength: 300 } }} sx={{ gridColumn: '1 / -1' }} />
                </>
              )}

              {d.kind === 'background' && (
                <>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>{tr('Boost: um destes dois e um livre (Player Core pg. 84)', 'Boost: one of these two and one free (Player Core pg. 84)')}</Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {ATTRIBUTES.map((a) => {
                        const on = d.boosts.includes(a);
                        return <Chip key={a} label={attributeLabel(a)} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                          onClick={() => set({ boosts: on ? d.boosts.filter((x) => x !== a) : [...d.boosts, a].slice(-2) })} />;
                      })}
                    </Stack>
                  </Box>
                  <TextField label={tr('Perícias treinadas (vírgula; em inglês)', 'Trained skills (comma)')} placeholder="Athletics, Warfare Lore" value={d.skills} onChange={(e) => set({ skills: e.target.value })} />
                  <TextField label={tr('Talento de perícia (em inglês)', 'Skill feat')} placeholder="Assurance" value={d.bgFeat} onChange={(e) => set({ bgFeat: e.target.value })} />
                </>
              )}

              {d.kind === 'heritage' && (
                <TextField label={tr('Ancestralidade (em inglês; vazio = versátil)', 'Ancestry (empty = versatile)')} placeholder="Dwarf" value={d.ancestry}
                  onChange={(e) => set({ ancestry: e.target.value })} sx={{ gridColumn: '1 / -1' }} />
              )}

              {d.kind === 'spell' && (
                <>
                  <FormControlLabel control={<Switch checked={d.cantrip} onChange={(e) => set({ cantrip: e.target.checked })} />} label={tr('Truque', 'Cantrip')} />
                  {!d.cantrip && <TextField type="number" label={tr('Rank', 'Rank')} value={d.rank} onChange={(e) => set({ rank: e.target.value })} slotProps={{ htmlInput: { min: 1, max: 10 } }} />}
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>{tr('Tradições', 'Traditions')}</Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {TRADITIONS.map((t) => {
                        const on = d.traditions.includes(t.value);
                        return <Chip key={t.value} label={t.label} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                          onClick={() => set({ traditions: on ? d.traditions.filter((x) => x !== t.value) : [...d.traditions, t.value] })} />;
                      })}
                    </Stack>
                  </Box>
                </>
              )}

              {(d.kind === 'item' || d.kind === 'rune') && (
                <>
                  {d.kind === 'item' ? (
                    <TextField select label={tr('Categoria', 'Category')} value={d.category} onChange={(e) => set({ category: e.target.value })}>
                      {ITEM_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                    </TextField>
                  ) : (
                    <TextField select label={tr('Gravada em', 'Etched on')} value={d.runeOn} onChange={(e) => set({ runeOn: e.target.value as Draft['runeOn'] })}>
                      <MenuItem value="weapon">{tr('Arma', 'Weapon')}</MenuItem>
                      <MenuItem value="armor">{tr('Armadura', 'Armor')}</MenuItem>
                    </TextField>
                  )}
                  <TextField type="number" label={tr('Preço (po)', 'Price (gp)')} value={d.price} onChange={(e) => set({ price: e.target.value })} slotProps={{ htmlInput: { min: 0 } }} />
                  <TextField label={tr('Volume (número ou L)', 'Bulk (number or L)')} value={d.bulk} onChange={(e) => set({ bulk: e.target.value })} slotProps={{ htmlInput: { maxLength: 4 } }} />
                </>
              )}

              <TextField label={tr('Traços (vírgula; em inglês)', 'Traits (comma)')} placeholder="Fire, Magical" value={d.traits} onChange={(e) => set({ traits: e.target.value })} sx={{ gridColumn: '1 / -1' }} />
              <TextField multiline minRows={3} label={tr('Descrição', 'Description')} value={d.summary} onChange={(e) => set({ summary: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 4000 } }} sx={{ gridColumn: '1 / -1' }} />
              <TextField label={tr('Efeito que muda números (vira aviso)', 'Effect that changes numbers (becomes a warning)')} placeholder={tr('+1 de circunstância em Atletismo', '+1 circumstance to Athletics')}
                value={d.effect} onChange={(e) => set({ effect: e.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} sx={{ gridColumn: '1 / -1' }} />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={busy}>{tr('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" onClick={() => void save()} disabled={busy || !d?.name.trim()}>{tr('Salvar', 'Save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>{tr('Apagar conteúdo da mesa?', 'Delete table homebrew?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{tr(`"${confirmDelete?.entry.name ?? ''}" sai do Criador. Personagens que o escolheram ficam com a escolha marcada como não encontrada.`,
            `"${confirmDelete?.entry.name ?? ''}" leaves the Builder. Characters that picked it keep the choice flagged as not found.`)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>{tr('Cancelar', 'Cancel')}</Button>
          <Button color="error" onClick={() => confirmDelete && void remove(confirmDelete)}>{tr('Apagar', 'Delete')}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
