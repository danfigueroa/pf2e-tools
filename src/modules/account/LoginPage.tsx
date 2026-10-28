import { useEffect, useState } from 'react';
import { Alert, Box, Button, Link, TextField, Typography } from '@mui/material';
import { requestCode, verifyCode } from '../../services/auth';
import { AuthShell } from './AuthShell';

const RESEND_SECONDS = 60;

/**
 * Entrar pelo e-mail, sem senha: o Supabase manda um código de 6 dígitos (e um link, para
 * quem prefere). O código evita sair do app no celular; o link serve de plano B.
 */
export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const problem = await requestCode(email);
    setBusy(false);
    if (problem) return setError(problem);
    setSent(true);
    setWait(RESEND_SECONDS);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const problem = await verifyCode(email, code);
    // Com sucesso a página recarrega; só chega aqui quando deu errado.
    setBusy(false);
    if (problem) setError(problem);
  };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <AuthShell title="Entrar na mesa">
      {!sent ? (
        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); if (validEmail && !busy) void send(); }}
          sx={{ display: 'grid', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            Digite seu e-mail. Enviamos um código para você entrar — sem senha.
          </Typography>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ inputMode: 'email' }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={!validEmail || busy}>
            {busy ? 'Enviando…' : 'Enviar código'}
          </Button>
        </Box>
      ) : (
        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 6 && !busy) void confirm(); }}
          sx={{ display: 'grid', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            Enviamos um e-mail para <strong>{email.trim()}</strong>. Digite o código dele aqui — ou toque no link do e-mail.
          </Typography>
          <TextField
            label="Código"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { letterSpacing: '0.3em', fontSize: '1.3rem' } }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={code.trim().length < 6 || busy}>
            {busy ? 'Conferindo…' : 'Entrar'}
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Link component="button" type="button" variant="body2" onClick={() => { setSent(false); setCode(''); setError(null); }}>
              Trocar o e-mail
            </Link>
            <Link
              component="button"
              type="button"
              variant="body2"
              disabled={wait > 0 || busy}
              onClick={() => void send()}
              sx={{ opacity: wait > 0 ? 0.5 : 1 }}
            >
              {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar o código'}
            </Link>
          </Box>
        </Box>
      )}
    </AuthShell>
  );
};
