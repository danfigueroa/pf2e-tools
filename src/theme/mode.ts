// Tema da plataforma: claro (o de sempre), escuro ou o do sistema.
//
// É uma CONSTANTE lida no boot, como o idioma (`src/i18n`) e a mesa: trocar de tema
// recarrega a página. Por isso `palette.ts` pode exportar os tokens do modo ativo como
// constantes comuns — os componentes importam `parchment.paper`, `HP_COLOR`… direto, e
// concatenam alpha na string (`accent + '22'`), o que variáveis CSS quebrariam.
//
// A escolha é do APARELHO (decisão do usuário): o celular na mesa à noite pode ficar
// escuro e o computador claro. "Sistema" segue o `prefers-color-scheme` desta carga; o
// sistema mudar com o app aberto só vale na próxima (recarregar sozinho no meio do turno
// perderia o que está na tela).
//
// O `index.html` repete esta leitura num script inline para a primeira pintura não piscar.

export type ThemePref = 'light' | 'dark' | 'system'
export type ThemeMode = 'light' | 'dark'

export const THEME_KEY = 'pf2e:theme'

const isPref = (v: unknown): v is ThemePref => v === 'light' || v === 'dark' || v === 'system'

function readStored(): ThemePref | null {
    try {
        const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_KEY)
        return isPref(v) ? v : null
    } catch {
        return null
    }
}

function systemDark(): boolean {
    try {
        return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
        return false
    }
}

function detect(): ThemeMode {
    // Fora do navegador (os scripts `check-*` importam o TS): claro, a não ser com
    // `PF2E_THEME=dark` — é como o `check-contrast` confere os dois conjuntos.
    if (typeof window === 'undefined') {
        const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        return env?.PF2E_THEME === 'dark' ? 'dark' : 'light'
    }
    const pref = readStored() ?? 'system'
    if (pref === 'system') return systemDark() ? 'dark' : 'light'
    return pref
}

/** O que o aparelho escolheu ("Sistema" quando nunca escolheu). */
export const themePref: ThemePref = readStored() ?? 'system'
/** O tema desta carga da página. */
export const themeMode: ThemeMode = detect()
export const isDark = themeMode === 'dark'

/** Grava a escolha neste aparelho e recarrega (o tema é constante por carga). */
export function setThemePref(next: ThemePref) {
    try { localStorage.setItem(THEME_KEY, next) } catch { /* sem armazenamento: não há como lembrar */ }
    // Nada mudou de fato (ex.: "Sistema" → "Escuro" com o sistema já escuro): só grava.
    const resolved = next === 'system' ? (systemDark() ? 'dark' : 'light') : next
    if (resolved === themeMode) return
    location.reload()
}

if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = themeMode
    document.documentElement.style.colorScheme = themeMode
}
