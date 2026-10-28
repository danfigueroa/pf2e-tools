import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { changePassword } from '../../services/auth';

/** Trocar a própria senha (a provisória que o GM gerou, por exemplo). */
export const ChangePasswordDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setPassword('');
    setConfirm('');
    setError(null);
    setDone(false);
    onClose();
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const problem = await changePassword(password);
    setBusy(false);
    if (problem) setError(problem);
    else setDone(true);
  };

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= 6 && confirm === password && !busy;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Trocar senha</DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success">Senha trocada. Use a nova na próxima vez que entrar.</Alert>
        ) : (
          <Stack
            component="form"
            id="change-password"
            spacing={2}
            sx={{ pt: 1 }}
            onSubmit={(e) => { e.preventDefault(); if (ready) void save(); }}
          >
            <TextField
              label="Senha nova" type="password" autoComplete="new-password" autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)}
              error={password.length > 0 && password.length < 6} helperText="Pelo menos 6 caracteres"
            />
            <TextField
              label="Repita a senha nova" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              error={mismatch} helperText={mismatch ? 'As senhas não são iguais' : ' '}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{done ? 'Fechar' : 'Cancelar'}</Button>
        {!done && <Button type="submit" form="change-password" variant="contained" disabled={!ready}>Trocar</Button>}
      </DialogActions>
    </Dialog>
  );
};
