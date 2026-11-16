import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, onTableEvent, subscribeNotifications } from '../services/notifications';
import { getAuthState } from '../services/auth';
import { mesaKey } from '../services/mesa';
import { peekTrophySummary, refreshTrophySummary, TIER_POINTS, type TrophyTier } from '../services/trophies';
import type { UnlockToast } from '../modules/trophies/TrophyUnlockCard';
import { isEn, tr } from '../i18n';

// "Troféu desbloqueado", em qualquer página: montado UMA vez no `MainLayout`. Vários de uma vez
// (encerrar a sessão dá alguns) entram em fila, um por vez. Dois formatos, os dois em chunks à
// parte, baixados com o app ocioso — o primeiro troféu não espera o código chegar:
//   - CERIMÔNIA em tela cheia: o troféu DESTA conta, e o ouro ou a platina de um colega;
//   - FAIXA no topo: o bronze e a prata de um colega — e qualquer um quando a pessoa está
//     digitando (a cerimônia taparia o que ela escreve; o troféu fica para rever na página).
// O do colega vem do canal ao vivo. O MEU vem da lista do sino (`?events=1`, relida a cada
// reconexão): assim o que foi ganho com o app fechado é celebrado na próxima abertura. A marca
// do que já foi celebrado é do aparelho e da mesa (o id é o do evento da mesa).

const loadCard = () => import('../modules/trophies/TrophyUnlockCard');
const loadCeremony = () => import('../modules/trophies/TrophyCeremony');
const TrophyUnlockCard = lazy(loadCard);
const TrophyCeremony = lazy(loadCeremony);

const TIERS: TrophyTier[] = ['bronze', 'prata', 'ouro', 'platina'];
const BANNER_MS: Record<TrophyTier, number> = { bronze: 6000, prata: 6500, ouro: 7500, platina: 9000 };
const MINE_MS: Record<TrophyTier, number> = { bronze: 7000, prata: 7500, ouro: 8500, platina: 11000 };
/** A cerimônia do colega é mais curta: a festa é dele. */
const PEER_MS: Record<TrophyTier, number> = { bronze: 4500, prata: 4500, ouro: 5000, platina: 6500 };
const LEVEL_MS = 2200;
const BUNDLE_MS = 11000;
const LEAVE_MS = 260;
/** Mais do que isto ganho com o app fechado vira uma cerimônia só. */
const BUNDLE_OVER = 3;

const tierOf = (data: Record<string, unknown>): TrophyTier => (TIERS.includes(data.tier as TrophyTier) ? (data.tier as TrophyTier) : 'bronze');

function toastOf(data: Record<string, unknown>, key: string, who: string | null): UnlockToast {
  return {
    key, who, tier: tierOf(data),
    title: String((isEn ? data.titleEn : null) ?? data.title ?? tr('Troféu', 'Trophy')),
    // Aviso antigo (de antes da descrição e da categoria no evento) chega sem elas.
    description: String((isEn ? data.descriptionEn : null) ?? data.description ?? ''),
    category: typeof data.category === 'string' ? data.category : null,
  };
}

/** Quem está com o cursor num campo de texto não recebe a tela cheia. */
function typing(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit|reset|file|color)$/.test((el as HTMLInputElement).type));
}

const markKey = (userId: string) => mesaKey(`pf2e:trophies:celebrated:${userId}`);
function readMark(userId: string): number | null {
  try {
    const raw = localStorage.getItem(markKey(userId));
    const n = raw === null ? NaN : Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  } catch { return null; }
}
function writeMark(userId: string, value: number) {
  try { localStorage.setItem(markKey(userId), String(value)); } catch { /* sem storage: vale nesta carga */ }
}

export const TrophyToastLayer = memo(function TrophyToastLayer() {
  const [queue, setQueue] = useState<UnlockToast[]>([]);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  /** Os pontos da conta contando os troféus desta rajada que o resumo ainda não leu. */
  const running = useRef<number | null>(null);

  useEffect(() => {
    const run = () => {
      void loadCard().catch(() => { /* o lazy tenta de novo quando precisar */ });
      void loadCeremony().catch(() => { /* idem */ });
    };
    const idle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(run, { timeout: 8000 })
      : window.setTimeout(run, 4000);
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    /** Os meus que chegaram AO VIVO, com os pontos de antes (para o ato do nível). */
    const live = new Map<number, number | null>();
    const queued = new Set<number>();

    const offEvent = onTableEvent((kind, data, eventId) => {
      if (kind !== 'trophy-unlocked') return;
      const auth = getAuthState();
      if (auth.status !== 'in') return;
      if (data.user === auth.user.id) {
        // O meu entra pela lista do sino, logo abaixo (`sync`); aqui só se guarda o "antes".
        const summary = peekTrophySummary();
        const before = running.current ?? (summary ? summary.points.player + summary.points.gm : null);
        live.set(eventId, before);
        running.current = before === null ? null : before + TIER_POINTS[tierOf(data)];
        refreshTrophySummary();
        return;
      }
      const who = typeof data.name === 'string' && data.name ? data.name : tr('Alguém da mesa', 'Someone at the table');
      setQueue((q) => [...q, toastOf(data, `${String(data.trophy)}-${String(data.user)}-${eventId}`, who)]);
    });

    const sync = () => {
      const auth = getAuthState();
      if (auth.status !== 'in') return;
      const me = auth.user.id;
      const snap = getNotifications();
      const events = snap.items
        .filter((n) => n.key.startsWith('s'))
        .map((n) => ({ id: Number(n.key.slice(1)), n }))
        .filter((e) => Number.isSafeInteger(e.id));
      const mark = readMark(me);
      const fresh = events
        .filter((e) => e.n.kind === 'trophy-unlocked' && e.n.data.user === me && !queued.has(e.id)
          && (live.has(e.id) || (snap.ready && mark !== null && e.id > mark)))
        .sort((a, b) => a.id - b.id);
      // Primeira vez neste aparelho (sem marca): o passado não é celebrado, só se marca o topo.
      if (snap.ready) {
        const top = Math.max(mark ?? 0, ...events.map((e) => e.id));
        if (top !== mark) writeMark(me, top);
      }
      if (fresh.length === 0) return;
      fresh.forEach((e) => queued.add(e.id));
      const missed = fresh.filter((e) => !live.has(e.id));
      if (missed.length === fresh.length) refreshTrophySummary();
      if (missed.length > BUNDLE_OVER) {
        const list = missed.map((e) => toastOf(e.n.data, '', null));
        const best = [...list].sort((a, b) => TIER_POINTS[b.tier] - TIER_POINTS[a.tier])[0];
        setQueue((q) => [...q, {
          ...best, key: `bundle-${missed[0].id}`, description: '',
          bundle: [...list].sort((a, b) => TIER_POINTS[b.tier] - TIER_POINTS[a.tier]).map(({ title, tier, category }) => ({ title, tier, category })),
        }]);
      }
      const single = missed.length > BUNDLE_OVER ? fresh.filter((e) => live.has(e.id)) : fresh;
      if (single.length) {
        setQueue((q) => [...q, ...single.map((e) => ({ ...toastOf(e.n.data, `mine-${e.id}`, null), pointsBefore: live.get(e.id) ?? null }))]);
      }
    };
    const offStore = subscribeNotifications(sync);
    sync();
    return () => { offEvent(); offStore(); };
  }, []);

  // Só em dev: `__trophy({ tier: 'ouro', category: 'dados', who: 'Fulano', pointsBefore: 50 })` mostra o aviso sem tocar no banco.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __trophy?: (t?: Partial<UnlockToast>) => void };
    w.__trophy = (t = {}) => setQueue((q) => [...q, {
      key: `dev-${Date.now()}-${q.length}`, title: 'Dois vintes seguidos', tier: 'ouro', who: null, category: 'dados', // i18n-ok (só em dev)
      description: 'Tire dois 20 naturais seguidos na mesma sessão.', ...t, // i18n-ok (só em dev)
    }]);
    return () => { delete w.__trophy; };
  }, []);

  const current = queue[0];
  const currentKey = current?.key;
  const waiting = queue.length - 1;
  // O formato e o tempo são decididos quando o aviso chega à frente da fila, e não mudam com ele na tela.
  const { ceremony, duration } = useMemo(() => {
    if (!current) return { ceremony: false, duration: 0 };
    const full = (current.who === null || current.tier === 'ouro' || current.tier === 'platina') && !typing();
    if (!full) return { ceremony: false, duration: BANNER_MS[current.tier] };
    if (current.bundle) return { ceremony: true, duration: BUNDLE_MS };
    const base = (current.who ? PEER_MS : MINE_MS)[current.tier] + (typeof current.pointsBefore === 'number' ? LEVEL_MS : 0);
    // Com mais gente na fila, cada um fica um pouco menos.
    return { ceremony: true, duration: Math.round(base * (waiting > 0 ? 0.75 : 1)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Sai com a animação de saída, e só então o próximo da fila entra.
  const closing = useRef(false);
  const dismiss = () => {
    // O tempo acabando junto com o toque não pode levar dois da fila.
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      closing.current = false;
      setLeaving(false);
      setQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0) running.current = null;
        return rest;
      });
    }, LEAVE_MS);
  };
  useEffect(() => {
    if (!currentKey) return;
    const timer = window.setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  if (!current) return null;
  const open = () => { dismiss(); navigate('/trofeus'); };
  return (
    <Suspense fallback={null}>
      {ceremony
        ? <TrophyCeremony key={current.key} toast={current} leaving={leaving} duration={duration} waiting={waiting} onOpen={open} onClose={dismiss} />
        : <TrophyUnlockCard key={current.key} toast={current} leaving={leaving} duration={duration} onOpen={open} onClose={dismiss} />}
    </Suspense>
  );
});
