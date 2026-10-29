// Uma regra compartilhada com a mesa: o jogador abre um talento, habilidade,
// item ou magia na ficha e toca em "Compartilhar"; todo aparelho aberto na
// plataforma mostra o texto num cartão, para a mesa ler a mesma coisa.
//
// Viaja só a REFERÊNCIA (tipo, nome, rank): quem recebe busca a descrição pelos
// mesmos `fetch*Description` do drawer da ficha — o cache de traduções da mesa
// acabou de ser aquecido por quem compartilhou. Sem prosa na rede, a validação
// fica pequena.
//
// O backend tem a MESMA validação em `api/_lib/roll-store.js` (`sanitizeShare`)
// — espelhada à mão porque o servidor é JS puro; mudou aqui, muda lá.
//
// `handout` é o que o GM mostra pelo Diário de Campanha: `name` é o título e
// `ref` o id do que foi mostrado (`?reveal=`), de onde o cartão lê o texto e a
// imagem. Só o servidor o cria (`journal-reveal`).

export type ShareType = 'feat' | 'special' | 'item' | 'spell' | 'handout'

const SHARE_TYPES: readonly ShareType[] = ['feat', 'special', 'item', 'spell', 'handout']

export interface TableShare {
    id: string
    /** Hora do servidor (ms). */
    at: number
    /** Quem compartilhou: o personagem. */
    by: string
    slug?: string
    /** Cor do personagem (hex de 6 dígitos), a mesma das rolagens dele. */
    color: string
    type: ShareType
    /** Nome em inglês: é a chave de busca na AON. */
    name: string
    /** Rank conjurado (magia) ou nível (talento). */
    level?: number
    /** CD e ataque de quem conjura — só magia. */
    caster?: { name: string; dc: number; attack: number; tradition: string }
    /** Só `handout`: o id do que o GM mostrou. */
    ref?: string
}

/** Uma regra (talento, habilidade, item, magia): o cartão busca a descrição pela AON. */
export type RuleShare = TableShare & { type: Exclude<ShareType, 'handout'> }

export const isRuleShare = (s: TableShare): s is RuleShare => s.type !== 'handout'

const HEX = /^#[0-9a-fA-F]{6}$/
const ID_RE = /^[a-z0-9-]{1,64}$/
/** Até 120 caracteres, sem quebra de linha nem outro caractere de controle. */
const validName = (v: unknown): v is string =>
    typeof v === 'string' && v.length <= 120 && !!v.trim() && ![...v].some((c) => c.charCodeAt(0) < 32)
const isInt = (v: unknown, max: number): v is number => Number.isInteger(v) && Math.abs(v as number) <= max
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizeCaster(raw: unknown): TableShare['caster'] | null {
    if (!raw || typeof raw !== 'object') return null
    const c = raw as Record<string, unknown>
    if (!isInt(c.dc, 99) || c.dc < 0 || !isInt(c.attack, 99)) return null
    const name = str(c.name, 40)
    if (!name) return null
    return { name, dc: c.dc, attack: c.attack, tradition: str(c.tradition, 20) }
}

export function sanitizeTableShare(raw: unknown): TableShare | null {
    if (!raw || typeof raw !== 'object') return null
    const s = raw as Record<string, unknown>
    if (typeof s.id !== 'string' || !ID_RE.test(s.id)) return null
    if (typeof s.color !== 'string' || !HEX.test(s.color)) return null
    if (!SHARE_TYPES.includes(s.type as ShareType)) return null
    if (!validName(s.name)) return null
    const out: TableShare = {
        id: s.id,
        at: typeof s.at === 'number' && Number.isFinite(s.at) ? s.at : 0,
        by: str(s.by, 40),
        color: s.color,
        type: s.type as ShareType,
        name: s.name,
    }
    if (typeof s.slug === 'string' && ID_RE.test(s.slug)) out.slug = s.slug
    // Só talento e magia têm nível no pedido de descrição.
    if ((out.type === 'feat' || out.type === 'spell') && isInt(s.level, 30) && s.level >= 0) out.level = s.level
    if (out.type === 'spell') {
        const caster = sanitizeCaster(s.caster)
        if (caster) out.caster = caster
    }
    if (out.type === 'handout') {
        if (typeof s.ref !== 'string' || !ID_RE.test(s.ref)) return null
        out.ref = s.ref
    }
    return out
}
