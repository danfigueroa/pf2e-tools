// O grupo da mesa para a Início: as fichas publicadas com o PV, as condições e as ações de
// agora, e quem está online. Lê o estado da mesa (`loadCharacter`) e acompanha cada escrita
// pelo Realtime (`onStateChange`), como a ficha. O PV máximo sai da ficha publicada
// (`characterMaxHp`, com o corte de Drenado), lida uma vez por personagem.

import { useEffect, useMemo, useState } from 'react';
import { fetchPublished, type PublishedSummary } from '../../services/sheets';
import { ensureStateLive, loadCharacter, onStateChange } from '../../services/tableState';
import { usePresence } from '../../services/presence';
import { usePublishedSheets } from '../../modules/character-viewer/usePublishedSheets';
import { parseCharacterJson, type BuildInfo } from '../../pathbuilder/types';
import { characterMaxHp } from '../../modules/character-viewer/helpers';
import { CONDITIONS_BY_ID, computeConditionModifiers } from '../../modules/character-viewer/conditions';
import { sanitizeConditions, type ConditionState } from '../../modules/character-viewer/components/useConditions';
import { sanitizeHp, type HpStored } from '../../modules/character-viewer/components/useHpTracker';
import { sanitizeActions, type ActionsStored } from '../../modules/character-viewer/actions';

export interface PartyMember {
  slug: string;
  name: string;
  className: string;
  level: number;
  ownerId: string | null;
  /** `null` até a ficha publicada chegar (o máximo depende dela). */
  hp: { current: number; max: number; temp: number } | null;
  /** "Amedrontado 1", "Ferido 2" — as marcadas, na ordem do catálogo. */
  conditions: string[];
  actions: ActionsStored | null;
  /** Alguém está com a ficha aberta, ou o dono está no app. */
  online: boolean;
}

interface Live { hp: HpStored | null; conditions: ConditionState; actions: ActionsStored | null }

const builds = new Map<string, Promise<BuildInfo | null>>();
function buildOf(slug: string): Promise<BuildInfo | null> {
  let p = builds.get(slug);
  if (!p) {
    p = fetchPublished(slug).then((sheet) => {
      if (!sheet) return null;
      try { return parseCharacterJson(sheet.json); } catch { return null; }
    });
    builds.set(slug, p);
  }
  return p;
}

const conditionLabels = (state: ConditionState): string[] =>
  Object.entries(state)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => {
      const def = CONDITIONS_BY_ID[id];
      if (!def) return null;
      return def.valued ? `${def.name} ${v}` : def.name;
    })
    .filter((x): x is string => !!x);

/** As fichas publicadas da mesa, vivas. */
export function useParty(): { members: PartyMember[]; ready: boolean } {
  const { published } = usePublishedSheets();
  const peers = usePresence();
  const [live, setLive] = useState<Record<string, Live>>({});
  const [loadedBuilds, setBuilds] = useState<Record<string, BuildInfo | null>>({});
  const [ready, setReady] = useState(false);

  const slugs = useMemo(() => published.map((p) => p.slug).join('|'), [published]);

  useEffect(() => {
    const list = slugs ? slugs.split('|') : [];
    if (list.length === 0) return;
    let alive = true;
    ensureStateLive();
    for (const slug of list) {
      void loadCharacter(slug).then((snap) => {
        if (!alive) return;
        setLive((prev) => ({
          ...prev,
          [slug]: {
            hp: sanitizeHp(snap.hp),
            conditions: sanitizeConditions(snap.conditions),
            actions: snap.actions ? sanitizeActions(snap.actions) : null,
          },
        }));
        setReady(true);
      });
      void buildOf(slug).then((b) => { if (alive) setBuilds((prev) => ({ ...prev, [slug]: b })); });
    }
    const stop = onStateChange((slug, field, data) => {
      if (!list.includes(slug) || (field !== 'hp' && field !== 'conditions' && field !== 'actions')) return;
      setLive((prev) => {
        const cur = prev[slug] ?? { hp: null, conditions: {}, actions: null };
        const next = { ...cur };
        if (field === 'hp') next.hp = sanitizeHp(data);
        if (field === 'conditions') next.conditions = sanitizeConditions(data);
        if (field === 'actions') next.actions = sanitizeActions(data);
        return { ...prev, [slug]: next };
      });
    });
    return () => { alive = false; stop(); };
  }, [slugs]);

  const members = useMemo(() => published.map((p: PublishedSummary): PartyMember => {
    const state = live[p.slug];
    const build = loadedBuilds[p.slug];
    let hp: PartyMember['hp'] = null;
    if (build) {
      const mods = computeConditionModifiers(state?.conditions ?? {}, build.level);
      const max = characterMaxHp(build, mods.hpMaxDelta);
      // Sem PV gravado = ninguém mexeu: cheio (a mesma regra do `useHpTracker`).
      const current = Math.min(max, Math.max(0, state?.hp?.current ?? max));
      hp = { current, max, temp: state?.hp?.temp ?? 0 };
    }
    const online = peers.some((peer) => peer.slug === p.slug || (p.ownerId !== null && peer.id === p.ownerId));
    return {
      slug: p.slug,
      name: p.name,
      className: p.className,
      level: p.level,
      ownerId: p.ownerId,
      hp,
      conditions: conditionLabels(state?.conditions ?? {}),
      actions: state?.actions ?? null,
      online,
    };
  }), [published, live, loadedBuilds, peers]);

  return { members, ready: ready || published.length > 0 };
}
