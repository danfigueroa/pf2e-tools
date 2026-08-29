// Loader de ESM que deixa o Node importar os `.ts` do `src/` direto.
//
// Existe para os scripts de conferência (`check-scaling.mjs`) poderem usar o
// MESMO código que o app usa, em vez de uma cópia traduzida à mão que
// envelheceria em silêncio.
//
// Faz duas coisas que o Node não faz sozinho:
//   1. resolve import sem extensão (`./types` → `./types.ts`), como o Vite;
//   2. remove os tipos com o `typescript`, que já é dependência de dev.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx']

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
    const base = new URL(specifier, context.parentURL)
    if (!existsSync(fileURLToPath(base))) {
      for (const ext of CANDIDATES) {
        const candidate = pathToFileURL(fileURLToPath(base) + ext)
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, format: 'module', shortCircuit: true }
        }
      }
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url, context)
  const source = readFileSync(fileURLToPath(url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  })
  return { format: 'module', source: outputText, shortCircuit: true }
}
