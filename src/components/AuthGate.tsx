import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Snackbar } from '@mui/material';
import { currentMesa } from '../services/mesa';
import { getAuthState, initAuth, refreshAuth, useAuth } from '../services/auth';
import { green } from '../theme';

// A tela de entrada só é baixada por quem precisa dela: quem já está logado não paga o chunk.
const LoginPage = lazy(() => import('../modules/account/LoginPage').then((m) => ({ default: m.LoginPage })));
const JoinPage = lazy(() => import('../modules/account/JoinPage').then((m) => ({ default: m.JoinPage })));

const Splash = ({ children }: { children?: ReactNode }) => (
  <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', backgroundColor: green.main, px: 2 }}>
    {children ?? <CircularProgress sx={{ color: '#C8A951' }} aria-label="Carregando" />}
  </Box>
);

/**
 * Tudo no app exige login e fazer parte da mesa. Sem sessão, a tela de e-mail; logado
 * mas fora da mesa, a do convite; dentro, o app. O servidor é quem barra de verdade
 * (`api/_lib/access.js`) — este portão só leva a pessoa até onde ela consegue entrar.
 */
export const AuthGate = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const [denied, setDenied] = useState<string | null>(null);
  const refreshing = useRef(false);

  useEffect(() => { void initAuth(); }, []);

  useEffect(() => {
    // Sessão vencida no meio do uso: relê o login (uma vez, mesmo com vários pedidos juntos).
    const onUnauthenticated = () => {
      if (getAuthState().status !== 'in' || refreshing.current) return;
      refreshing.current = true;
      void refreshAuth().finally(() => { refreshing.current = false; });
    };
    // O servidor recusou uma ação por papel (jogador tentando o que é do GM, ficha de outra pessoa…).
    const onForbidden = (event: Event) => setDenied((event as CustomEvent<string>).detail);
    window.addEventListener('pf2e:unauthenticated', onUnauthenticated);
    window.addEventListener('pf2e:forbidden', onForbidden);
    return () => {
      window.removeEventListener('pf2e:unauthenticated', onUnauthenticated);
      window.removeEventListener('pf2e:forbidden', onForbidden);
    };
  }, []);

  if (auth.status === 'loading') return <Splash />;

  if (auth.status === 'error') {
    return (
      <Splash>
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void refreshAuth()}>Tentar de novo</Button>}>
          Não consegui falar com o servidor.
        </Alert>
      </Splash>
    );
  }

  if (auth.status === 'out') {
    return <Suspense fallback={<Splash />}><LoginPage /></Suspense>;
  }

  if (auth.status === 'in' && !auth.mesas.some((m) => m.id === currentMesa.id)) {
    return (
      <Suspense fallback={<Splash />}>
        <JoinPage email={auth.user.email} mesas={auth.mesas} notice={auth.notice} />
      </Suspense>
    );
  }

  return (
    <>
      {children}
      <Snackbar
        open={denied !== null}
        autoHideDuration={6000}
        onClose={() => setDenied(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: 1400 }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setDenied(null)}>{denied}</Alert>
      </Snackbar>
    </>
  );
};
