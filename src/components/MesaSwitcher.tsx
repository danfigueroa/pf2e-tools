import { useState } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Check as CheckIcon, Link as LinkIcon } from '@mui/icons-material';
import { currentMesa, MESAS, mesaLink, switchMesa } from '../services/mesa';
import { mesaName, useAuth } from '../services/auth';

/**
 * O menu das mesas: trocar recarrega a página na outra mesa (`switchMesa`); "Copiar link"
 * entrega o `?mesa=` para mandar no grupo. Quem o abre é o cartão da mesa da sidebar e o
 * botão da mesa do cabeçalho do celular. O nome de cada mesa vem do servidor (o GM pode
 * renomeá-la), com o fixo do código como reserva.
 */
export const MesaMenu = ({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) => {
  const auth = useAuth();
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
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      {MESAS.map((mesa) => {
        const active = mesa.id === currentMesa.id;
        return (
          <MenuItem key={mesa.id} selected={active} onClick={() => { onClose(); if (!active) switchMesa(mesa.id); }}>
            <ListItemIcon>{active && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText primary={mesaName(auth, mesa.id, mesa.nome)} />
          </MenuItem>
        );
      })}
      <Divider />
      <MenuItem onClick={copyLink}>
        <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
        <ListItemText primary={copied ? 'Link copiado' : 'Copiar link da mesa'} />
      </MenuItem>
    </Menu>
  );
};
