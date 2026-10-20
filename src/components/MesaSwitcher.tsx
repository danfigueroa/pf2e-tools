import { useState } from 'react';
import { Box, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { Check as CheckIcon, ExpandMore as ExpandIcon, Link as LinkIcon } from '@mui/icons-material';
import { currentMesa, MESAS, mesaLink, switchMesa } from '../services/mesa';
import { gold, parchment } from '../theme';

/** Tinta clara sobre a moldura verde, a mesma do `MainLayout`. */
const CHROME_TEXT = 'rgba(237, 227, 204, 0.78)';

/**
 * A mesa deste aparelho, na sidebar. Trocar recarrega a página na outra mesa
 * (`switchMesa`); "Copiar link" entrega o `?mesa=` para mandar no grupo.
 */
export const MesaSwitcher = () => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(mesaLink());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: mostra o link para copiar à mão.
      window.prompt('Link da mesa', mesaLink());
    }
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={`Mesa: ${currentMesa.nome}. Trocar de mesa`}
        sx={{
          width: '100%',
          mt: 1.5,
          px: 1.25,
          py: 0.75,
          borderRadius: 1,
          border: '1px solid rgba(200, 169, 81, 0.35)',
          justifyContent: 'space-between',
          textAlign: 'left',
          '&:hover': { backgroundColor: 'rgba(200, 169, 81, 0.08)' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" component="div" sx={{ color: CHROME_TEXT, lineHeight: 1.2 }}>
            Mesa
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: parchment.page }}>
            {currentMesa.nome}
          </Typography>
        </Box>
        <ExpandIcon sx={{ color: gold.bright, flexShrink: 0 }} />
      </ButtonBase>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {MESAS.map((mesa) => {
          const active = mesa.id === currentMesa.id;
          return (
            <MenuItem key={mesa.id} selected={active} onClick={() => { setAnchor(null); switchMesa(mesa.id); }}>
              <ListItemIcon>{active && <CheckIcon fontSize="small" />}</ListItemIcon>
              <ListItemText primary={mesa.nome} />
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={copyLink}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={copied ? 'Link copiado' : 'Copiar link da mesa'} />
        </MenuItem>
      </Menu>
    </>
  );
};
