import { useRef, useState, type KeyboardEvent } from 'react';
import { keyframes } from '@emotion/react';
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, InputAdornment, TextField, Typography, type TextFieldProps } from '@mui/material';
import { Check as CheckIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { USERNAME_RE, cleanUsername, pendingInvite, register, signIn } from '../../services/auth';
import { SHAKE, useReducedMotion } from '../../motion/motion';
import { displayFont, gold, ink, parchment, rule, status, greenInk } from '../../theme';
import { LoginLayout } from './LoginLayout';
import { tr } from '../../i18n';

type Mode = 'login' | 'register';

/** Quanto o "Bem-vindo" fica na tela antes de a página recarregar já logada. */
const WELCOME_MS = 650;

const swap = keyframes`
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: none; }
`;

/** Senha com o olho para mostrar e o aviso de Caps Lock — o erro mais comum na entrada. */
const PasswordField = ({ helperText, error, inputRef, ...props }: TextFieldProps) => {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const readCaps = (e: KeyboardEvent) => setCaps(e.getModifierState('CapsLock'));
  return (
    <TextField
      {...props}
      inputRef={inputRef}
      type={shown ? 'text' : 'password'}
      error={error}
      onKeyDown={readCaps}
      onKeyUp={readCaps}
      onBlur={() => setCaps(false)}
      helperText={caps ? tr('O Caps Lock está ligado', 'Caps Lock is on') : helperText}
      FormHelperTextProps={caps ? { sx: { color: status.warning, fontWeight: 600 } } : undefined}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              edge="end"
              size="small"
              aria-label={shown ? tr('Esconder a senha', 'Hide the password') : tr('Mostrar a senha', 'Show the password')}
              onClick={() => setShown((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
            >
              {shown ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

/** "Entrar" / "Criar conta", com o indicador deslizando entre os dois. */
const ModeSwitch = ({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) => (
  <Box
    role="tablist"
    aria-label={tr("Entrar ou criar conta", 'Sign in or create an account')}
    sx={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', p: 0.5, borderRadius: 2, backgroundColor: parchment.sunken, mb: 3 }}
  >
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        width: 'calc(50% - 4px)',
        borderRadius: 1.5,
        backgroundColor: parchment.paper,
        boxShadow: `0 1px 3px ${ink.primary}33`,
        transform: mode === 'login' ? 'none' : 'translateX(100%)',
        transition: 'transform 320ms cubic-bezier(.2,.8,.2,1)',
      }}
    />
    {(['login', 'register'] as const).map((m) => (
      <ButtonBase
        key={m}
        role="tab"
        aria-selected={mode === m}
        onClick={() => onChange(m)}
        sx={{
          position: 'relative',
          minHeight: 40,
          borderRadius: 1.5,
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: '0.9rem',
          color: mode === m ? ink.primary : ink.secondary,
          transition: 'color 200ms',
          '&.Mui-focusVisible': { outline: `2px solid ${gold.main}`, outlineOffset: 1 },
        }}
      >
        {m === 'login' ? tr('Entrar', 'Sign in') : tr('Criar conta', 'Create account')}
      </ButtonBase>
    ))}
  </Box>
);

/**
 * Entrar com usuário e senha, ou criar a conta com um convite — sem e-mail nenhum. Quem
 * chega pelo link do convite (`/convite/<código>`) já cai em "criar conta" com o código
 * preenchido; quem já tem conta entra, e o convite é resgatado sozinho depois (`initAuth`).
 */
export const LoginPage = () => {
  const reduced = useReducedMotion();
  const invite = pendingInvite();
  const [mode, setMode] = useState<Mode>(invite ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cada erro troca o gêmeo do tremor, para dois erros seguidos tremerem duas vezes.
  const [failures, setFailures] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  const switchTo = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  };

  // A página só recarrega depois de o "Bem-vindo" aparecer.
  const welcome = () => {
    setDone(true);
    return new Promise<void>((resolve) => window.setTimeout(resolve, reduced ? 0 : WELCOME_MS));
  };

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    // Com sucesso a página recarrega; só volta aqui quando deu errado.
    const problem = await action();
    setBusy(false);
    if (!problem) return;
    setError(problem);
    setFailures((n) => n + 1);
    passwordRef.current?.focus();
    passwordRef.current?.select();
  };

  const validUser = USERNAME_RE.test(cleanUsername(username));
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = !busy && !done && (mode === 'login'
    ? username.trim().length > 0 && password.length > 0
    : code.trim().length >= 8 && validUser && password.length >= 6 && confirm === password);

  const submit = () => {
    if (!ready) return;
    if (mode === 'login') void run(() => signIn(username, password, { beforeReload: welcome }));
    else void run(() => register({ code, username, password, name }, { beforeReload: welcome }));
  };

  return (
    <LoginLayout>
      <Box
        sx={{
          opacity: done ? 0.92 : 1,
          transition: 'opacity 300ms',
          animation: failures > 0 && !reduced ? `${SHAKE[failures % 2]} 420ms ease-in-out` : undefined,
        }}
      >
        <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.25, color: ink.primary }}>
          {mode === 'login' ? tr('Bem-vindo de volta', 'Welcome back') : tr('Entre para o Covil', 'Enter the Covil')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: ink.secondary }}>
          {mode === 'login'
            ? tr('Entre com o usuário que você criou no convite da mesa.', 'Sign in with the username you created from the table\'s invite.')
            : tr('Use o convite que o GM mandou. Você escolhe um usuário e uma senha — não precisa de e-mail.', 'Use the invite the GM sent you. You choose a username and a password — no e-mail needed.')}
        </Typography>

        <ModeSwitch mode={mode} onChange={switchTo} />

        {invite && (
          <Alert severity="info" sx={{ mb: 2, borderLeft: `3px solid ${gold.main}` }}>
            {mode === 'login'
              ? tr('Você tem um convite. Entre na sua conta e ele vale sozinho — ou crie uma conta nova.', 'You have an invite. Sign in to your account and it applies by itself — or create a new account.')
              : tr('Convite da mesa já preenchido. Falta só escolher seu usuário e senha.', 'Table invite already filled in. All that\'s left is choosing your username and password.')}
          </Alert>
        )}

        <Box
          key={mode}
          component="form"
          noValidate
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          sx={{ display: 'grid', gap: 2, animation: reduced ? undefined : `${swap} 320ms ease-out` }}
        >
          {mode === 'register' && (
            <>
              <TextField
                label={tr("Código do convite", 'Invite code')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 32))}
                inputProps={{ style: { letterSpacing: '0.15em', fontFamily: 'monospace' } }}
              />
              <TextField
                label={tr("Seu nome na mesa", 'Your name at the table')}
                helperText={tr("Opcional — é como os outros veem você", 'Optional — it\'s how the others see you')}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
              />
            </>
          )}
          <TextField
            label={tr("Usuário", 'Username')}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={mode === 'login' || !!invite}
            value={username}
            onChange={(e) => setUsername(mode === 'register' ? e.target.value.slice(0, 30) : e.target.value)}
            error={mode === 'register' && username.length > 0 && !validUser}
            helperText={mode === 'register' ? tr('De 3 a 30: letras minúsculas, números, ponto, hífen ou sublinhado', '3 to 30: lowercase letters, numbers, dot, hyphen or underscore') : undefined}
          />
          <PasswordField
            label={tr("Senha", 'Password')}
            inputRef={passwordRef}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={mode === 'register' && password.length > 0 && password.length < 6}
            helperText={mode === 'register' ? tr('Pelo menos 6 caracteres', 'At least 6 characters') : undefined}
          />
          {mode === 'register' && (
            <PasswordField
              label={tr("Repita a senha", 'Repeat the password')}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={mismatch}
              helperText={mismatch ? tr('As senhas não são iguais', 'The passwords don\'t match') : ' '}
            />
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!ready && !done}
            startIcon={done ? <CheckIcon /> : busy ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{
              minHeight: 48,
              fontWeight: 700,
              ...(done && {
                pointerEvents: 'none',
                backgroundColor: status.success,
                '&:hover': { backgroundColor: status.success },
              }),
              transition: 'background-color 250ms',
            }}
          >
            {done ? tr('Bem-vindo!', 'Welcome!') : busy
              ? (mode === 'login' ? tr('Entrando…', 'Signing in…') : tr('Criando a conta…', 'Creating the account…'))
              : (mode === 'login' ? tr('Entrar', 'Sign in') : tr('Criar conta e entrar', 'Create account and sign in'))}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${rule}`, display: 'grid', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: ink.secondary }}>
            {mode === 'login'
              ? tr('Esqueceu a senha? Peça ao GM da mesa para gerar uma provisória.', 'Forgot your password? Ask the table\'s GM to generate a temporary one.')
              : tr('Sem convite? Peça um link ao GM da sua mesa.', 'No invite? Ask your table\'s GM for a link.')}
          </Typography>
          <Typography variant="caption" sx={{ color: greenInk.light }}>
            {mode === 'login' ? tr('Primeira vez aqui? Toque em "Criar conta" com o convite.', 'First time here? Tap "Create account" with the invite.') : tr('Já tem conta? Toque em "Entrar".', 'Already have an account? Tap "Sign in".')}
          </Typography>
        </Box>
      </Box>
    </LoginLayout>
  );
};
