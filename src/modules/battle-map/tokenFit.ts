/**
 * Onde, na imagem, fica o CENTRO do círculo do token — e quanto ela é ampliada.
 *
 * `x`/`y` são frações da imagem (0 = borda esquerda/de cima, 1 = direita/de
 * baixo) do ponto que vai para o centro do círculo; `z` é a ampliação sobre o
 * "cobrir o círculo" (1 = a imagem mal cobre). Padrão: o centro da imagem, sem
 * ampliação — o que o token sempre fez.
 *
 * É escolha de EXIBIÇÃO do GM (campo `fit:<id>` do mapa), não do que o token É:
 * nada da imagem é cortado no envio, então dá para mudar de ideia depois.
 */
export interface TokenFit {
    x: number
    y: number
    z: number
    /**
     * Imagem enviada AQUI, no mapa, no lugar da que o encontro mandou. Mora junto do
     * enquadramento porque os dois nascem do mesmo diálogo — e um enquadramento só
     * faz sentido para a imagem a que ele foi feito. Só vale para monstro.
     */
    url?: string
}

export const DEFAULT_FIT: TokenFit = { x: 0.5, y: 0.5, z: 1 }
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

/** Lê o que veio do servidor; qualquer coisa estranha vira o padrão. */
export function sanitizeFit(raw: unknown): TokenFit {
    if (!raw || typeof raw !== 'object') return DEFAULT_FIT
    const r = raw as Partial<TokenFit>
    const url = typeof r.url === 'string' && r.url.length > 0 && r.url.length < 600 ? r.url : undefined
    return { x: num(r.x, 0, 1, 0.5), y: num(r.y, 0, 1, 0.5), z: num(r.z, MIN_ZOOM, MAX_ZOOM, 1), ...(url ? { url } : {}) }
}

export const isDefaultFit = (f: TokenFit) => f.x === 0.5 && f.y === 0.5 && f.z === 1 && !f.url

/** Tamanho da imagem (em % do círculo) para cobri-lo com a ampliação `z`. */
export function coverSize(aspect: number, z: number): { w: number; h: number } {
    const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1
    return { w: Math.max(1, a) * 100 * z, h: Math.max(1, 1 / a) * 100 * z }
}

/** O ponto escolhido não pode puxar a imagem a ponto de deixar o círculo com um canto vazio. */
export function clampFit(fit: TokenFit, aspect: number): TokenFit {
    const { w, h } = coverSize(aspect, fit.z)
    const mx = 50 / w
    const my = 50 / h
    return {
        z: fit.z,
        x: Math.min(1 - mx, Math.max(mx, fit.x)),
        y: Math.min(1 - my, Math.max(my, fit.y)),
        ...(fit.url ? { url: fit.url } : {}),
    }
}

/** Posição e tamanho da imagem dentro do círculo, em %: o ponto (x, y) cai no centro. */
export function fitStyle(fit: TokenFit, aspect: number): { width: string; height: string; left: string; top: string } {
    const f = clampFit(fit, aspect)
    const { w, h } = coverSize(aspect, f.z)
    return { width: `${w}%`, height: `${h}%`, left: `${50 - f.x * w}%`, top: `${50 - f.y * h}%` }
}
