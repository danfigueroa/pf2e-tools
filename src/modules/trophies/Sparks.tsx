import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

// Faíscas do desbloqueio: um `<canvas>` com partículas desenhadas num `requestAnimationFrame`
// (nada de elemento por faísca, nem de render React por quadro). Explode do centro, cai com a
// gravidade e some. Some sozinho ao acabar; com movimento reduzido nem monta (quem usa decide).

interface Props {
  /** Cores das faíscas (hex de 6 dígitos, da paleta). */
  colors: readonly string[];
  count: number;
  size: number;
  /** Espera antes de explodir (ms) — para casar com a taça assentando. */
  delay?: number;
  /** Segunda leva (platina). */
  bursts?: number;
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string; star: boolean }

export function Sparks({ colors, count, size, delay = 0, bursts = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const sparks: Spark[] = [];
    const burst = () => {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 1.6 + Math.random() * 3.2;
        const max = 46 + Math.random() * 34;
        sparks.push({
          x: size / 2, y: size / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.2,
          life: max, max, r: 1.4 + Math.random() * 2.2, color: colors[i % colors.length], star: Math.random() < 0.25,
        });
      }
    };

    let raf = 0;
    const timers: number[] = [];
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= 1;
        s.vy += 0.07;
        s.vx *= 0.985;
        s.x += s.vx;
        s.y += s.vy;
        ctx.globalAlpha = Math.max(0, s.life / s.max);
        ctx.fillStyle = s.color;
        if (s.star) {
          // Uma cruzinha brilhante, girando com a vida.
          const a = s.life * 0.2, len = s.r * 2.6;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(a);
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
  }, [colors, count, size, delay, bursts]);

  return (
    <Box component="canvas" ref={ref} aria-hidden sx={{
      position: 'absolute', left: '50%', top: '50%', width: size, height: size,
      transform: 'translate(-50%, -50%)', pointerEvents: 'none',
    }} />
  );
}
