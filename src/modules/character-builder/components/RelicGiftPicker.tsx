import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, TextField, useMediaQuery, useTheme } from '@mui/material';
import { tr } from '../../../i18n';
import type { RelicOption } from '../../../pathbuilder/relicOptions';
import { VIEW_OK } from '../../character-viewer/sheetAccess';
import { relicAspectLabel } from './relicView';
import { cardSx } from './uiTokens';
import { ContentBadge } from './ui';

const Description = lazy(() => import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));
const PAGE_SIZE = 4;

export function RelicAspectTags({ names }: { names: string[] }) {
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} aria-label={tr('Aspectos', 'Aspects')}>
    {names.map((a) => <ContentBadge key={a} kind="trait">{relicAspectLabel(a)}</ContentBadge>)}
  </Box>;
}

export function RelicGiftDescription({ name, rune }: { name: string; rune?: string }) {
  const request = useMemo(() => rune
    ? { type: 'item' as const, name: `${rune} [equipment]` }
    : { type: 'special' as const, name: `${name} [relic]` }, [name, rune]);
  return <Suspense fallback={<small>{tr('Carregando descrição…', 'Loading description…')}</small>}>
    <Description key={request.name} request={request} embedded onClose={() => {}} />
  </Suspense>;
}

/** Abrir, buscar e ler mantém a escolha atual. Só o botão do cartão grava a dádiva. */
export function RelicGiftPicker({ title, options, value, onPick, onClose }: {
  title: string; options: RelicOption[]; value: string; onPick?: (id: string) => void; onClose: () => void;
}) {
  const titleId = useId();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [runes, setRunes] = useState(!!options.find((g) => g.id === value)?.rune);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const term = search.trim().toLocaleLowerCase();
  const results = options.filter((g) => !!g.rune === runes && [g.name, ...g.aspects, ...g.aspects.map(relicAspectLabel)]
    .some((text) => text.toLocaleLowerCase().includes(term)));
  return <Dialog open fullWidth maxWidth="sm" fullScreen={fullScreen} onClose={onClose} aria-labelledby={titleId}>
    <DialogTitle id={titleId}>{title}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        {options.some((g) => g.rune) && <Tabs value={Number(runes)} aria-label={tr('Tipo de dádiva', 'Gift type')}
          onChange={(_, tab) => { setRunes(tab === 1); setLimit(PAGE_SIZE); }}>
          <Tab label={tr('Poderes', 'Powers')} /><Tab label={tr('Runas', 'Runes')} />
        </Tabs>}
        <TextField label={tr('Buscar por nome ou aspecto', 'Search by name or aspect')} size="small" type="search"
          value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }} />
        {results.slice(0, limit).map((g) => <Box component="article" aria-label={g.name} key={g.id} sx={{ ...cardSx, p: 1.5, overflowWrap: 'anywhere' }}>
          <Stack spacing={1}>
            <Box component="h3" sx={{ m: 0 }}>{g.name}</Box>
            <RelicAspectTags names={g.aspects} />
            <RelicGiftDescription name={g.name} rune={g.rune} />
            {onPick && <Button variant="outlined" disabled={g.id === value} onClick={() => onPick(g.id)}>
              {g.id === value ? tr('Dádiva atual', 'Current gift') : tr(`Escolher ${g.name}`, `Choose ${g.name}`)}
            </Button>}
          </Stack>
        </Box>)}
        {!results.length && <Box role="status">{tr('Nenhuma dádiva encontrada.', 'No gifts found.')}</Box>}
        {results.length > limit && <Button {...VIEW_OK} onClick={() => setLimit(limit + PAGE_SIZE)}>{tr('Mostrar mais dádivas', 'Show more gifts')}</Button>}
      </Stack>
    </DialogContent>
    <DialogActions><Button {...VIEW_OK} onClick={onClose}>{tr('Fechar', 'Close')}</Button></DialogActions>
  </Dialog>;
}
