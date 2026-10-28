import { useState } from 'react';
import { Alert, Box, Button, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { acceptInvite, signOut, type Membership } from '../../services/auth';
import { currentMesa, MESAS, switchMesa } from '../../services/mesa';
import { AuthShell } from './AuthShell';

interface Props {
  username: string | null;
  mesas: Membership[];
  /** Por que o convite do link falhou, quando falhou. */
  notice: string | null;
}

/**
 * Logado, mas sem lugar nesta mesa. Entra-se por convite: o GM manda um link (que já
 * resgata sozinho ao abrir) ou um código, que a pessoa digita aqui. Quem faz parte de
 * outra mesa pode ir para ela.
 */
export const JoinPage = ({ username, mesas, notice }: Props) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  const join = async () => {
    setBusy(true);
    setError(null);
    const result = await acceptInvite(code.trim().toUpperCase());
    if ('error' in result) {
      setBusy(false);
      return setError(result.error);
    }
    if (result.mesa === currentMesa.id) window.location.reload();
    else switchMesa(result.mesa);
  };

  const others = mesas.filter((m) => m.id !== currentMesa.id && MESAS.some((x) => x.id === m.id));

  return (
    <AuthShell title={`Você ainda não está na mesa ${currentMesa.nome}`}>
      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 8 && !busy) void join(); }}
        sx={{ display: 'grid', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Peça um convite ao GM da mesa. Se ele mandou um link, é só abri-lo; se mandou um código, digite abaixo.
        </Typography>
        <TextField
          label="Código do convite"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 32))}
          inputProps={{ style: { letterSpacing: '0.15em', fontFamily: 'monospace' } }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={code.trim().length < 8 || busy}>
          {busy ? 'Entrando…' : 'Entrar na mesa'}
        </Button>
      </Box>

      {others.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Suas outras mesas</Typography>
          <List dense disablePadding>
            {others.map((m) => (
              <ListItemButton key={m.id} onClick={() => switchMesa(m.id)}>
                <ListItemText primary={m.name} secondary={m.role === 'gm' ? 'GM' : 'Jogador'} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }} noWrap>{username}</Typography>
        <Button size="small" onClick={() => void signOut()}>Sair</Button>
      </Box>
    </AuthShell>
  );
};
