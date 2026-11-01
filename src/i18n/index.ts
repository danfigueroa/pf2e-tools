// Idioma da plataforma: português (como sempre foi) ou inglês, o original do PF2e.
//
// É uma CONSTANTE lida no boot, como a mesa (`services/mesa.ts`): trocar de idioma
// recarrega a página. Por isso `tr()` é uma função comum, sem hook nem contexto, e vale
// também nos arquivos de lógica (rolagens, catálogos montados no nível do módulo).
//
// A escolha é da CONTA (`user_metadata.language`, gravada por `setLanguage`); o
// `localStorage` é só o cache da primeira pintura e o que vale antes do login. Quem
// reconcilia os dois é o `load()` de `services/auth.ts`.
//
// Regra da casa: o lado português de todo `tr()` é o texto de antes, sem mudança — o modo
// português continua idêntico. O `scripts/check-i18n.mjs` acusa texto em português fora
// de um `tr()`.

export type Lang = 'pt' | 'en'

export const LANG_KEY = 'pf2e:language'

const isLang = (v: unknown): v is Lang => v === 'pt' || v === 'en'

function readStored(): Lang | null {
    try {
        const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(LANG_KEY)
        return isLang(v) ? v : null
    } catch {
        return null
    }
}

function detect(): Lang {
    // Fora do navegador (os scripts `check-*` e o de pacotes importam o TS): português,
    // a não ser que se peça inglês — o Node tem `navigator.language` ('en-US') e, sem
    // isto, todo script rodaria em inglês.
    if (typeof window === 'undefined') {
        const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        return env?.PF2E_LANG === 'en' ? 'en' : 'pt'
    }
    const stored = readStored()
    if (stored) return stored
    // Aparelho que nunca escolheu: o idioma do navegador decide só se for inglês — a mesa
    // é brasileira e o padrão continua sendo o português.
    const nav = typeof navigator === 'undefined' ? '' : navigator.language || ''
    return /^en\b/i.test(nav) ? 'en' : 'pt'
}

/** O idioma desta carga da página. */
export const lang: Lang = detect()
export const isEn = lang === 'en'
/** Locale do `Intl` para datas e números. */
export const locale = isEn ? 'en-US' : 'pt-BR'

/** O texto no idioma atual. Os dois lados são obrigatórios: nenhum texto fica sem tradução. */
export function tr<T = string>(pt: T, en: T): T {
    return isEn ? en : pt
}

/** O que o aparelho guardou (nulo = nunca escolheu). */
export const storedLanguage = readStored

/** Grava a escolha NESTE aparelho (sem recarregar). */
export function rememberLanguage(next: Lang) {
    try { localStorage.setItem(LANG_KEY, next) } catch { /* sem armazenamento: vale só nesta carga */ }
}

export const fmtNumber = (n: number, options?: Intl.NumberFormatOptions) => n.toLocaleString(locale, options)

if (typeof document !== 'undefined') document.documentElement.lang = isEn ? 'en' : 'pt-BR'
