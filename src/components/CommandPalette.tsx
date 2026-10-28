import { useMemo, useState } from 'react';
import { Box, ButtonBase, Dialog, InputBase, Typography } from '@mui/material';
import { KeyboardReturn as EnterIcon, Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../services/auth';
import { SECTION_LABEL, visibleNav, type NavItem } from '../layouts/navigation';
import { gold, ink, rule } from '../theme';

// A busca (⌘K / Ctrl+K, o campo do topo da Início e a lupa do celular): ir para uma página ou
// ferramenta pelo teclado. Decisão do usuário: só navegação — nada de regras da AON aqui.
// Chunk próprio: o atalho e o campo do topo só pedem para abrir (`pf2e:open-search`).

/** Sem acento e em minúsculas: "configuracoes" acha "Configurações". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function score(item: NavItem, query: string): number {
  if (!query) return 1;
  const name = fold(item.text);
  if (name.startsWith(query)) return 3;
  if (name.includes(query)) return 2;
  return item.keywords.some((k) => k.includes(query)) ? 1 : 0;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { isGm } = useRole();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const results = useMemo(() => {
    const q = fold(query.trim());
    return visibleNav(isGm)
      .map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.item);
  }, [query, isGm]);
  const current = Math.min(index, Math.max(0, results.length - 1));

  const go = (item: NavItem | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.path);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Ir para uma página"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      slotProps={{ paper: { sx: { mt: { xs: 2, sm: '12vh' }, mx: 1, width: 'calc(100% - 16px)' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 56, borderBottom: `1px solid ${rule}` }}>
        <SearchIcon sx={{ color: ink.secondary }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Ir para… (página ou ferramenta)"
          value={query}
          inputProps={{ 'aria-label': 'Ir para uma página ou ferramenta', role: 'combobox', 'aria-expanded': true, 'aria-controls': 'busca-resultados' }}
          onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((current + 1) % Math.max(1, results.length)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((current - 1 + results.length) % Math.max(1, results.length)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(results[current]); }
          }}
          sx={{ fontSize: '1rem' }}
        />
      </Box>
      <Box id="busca-resultados" role="listbox" component="ul" sx={{ listStyle: 'none', m: 0, p: 1, maxHeight: '60vh', overflowY: 'auto' }}>
        {results.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>Nenhuma página com esse nome.</Typography>
        )}
        {results.map((item, i) => (
          <Box component="li" key={item.path} role="option" aria-selected={i === current}>
            <ButtonBase
              onClick={() => go(item)}
              onMouseEnter={() => setIndex(i)}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, minHeight: 48, borderRadius: 1.5,
                justifyContent: 'flex-start', textAlign: 'left',
                bgcolor: i === current ? `${gold.bright}2E` : 'transparent',
              }}
            >
              <Box sx={{ color: gold.deep, display: 'flex' }}>{item.icon}</Box>
              <Typography sx={{ flex: 1, fontWeight: 600 }}>{item.text}</Typography>
              <Typography variant="caption" color="text.secondary">{SECTION_LABEL[item.section]}</Typography>
              {i === current && <EnterIcon fontSize="small" sx={{ color: ink.secondary }} />}
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}
