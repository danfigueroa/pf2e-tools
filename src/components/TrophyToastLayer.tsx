import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onTableEvent } from '../services/notifications';
import { getAuthState } from '../services/auth';
import { refreshTrophySummary, type TrophyTier } from '../services/trophies';
import type { UnlockToast } from '../modules/trophies/TrophyUnlockCard';

// "Troféu desbloqueado", em qualquer página: montado UMA vez no `MainLayout`, ouve o canal de
// eventos da mesa e mostra o cartão quando o troféu é DESTA conta. Vários de uma vez (encerrar
// a sessão dá alguns) entram em fila, um por vez. O cartão animado é um chunk à parte, baixado
// com o app ocioso — o primeiro troféu não espera o código chegar.

const loadCard = () => import('../modules/trophies/TrophyUnlockCard');
const TrophyUnlockCard = lazy(loadCard);

const TIERS: TrophyTier[] = ['bronze', 'prata', 'ouro', 'platina'];
const SHOW_MS: Record<TrophyTier, number> = { bronze: 6000, prata: 6500, ouro: 7500, platina: 10000 };
const LEAVE_MS = 260;

export const TrophyToastLayer = memo(function TrophyToastLayer() {
  const [queue, setQueue] = useState<UnlockToast[]>([]);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const run = () => { void loadCard().catch(() => { /* o lazy tenta de novo quando precisar */ }); };
    const idle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(run, { timeout: 8000 })
      : window.setTimeout(run, 4000);
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);

  useEffect(() => onTableEvent((kind, data) => {
    if (kind !== 'trophy-unlocked') return;
    const auth = getAuthState();
    if (auth.status !== 'in' || data.user !== auth.user.id) return;
    refreshTrophySummary();
    const tier = TIERS.includes(data.tier as TrophyTier) ? (data.tier as TrophyTier) : 'bronze';
    setQueue((q) => [...q, { key: `${String(data.trophy)}-${Date.now()}`, title: String(data.title ?? 'Troféu'), tier }]);
  }), []);

  const current = queue[0];
  // Sai com a animação de saída, e só então o próximo da fila entra.
  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => { setLeaving(false); setQueue((q) => q.slice(1)); }, LEAVE_MS);
  };
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(dismiss, SHOW_MS[current.tier]);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return (
    <Suspense fallback={null}>
      <TrophyUnlockCard
        key={current.key}
        toast={current}
        leaving={leaving}
        onOpen={() => { dismiss(); navigate('/trofeus'); }}
        onClose={dismiss}
      />
    </Suspense>
  );
});
