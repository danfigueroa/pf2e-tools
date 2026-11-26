import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, CircularProgress, Snackbar } from '@mui/material';
import { PhotoCamera as CameraIcon } from '@mui/icons-material';
import { chrome, gold, green } from '../../../theme';
import { tr } from '../../../i18n';
import { TOKEN_MAX_SIDE, deleteImage, imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images';
import { useSharedState } from '../../character-viewer/components/useSharedState';
import { SheetReadOnlyProvider } from '../../character-viewer/sheetAccess';
import { Medallion } from './ui';

interface TokenStored { url: string }
const sanitize = (raw: unknown): TokenStored | null =>
  raw && typeof raw === 'object' && typeof (raw as TokenStored).url === 'string' ? { url: (raw as TokenStored).url } : null;

interface Props {
  slug: string;
  name: string;
  /** `details.portrait` do build. */
  portrait?: string;
  /** Já tem ficha na mesa: o token da mesa (`<slug>/token`) existe e é a mesma imagem. */
  published: boolean;
  canEdit: boolean;
  onPortrait: (url: string) => void;
  size: number;
}

function Portrait({ slug, name, portrait, published, canEdit, onPortrait, size }: Props) {
  // A mesma fatia da Ficha Virtual (TokenAvatar): o retrato do Criador É o token do personagem no mapa e na ficha.
  const [token, setToken] = useSharedState<TokenStored | null>(`${slug}/token`, { empty: () => null, sanitize, isEmpty: (v) => v === null });
  const url = token?.url ?? portrait;
  const src = useImageUrl(url);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retrato escolhido antes de aplicar: quando a ficha chega à mesa, vira o token (se a mesa ainda não tem um).
  useEffect(() => {
    if (published && canEdit && portrait && !token) setToken(() => ({ url: portrait }));
  }, [published, canEdit, portrait, token, setToken]);
  // Token trocado na Ficha: o build acompanha (a Wiki e a revisão leem o `details.portrait`).
  useEffect(() => {
    if (canEdit && token?.url && token.url !== portrait) onPortrait(token.url);
  }, [canEdit, token, portrait, onPortrait]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { blob } = await shrinkImage(file, TOKEN_MAX_SIDE, true);
      const next = await uploadImage(blob, 'tokens', slug);
      const old = url;
      onPortrait(next);
      if (published) setToken(() => ({ url: next }));
      if (old && old !== next) void deleteImage(old);
    } catch (e) {
      setError(imageErrorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  if (!canEdit) return <Medallion name={name} src={src} size={size} />;
  return (
    <>
      <ButtonBase onClick={() => input.current?.click()} disabled={busy} data-view=""
        aria-label={tr('Trocar a imagem do personagem (token)', 'Change the character image (token)')} title={tr('Imagem do personagem (token)', 'Character image (token)')}
        sx={{ borderRadius: '50%', position: 'relative', '&:hover .cam, &:focus-visible .cam': { opacity: 1 } }}>
        <Medallion name={name} src={src} size={size} />
        <Box className="cam" component="span" sx={{
          position: 'absolute', right: -2, bottom: -2, width: Math.max(22, size * 0.34), height: Math.max(22, size * 0.34), borderRadius: '50%',
          bgcolor: green.main, color: chrome.text, border: `2px solid ${gold.bright}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: src ? 0.85 : 1, '& svg': { fontSize: Math.max(13, size * 0.18) },
        }}>{busy ? <CircularProgress size={12} sx={{ color: chrome.text }} /> : <CameraIcon />}</Box>
      </ButtonBase>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)} message={error} />
    </>
  );
}

/** O medalhão do resumo que também troca a imagem do personagem (o mesmo token da Ficha Virtual). */
export function HeroPortrait(props: Props) {
  return (
    <SheetReadOnlyProvider value={!props.canEdit}>
      <Portrait {...props} />
    </SheetReadOnlyProvider>
  );
}
