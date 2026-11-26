import { useImageUrl } from '../../../services/images';
import { useSharedState } from '../../character-viewer/components/useSharedState';
import { SheetReadOnlyProvider } from '../../character-viewer/sheetAccess';
import { Medallion } from './ui';

interface TokenStored { url: string }
const sanitize = (raw: unknown): TokenStored | null =>
  raw && typeof raw === 'object' && typeof (raw as TokenStored).url === 'string' ? { url: (raw as TokenStored).url } : null;

function Inner({ slug, name, portrait, size, dashed }: { slug: string; name: string; portrait?: string | null; size: number; dashed?: boolean }) {
  // A mesma fatia da Ficha e do Mapa (`<slug>/token`), só leitura; sem token na mesa, o retrato do build (rascunho).
  const [token] = useSharedState<TokenStored | null>(`${slug}/token`, { empty: () => null, sanitize, isEmpty: (v) => v === null });
  const src = useImageUrl(token?.url ?? portrait ?? undefined);
  return <Medallion name={name} src={src} size={size} dashed={dashed} />;
}

/** Medalhão de um personagem da lista: a foto (token da mesa ou retrato do build) e, sem ela, a inicial. */
export function BuildMedallion(props: { slug: string; name: string; portrait?: string | null; size: number; dashed?: boolean }) {
  return <SheetReadOnlyProvider value><Inner {...props} /></SheetReadOnlyProvider>;
}
