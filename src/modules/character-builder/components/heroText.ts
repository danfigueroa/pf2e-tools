import { locale, tr } from '../../../i18n';
import type { SaveStatus } from '../hooks/useBuild';

export const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  pending: tr('Alterações por salvar…', 'Unsaved changes…'),
  saving: tr('Salvando…', 'Saving…'),
  saved: tr('Salvo', 'Saved'),
  offline: tr('Salvo neste aparelho', 'Saved on this device'),
  error: tr('Salvo neste aparelho', 'Saved on this device'),
};

/** "Magus 7 · Humano · Laughing Shadow". */
export function heroSubtitle(parts: { className?: string | null; level: number; ancestry?: string | null; subclass?: string | null }) {
  const head = parts.className ? `${parts.className} ${parts.level.toLocaleString(locale)}` : tr(`Nível ${parts.level}`, `Level ${parts.level}`);
  return [head, parts.ancestry, parts.subclass].filter(Boolean).join(' · ');
}
