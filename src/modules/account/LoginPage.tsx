import { useState } from 'react';
import { Alert, Box, Button, Link, TextField, Typography } from '@mui/material';
import { USERNAME_RE, cleanUsername, pendingInvite, register, signIn } from '../../services/auth';
import { AuthShell } from './AuthShell';

type Mode = 'login' | 'register';

/**
 * Entrar com usuário e senha, ou criar a conta com um convite — sem e-mail nenhum. Quem
 * chega pelo link do convite (`/convite/<código>`) já cai em "criar conta" com o código
 * preenchido; quem já tem conta entra, e o convite é resgatado sozinho depois (`initAuth`).
 */
export const LoginPage = () => {
  const invite = pendingInvite();
  const [mode, setMode] = useState<Mode>(invite ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  };

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    // Com sucesso a página recarrega; só volta aqui quando deu errado.
    const problem = await action();
    setBusy(false);
    if (problem) setError(problem);
  };

  const validUser = USERNAME_RE.test(cleanUsername(username));

  if (mode === 'login') {
    const ready = username.trim().length > 0 && password.length > 0 && !busy;
    return (
      <AuthShell title="Entrar na mesa">
        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); if (ready) void run(() => signIn(username, password)); }}
          sx={{ display: 'grid', gap: 2 }}
        >
          {invite && (
            <Alert severity="info">Você tem um convite. Entre na sua conta e ele vale sozinho — ou crie uma conta nova.</Alert>
          )}
          <TextField
            label="Usuário"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={!ready}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Esqueceu a senha? Peça ao GM da mesa para gerar uma nova.
          </Typography>
          <Link component="button" type="button" variant="body2" onClick={() => switchTo('register')} sx={{ justifySelf: 'start' }}>
            Primeira vez? Criar conta com um convite
          </Link>
        </Box>
      </AuthShell>
    );
  }

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = code.trim().length >= 8 && validUser && password.length >= 6 && confirm === password && !busy;
  return (
    <AuthShell title="Criar conta">
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void run(() => register({ code, username, password, name }));
        }}
        sx={{ display: 'grid', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Use o convite que o GM mandou. Você escolhe um usuário e uma senha — não precisa de e-mail.
        </Typography>
        <TextField
          label="Código do convite"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 32))}
          inputProps={{ style: { letterSpacing: '0.15em', fontFamily: 'monospace' } }}
        />
        <TextField
          label="Seu nome na mesa"
          helperText="Opcional — é como os outros veem você"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
        />
        <TextField
          label="Usuário"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus={!!invite}
          value={username}
          onChange={(e) => setUsername(e.target.value.slice(0, 30))}
          error={username.length > 0 && !validUser}
          helperText="De 3 a 30: letras minúsculas, números, ponto, hífen ou sublinhado"
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={password.length > 0 && password.length < 6}
          helperText="Pelo menos 6 caracteres"
        />
        <TextField
          label="Repita a senha"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
          helperText={mismatch ? 'As senhas não são iguais' : ' '}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={!ready}>
          {busy ? 'Criando…' : 'Criar conta e entrar'}
        </Button>
        <Link component="button" type="button" variant="body2" onClick={() => switchTo('login')} sx={{ justifySelf: 'start' }}>
          Já tenho conta — entrar
        </Link>
      </Box>
    </AuthShell>
  );
};
