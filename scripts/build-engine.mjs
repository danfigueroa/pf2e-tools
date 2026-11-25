// Gera `api/_lib/builder-engine.gen.js`: o motor do Criador (TS) empacotado em JS puro para o servidor compilar o
// personagem no "Aplicar na mesa" (F10.1). Rode depois de mudar o motor; o `check-builder` falha se estiver velho.
//
//   node scripts/build-engine.mjs           grava o pacote
//   node scripts/build-engine.mjs --check   só confere (sai ≠ 0 se o pacote não bate com o código)
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const ENGINE_OUT = `${ROOT}api/_lib/builder-engine.gen.js`

export async function bundleEngine() {
    const out = await build({
        entryPoints: [`${ROOT}src/modules/character-builder/engine/server.ts`],
        bundle: true, format: 'esm', platform: 'node', target: 'node20', write: false, legalComments: 'none',
        banner: { js: '// GERADO por scripts/build-engine.mjs a partir de src/modules/character-builder/engine/. Não edite.\n/* i18n-ignore-file */' },
    })
    return out.outputFiles[0].text
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const code = await bundleEngine()
    if (process.argv.includes('--check')) {
        let current = ''
        try { current = readFileSync(ENGINE_OUT, 'utf8') } catch { /* sem pacote */ }
        if (current !== code) {
            console.error('api/_lib/builder-engine.gen.js está velho: rode node scripts/build-engine.mjs')
            process.exit(1)
        }
        console.log('Pacote do motor em dia.')
    } else {
        writeFileSync(ENGINE_OUT, code)
        console.log(`api/_lib/builder-engine.gen.js: ${Math.round(code.length / 1024)} KB`)
    }
}
