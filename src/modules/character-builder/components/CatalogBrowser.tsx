import { useEffect, useMemo, useState } from 'react';
import { Box, Button, type ButtonProps, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { locale, tr } from '../../../i18n';
import { ruleListSlug } from '../rules';
import { loadRuleList } from '../rules/loader';
import type { RuleEntry } from '../rules/types';
import type { CoreRules } from '../hooks/useRules';
import { ITEM_LISTS, useRules } from '../hooks/useRules';
import { MenuBook as BrowseIcon } from '@mui/icons-material';
import type { MesaRules } from '../types';
import { pickerEditions } from '../remaster';
import { ContentPicker } from './ContentPicker';

type Kind = 'ancestries' | 'heritages' | 'backgrounds' | 'classes' | 'archetypes'
  | 'feats-general' | 'feats-skill' | 'feats-mythic' | 'feats-class' | 'feats-ancestry' | 'feats-archetype'
  | 'spells' | 'spells-focus' | 'spells-rituals' | 'items';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'ancestries', label: tr('Ancestralidades', 'Ancestries') },
  { value: 'heritages', label: tr('Heranças', 'Heritages') },
  { value: 'backgrounds', label: tr('Backgrounds', 'Backgrounds') },
  { value: 'classes', label: tr('Classes', 'Classes') },
  { value: 'archetypes', label: tr('Arquétipos', 'Archetypes') },
  { value: 'feats-general', label: tr('Talentos gerais', 'General feats') },
  { value: 'feats-skill', label: tr('Talentos de perícia', 'Skill feats') },
  { value: 'feats-class', label: tr('Talentos de classe', 'Class feats') },
  { value: 'feats-ancestry', label: tr('Talentos de ancestralidade', 'Ancestry feats') },
  { value: 'feats-archetype', label: tr('Talentos de arquétipo', 'Archetype feats') },
  { value: 'feats-mythic', label: tr('Talentos míticos', 'Mythic feats') },
  { value: 'spells', label: tr('Magias por tradição', 'Spells by tradition') },
  { value: 'spells-focus', label: tr('Magias de foco', 'Focus spells') },
  { value: 'spells-rituals', label: tr('Rituais', 'Rituals') },
  { value: 'items', label: tr('Itens', 'Items') },
];

const TRADITIONS = [
  { value: 'arcane', label: tr('Arcana', 'Arcane') }, { value: 'divine', label: tr('Divina', 'Divine') },
  { value: 'occult', label: tr('Oculta', 'Occult') }, { value: 'primal', label: tr('Primal', 'Primal') },
];

const ITEM_LABEL: Record<(typeof ITEM_LISTS)[number], string> = {
  weapons: tr('Armas', 'Weapons'), armor: tr('Armaduras', 'Armor'), shields: tr('Escudos', 'Shields'), runes: tr('Runas', 'Runes'),
  materials: tr('Materiais', 'Materials'), worn: tr('Vestidos', 'Worn'), held: tr('Empunhados', 'Held'),
  consumables: tr('Consumíveis', 'Consumables'), gear: tr('Equipamento', 'Gear'), 'staves-wands': tr('Cajados e varinhas', 'Staves and wands'),
  relics: tr('Relíquias', 'Relics'),
};

/** O que cada categoria pede como segunda escolha (classe, ancestralidade, arquétipo, tradição ou lista de item). */
function subOptions(kind: Kind, core: CoreRules, mesaRules: MesaRules | null): { value: string; label: string }[] {
  const byName = (list: RuleEntry[]) => pickerEditions(list, mesaRules).sort((a, b) => a.name.localeCompare(b.name, locale)).map((e) => ({ value: e.name, label: e.name }));
  if (kind === 'feats-class') return byName(core.classes);
  if (kind === 'feats-ancestry') return byName([...core.ancestries, ...core.heritages.filter((h) => !h.heritage?.ancestry)]);
  if (kind === 'feats-archetype') return byName(core.archetypes);
  if (kind === 'spells') return TRADITIONS;
  if (kind === 'items') return ITEM_LISTS.map((l) => ({ value: l, label: ITEM_LABEL[l] }));
  return [];
}

function listPath(kind: Kind, sub: string): string | null {
  switch (kind) {
    case 'feats-general': return 'feats/general';
    case 'feats-skill': return 'feats/skill';
    case 'feats-mythic': return 'feats/mythic';
    case 'feats-class': return sub ? `feats/class/${ruleListSlug(sub)}` : null;
    case 'feats-ancestry': return sub ? `feats/ancestry/${ruleListSlug(sub)}` : null;
    case 'feats-archetype': return sub ? `feats/archetype/${ruleListSlug(sub)}` : null;
    case 'spells': return sub ? `spells/${sub}` : null;
    case 'spells-focus': return 'spells/focus';
    case 'spells-rituals': return 'spells/rituals';
    case 'items': return sub ? `items/${sub}` : null;
    default: return null;
  }
}

/**
 * Navegador do catálogo fora de slot (9.7): ler talentos, magias e itens sem estar escolhendo nada. Baixa só a lista
 * pedida (cache do loader) e abre o seletor de sempre, sem o botão de escolher.
 */
export function CatalogBrowser({ open, onClose, core, mesaRules }: { open: boolean; onClose: () => void; core: CoreRules | null; mesaRules: MesaRules | null }) {
  const [kind, setKind] = useState<Kind>('feats-general');
  const [sub, setSub] = useState('');
  const [entries, setEntries] = useState<RuleEntry[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const subs = useMemo(() => (core ? subOptions(kind, core, mesaRules) : []), [kind, core, mesaRules]);
  const path = listPath(kind, sub);

  useEffect(() => { setSub(''); }, [kind]);
  useEffect(() => {
    if (!browsing || !core) return;
    const fromCore: Partial<Record<Kind, RuleEntry[]>> = {
      ancestries: core.ancestries, heritages: core.heritages, backgrounds: core.backgrounds, classes: core.classes, archetypes: core.archetypes,
    };
    if (fromCore[kind]) { setEntries(fromCore[kind]!); return; }
    if (!path) return;
    let alive = true;
    setEntries(null);
    void loadRuleList<RuleEntry[]>(path).catch(() => [] as RuleEntry[]).then((list) => alive && setEntries(list));
    return () => { alive = false; };
  }, [browsing, core, kind, path]);

  const ready = !!core && (subs.length === 0 || !!sub);
  const title = [KINDS.find((k) => k.value === kind)?.label, subs.find((s) => s.value === sub)?.label].filter(Boolean).join(' · ');

  return (
    <>
      <Dialog open={open && !browsing} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>{tr('Navegar no catálogo', 'Browse the catalog')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label={tr('O quê', 'What')} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
            </TextField>
            {subs.length > 0 && (
              <TextField select label={tr('De', 'Of')} value={sub} onChange={(e) => setSub(e.target.value)}>
                {subs.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{tr('Fechar', 'Close')}</Button>
          <Button variant="contained" disabled={!ready} onClick={() => setBrowsing(true)}>{tr('Abrir', 'Open')}</Button>
        </DialogActions>
      </Dialog>
      {browsing && (entries ? (
        <ContentPicker open title={title} entries={entries} mesaRules={mesaRules} onClose={() => setBrowsing(false)}
          secondary={(e) => (e.level !== undefined ? tr(`Nível ${e.level}`, `Level ${e.level}`) : undefined)} />
      ) : (
        <Dialog open onClose={() => setBrowsing(false)}>
          <Box role="status" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />{tr('Baixando a lista…', 'Downloading the list…')}
          </Box>
        </Dialog>
      ))}
    </>
  );
}

function LoadedBrowser({ onClose }: { onClose: () => void }) {
  const rules = useRules();
  return <CatalogBrowser open onClose={onClose} core={rules.core} mesaRules={rules.mesaRules} />;
}

/** Botão da lista de personagens: o catálogo só baixa quando a pessoa abre. */
export function CatalogButton({ children, ...props }: ButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" startIcon={<BrowseIcon />} {...props} onClick={() => setOpen(true)}>{children ?? tr('Catálogo', 'Catalog')}</Button>
      {open && <LoadedBrowser onClose={() => setOpen(false)} />}
    </>
  );
}
