// Versão do catálogo do Criador, que chega no `?me=1` (BASE-DE-REGRAS §5). Módulo à parte para o carregador do Criador
// ler sem importar o `auth.ts` (que puxaria a sessão para o chunk dele).

let version: string | null = null

export function setRulesVersion(value: string | null): void {
    version = value
}

/** Null sem login (modo local) ou antes da primeira importação: o carregador pergunta ao manifesto. */
export const rulesVersionHint = (): string | null => version
