// Textos curtos da moldura e da Início, em pt-BR: há quanto tempo, saudação, data da sessão.

import { rayTotal, type TableRoll } from '../dice/tableRoll';

/** "agora", "há 3 min", "há 2 h", "ontem", "12/10". */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'agora';
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  if (h < 48) return 'ontem';
  return new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "Quarta-feira, 28 de outubro". */
export function longDate(now = new Date()): string {
  const text = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "sex., 31/10 às 20:00" — a próxima sessão. */
export function sessionDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} às ${time}`;
}

/** "Sábado, 14 de novembro" — a próxima sessão em destaque. */
export function sessionDay(iso: string): string {
  const text = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "14:00". */
export const sessionTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "hoje", "amanhã", "em 16 dias" — pelo calendário (meia-noite local), não por 24 h corridas. */
export function untilSession(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

/** "desde 20:15" — a sessão em andamento. */
export const sessionSince = (iso: string): string =>
  `desde ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/** O número grande de uma rolagem: o teste, senão o dano, senão o livre. */
export function rollHeadline(roll: TableRoll): number | null {
  if (roll.check) return roll.check.total;
  if (roll.rays?.length) return rayTotal(roll.rays);
  if (roll.damage) return roll.damage.total;
  if (roll.free) return roll.free.total;
  return null;
}
