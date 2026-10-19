// Confere que TODO talento, habilidade e item do elenco que custa ação, reação ou Ponto Mítico
// tem um caminho na ficha que o contabiliza — sem rede: lê os JSONs das fichas e os pacotes de
// descrição (`public/descriptions/`), que já trazem `actions`, `traits` e `frequency` da AON.
//
//   node scripts/check-economy.mjs
//
// Sai com código diferente de zero quando algo do elenco fica sem cobertura. Rode depois de
// publicar/regerar um pacote (level-up de personagem novo) e depois de mexer em `activities.ts`,
// `mythicFeats.ts`, `mythicUse.ts` ou nas faixas de classe.
//
// Cobertura de cada item, na ordem:
//   1. "Usar" genérico   — `activityOf` devolve o custo (talentos/habilidades com ação, reação ou ponto);
//   2. caminho próprio   — `DEDICATED` em `activities.ts` (Rage, Shield Block, Godspeed…);
//   3. ✦ dos diálogos    — talento que só gasta ponto quando uma rolagem o pede (`mythicUse.ts`);
//   4. sem custo no turno — ação livre sem recurso, exploração (minutos) ou passivo.

import { register } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'

register('./ts-loader.mjs', import.meta.url)

const act = await import('../src/modules/character-viewer/activities.ts')
const sc = await import('../src/modules/character-viewer/spellCast.ts')
const mf = await import('../src/modules/character-viewer/mythicFeats.ts')
const mu = await import('../src/modules/character-viewer/mythicUse.ts')

/** Talentos que gastam ponto numa rolagem (✦) — o `mythicUse.ts` os oferece no diálogo. */
const MYTHIC_ROLL_FEATS = new Set(['Ears that Hear the Truth', 'Feet that Stride the Sky', 'Arms that Cut the Waves'])
/** Gasta ponto fora do turno / sem efeito que a ficha acompanhe: só informativo. */
const MYTHIC_INFO_ONLY = new Set(["Hydra's Bond"])

const dir = new URL('../public/', import.meta.url)
const slugOf = {
    'brukuthur10': 'brukuthur-the-barbarian-android',
    'cerosqualhanthallas10': 'cerosqualhanthallas',
    'eldarion10': 'eldarion',
    'ghanburi10': 'ghan-buri',
    'nathaniel10': 'nathaniel-o-magus',
    'thalos10': 'thalos',
}

let failures = 0
const fail = (msg) => { failures++; console.error(`✗ ${msg}`) }

for (const file of readdirSync(new URL('characters/', dir)).filter((f) => f.endsWith('.json'))) {
    const key = file.replace('.json', '')
    const bundleSlug = slugOf[key]
    if (!bundleSlug) { fail(`${file}: sem pacote de descrições mapeado (acrescente em slugOf)`); continue }
    const build = JSON.parse(readFileSync(new URL(`characters/${file}`, dir))).build
    const entries = JSON.parse(readFileSync(new URL(`descriptions/${bundleSlug}.json`, dir))).entries
    const tally = { generic: 0, dedicated: 0, roll: 0, free: 0, items: 0 }

    const owned = [
        ...build.feats.map((f) => ({ name: f[0], desc: entries.feat?.[f[0]] })),
        ...build.specials.map((n) => ({ name: n, desc: entries.special?.[n] })),
    ]
    for (const { name, desc } of owned) {
        if (!desc) continue
        const timed = sc.castTimeOf(desc.actions)
        const costs = timed.kind === 'actions' || timed.kind === 'reaction' || timed.kind === 'variable'
        const point = act.spendsMythicPoint(desc)
        if (act.isDedicated(name)) { tally.dedicated++; continue }
        if (act.activityOf(name, desc)) { tally.generic++; continue }
        if (MYTHIC_ROLL_FEATS.has(name) || MYTHIC_INFO_ONLY.has(name)) { tally.roll++; continue }
        if (costs || point) fail(`${build.name}: "${name}" custa ${desc.actions || 'ponto mítico'} e nenhum caminho o contabiliza`)
        else tally.free++
    }

    // Itens com custo de ativar (poções, elixires, venenos): o Inventário paga pela AON (`fetchItemTraits`).
    for (const [name, desc] of Object.entries(entries.item ?? {})) {
        if (desc?.actions) tally.items++
        void name
    }

    // O ✦ de cada talento de rolagem que a ficha tem precisa ser oferecido em algum contexto.
    for (const feat of MYTHIC_ROLL_FEATS) {
        if (!owned.some((o) => o.name === feat)) continue
        const ctx = { 'Ears that Hear the Truth': 'initiative', 'Feet that Stride the Sky': 'jump', 'Arms that Cut the Waves': 'swim' }[feat]
        if (mu.mythicOptionFor(build, ctx)?.feat !== feat) fail(`${build.name}: ${feat} não é oferecido no contexto ${ctx}`)
    }
    // O Mythic Strike vira ✦ no Golpe, e só com o talento.
    const hasMythicStrike = owned.some((o) => o.name === 'Mythic Strike')
    if (hasMythicStrike !== (mu.mythicOptionFor(build, 'strike')?.feat === 'Mythic Strike')) fail(`${build.name}: ✦ do Golpe não bate com o Mythic Strike da ficha`)

    // Os talentos míticos da faixa: o custo escrito em `mythicFeats.ts` tem de bater com a AON.
    for (const def of mf.mythicFeatsOf(build)) {
        const desc = entries.feat?.[def.name]
        if (!desc) { fail(`${build.name}: ${def.name} sem descrição no pacote`); continue }
        const aon = sc.castTimeOf(desc.actions)
        if (aon.kind !== def.info.time.kind || (aon.kind === 'actions' && aon.n !== def.info.time.n)) fail(`${build.name}: ${def.name} custa ${desc.actions} na AON e ${JSON.stringify(def.info.time)} em mythicFeats.ts`)
        if (def.info.mythicPoint !== act.spendsMythicPoint(desc)) fail(`${build.name}: ${def.name} — o Ponto Mítico não bate com o texto da AON`)
    }

    console.log(`${build.name.padEnd(34)} usar ${String(tally.generic).padStart(2)} · próprio ${String(tally.dedicated).padStart(2)} · ✦ ${tally.roll} · itens ${tally.items} · sem custo ${String(tally.free).padStart(2)}`)
}

console.log(failures ? `${failures} lacuna(s).` : 'Elenco inteiro coberto.')
process.exit(failures ? 1 : 0)
