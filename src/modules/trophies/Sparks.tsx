import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

// Faíscas e confete do desbloqueio: um `<canvas>` com partículas desenhadas num
// `requestAnimationFrame` (nada de elemento por partícula, nem de render React por quadro).
// Explode de um ponto, cai com a gravidade e some. Some sozinho ao acabar; com movimento
// reduzido nem monta (quem usa decide).
//   - faíscas (padrão): pontos e cruzinhas, num quadrado de `size` centrado no pai;
//   - `confetti`: papeizinhos que giram e planam, mais lentos e mais longe;
//   - `cover`: o canvas ocupa o pai inteiro (a cerimônia em tela cheia) e a explosão sai de
//     `originY` (fração da altura).

interface Props {
  /** Cores das partículas (hex de 6 dígitos, da paleta). */
  colors: readonly string[];
  count: number;
  /** Lado do canvas quando não é `cover`. */
  size?: number;
  /** Espera antes de explodir (ms) — para casar com a medalha assentando. */
  delay?: number;
  /** Levas seguidas (platina). */
  bursts?: number;
  confetti?: boolean;
  cover?: boolean;
  originY?: number;
}

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string
  kind: 'dot' | 'star' | 'paper'; rot: number; spin: number; phase: number
}

export function Sparks({ colors, count, size = 220, delay = 0, bursts = 1, confetti = false, cover = false, originY = 0.5 }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = cover ? canvas.clientWidth : size;
    const h = cover ? canvas.clientHeight : size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    // Tela estreita: metade das partículas e alcance menor (celular modesto, canvas de tela cheia).
    const small = w < 600;
    const n = cover && small ? Math.ceil(count / 2) : count;
    const reach = cover ? Math.max(0.75, Math.min(1.9, w / 520)) : 1;

    const sparks: Spark[] = [];
    const burst = () => {
      for (let i = 0; i < n; i += 1) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const paper = confetti && Math.random() < 0.7;
        const speed = (paper ? 3.2 + Math.random() * 6.5 : 1.6 + Math.random() * 3.2) * reach;
        const max = paper ? 110 + Math.random() * 80 : 46 + Math.random() * 34;
        sparks.push({
          x: w / 2, y: h * originY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (paper ? 3.4 : 1.2),
          life: max, max, r: paper ? 3 + Math.random() * 3 : 1.4 + Math.random() * 2.2, color: colors[i % colors.length],
          kind: paper ? 'paper' : Math.random() < 0.25 ? 'star' : 'dot',
          rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.3, phase: Math.random() * Math.PI * 2,
        });
      }
    };

    let raf = 0;
    let last = 0;
    const timers: number[] = [];
    const draw = (now: number) => {
      // O passo acompanha o tempo real: numa tela de 120 Hz a explosão não corre em dobro.
      const k = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= k;
        const paper = s.kind === 'paper';
        s.vy += (paper ? 0.1 : 0.07) * k;
        s.vx *= paper ? 0.975 : 0.985;
        if (paper) s.vy *= 0.985;
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.rot += s.spin * k;
        ctx.globalAlpha = Math.max(0, Math.min(1, (s.life / s.max) * (paper ? 2.2 : 1)));
        ctx.fillStyle = s.color;
        if (paper) {
          // Um papelzinho girando: a largura "respira" como se virasse no ar.
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.scale(1, Math.cos(s.phase + s.life * 0.16));
          ctx.fillRect(-s.r, -s.r * 0.6, s.r * 2, s.r * 1.2);
          ctx.restore();
        } else if (s.kind === 'star') {
          // Uma cruzinha brilhante, girando com a vida.
          const len = s.r * 2.6;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.life * 0.2);
          ctx.fillRect(-len, -0.7, len * 2, 1.4);
          ctx.fillRect(-0.7, -len, 1.4, len * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (sparks.some((s) => s.life > 0) || timers.length > 0) raf = requestAnimationFrame(draw);
    };

    for (let b = 0; b < bursts; b += 1) {
      timers.push(window.setTimeout(() => {
        burst();
        timers.shift();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }, delay + b * 420));
    }
    return () => { cancelAnimationFrame(raf); timers.forEach((t) => clearTimeout(t)); };
  }, [colors, count, size, delay, bursts, confetti, cover, originY]);

  return (
    <Box component="canvas" ref={ref} aria-hidden sx={cover
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }
      : { position: 'absolute', left: '50%', top: '50%', width: size, height: size, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
  );
}
