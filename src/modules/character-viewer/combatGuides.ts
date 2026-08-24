import type { BuildInfo } from '../character-sheet/types'
import { abilityMod, totalHp } from './helpers'

// Guias de uso ("como jogar em combate") escritos à mão a partir da análise de
// cada ficha (classe, talentos, magias, itens). Cada guia casa por nome do
// personagem; fichas ainda não catalogadas caem no gerador heurístico abaixo,
// que monta um resumo tático a partir dos dados da build.

export interface CombatGuide {
    /** Casa o guia com uma build carregada. */
    match: (b: BuildInfo) => boolean
    markdown: string
    /** true = escrito à mão; false = derivado por heurística. */
    curated: boolean
}

const byName = (name: string) => (b: BuildInfo) =>
    (b.name || '').trim().toLowerCase() === name.toLowerCase()

// ---------------------------------------------------------------------------
// ARDAGAR — Druida 10 (Ordem Animal), Awakened Animal + Urso
// ---------------------------------------------------------------------------
const ARDAGAR = `## 🎯 Papel em Combate
**Druida da Ordem Animal** (Awakened Animal, tamanho Grande) — controlador/invocador com um **Urso Selvagem** (companheiro maduro e incrível) na linha de frente. Você orquestra: comanda o urso, lança buffs e blasters, e vira **battle form** quando precisa bater. CON 19, ~138 PV e CA 26 te deixam surpreendentemente durão.

## 🔁 Rotina de Turno
- 🐻 **1 ação — Comande o Urso:** sem o comando ele age só 1 vez; com o comando ele ganha **2 ações** (Stride+Strike ou 2 Strikes). *Nunca* pule isso.
- ✨ **2 ações — Magia:** *Haste* (dá ação extra ao urso ou a você), *Lightning Bolt* (dano em área), ou uma cura.
- ⚡ **1 ação — Mythic Strike:** gaste um **Ponto Mítico** e ataque com proficiência mítica. É o desempate contra o que tem **resistência ou imunidade mítica**.
- 🌿 Abertura alternativa: **Summon Elemental** para um terceiro corpo, ou entre em **battle form** e some ao urso na frente.

## ⭐ Nunca Esqueça
- 🐻 **Comandar o companheiro toda rodada** — o erro nº 1 é esquecer e desperdiçar metade do dano do urso.
- 💨 **Haste** no urso: +1 ação = +1 Strike do bicho por rodada. Enorme.
- 🩹 **Heal Animal** (foco): recoloca o urso na luta; é **1 ponto de foco**, então **refocus** depois.
- 🌀 **Wild Stride** + deslocamento alto: ignore terreno difícil para reposicionar e flanquear com o urso.
- 🗣️ **Steady Spellcasting:** menos chance de perder a magia se te atingirem conjurando.
- 🔄 **Healing Transformation (1 ação, nível 10):** antes de lançar uma magia de *polymorph* em **uma única criatura**, use isto — a transformação também cura **1d6 PV por nível da magia**. Uma *Animal Form* de 5º nível vira transformação + 5d6 de cura na mesma jogada. Não vale para truque nem para magia em área.

## ✨ Magias-Chave
- 🐾 **Battle forms** — *Animal Form*, *Dinosaur Form*, *Elemental Form*: gaste um slot e vire um brutamontes de linha de frente (gere o stat block na aba **Transformação**).
- ⚡ **Lightning Bolt:** dano em área primal.
- 💨 **Haste** (o melhor buff de ação) e 🧊 **Frostbite** (truque de dano + debuff).
- 🌊 **Summon Elemental** para bloquear passagem e flanquear.
- 💚 **Summon Healing Servitor** (5º, novo): um corpo extra que **cura enquanto você faz outra coisa** — bom quando a party toma dano espalhado e você não quer gastar seu turno curando.
- ❤️ **Heal** (vários slots, agora com **três** de 5º nível) para a party.

## 🎒 Itens & Recursos
- 🪄 **Staff of Healing (Greater), investido:** banco extra de curas — carregue-o e lance *Heal* sem gastar sua preparação.
- 🐻 **Wolfjaw Armor:** concede um ataque de **mandíbulas** desarmado (você não carrega armas) — seu golpe corpo a corpo padrão.
- 🔮 1 ponto de foco (Heal Animal): refocus entre lutas.
- ⭐ **Pontos Míticos:** moeda de *Mythic Strike*, *Correct the Story* e *Mythic Allies*. São poucos por dia — guarde para o inimigo que realmente resiste.

## 🛡️ Defesa & Sobrevivência
- 💪 **CON 19, ~138 PV e todos os saves ao menos expert** — você aguenta pancada; pode ficar mais à frente que a maioria dos conjuradores.
- 🐻 Deixe o urso segurar a linha e fique logo atrás, ao alcance de comandos e curas.
- 🏃 Alta mobilidade (Godspeed/Wild Stride) para reposicionar sob pressão.

## ⚠️ Erros Comuns
- ❌ **Não comandar o urso** — corta o dano dele pela metade.
- 🛡️ **Shield Block sem escudo:** você tem o talento, mas **nenhum escudo equipado** — sem escudo na mão a reação não faz nada. Considere adquirir um.
- ❌ Entrar em battle form e *ainda* tentar conjurar: em forma de batalha suas magias ficam limitadas — decida o modo do turno.
- ❌ Segurar *Haste*: ele rende mais quanto antes entrar.
- ❌ **Gastar Healing Transformation numa magia em área ou num truque** — ela só funciona em *polymorph* que tenha **um único alvo**.
- ❌ Esquecer que **Consult the Spirits** é de exploração (10 minutos, **uma vez por dia**): é ferramenta de reconhecimento antes da luta, não recurso de combate.`

// ---------------------------------------------------------------------------
// ELDARION — Ladino 10 (Thief), Elfo
// ---------------------------------------------------------------------------
const ELDARION = `## 🎯 Papel em Combate
**Ladino Trapaceiro (Thief)** élfico — assassino de precisão e batedor. Seu jogo é **iniciativa alta → deixar o alvo _off-guard_ → descarregar Sneak Attack**. A maior CA da party (**29**) e Reflexos mestres fazem de você um esquivo difícil de fixar. Skirmisher: entra, fere pesado, sai.

## 🔁 Rotina de Turno
- ⚔️ **Strike com a Gloom Blade (+20):** contra alvo **off-guard**, some **+2d6 de precisão (Sneak Attack)** e aplique **Debilitating Strike** (deixe o inimigo *lento*/*enfraquecido*).
- 🤝 **Garanta o off-guard:** *Gang Up* — **qualquer aliado adjacente** ao alvo já o deixa off-guard para você (sem precisar flanquear na diagonal exata). Ou flanqueie do jeito normal.
- 🏃 **3ª ação:** reposicione (Step/Stride, *Swift Sneak* para furtar em velocidade plena) ou segure para a reação.
- ⚡ **Mythic Strike (1 ação):** gaste um **Ponto Mítico** para atacar com proficiência mítica. Guarde para o inimigo com **resistência ou imunidade mítica** — e combine com off-guard, porque o Sneak Attack continua valendo.

## ⭐ Nunca Esqueça
- 🛡️ **Nimble Dodge (reação):** +2 CA contra um ataque — quase sempre vale gastar. Não termine a rodada com a reação sobrando.
- 🥇 **Surprise Attack:** na 1ª rodada, quem ainda não agiu está **off-guard** — por isso a iniciativa alta (Incredible Initiative + Elven Instincts) importa tanto. Bata forte no round 1.
- ☠️ **Poison Weapon / Improved Poison Weapon:** envenene a lâmina **antes** da luta; com o aprimorado o veneno persiste por mais tempo.
- 🤸 **Kip Up:** levante-se de graça sem provocar. **Evasive Reflexes** e **Slippery Prey** para escapar de agarrões e ameaças.
- 🥷 **Sneak Adept (nível 10):** ao **Sneak**, uma *falha* vira **sucesso** — só a falha crítica ainda te denuncia. Furtar-se para a posição passou de aposta a plano confiável: use para abrir a luta já escondido e garantir o off-guard do round 1.
- 🕊️ **Aerobatics Mastery (nível 10):** **+2 de circunstância** em Acrobacia para *Maneuver in Flight* e **duas manobras numa ação só** (CD da mais difícil +5). Com *Feet that Stride the Sky*, você reposiciona no ar em uma ação e ainda ataca.
- 🩹 **Battle Medicine:** cura de emergência em você ou num aliado no meio do combate.

## 🎒 Itens & Recursos
- 🗡️ **Gloom Blade** (shadow): não emite luz e ignora certas defesas; sua arma principal — combine com **Quick Draw**.
- 🥷 **Shadow Weaver (+1 resilient, shadow):** bônus em Furtividade e nos saves — mantenha investida.
- 💍 **Ring of Climbing** + **Feet that Stride the Sky** (mítico): mobilidade vertical e aérea para alcançar alvos e escapar — agora com **Aerobatics Mastery** para manobrar de verdade lá em cima.
- 🎭 **Vigilante — Quick Change (nível 10):** trocar de identidade caiu de **1 minuto para 3 ações**, ou seja, dá para fazer **dentro do combate**. Com Deception mestre (+CHA 18), a identidade social virou ferramenta tática, não só de interlúdio.
- ⭐ **Pontos Míticos:** moeda de *Mythic Strike*, *Divert Destiny* e *Summon Mythic Power*. São escassos — gaste no golpe que decide a luta.

## 🛡️ Defesa & Sobrevivência
- 🛡️ **Melhor defesa: CA 29 + Reflexos mestres com Evasion** — transforma AoE em dano zero num sucesso.
- 🧠 **Deny Advantage:** inimigos de nível igual ou menor não te deixam off-guard com facilidade.
- ⚠️ ~116 PV e sem armadura pesada: não troque golpes parado com brutamontes — bata e recue (skirmish).

## ⚠️ Erros Comuns
- ❌ **Atacar sem off-guard:** sem isso você perde os **2d6** de Sneak Attack — monte o flanking/Gang Up antes.
- ❌ Esquecer a **reação Nimble Dodge**.
- ❌ Não pré-envenenar a arma no começo do combate.
- ❌ Desperdiçar a alta iniciativa não focando o alvo certo no round 1 (Surprise Attack).
- ❌ **Continuar tratando Sneak como aposta:** com *Sneak Adept* a falha vira sucesso — vale muito mais a pena se aproximar escondido do que atacar de longe sem off-guard.
- ❌ Esquecer que **Quick Change** agora cabe num turno: trocar de identidade deixou de exigir sair de cena.`

// ---------------------------------------------------------------------------
// GHAN BURI — Guerreiro 10 (Bastion), Jotunborn Grande + Escudo-Fortaleza
// ---------------------------------------------------------------------------
const GHAN_BURI = `## 🎯 Papel em Combate
**Guerreiro Bastion (Bastião)** — um **Jotunborn Grande** (sangue de gigante) que é a **muralha da party**. Com o **Escudo-Fortaleza** (tower shield) e a **Hero's Plate**, você é um tanque quase imóvel: fica na **linha de frente**, tranca a passagem, protege os aliados e pune quem se aproxima. FOR 20 e a Warhammer garantem que a defesa vem acompanhada de pancada de verdade. Alcance **3 m (Grande)** — você ameaça mais espaço que os outros.

## 🔁 Rotina de Turno
- 🛡️ **1ª ação — Raise a Shield (SEMPRE):** +3 CA com o Escudo-Fortaleza enquanto erguido. Este é o botão que você aperta *toda rodada* — sua defesa inteira depende dele.
- 🔨 **2ª–3ª ação — Strike com a Warhammer (+23):** 2d8+8 contusão **+1d6 elétrico (Shock) +1d6 sônico (Thundering)**. No **crítico**, a especialização do grupo *Hammer* **derruba** o alvo (prone).
- 🎯 **Exacting Strike (1 ação):** um Strike que, se **errar**, **não conta para o MAP** — dá pra atacar agressivo sem medo de estragar a mira do 2º golpe. Ótimo como *primeiro* ataque da rodada.
- 🛑 Se precisar segurar posição: erga o escudo, dê **Take Cover** atrás dele e guarde as reações — você vira uma rocha.

## ⭐ Nunca Esqueça
- 🧱 **Take Cover atrás do Escudo-Fortaleza:** com o escudo erguido, **Take Cover** sobe o bônus de circunstância para **+4 CA** — e com **Reflexive Shield** esse bônus **também vale nos Reflexos**. Contra AoE e chuva de flechas, é ouro.
- 🛡️ **Muitas reações de escudo:** você tem **Shield Block** + **Quick Shield Block** (uma **reação extra** só para Shield Block por rodada) + **Reactive Shield** (erguer o escudo *como reação* ao ser atingido). Quase nunca leve um golpe "no seco".
- 🧑‍🤝‍🧑 **Shield Warden:** você pode gastar **Shield Block para parar dano de um aliado adjacente**, não só o seu. Junte com **Devoted Guardian** (fica colado em quem protege) e com a reação extra do **Quick Shield Block** — você vira o guarda-costas da party. Grande contra golpes que iriam derrubar o conjurador.
- 💢 **Disarming Block:** ao dar Shield Block, você pode **desarmar ou empurrar** quem te acertou. **Destructive Block:** seu bloqueio ainda **devolve dano / dispensa a redução** — bloquear vira ofensa.
- ⚔️ **Reactive Strike (Ataque de Oportunidade):** inimigo que se move ou manipula no seu alcance de **3 m** leva um Strike de graça. Combine com o alcance Grande para travar o campo.
- 😱 **Intimidating Glare → Fearsome Brute:** **Demoralize** só no olhar (sem idioma); contra alvo **amedrontado**, o **Fearsome Brute** soma **dano extra**. Assuste primeiro, esmague depois.
- 🤝 **Devoted Guardian:** quando você ergue o escudo, um **aliado adjacente** também ganha CA — posicione-se colado em quem precisa proteger.
- 👁️ **Blind-Fight:** ignore alvos ocultos/enevoados e não fique *off-guard* por inimigos invisíveis — ótimo com Take Cover, quando você "cega" o campo com o escudo.

## ⚡ Poderes Míticos
- 🔨 **Mythic Strike:** gaste um ponto mítico para um Strike que **supera resistências** e bate mais forte — guarde para o chefe ou o momento decisivo.
- 🔋 **Summon Mythic Power:** recarrega seus **pontos míticos** — não termine a luta grande com eles sobrando.
- 🔥 **Fiery Rebirth:** ao ser derrubado/morto, você **renasce em chamas** (1×/dia). Jogue com ousadia sabendo desse seguro.
- 🎲 **Rewrite Fate:** **rerrole** um teste crucial, seu ou de aliado — segure para a falha que realmente dói.

## 🌋 Ancestralidade Jotunborn
- 🧬 **Grande + Low-Light Vision:** alcance 3 m, corpo que bloqueia corredores, enxerga na penumbra.
- 🛡️ **Planar Resilience:** **resistência** a dano planar/energético — avance contra esses perigos.
- ✨ **Plane Step:** desloque-se piscando por outro plano para **atravessar obstáculos/inimigos** e reposicionar sob pressão.

## 🎒 Itens & Recursos
- 🔨 **+2 Striking Shock Thundering Cold Iron Warhammer:** o **Cold Iron** (ferro frio) fere criaturas vulneráveis a ele (muitos feéricos/demônios); Shock e Thundering somam elétrico + sônico todo golpe.
- 🛡️ **Escudo-Fortaleza (Reinforcing Moderate):** sua defesa central — a runa de reforço aumenta a Dureza/PV do escudo para aguentar mais Shield Blocks. **Quick Repair** + **Crafting mestre** deixam você **consertá-lo** rápido entre lutas.
- 🩹 **Battle Medicine:** cura de emergência em você ou num aliado no meio do combate.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 29** (base) → **+3 erguendo o escudo** → **+4 com Take Cover**; **~150 PV** e **Robust Health** por cima. Você é o mais difícil de derrubar da mesa.
- 💪 **Melhor save: Fortitude ~+21** (mestre, CON 19) — encare veneno e corpo-a-corpo de frente.
- ⚠️ **Mais frágeis: Reflexos e Vontade (~+17)** — mas com o escudo erguido + **Reflexive Shield** seus Reflexos ficam bem mais decentes contra área.
- 👀 **Battlefield Surveyor:** **Percepção mestre (~+18)** e bônus de **iniciativa** — você costuma agir cedo e erguer o escudo antes da pancada.

## ⚠️ Erros Comuns
- ❌ **Esquecer de erguer o escudo:** sem *Raise a Shield*, você perde +3 CA, o Take Cover, o Reflexive Shield e o Devoted Guardian de uma vez. É o erro nº 1.
- ❌ Não usar **Take Cover** contra AoE — você tem uma das melhores defesas do jogo contra área e deixa parada.
- ❌ Não abrir a rodada com **Exacting Strike**: é o Strike que "perdoa" o erro (não soma MAP), então deveria vir *antes* dos ataques normais.
- ❌ Deixar **reações de Shield Block sobrando** — você tem várias por rodada e ainda pode gastá-las para **proteger um aliado** (Shield Warden); use-as.
- ❌ Guardar **pontos míticos / Rewrite Fate** a ponto de terminar a luta sem gastar.
- ❌ Perseguir inimigos em vez de **segurar a linha**: seu valor é travar o campo com alcance 3 m e Reactive Strike, não correr atrás (velocidade baixa com armadura pesada).`

export const COMBAT_GUIDES: CombatGuide[] = [
    { match: byName('Ardagar'), markdown: ARDAGAR, curated: true },
    { match: byName('Eldarion'), markdown: ELDARION, curated: true },
    { match: byName('Ghan Buri'), markdown: GHAN_BURI, curated: true },
]

// ---------------------------------------------------------------------------
// Fallback heurístico — para fichas ainda não catalogadas à mão.
// ---------------------------------------------------------------------------

// Papel tático aproximado por classe.
const CLASS_ROLE: Record<string, string> = {
    Fighter: 'Linha de frente — dano marcial confiável e Reações de ataque de oportunidade.',
    Barbarian: 'Linha de frente — dano bruto; entre em Rage antes de engajar.',
    Champion: 'Tanque/defensor — proteja aliados com sua Reação de campeão.',
    Monk: 'Combatente ágil — mobilidade, controle e golpes desarmados; use sua stance.',
    Rogue: 'Precisão/skirmisher — garanta off-guard para o Sneak Attack e bata-e-recue.',
    Ranger: 'Caçador — marque o alvo (Hunt Prey) e concentre ataques nele.',
    Swashbuckler: 'Duelista ágil — gere Panache e finalize com o Finisher.',
    Gunslinger: 'Atirador — gerencie recarga e posicionamento para tiros certeiros.',
    Investigator: 'Precisão metódica — Devise a Stratagem antes de atacar.',
    Cleric: 'Suporte divino — cure, abençoe e controle; fique na retaguarda.',
    Druid: 'Conjurador primal — controle, invocação e battle forms; comande companheiros.',
    Wizard: 'Artilharia arcana — controle de área e debuffs à distância.',
    Sorcerer: 'Conjurador espontâneo — dano/controle flexível; posicione-se atrás.',
    Oracle: 'Suporte/dano divino — gerencie sua maldição ao conjurar.',
    Witch: 'Controle arcano/oculto — hexes e debuffs; proteja seu familiar.',
    Bard: 'Suporte oculto — mantenha as composições (Courageous Anthem) ligadas.',
    Psychic: 'Conjurador mental — alterne amps e psi cantrips; retaguarda.',
    Magus: 'Híbrido — Spellstrike para picos de dano; gerencie o recarregamento.',
    Summoner: 'Você + eidolon agem em conjunto; posicione o eidolon na frente.',
    Alchemist: 'Suporte com bombas e elixires — prepare recursos antes da luta.',
    Kineticist: 'Blaster elemental — canalize impulsos conforme a situação.',
    Thaumaturge: 'Versátil anti-monstro — Exploit Vulnerability e use seu implemento.',
}

function bestSave(b: BuildInfo): string {
    const saves = [
        { label: 'Fortitude', total: b.level + b.proficiencies.fortitude + abilityMod(b.abilities.con) },
        { label: 'Reflexos', total: b.level + b.proficiencies.reflex + abilityMod(b.abilities.dex) },
        { label: 'Vontade', total: b.level + b.proficiencies.will + abilityMod(b.abilities.wis) },
    ]
    saves.sort((a, c) => c.total - a.total)
    const best = saves[0]
    const worst = saves[saves.length - 1]
    const sg = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
    return `Melhor save: **${best.label} ${sg(best.total)}**; mais frágil: **${worst.label} ${sg(worst.total)}** — cuidado com efeitos que o visem.`
}

export function buildFallbackGuide(b: BuildInfo): string {
    const role = CLASS_ROLE[b.class] || 'Analise classe, atributo-chave e talentos para definir seu papel na linha de combate.'
    const ac = b.acTotal?.acTotal ?? 10
    const hp = totalHp({
        ancestryHp: b.attributes.ancestryhp,
        classHp: b.attributes.classhp,
        bonusHp: b.attributes.bonushp,
        bonusHpPerLevel: b.attributes.bonushpPerLevel,
        level: b.level,
        conScore: b.abilities.con,
    })

    const classFeats = (b.feats || [])
        .map((f) => (Array.isArray(f) ? { name: String(f[0] ?? ''), type: String(f[2] ?? '') } : { name: f.name, type: f.type || '' }))
        .filter((f) => /Class Feat|Archetype|Mythic/i.test(f.type))
        .map((f) => f.name)
        .filter(Boolean)
        .slice(0, 6)

    const hasFocus = !!b.focus && Object.keys(b.focus).length > 0
    const casts = (b.spellCasters || []).some((c) => c.spells?.some((l) => l.list.length > 0))

    const remember: string[] = []
    if (classFeats.length) remember.push(`⭐ Lembre dos seus talentos de destaque: **${classFeats.join(', ')}**.`)
    remember.push('🛡️ Cheque suas **Reações** (ex.: Shield Block, esquivas, ataques de oportunidade) e não termine a rodada sem considerar usá-las.')
    if (hasFocus) remember.push('🔮 Você tem **magias de foco** — gaste os pontos e **refocus** entre combates.')
    if (casts) remember.push('✨ Priorize ligar **buffs/controle** cedo, quando rendem mais rounds.')

    return `## 🎯 Papel em Combate
${role}

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA ${ac}** · **~${hp} PV**.
- 🎲 ${bestSave(b)}

## ⭐ Nunca Esqueça
${remember.map((r) => `- ${r}`).join('\n')}

## ⚠️ Observação
_Este é um guia automático a partir dos dados da ficha. Um guia detalhado e revisado ainda não foi escrito para este personagem._`
}

export function getCombatGuide(b: BuildInfo): { markdown: string; curated: boolean } {
    const found = COMBAT_GUIDES.find((g) => g.match(b))
    if (found) return { markdown: found.markdown, curated: true }
    return { markdown: buildFallbackGuide(b), curated: false }
}
