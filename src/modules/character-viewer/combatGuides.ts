import type { BuildInfo } from '../../pathbuilder/types'
import { totalHp } from './helpers'
import { saveCheck, SAVES } from './checks'
import { NO_MODIFIERS } from './conditions'

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
**Ladino Trapaceiro (Thief)** élfico — assassino de precisão e batedor. Seu jogo é **iniciativa alta → deixar o alvo _off-guard_ → descarregar Sneak Attack**. A maior CA da party (**29**) e Reflexos mestres fazem de você um esquivo difícil de fixar. Skirmisher: entra, fere pesado, sai. Uma camada de **Duelista (Swashbuckler Dedication, estilo Rascal)** dá um segundo motor por cima: **Panache**, ganho ao **Tumble Through** com sucesso, alimenta um pouco mais de precisão e libera um Finisher para fechar a troca.

## 🔁 Rotina de Turno
- ⚔️ **Strike com a Gloom Blade (+20):** contra alvo **off-guard**, some **+2d6 de precisão (Sneak Attack)** e aplique **Debilitating Strike** (deixe o inimigo *lento*/*enfraquecido*).
- 🤝 **Garanta o off-guard:** *Gang Up* — **qualquer aliado adjacente** ao alvo já o deixa off-guard para você (sem precisar flanquear na diagonal exata). Ou flanqueie do jeito normal.
- 🤺 **Panache:** um **Tumble Through** bem-sucedido (inclusive atravessando o espaço do próprio alvo) te dá Panache — numa falha não-crítica você ainda ganha, só que até o fim do seu próximo turno. Com Panache ativa, seu próximo acerto com a Gloom Blade soma **+1 de precisão fixo** (Finishing Precision) e você pode fechar com **Retreating Finisher**: um Strike que, se errar, ainda te deixa **Step de graça** para fora de alcance.
- 🏃 **3ª ação:** reposicione (Step/Stride, *Swift Sneak* para furtar em velocidade plena, ou o próprio Tumble Through para gerar Panache) ou segure para a reação.
- ⚡ **Mythic Strike (1 ação):** gaste um **Ponto Mítico** para atacar com proficiência mítica. Guarde para o inimigo com **resistência ou imunidade mítica** — e combine com off-guard, porque o Sneak Attack continua valendo.

## ⭐ Nunca Esqueça
- 🛡️⚔️ **Nimble Dodge × Opportune Riposte:** duas reações competindo pelo mesmo slot. Ataque comum contra você → **Nimble Dodge** (+2 CA). Inimigo adjacente que **erra criticamente** um Strike contra você → **Opportune Riposte** (Strike ou Desarme nele). Escolha pela ameaça da rodada; não dá pra guardar as duas.
- 🥇 **Surprise Attack:** na 1ª rodada, quem ainda não agiu está **off-guard** — por isso a iniciativa alta (Incredible Initiative + Elven Instincts) importa tanto. Bata forte no round 1.
- ☠️ **Poison Weapon (1 ação):** aplica na lâmina um veneno de **ferimento ou de contato** (o Remaster libera o de contato, que normalmente não iria na arma) e, com mão livre, já saca o frasco na mesma ação. Todo dia você prepara venenos simples (1d4, **2d4** com *Improved Poison Weapon*, sem salvaguarda), e com o aprimorado uma **falha crítica** no ataque **não desperdiça** o veneno.
- 🤸 **Kip Up:** levante-se de graça sem provocar. **Evasive Reflexes** e **Slippery Prey** para escapar de agarrões e ameaças.
- 🥷 **Sneak Adept (nível 10):** ao **Sneak**, uma *falha* vira **sucesso** — só a falha crítica ainda te denuncia. Furtar-se para a posição passou de aposta a plano confiável: use para abrir a luta já escondido e garantir o off-guard do round 1.
- 🕊️ **Aerobatics Mastery (nível 10):** **+2 de circunstância** em Acrobacia para *Maneuver in Flight* e **duas manobras numa ação só** (CD da mais difícil +5). Com *Feet that Stride the Sky*, você reposiciona no ar em uma ação e ainda ataca.
- 🩹 **Battle Medicine:** cura de emergência em você ou num aliado no meio do combate.
- 🏃 **Swashbuckler's Speed:** **+1,5 m** de velocidade sempre, subindo para **+3 m** enquanto tiver Panache — soma com Elf Step e Feet that Stride the Sky para você nunca ficar sem espaço pra sair.

## 🎒 Itens & Recursos
- 🗡️ **Gloom Blade** (shadow): não emite luz e ignora certas defesas; sua arma principal — combine com **Quick Draw**.
- 🥷 **Shadow Weaver (+1 resilient, shadow):** bônus em Furtividade e nos saves — mantenha investida.
- 💍 **Ring of Climbing** + **Feet that Stride the Sky** (mítico): mobilidade vertical e aérea para alcançar alvos e escapar — agora com **Aerobatics Mastery** para manobrar de verdade lá em cima.
- 🤺 **Swashbuckler Dedication (estilo Rascal):** camada de duelista sobre o Ladino — Panache via Tumble Through, **+1 de precisão fixo** (Finishing Precision) e o Finisher **Retreating Finisher** para fechar um alvo e já sair dali. **Swashbuckler's Riposte** é quem te dá a **Opportune Riposte** (ver acima, em Nunca Esqueça).
- 🧪 **Toxic Effluence** (contato, **Fort CD 29**, até 6 rodadas): vai na lâmina com *Poison Weapon* e **não tem incubação** — já no estágio 1 são 3d6 veneno + 3d6 fogo, **desajeitado 1 e enfraquecido 1**. É o veneno de combate: guarde para o alvo que precisa cair nesta luta.
- 🧪 **Fearweed** (contato, **Fort CD 30**): também vai na lâmina, mas tem **incubação de 1 minuto** (10 rodadas) — o 7d6 e o amedrontado chegam quando a luta curta já acabou. Rende em emboscada preparada ou luta longa; o amedrontado dele **não sai** enquanto o veneno durar.
- 🧪 **Breath of the Mantis God** (**inalado**, virulento, **Fort CD 29**): **não vai na arma** — ao abrir o frasco vira uma nuvem de **3 m de lado** por 1 minuto, e quem entra sangra (3d6 persistente) e fica drenado. Jogue antes de o grupo entrar, e **não entre na nuvem**: quem sabe dela pode prender a respiração (+2 na salvaguarda), mas você também respira.
- 🧪 Os três venenos são **consumíveis** — o Pathbuilder os exporta como "investidos", mas cada um é uma dose e some ao ser usado.
- ⭐ **Pontos Míticos:** moeda de *Mythic Strike*, *Divert Destiny* e *Summon Mythic Power*. São escassos — gaste no golpe que decide a luta.

## 🛡️ Defesa & Sobrevivência
- 🛡️ **Melhor defesa: CA 29 + Reflexos mestres com Evasion** — transforma AoE em dano zero num sucesso.
- 🧠 **Deny Advantage:** inimigos de nível igual ou menor não te deixam off-guard com facilidade.
- ⚠️ ~116 PV e sem armadura pesada: não troque golpes parado com brutamontes — bata e recue (skirmish).

## ⚠️ Erros Comuns
- ❌ **Atacar sem off-guard:** sem isso você perde os **2d6** de Sneak Attack — monte o flanking/Gang Up antes.
- ❌ Esquecer a **reação Nimble Dodge**.
- ❌ Não pré-envenenar a arma no começo do combate.
- ❌ **Tentar passar o Breath of the Mantis God na lâmina:** é inalado, não entra por *Poison Weapon* — é uma nuvem, não um golpe. E não gaste o **Fearweed** no meio de uma luta curta: com 1 minuto de incubação, o efeito chega tarde.
- ❌ Desperdiçar a alta iniciativa não focando o alvo certo no round 1 (Surprise Attack).
- ❌ **Continuar tratando Sneak como aposta:** com *Sneak Adept* a falha vira sucesso — vale muito mais a pena se aproximar escondido do que atacar de longe sem off-guard.
- ❌ **Usar Retreating Finisher sem Panache:** o finisher só existe com Panache ativa — sem ela é um Strike qualquer, sem o extra de precisão e sem o Step de segurança na falha.`

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
- 💢 **Disarming Block:** ao dar Shield Block, você pode **desarmar ou empurrar** quem te acertou. **Destructive Block:** ao bloquear, você pode descontar o **dobro da Dureza** do seu dano — mas o escudo toma o **dobro do dano** (antes da Dureza). Use quando o golpe é grande e o escudo aguenta; o card do escudo mostra as duas contas lado a lado.
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

// ---------------------------------------------------------------------------
// BRUKUTHUR — Bárbaro 10 (Instinto Gigante), Android + Manobras de Guerreiro
// ---------------------------------------------------------------------------
const BRUKUTHUR = `## 🎯 Papel em Combate
**Bárbaro de Instinto Gigante**, Android Artesão com **Fighter Dedication** — a linha de frente que fecha distância e derruba. FOR 20, ~178 PV e Fortitude mestre com **Juggernaut** fazem de você quase impossível de parar por saves; **Giant's Stature** te deixa **Grande** (alcance +1,5 m) em pleno combate, e as manobras de Guerreiro (Trip, flanqueamento) somam controle ao dano bruto do Greataxe.

## 🔁 Rotina de Turno
- 😡 **Raiva:** normalmente você já entra em Raiva de graça — **Quick-Tempered** te faz Ragir automaticamente ao rolar iniciativa, e o primeiro Strike do 1º turno ainda soma o dano de Raiva extra. Use o botão **Entrar em Fúria** da faixa no topo da ficha: ele liga os **+14 PV temporários**, o **+10 de dano com o Greataxe** (arma Grande do *Titan Mauler*; +2 nas demais, +1 em arma ágil) e a **resistência 7 a contundente e fogo**. O *Titan Mauler* também te deixa **desajeitado 1** o tempo todo enquanto você empunha a arma Grande — já está na sua CA e nos Reflexos.
- 🏃 **Fechar distância — Sudden Charge (2 ações):** Stride duas vezes e Strike no final. Ótimo pra abrir o combate ou alcançar quem fugiu.
- 🪓 **Golpe grande — Vicious Swing (2 ações, Flourish):** Strike com o Solar Bloodthirsty que conta como 2 ataques pro MAP, mas soma **um dado extra de dano**. Bom como abertura, antes do MAP normal pesar.
- 🤼 **Derrubar — Slam Down (2 ações):** Strike e, se acertar e causar dano, tenta Derrubar de brinde — com arma de duas mãos, os dois ataques contam pro MAP mas ele só sobe **depois** dos dois. Prone deixa o alvo off-guard pro resto da party.
- ⚔️ **Flanqueado por dois — Quick Reversal (2 ações):** vira a mesa contra quem tentou te flanquear: Strike em um dos dois flanqueadores e um segundo Strike no outro, sem MAP extra no segundo. Situacional, mas devastador quando acontece.
- ⚡ **Reação — escolha uma por rodada:** **Reactive Strike** (inimigo no seu alcance usa manipulação/movimento/ataque à distância ou sai de uma casa — Strike nele), **No Escape** (inimigo no alcance tenta se afastar — persiga Stride até seu Speed) ou **Farabellus Flip** (+2 CA contra um ataque corpo a corpo; se ainda acertar, Step de graça). As três competem pelo mesmo slot — decida pela ameaça real da rodada.

## ⭐ Nunca Esqueça
- 🦣 **Giant's Stature (1 ação):** vira **Grande**, +1,5 m de alcance, seu equipamento cresce junto — troque **clumsy 1** (penaliza CA, Reflexos, Acrobacia e ataques à distância) por alcance e a chance de empunhar armas Grandes. Não ative se precisar de precisão fina naquele round.
- 🤼 **Athletics mestre:** Desarmar, Agarrar, Reposicionar, Empurrar e Derrubar valem contra criaturas até **uma categoria de tamanho maior** que você — Grandes normalmente, e **Enormes** enquanto o *Giant's Stature* estiver ativo. Contra um chefe Enorme, ative a estatura **antes** de tentar a manobra.
- 🎯 **Assurance (Athletics):** resultado fixo de 10 + seu bônus de proficiência, sem rolar e sem somar nenhum outro bônus/penalidade. Ótimo pra travar uma manobra de CD média sem risco; contra o chefão, sua rolagem de verdade (com todos os bônus) ainda pode valer mais.
- 🔨 **Brutality:** perícia especialista com armas simples/marciais/desarmado e, em Raiva, acesso ao **efeito de especialização crítica** — a do Greataxe é sangramento extra no crítico.
- 🛡️ **Juggernaut:** Fortitude mestre e **sucesso vira sucesso crítico** — venenos e efeitos que só pedem uma falha simples raramente te seguram.
- 💪 **Renewed Vigor (1 ação):** PV temporários iguais a metade do nível + CON (ou **nível cheio + CON** se você já atacou neste turno) — use antes de mergulhar de volta na briga, não só quando já estiver no fio.
- 😱 **Terrifying Howl (1 ação):** Demoraliza **todos** os inimigos em 9 m de uma vez, sem penalidade por idioma — bom abridor de round 1 antes de fechar com Sudden Charge.

## ⚡ Poderes Míticos
- 👂 **Ears that Hear the Truth:** gaste um Ponto Mítico pra rolar Sentir Motivação, ou Percepção pra iniciativa, com **proficiência mítica**.
- 💨 **Godspeed (1 ação):** gaste um Ponto Mítico — por 1 minuto, +3 m de velocidade e **quickened**: uma ação extra por rodada só pra Stride, Step ou Leap. Perfeito para perseguir vários alvos ou fechar um mapa grande.
- 🗣️ **Correct the Story (reação):** inimigo **acerta uma crítica** em você (ataque ou save) — gaste um Ponto Mítico e ele **rerrola**, ficando com o novo resultado.
- 💀 **Divert Destiny (ação livre, gatilho: cairia a 0 PV ou morreria):** gaste um Ponto Mítico, ignore Ferido/Morrendo por completo, **não** aumente Fadado, e levante-se com **10 + seu nível de PV**. É a sua rede de segurança — jogue sabendo que ela existe, mas ela também gasta do mesmo estoque escasso de Pontos Míticos.
- 🔋 **Summon Mythic Power (1×/dia):** recupera 1 Ponto Mítico no meio da luta longa.

## 🤖 Ancestralidade Android
- 🔩 **Constructed:** +1 de circunstância em saves contra doença, veneno e radiação — seu corpo sintético resiste melhor a isso do que a biologia normal.
- 😐 **Emotionally Unaware:** −1 de circunstância em Diplomacia, Atuação e nos testes de Percepção pra Sentir Motivação — não é bug, é ancestralidade; avise a mesa se alguém contar com você pra ler intenção social.
- 💡 **Radiant Circuitry (Concentrar):** liga sua própria luz (20 pés claros + 20 dim) sem precisar de torch — desliga sozinha se você cair inconsciente.
- 🎯 **Advanced Targeting System:** *Sure Strike* 1×/dia como magia inata arcana de 1º círculo — guarde pro ataque que realmente precisa acertar.
- 🚀 **Arcane Propulsion (2 ações, 1×/dia):** voo por 5 minutos, na sua velocidade normal — para alcançar voadores, cruzar abismos ou simplesmente sair do chão quando o combate pede.
- 🧬 **Adopted Ancestry (Automaton):** você tem acesso a talentos de ancestralidade Autômato pra escolher no futuro — ainda não usou nenhum, é uma porta aberta, não uma obrigação.

## 🎒 Itens & Recursos
- 🪓 **Solar Bloodthirsty (+1 striking Greataxe, Extending, +1d6 fogo):** a runa **Extending** estende a arma (Interact, 1 ação) ganhando alcance até o início do seu próximo turno — útil pra ameaçar sem precisar ficar colado, combinando com Reactive Strike/No Escape.
- 🛡️ **Studded Leather (+1 resilient, Brukuthur's Size-Changing):** runa homebrew, **1×/dia, 1 ação (manipular)** — interruptores na armadura te dão o efeito de um **Enlarge de 4º rank** (Enorme, alcance +3 m, +4 de estado no dano corpo a corpo, desajeitado 1, 5 min) ou de um **Shrink** (Miúdo, alcance 0). Sem concentração: funciona mesmo quando a mente está ocupada.
- 🧪 **Elixir of Life (Lesser), investido:** cura rápida de bolso fora do turno de Renewed Vigor.
- ⭐ **Pontos Míticos:** moeda de *Godspeed*, *Correct the Story*, *Divert Destiny* e *Summon Mythic Power* — cinco usos possíveis competindo pelo mesmo estoque pequeno; priorize Divert Destiny quando a vida realmente estiver em jogo.

## 🛡️ Defesa & Sobrevivência
- ❤️ **~178 PV e CA 28** — você não é o mais esquivo da mesa, mas aguenta o tranco melhor que quase todo mundo.
- 💪 **Fortitude mestre + Juggernaut:** sucesso em Fortitude vira crítico — venenos e doenças raramente te incomodam.
- 🔥 **Raging Resistance (Raiva):** resistência a impacto (bludgeoning) + a energia que você escolheu ao pegar o talento (fogo, frio ou elétrico) — confirme qual está anotada na ficha.
- 🎯 **Reflex Expertise:** Reflexos especialista — ainda seu save mais fraco, mas não tão vulnerável quanto o de um bárbaro comum.

## ⚠️ Erros Comuns
- ❌ **Deixar a Raiva cair no meio da luta e esquecer de reentrar:** Quick-Tempered só é de graça **ao rolar iniciativa** — depois disso, Ragir de novo custa 1 ação normal.
- ❌ **Tentar usar duas reações na mesma rodada:** Reactive Strike, No Escape e Farabellus Flip disputam o mesmo slot — escolha uma pela ameaça daquele turno, não guarde todas esperando a "melhor".
- ❌ **Ativar Giant's Stature sem pensar no clumsy 1:** o alcance é ótimo, mas a penalidade em CA/Reflexos/Acrobacia pode custar caro contra quem precisa de precisão (ex.: perseguir por terreno ruim).
- ❌ **Tentar Derrubar/Agarrar um Colossal:** sem *Titan Wrestler* (trocado por *Inventor*, que é talento de downtime), o limite é **uma** categoria acima — nem com Giant's Stature a manobra alcança um alvo Colossal.
- ❌ **Forçar Quick Reversal sem estar flanqueado por dois:** é situacional — não vale gastar Vicious Swing/Slam Down esperando por ele quando a ficha de combate não está montada.
- ❌ **Guardar Pontos Míticos até o fim da luta sem gastar:** entre Godspeed, Correct the Story, Divert Destiny e Summon Mythic Power, quase sempre há um uso melhor que "sobrar".`

// ---------------------------------------------------------------------------
// CEROSQUALHANTHALLAS — Patrulheiro 10 (Precisão), Aiuvarin + Druida da Tempestade
// ---------------------------------------------------------------------------
const CEROSQUALHANTHALLAS = `## 🎯 Papel em Combate
**Patrulheiro de Precisão** com arco longo composto — o **atirador** da party. Aiuvarin (meio-elfo) com **Druid Dedication (Ordem da Tempestade)**: marca uma presa e a derruba de longe, com magia de guardião (*warden*) e de tempestade por cima. DES 20, **Percepção mestre** e *Incredible Initiative* te fazem agir cedo; **Reflexos mestres** e CA 28 seguram o que chega até você.

## 🔁 Rotina de Turno
- 🎯 **1 ação — Hunt Prey:** marque o alvo. Quase tudo que você tem só vale contra a **presa**: a precisão, o Hunter's Aim e o Deadly Aim.
- 🏹 **Strike com o arco (+21):** 3d8+4 perfurante, **+1d8 de precisão** no **primeiro acerto da rodada** contra a presa (*Hunter's Edge: Precision*).
- 🔭 **Hunter's Aim (2 ações):** Strike contra a presa com **+2 de circunstância**, ignorando **ocultação** e **cobertura menor**. É o tiro para o alvo escondido na névoa ou atrás de um aliado.
- 💥 **Deadly Aim (1 ação):** Strike contra a presa com **−2** no ataque e **+4 de dano**. Rende contra CA baixa ou alvo desprevenido — o −2 dói menos quando o alvo já está *off-guard*.
- 🌀 **Gravity Weapon (1 ação, foco):** 1 minuto de **+6 de dano** (2 × os 3 dados da arma) no **primeiro Strike de cada rodada**. Ligue no 1º turno de uma luta que vai durar.

## ⭐ Nunca Esqueça
- 🏹 **Volley 9 m:** o arco longo tem **−2** contra alvos a **9 m ou menos**. Não fique colado: recue antes de atirar.
- 🌿 **Nature's Edge:** inimigo em **terreno difícil** fica **off-guard para você** (−2 CA). Escombros, mato, a neve do *Snowdrift Spell* — e a **Cave Fangs do Nathaniel**, que enche 6 m de raio de terreno difícil por 1 minuto. Peça a magia e atire no que estiver dentro.
- ❄️ **Snowdrift Spell (1 ação) + Tempest Surge:** a *Tempest Surge* tem o traço **ar**, então o *Snowdrift* enche de neve o espaço do alvo e os quadrados ao redor — terreno difícil até o **começo do seu próximo turno**. Como isso gasta o turno inteiro, o combo só fecha com **Haste**: sobra ação para atirar no alvo já *off-guard*.
- ⏱️ **Pinch Time:** *Haste* **1×/dia**, só em você (1 minuto de ação extra para Strike ou Stride). Ligue na luta que importa: é +1 flecha por rodada.
- 🧠 **Additional Recollection (ação livre):** ao **acertar** um *Recall Knowledge* sobre a presa, faça outro, de graça, sobre **outra** criatura.
- 🗺️ **Terrain Transposition (2 ações, foco):** teletransporte-se até **27 m** para um espaço que você veja, levando só o que estiver segurando. Só funciona em **ambiente selvagem** — numa masmorra ou cidade, não conte com ela.

## ⚡ Poderes Míticos
- 🏹 **Mythic Strike (1 ação):** gaste um Ponto Mítico e atire com **proficiência mítica** (~**+27** em vez de +21), contando como arma mítica contra resistência e imunidade míticas. Contra a presa, some a precisão.
- 🔥 **Mythic Magic:** gaste um Ponto Mítico para lançar *Scorching Ray*, *Heal* ou *Darkvision* **no 5º rank** e com **proficiência mítica**. O *Scorching Ray* de 2–3 ações dispara um raio por ação, em alvos diferentes — é o seu nova de área. Na aba de Magias, o ⚡ ao lado de cada uma **gasta o Ponto Mítico** direto.
- 🗣️ **Correct the Story (reação):** inimigo tira **crítico** num ataque ou numa salvaguarda — gaste um Ponto Mítico e ele **rerrola**.
- 💨 **Godspeed (1 ação):** 1 minuto de **+3 m** de velocidade e *quickened* (a ação extra é só para Stride, Step ou Leap) — ótimo para manter a distância do *volley*.
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com proficiência mítica.
- 🐾 **Hunter's Calling:** *Seek* e *Track* com proficiência mítica por um Ponto Mítico; o **primeiro crítico do dia** nesses testes contra criatura hostil **devolve** o ponto.
- 🌊 **Arms that Cut the Waves:** nado com proficiência mítica, e fôlego para **10 rodadas** a mais antes de sufocar. É de exploração, não de combate.

## 🎒 Itens & Recursos
- 🏹 **+2 Greater Striking Composite Longbow:** sua arma. A ficha soma **+1d6 elétrico** ao dano.
- 🧥 **Cloak of Illusions (Greater):** **+2 em Furtividade**, *figment* à vontade e, **1×/dia**, puxar o capuz (2 ações) dá **invisibilidade de 4º rank**: 1 minuto que **não acaba quando você ataca**. Invisível, o alvo fica *off-guard* para você — combine com a precisão.
- 🛡️ **Bands of Force:** +1 na CA e nas salvaguardas. **Return Force (reação):** inimigo **erra criticamente** um golpe corpo a corpo em você → as faixas o **empurram** (Atletismo +14) para longe — ótimo para o arqueiro que ficou cercado.
- 🔮 **3 pontos de foco** para *Gravity Weapon*, *Soothing Mist*, *Tempest Surge* e *Terrain Transposition* — refocus entre lutas.
- 💧 **Soothing Mist (2 ações, foco):** cura **5d8** num aliado a até 9 m **e encerra um dano persistente** (ácido, sangramento, fogo, veneno ou vazio) à sua escolha.
- ⚡ **Tempest Surge (2 ações, foco):** **5d12 elétrico** (Reflexos básico, 9 m) e, na falha, **desajeitado 2** por 1 rodada.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 28 · ~138 PV.** Melhor salvaguarda: **Reflexos mestres (~+22)**; Fortitude (~+18) e Vontade (~+19) são especialistas.
- 🧠 **Ancestral Suspicion:** **+2** contra efeitos que te **controlariam** (*dominate* e afins), e um **sucesso vira crítico**.
- 🏃 Seu lugar é **a 10–30 m da briga**, fora do *volley* e fora do alcance dos brutamontes. Se chegarem perto, *Godspeed* ou *Terrain Transposition* te tiram dali.

## ⚠️ Erros Comuns
- ❌ **Atirar sem Hunt Prey:** sem presa, nada de precisão, Hunter's Aim nem Deadly Aim.
- ❌ **Atirar a 9 m ou menos** e comer o −2 do *volley* sem perceber.
- ❌ **Esquecer que o +1d8 de precisão é só no primeiro acerto da rodada** — o segundo e o terceiro acerto não somam.
- ❌ **Gastar os Pontos Míticos em Mythic Magic sem pensar:** é o mesmo estoque de 3 do Mythic Strike e do Correct the Story.
- ❌ **Snowdrift sem ação para atirar:** a neve some no começo do seu próximo turno. Sem *Haste*, o *off-guard* que você montou só serve aos aliados — e *Nature's Edge* vale só para você.`

// ---------------------------------------------------------------------------
// NATHANIEL — Magus 10 (Sparkling Targe), Aiuvarin + Mago (Teoria Unificada)
// ---------------------------------------------------------------------------
const NATHANIEL = `## 🎯 Papel em Combate
**Magus de Sparkling Targe (Escudo Faiscante)** — espada longa numa mão, escudo na outra e magia no golpe. É **linha de frente híbrida**: descarrega uma magia inteira dentro de um Strike (*Spellstrike*) e, com o escudo erguido, bloqueia até dano mágico. FOR 19 e INT 19, **CA 28 (30 com o escudo erguido)**, ~138 PV e **Vontade mestre**. A **Wizard Dedication** dá magias de utilidade e área por fora.

## 🔁 Rotina de Turno
- 🌀 **1 ação — Arcane Cascade (postura):** seus golpes corpo a corpo ganham **+2 de dano** de força e você ganha **resistência 2 a dano de magias**. Se você **lançou uma magia neste turno antes** de entrar na postura, o dano extra pode virar qualquer tipo que aquela magia cause — bom contra fraqueza. Entre nela no 1º turno e não saia.
- ⚡ **2 ações — Spellstrike:** lance uma magia de 1 ou 2 ações que peça **ataque de magia ou salvaguarda** e entregue-a num **Strike com a Zarroc Sheilvean (+19, 2d8+6)**. Magia de ataque usa o **resultado do Strike** (acertou, acertou os dois); magia de salvaguarda faz o alvo rolar **mesmo se o Strike errar** — só a falha crítica do Strike desperdiça a magia. Conta como **dois ataques** para o MAP, mas o MAP só entra depois.
- 🔄 **Recarregar o Spellstrike:** depois de usá-lo, ele fica descarregado. Recarrega com **1 ação** (*concentrate*) **ou lançando uma magia de confluência** — e é aí que entra o **Shielding Strike**.
- 🛡️ **Shielding Strike (1 ação, foco):** **ergue o escudo e faz um Strike** numa ação só, **e recarrega o Spellstrike**. O ciclo ideal de um turno depois do primeiro: *Shielding Strike* (1) + *Spellstrike* (2).

## ⭐ Nunca Esqueça
- 🛡️ **Sparkling Targe:** em **Arcane Cascade** e com o escudo **erguido**, o **+2 do escudo vale também nas salvaguardas contra magias** e efeitos mágicos, e o **Shield Block** para até dano **não físico** de magia — com a Dureza aumentada em +2 (a **resistência** que a postura te dá).
- ⚙️ **Clockwork Shield (1×/dia, 1 ação):** por 1 minuto, **uma reação extra por turno só para Shield Block** (Dureza 12, 90 PV). Ligue na luta em que você vai ser o alvo — e o escudo ainda tem **espigões +2 striking** para bater.
- 🔀 **Expansive Spellstrike:** magias de **explosão, cone ou linha** criam a área inteira no Spellstrike, em vez de atingir só o alvo. A explosão é centrada num canto do quadrado do alvo, que é **colado em você**: ⚠️ ***Ancestral Winds*** (6 m de raio) e ***Cave Fangs*** (6 m) **pegam você e os aliados adjacentes**. Com essas, lance **à distância**, do jeito normal.
- 🔁 **Reações que disputam o mesmo slot:** **Reactive Strike** (inimigo no alcance se move, manipula ou ataca à distância), **Shield Block**, **Crosscurrent Counter** (alguém te **agarra ou imobiliza** → você tenta agarrá-lo de volta, mesmo fora do alcance e sem mão livre; no sucesso você se solta e o puxa para perto) e **Vanish Weapon** (ver Míticos). Decida pela ameaça da rodada — o *Clockwork Shield* é o que te dá um Shield Block **a mais**.
- 🔥 **Runic Impression (1 ação, foco):** por 1 minuto a espada ganha uma runa à escolha — *flaming*, *frost*, *shock*, *thundering*, *corrosive*, *ghost touch* ou *returning*. Escolha pela **fraqueza** do inimigo; *ghost touch* contra incorpóreos.
- 🎯 **Hand of the Apprentice (1 ação, foco):** arremessa a espada até **150 m** como ataque de magia, somando **INT** ao dano, e ela volta à mão. É o seu ataque à distância contra o voador.

## ✨ Magias-Chave
- 🔥 **Cinder Swarm (4º):** o melhor para *Spellstrike* — alvo único com aura de 1,5 m. **Formigas de fogo:** 3d6 perfurante + 2d6 fogo persistente e empurram 1,5 m; **vaga-lumes:** 3d6 fogo e **cegam** na falha (incapacitação). Sustente para repetir.
- 👻 **Ancestral Winds (5º):** 5d6 vazio + 1d6 mental numa explosão de 6 m, a até 36 m, com **amedrontado 2** na falha, e sustentável. Lance **à distância** (ver o aviso do Expansive Spellstrike).
- 🚪 **Banishment (5º):** manda um extraplanar de volta para casa. Guarde para o demônio ou o elemental que decide a luta.
- 📦 **Containment (4º):** prende um inimigo (ou protege um aliado) num campo de força com Dureza 10 e 40 PV.
- 🪨 **Cave Fangs (3º, arquétipo):** 6d6 perfurante numa explosão de 6 m e **terreno difícil por 1 minuto** — e o terreno difícil deixa os inimigos **off-guard para o Cerosqualhanthallas** (*Nature's Edge*). Combine com ele.
- ✨ **Truques de Spellstrike:** *Gouging Claw* e *Telekinetic Projectile* (ataque), *Ignition* (ataque, fogo) e *Daze* (Vontade) do Magus, e *Live Wire* (ataque, cortante + elétrico) do arquétipo de Mago — o Spellstrike aceita magia de qualquer bloco.
- 📚 **Magias estudiosas (*Gecko Grip* e *Resist Energy*):** ao lançar uma delas, você pode entrar em **Arcane Cascade como ação livre** logo em seguida, no mesmo turno. **Não dão slot próprio** (isso era a regra antiga do Secrets of Magic): ficam no grimório e precisam ser preparadas nos slots normais. *Resist Energy* (2 ações) + postura de graça abre a luta protegido e já em Arcane Cascade.
- 🕊️ **Aeromancer:** *Fly* de 4º rank, inata, **1×/dia**.

## ⚡ Poderes Míticos
- 🔥 **Mythic Magic:** gaste um Ponto Mítico para lançar *Blazing Bolt*, *Vanish Weapon* ou *Horizon Thunder Sphere* **no 5º rank** com **proficiência mítica** (ataque de magia ~**+24** em vez de +18). O ⚡ ao lado de cada uma, na aba de Magias, **gasta o Ponto Mítico** direto. No **Spellstrike** elas entram (a lista de magias do Golpe inclui o Mythic Magic: gasta **1 Ponto Mítico** em vez de slot), mas quem rola é o Strike — a proficiência mítica da magia **se perde**. Vale pelo dano do *Blazing Bolt* de 5º rank (10d6 com 2 ações), não pelo ataque.
- 🗡️ **Vanish Weapon (reação, via Mythic Magic):** um inimigo **acerta ou erra** (sem crítico) um golpe corpo a corpo com arma em você → tente **Desarmá-lo** com ataque de magia mítico, sem precisar de mão livre. No sucesso a arma some numa bolsa extradimensional sua.
- 💀 **Divert Destiny (livre):** ao cair a 0 PV ou morrer, gaste um Ponto Mítico e fique **de pé com 10 + nível PV**, sem Ferido nem Morrendo.
- 💨 **Godspeed (1 ação):** 1 minuto de **+3 m** de velocidade e *quickened* para Stride, Step ou Leap.
- 👂 **Ears that Hear the Truth:** iniciativa (ou Sentir Motivação) com **proficiência mítica** por um Ponto Mítico — soma com *Incredible Initiative*.
- 🔋 **Summon Mythic Power (1×/dia):** recupera 1 Ponto Mítico.
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com proficiência mítica.

## 🎒 Itens & Recursos
- 🗡️ **Zarroc Sheilvean** (*+1 Striking Longsword*): 2d8+6 cortante, +19.
- 🛡️ **Clockwork Shield** + **Breastplate +1 Resilient de Ferro Frio** — o ferro frio pesa contra feéricos e demônios **na armadura**, não na espada.
- 💍 **Ring of Wizardry (Type I):** **+1 em Arcanismo** e **dois slots de 1º rank arcanos a mais** por dia. Escolha no preparo diário a qual fonte arcana eles vão (Magus ou o arquétipo de Mago) e prepare magias de 1º do grimório. Tirar o anel, por qualquer motivo, faz perder os slots extras.
- 🔮 **3 pontos de foco** para *Shielding Strike*, *Runic Impression* e *Hand of the Apprentice* — refocus entre lutas.

## 🤖 Companheiro: Animated Armor
- 🧩 **Entra sozinha no combate.** Ao adicionar o Nathaniel na Iniciativa, a **Animated Armor** (criatura de nível 2 da AON) vem junto, com token próprio, e aparece no mapa. Ela é um combatente **à parte**: tem a iniciativa, os PV e o turno dela — não gasta as suas ações.
- 📊 **Números:** **CA 17 · 20 PV · Dureza 9** · Percepção +6 · Atletismo +9 · Fort +10, Ref +3, Von +4 · velocidade 6 m.
- ⚔️ **Ataques:** **glaive +10** (1d8+4 cortante, *deadly d8*, *forceful*, **alcance 3 m**) e **gauntlet +9** (1d6+4 contundente, ágil). O alcance longo faz dela uma **flanqueadora**: ao flanquear com você, o inimigo fica *off-guard* — bom para o Spellstrike e para o **Eldarion** (Ataque Furtivo) e o **Ceros**.
- 🧱 **Quebra fácil:** com **menos da metade dos PV** (abaixo de 10), ou ao **sofrer um acerto crítico**, a armadura se parte: **perde a Dureza e a CA cai para 13**. Tire-a da linha de frente antes disso.
- 🧪 **Imune a quase tudo que você poderia lançar nela:** veneno, **mental**, **vazio** e **vitality** — e a cura. **Não dá para curá-la com magia de cura** (para recuperar PV, o caminho é **reparar**, com Artesanato; combine com o mestre). 
- 🌪️ **Combo com *Ancestral Winds*:** a magia é **vazio + mental**, e a armadura é imune aos dois — ela pode ficar **dentro da explosão** sem sofrer nada (e sem o *amedrontado*), enquanto os inimigos ao redor sofrem. Já ***Cave Fangs*** (perfurante) e o que for físico **a atingem**; a Dureza 9 segura parte.
- 📍 **No mapa:** o token dela é o que você enviou na aba **Inventário → Companheiros de combate** da ficha, já enquadrado.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 28 → 30 com o escudo erguido · ~138 PV.**
- 🧠 **Twofold Will:** Vontade **mestre (~+19)** e **sucesso vira crítico** — medo e controle mental raramente te pegam.
- ⚠️ **Mais frágil: Reflexos (~+16).** Contra área mágica, fique em **Arcane Cascade com o escudo erguido**: o +2 do escudo entra na salvaguarda (*Sparkling Targe*).
- 🗣️ **Steady Spellcasting:** menos chance de perder a magia quando te acertam enquanto conjura.

## ⚠️ Erros Comuns
- ❌ **Esquecer de recarregar o Spellstrike:** sem a ação de recarga ou uma magia de confluência, o próximo Spellstrike não existe. *Shielding Strike* recarrega de graça.
- ❌ **Lutar fora de Arcane Cascade:** sem a postura você perde o dano extra, a resistência a magia e os benefícios do Sparkling Targe.
- ❌ **Expansive Spellstrike com explosão grande:** *Ancestral Winds* e *Cave Fangs* centrados no alvo colado em você **te atingem**.
- ❌ **Mythic Magic no Spellstrike:** a proficiência mítica só vale quando **você** rola o ataque de magia — lance essas diretamente.
- ❌ **Gastar os Pontos Míticos em Mythic Magic sem pensar:** é o mesmo estoque de 3 do Divert Destiny, a sua rede de segurança.
- ❌ **Esquecer da Animated Armor:** ela tem turno próprio na Iniciativa — decida o que ela faz (flanquear, travar o corredor) assim que a vez dela chegar, e não a deixe tomar um crítico à toa.
- ❌ **Deixar o escudo abaixado:** CA 28 contra 30, e sem escudo erguido o Sparkling Targe não protege as salvaguardas.`

// ---------------------------------------------------------------------------
// THALOS — Psíquico 10 (The Oscillating Wave + Wandering Reverie), Humano
// ---------------------------------------------------------------------------
const THALOS = `## 🎯 Papel em Combate
**Psíquico da Onda Oscilante (The Oscillating Wave)** — artilharia de **fogo e frio** que alterna entre os dois a cada magia. Você bate de longe com **psi cantrips ampliados** (que escalam como magia de 5º rank), guarda os **slots** para a área grande e, a cada poucas rodadas, **libera a psique** para somar **+2 por rank** no dano. CAR 20, ataque de magia **+19**, **CD 29**. Em troca, é o mais frágil da mesa: **CA 24 e 98 PV** — seu lugar é a **18–36 m** da linha de frente.

## 🔁 Rotina de Turno
- 🕰️ **Antes da luta:** se der tempo, ative o **Crystal Exoskeleton** do colete (2 ações, 1×/dia): **20 PV temporários por 1 hora**. Ao rolar iniciativa, a **Chronoskimmer** deixa escolher: rolar normal, **estabilizar** (iniciativa fixa **27**) ou **desestabilizar** (teste plano CD 11: **36** no sucesso, **18** na falha). Em empate com inimigo, você age primeiro.
- 🔥 **Turno 1 — abra com uma magia:** Ignition ou Frostbite **ampliado** (1 Ponto de Foco, ação livre, logo antes de conjurar). Quando o dano de fogo ou frio cair, use a **reação Entropic Wheel** — ela dura 1 minuto. Conjurar neste turno é o **requisito** para liberar a psique no próximo.
- 🧠 **Turno 2 — Unleash Psyche (livre, no início do turno):** por **2 rodadas**, toda magia de dano conjurada pela **conjuração de Psíquico** soma **+2 × rank**. É a hora do slot alto: **Howling Blizzard** (10d6 **+10**), **Fireball** (6d6 **+6** no 3º) ou um cantrip ampliado + **Psi Burst** (1 ação).
- 🧠 **Turno 3 — ainda liberado:** repita. Se estiver exposto, a 3ª ação vira **Fade into Daydreams** (oculto até o próximo turno).
- 😵 **Turnos 4–5 — a ressaca:** a psique apaga sozinha, você fica **estupefato 1 por 2 rodadas** (−1 no ataque e na CD de magia, teste plano CD 6 para conjurar) e **não pode liberar de novo por 2 rodadas**. Cantrips sem amp, **Daze** do bastão (de graça), Thermal Stasis num aliado ou Disturbing Knowledge. Continue conjurando: o turno seguinte a uma magia é o que pode liberar de novo, assim que a ressaca passar.

## ⭐ Nunca Esqueça
- 🌊 **A Onda alterna:** a primeira magia concedida ou psi cantrip padrão (Frostbite, Ignition) da luta escolhe **adicionar energia (fogo)** ou **remover (frio)** — e a próxima **tem que ser a outra**. O ritmo natural é Ignition (fogo) → Frostbite (frio) → Ignition… Repetir Frostbite faz o segundo sair **de fogo** — ótimo contra quem resiste a frio. **Refocus** volta ao neutro.
- 🔋 **3 Pontos de Foco, 1 por amp.** No Refocus você recupera **2** se só gastou em amps do Psíquico. Guarde um ponto para a Entropic Wheel ampliada ou para o amp do turno liberado.
- 🎯 **Unleash Psyche não se desliga:** liberou, são 2 rodadas e a ressaca vem. Só libere quando houver alvo para as duas. O bônus vale para o **dano inicial** de magia da **conjuração de Psíquico** — não para dano persistente, nem para o Psi Burst (que não é magia), nem para magia lançada **do bastão**.
- 💥 **Psi Burst (1 ação, 1×/rodada, só com a psique liberada):** **5d4** a até 9 m, Reflexo básico. É mindshift: pela Onda, pode sair **de fogo ou de frio**. É a ação que sobra depois de um cantrip de 2 ações.
- 🛡️🧠 **Haughty Obstinacy + Mental Static:** um **sucesso** contra efeito mental que tenta **controlar suas ações** vira **crítico** — e crítico em Vontade contra efeito mental de uma criatura dispara a reação **Mental Static**: **10 de dano mental** nela.
- 👁️ **Homing Beacon:** troca o amp de Frostbite/Ignition — o alvo atingido (ou que falhou) fica marcado por 1 minuto: **invisível vira só oculto**, oculto deixa de ser. Com **Thoughtsense** (9 m, vago; **impreciso** com a psique liberada, dá para Seek), é sua resposta a inimigo invisível.
- 🎲 **Iniciativa +17** (Percepção +15, +2 do Incredible Initiative). Agir cedo é o que destrava o turno 2 — por isso a escolha da Chronoskimmer importa.

## ✨ Magias-Chave
- ❄️ **Frostbite** (2 ações, **36 m** pela Onda): 6d4 frio, Fortitude básica; falha crítica dá fraqueza 5 a concussão (combine com a Warhammer do Ghan Buri). **Ampliado:** **11d4** e você ganha **PV temporários = metade do dano** que o alvo sofrer, por 1 minuto — é a sua armadura.
- 🔥 **Ignition** (2 ações, ataque de magia, **18 m** à distância ou corpo a corpo com **alcance 3 m**): 6d4 fogo (6d6 no corpo a corpo). **Ampliado:** **5d10 + 5 de respingo** (5d12 no corpo a corpo, e o respingo não te pega). Crítico: dano dobrado + **5d4 fogo persistente**.
- ⚖️ **Redistribute Potential** (2 ações, 18 m): dois quadrados adjacentes, um de **frio** e um de **fogo**, 4d4 Fortitude básica; na falha, **desajeitado 1** (frio) ou **enfraquecido 1** (calor). **Ampliado:** duas **explosões de 3 m** com **6d6**, e as condições duram **1 minuto**. Seu cantrip de área.
- ☸️ **Entropic Wheel** (reação, ao causar dano de fogo ou frio): 1 minuto acumulando motes (1, ou 2 ampliada; até **5**). Toda magia de fogo causa também **frio = motes**, e vice-versa — a alternância da Onda é justamente o que a gira.
- 🌡️ **Thermal Stasis** (1 ação, 18 m): **resistência 10 a fogo e a frio** até o seu próximo turno; **ampliada, 1 minuto**. Contra baforada de dragão ou elemental, numa ação.
- 🛡️ **Shield** (truque, 1 ação): **+1 de circunstância na CA** até o próximo turno e **Bloqueio com Escudo de Dureza 15** — que também reduz dano de magia, não só físico. Depois do bloqueio, 10 minutos sem poder conjurar de novo.

## 📜 Repertório (2 slots por rank, do 1º ao 5º)
- 🌨️ **5º — Howling Blizzard:** **10d6 frio**, cone de 18 m (2 ações) ou explosão de 9 m a 150 m (3 ações), deixa terreno difícil. Sua magia de chefe. **Summon Entity** (3 ações, sustentada): uma aberração de **nível 5** para flanquear ou segurar a porta. **Mind Probe** é interrogatório (1 minuto), fora de combate.
- 🧊 **4º — Ice Storm** (3 ações, 36 m): explosão de 6 m com **2d8 concussão + 2d8 frio** e terreno difícil por 1 minuto; ao ar livre, **duas nuvens**. Mais controle que dano. **Clairvoyance** e **Read Omens** são de exploração.
- 💣 **3º — Fireball** (2 ações, 150 m): explosão de 6 m, **6d6 fogo**, Reflexo básico. **Hypercognition** (1 ação): até 6 Recordar Conhecimento de uma vez — no começo da luta contra o desconhecido. **Dream Message** é recado.
- 🔆 **2º — Blazing Bolt** (1 a 3 ações, 18 m): um raio por ação, cada um num alvo diferente, **4d6 fogo** com 2+ ações. **Invisibility** (no 2º rank acaba ao atacar) e **Cleanse Affliction** (baixa 1 estágio de veneno/doença).
- 😴 **1º — Breathe Fire** (cone de 4,5 m, 2d6 — fraco neste rank), **Sleep** (incapacitação: no 1º rank só derruba criatura de nível baixo) e **Alarm**.
- ✍️ **Magias de assinatura:** **Breathe Fire, Blazing Bolt, Fireball, Ice Storm e Howling Blizzard** — a aba de Magias as repete em cada rank acima do delas (com o chip "assinatura" e já elevadas), porque o Pathbuilder não exporta isso. Fireball no 5º vira **10d6**, Blazing Bolt no 5º vira **10d6 por raio** (até 3 alvos), Breathe Fire no 5º vira **10d6**. Num slot de rank mais alto o mesmo feitiço bate mais forte — **escolha o slot pelo tamanho da luta**.
- 🌊 As concedidas pela Onda (Breathe Fire, Blazing Bolt, Fireball, Ice Storm, Howling Blizzard) **também alternam**: uma Fireball pode sair congelada.
- 🕊️ **Shory Aeromancer:** Fly de 4º rank, inata, **1×/dia**, só em você.

## ⚡ Poderes Míticos
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com **proficiência mítica** — Fortitude e Vontade **+24**, Reflexos **+21**.
- 📖 **Correct the Story (reação):** um inimigo **acerta crítico** em você ou **tira sucesso crítico** na salvaguarda da sua Howling Blizzard → gaste um Ponto Mítico e ele rerrola.
- 🌀 **Become Destiny (livre):** remova **uma condição**, encerre **uma magia** que está em você ou escape de uma armadilha/perigo. Tira o estupefato da ressaca, o amedrontado, o agarrado…
- 🏹 **Arc of Destruction (reação):** um inimigo te mira com **Strike à distância de arma** → **+4 de status na CA**; se errar, você pega o projétil no ar e o devolve com proficiência mítica.
- 🐍 **Hydra's Bond (preparação diária):** até **5 criaturas voluntárias** ligadas. Quando uma delas salva contra algo que a faria agir contra os aliados (confuso, dominate…), gaste um Ponto Mítico e ela rola com proficiência mítica; se falhar, todos sabem que está controlada, e o grupo ganha **+2** para contra-atacar o efeito.
- 💭 **Dreamer's Calling:** Recordar Conhecimento de Arcanismo, Natureza, Religião ou Ocultismo com **proficiência mítica** por um Ponto Mítico — boa para achar a fraqueza do chefe.

## 🧭 Arquétipos
- 🕰️ **Chronoskimmer (dedicação):** a escolha de iniciativa acima (estabilizar ou desestabilizar são efeitos de **fortuna**) e **vence empate** com inimigo. Os talentos do arquétipo usam a **CD de chronoskimmer** — a maior entre classe e magia: **29**.
- ⏪ **Turn Back the Clock (reação, 1×/dia):** você **falha** num teste de perícia ou salvaguarda → rerrole com **+1 de circunstância**, e vale o novo resultado, mesmo pior. Disputa a reação com Entropic Wheel e Shield Block — e é a sua segunda chance numa salvaguarda de Reflexos.
- 🧭 **Guide the Timeline (1 ação, 1×/dia):** escolha um **aliado** (próximo ataque ou teste de perícia dele na rodada, **rola 2× e fica o melhor**) ou um **inimigo** (rola 2× e fica o **pior**, a menos que passe em Vontade contra a CD **29**). O alvo fica imune por 24 h.
- 💥 **Reversing Charge (2 ações):** Ande até a sua Velocidade, dê **um Golpe corpo a corpo** se terminar ao alcance de um inimigo e **teleporte de volta** ao quadrado de origem. Você não tem arma — o Golpe é desarmado, então é um último recurso, não um plano.
- 🐌 **Steal Time (2 ações, 1×/hora):** criatura a até 9 m faz **Fortitude contra a CD 29** e sofre os efeitos de *Slow*: falha = **lento 1 por 1 minuto**, falha crítica = lento 2, sucesso = lento 1 por 1 rodada, sucesso crítico = nada. É um controle de alto valor num chefe — mas só **uma vez por hora**, então escolha o alvo.
- ⚠️ **Os dois estão presos à mesma reação/ação que você quer usar na luta:** Turn Back the Clock disputa a reação; Guide the Timeline e Steal Time custam ação que seria de um cantrip. Use quando a mudança de resultado vale mais que o dano.

## 🎒 Itens & Recursos
- 🔮 **3 Pontos de Foco** (amps) e ⭐ **3 Pontos Míticos** (todos os poderes míticos disputam o mesmo estoque).
- 🧠 **Mentalist's Staff (Greater):** **5 cargas por dia** (o seu rank mais alto). **Daze** de graça (**3d6 mental**, Vontade básica, atordoado 1 na falha crítica); **Phantom Pain** no 1º ou no 3º (**6d4 mental + 3d4 persistente** e enjoado 1), **Paranoia** (2º), **Hypercognition** (3º), Mindlink (1º). Como espontâneo, você pode pagar **1 carga + um slot** do mesmo rank em vez das cargas todas. +2 para identificar magia mental.
- 💎 **Crystal Lattice** (+2 resilient, raiment): a CA 24 e o +1 nas salvaguardas vêm dele. **Crystal Exoskeleton** (2 ações, 1×/dia): **20 PV temporários por 1 hora**. PV temporários não somam com os do Frostbite ampliado — fica o maior.
- 🧪 **Poções (nível 10):** **Resistance (Moderate)** — **resistência 10** a um tipo de energia (a que a ficha de combate pedir; boa contra fogo e frio quando o inimigo não é seu). **Annulment (Lesser)** — desfaz um **pacto sobrenatural** (contrato infernal, barganha de bruxa, geas) com counteract **+17**; é de roleplay, não de combate.
- 📦 **Box of Unspoiling (Type II):** guarda 50 de Volume e conserva comida por um ano. Precisa das duas mãos.
- 🌊 **Wavetouched Paragon:** deslocamento de **natação 4,5 m**.
- 🌟 **Saoc Astrology (1 ação, 3×/dia):** 1d8 antes da próxima perícia — até **+2** (num 1, −1). Bom antes do Disturbing Knowledge.
- 😨 **Disturbing Knowledge (2 ações):** Ocultismo **+20** contra a CD de Vontade de **um** inimigo a 9 m — crítico deixa **confuso 1 rodada + amedrontado 1**; sucesso, amedrontado 1. Não é magia: funciona na ressaca sem teste plano (o −1 do estupefato ainda vale).

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 24 · 98 PV** — os menores números da mesa. Fique longe: Frostbite tem 36 m de alcance justamente para isso.
- 🎲 **Fortitude +18 · Vontade +18 · Reflexos +15** (o ponto fraco — área de Reflexo dói).
- 💎 **Crystal Exoskeleton** antes da luta e **Frostbite ampliado** durante: suas duas fontes de PV temporários.
- 🛡️ **Shield** leva a CA a **25** e bloqueia **15** de qualquer magia — a melhor terceira ação quando há inimigo perto.
- 🌫️ **Fade into Daydreams** (com a psique liberada): oculto, o atacante precisa passar num teste plano CD 5.
- ❄️ **Thermal Stasis** no próprio corpo contra fogo e frio.
- 🩹 **Fast Recovery:** cura em dobro ao descansar e salvaguardas contra veneno/doença descem **2 estágios** num sucesso.

## ⚠️ Erros Comuns
- ❌ **Esquecer a alternância da Onda:** dois Frostbite seguidos não são dois de frio — o segundo é de fogo.
- ❌ **Começar a luta sem conjurar:** sem magia no turno anterior, não há Unleash Psyche.
- ❌ **Liberar a psique sem alvo:** são 2 rodadas inevitáveis e depois 2 de estupefato. Libere quando houver dano para despejar.
- ❌ **Gastar slot alto fora da psique liberada:** a Howling Blizzard rende **+10** no turno liberado. Fora dele, num alvo só, o cantrip ampliado quase empata.
- ❌ **Usar Psi Burst ou Fade into Daydreams fora da psique liberada:** as ações psyche só existem enquanto ela dura.
- ❌ **Ignition corpo a corpo por ganância:** o d12 é tentador, mas com CA 24 você não quer um brutamontes adjacente. Ao menos use os **3 m** de alcance.
- ❌ **Gastar a reação à toa:** Entropic Wheel, Shield Block, Mental Static, Correct the Story, Arc of Destruction e Cognitive Crossover disputam **uma** reação por rodada. No turno 1, ela é da roda.`

// ---------------------------------------------------------------------------
// LOKI — Magus 7 (Laughing Shadow), Fleshwarp Surgewise, arquétipo de Psíquico
// (The Tangible Dream). Mesa Arton 1515. Regras do Magus pelo Impossible Magic
// (o Remaster da classe) e do Psíquico pelo Dark Archive (Remastered).
// ---------------------------------------------------------------------------
const LOKI = `## 🎯 Papel em Combate
**Magus do Laughing Shadow (Sombra Risonha)**: duelista móvel, espada numa mão e a **outra livre**. Chega de onde ninguém espera (*Dimensional Assault*), descarrega uma magia inteira dentro do golpe (*Spellstrike*) e cobra caro de quem está **desprevenido**. DES 19 no ataque e na CA, INT 14 nas magias de Magus e CAR 16 nas psíquicas e na **Enganação de mestre**. **CA 24 · 87 PV**: não é tanque. Escolha a briga, bata e saia dela.

## 🔁 Rotina de Turno
- 🌀 **Arcane Cascade (1 ação, postura):** golpes corpo a corpo com **+2 de dano de força** e **resistência 2 a dano de magias**. No Laughing Shadow, também **+3 m de Deslocamento**, porque você luta sem armadura (as Bands of Force não são armadura): **10,5 m**. Se lançou uma magia antes, no mesmo turno, o dano da postura pode ser do tipo dela.
- ⚡ **Spellstrike (2 ações):** lance uma magia de 1 ou 2 ações que peça **ataque de magia ou salvaguarda** e entregue-a num Golpe com a **Mirage Edge (+16, 2d6+2 perfurante + 1d6 espírito)**. Magia de ataque usa o **resultado do Golpe**, ou seja, **+16 no lugar do seu ataque de magia (+11 ou +12)**. Magia de salvaguarda faz o alvo rolar **mesmo se o Golpe errar**; só a falha crítica desperdiça a magia. A magia pega **só o alvo do Golpe**, no alcance da arma. Conta como dois ataques para a penalidade, que só entra depois.
- 🎭 **Finta (1 ação, Enganação +16):** no sucesso, o alvo fica **desprevenido contra o seu próximo ataque corpo a corpo** neste turno, e o Spellstrike é um ataque só. **Finta + Spellstrike** usa as 3 ações: CA −2 para o Golpe e a magia, e o **dano da postura sobe de 2 para 5** (Laughing Shadow). A Finta não tem o traço ataque, então não sobe a penalidade.
- 🔄 **Recarregar o Spellstrike:** 1 ação (concentrar) **ou uma magia de confluência**. *Dimensional Assault* e *Force Fang* recarregam de graça (no app, conjurá-las já recarrega).
- 🌌 **Dimensional Assault (1 ação, foco):** teletransporte até **metade do Deslocamento** (4,5 m em postura) para um espaço que você veja, ao alcance de um inimigo, e Golpe nele; recarrega o Spellstrike. Teletransporte não é movimento: **não provoca Reactive Strike**. Levar outra criatura junto desfaz a magia. No app, depois de conjurá-la, role o Golpe pela aba de Combate: ele não cobra outra ação.
- 🗡️ **Force Fang (1 ação, foco):** **2d4+2 de força automáticos** (sem ataque, sem salvaguarda) num alvo ao seu alcance, e recarrega o Spellstrike. Não entra no Spellstrike, justamente por não ter ataque nem salvaguarda. É o fecho de turno quando o terceiro ataque erraria.
- 🧭 **Ordem do turno:** o Spellstrike vem **primeiro** (ou logo depois da Finta), porque é o que mais depende do d20. Longe do alvo: **Andar (10,5 m) + Spellstrike**. Já colado: **Spellstrike + Force Fang**; o *Force Fang* não liga para a penalidade e deixa o Spellstrike carregado para o próximo turno.

## ⭐ Nunca Esqueça
- ✋ **Mão livre vale +3 de dano:** o bônus do Laughing Shadow (5 no lugar de 2) só vale com a **outra mão completamente vazia** e contra alvo **desprevenido**. Nada de tocha, poção ou escudo nela. Além da Finta, flanquear com um aliado e estar invisível ou escondido também deixam o alvo desprevenido.
- 📱 **No app:** em Arcane Cascade, o diálogo do Golpe tem o chip **Laughing Shadow · alvo desprevenido, outra mão livre**, que leva a postura de 2 para 5 (o app não sabe do alvo: ligue quando valer).
- 📚 **Magias estudiosas (*Gecko Grip* e *Blur*):** ao lançar uma delas, a **Arcane Cascade sai como ação livre** logo em seguida (no app, o chip do diálogo da magia já entra na postura sem gastar ação). *Blur* (2 ações, ocultação por 1 minuto) e a postura de graça é a melhor abertura de luta. Elas **não dão slot próprio** (era a regra antiga): saem dos slots normais.
- 🔁 **Uma reação por rodada, vários candidatos:** *Reactive Strike* (inimigo ao seu alcance manipula, se move, ataca à distância ou sai de um quadrado), **Shield Block** com o truque *Shield*, e **Return Force** das Bands of Force (alguém **erra você criticamente** num Golpe corpo a corpo: você o Empurra com Atletismo +14). Decida pela ameaça da rodada.
- 🧳 **Spirit Sheath:** a espada fica numa bainha extradimensional na roupa (+2 em Furtividade para escondê-la), e **no Spellstrike você a saca antes de conjurar**. Desmaiar expulsa a arma da bainha.
- 🪙 **Prata e espírito:** a lâmina é de **prata** (baixa qualidade), o que pesa contra diabos e lobisomens, e a runa **Astral** dá **+1d6 de espírito** e funciona como *ghost touch* contra incorpóreos.
- 🛡️ **Parry ou Shield, não os dois:** a espada tem *parry* (1 ação, +1 de circunstância na CA até o seu próximo turno), mas o truque *Shield* também é circunstância. Não somam.

## ✨ Magias-Chave
Truques e magias de foco saem no **4º rank**. CD 21 e ataque +11 nas de Magus (INT); CD 22 e ataque +12 nas psíquicas (CAR).
- 🧠 **Imaginary Weapon (truque psíquico, 2 ações):** ataque de magia corpo a corpo, **5d6 de força**; no crítico, dobra e pode empurrar o alvo 3 m. **Amplificado (1 Ponto de Foco): 8d6**, e fora do Spellstrike pega **dois alvos**, um ataque em cada (a penalidade só sobe depois dos dois). **No Spellstrike é a melhor do arsenal:** usa o seu Golpe (+16) e soma ao dano da arma; amplificada, dá os 8d6 no alvo do Golpe. **No app**, ela aparece na lista do Spellstrike (em "Truques de foco"), com o chip **Amplificar** que gasta o Ponto de Foco e troca o dano para 8d6.
- 🪡 **Needle Darts (truque):** 18 m de alcance, **6d4 perfurante**; no crítico, 4 de sangramento persistente. As agulhas saem de um metal que você carrega, e a sua espada é de **prata**: as agulhas também são.
- 🔥 **Ignition (truque):** colado no alvo (no Spellstrike, sempre está), os dados viram d6: **5d6 de fogo** e, no crítico, 4d6 de fogo persistente.
- ⚡ **Electric Arc (truque):** 5d4 elétrico, Reflexos básico, em **até dois alvos**. No Spellstrike, só o do Golpe.
- 💀 **Vision of Death (4º):** **8d6 mental**, Vontade, e amedrontado 1 a 4; quem cai a 0 PV por ela **morre**. Só em criatura viva. No Spellstrike, o alvo salva mesmo se o Golpe errar.
- 🐢 **Slow (3º):** Fortitude; **lento 1** (1 rodada no sucesso, 1 minuto na falha), **lento 2** na falha crítica. O melhor controle contra o chefe, e entra no Spellstrike.
- 🏃 **Haste (3º):** acelerado por 1 minuto; a ação extra só serve para **Golpe ou Andar**.
- 🎯 **Sure Strike (1º, 1 ação):** o próximo ataque do turno **rola duas vezes**, ignora penalidades de circunstância e o teste de ocultação. **Sure Strike + Spellstrike com Imaginary Weapon amplificada** é o turno de 3 ações que mais causa dano.
- 🌫️ **Blur (2º, estudiosa):** ocultação por 1 minuto; não serve para Esconder-se.
- 👻 **Invisibility (2º):** invisível por 10 minutos, até um ato hostil. Bom para chegar sem ser visto: o primeiro alvo fica desprevenido.
- 🪞 **Exchange Image (1º):** troca de aparência com outro humanoide (Vontade; quem aceita falha criticamente e a troca dura 24 h). Infiltração pura.
- 🛡️ **Shield (truque psíquico, 1 ação):** +1 na CA e Shield Block com **Dureza 10**. Pela The Tangible Dream, pode proteger **um aliado a até 9 m** (o bloqueio gasta a **sua** reação). **Amplificado (1 PF):** três camadas sustentadas por 1 minuto, e cada bloqueio quebra uma; quebrar duas de uma vez dá Dureza 15, as três, Dureza 20.
- 💚 **Mental Balm:** amp alternativo para truque psíquico que só afeta você e aliados, como o *Shield*: **+2 de status em Vontade contra emoção** por 1 minuto e uma tentativa de **contra-atacar o amedrontado** (ou um estupefato de até 1 hora).
- 🎈 **Figment (truque, também pela Cloak of Illusions):** ao conjurar ou sustentar, **Criar uma Distração** com +2. Se der certo, você fica escondido e o próximo Golpe pega o alvo desprevenido. Custa 2 ações; contra um alvo só, a Finta (1 ação) é melhor.

## ⚡ Poderes Míticos
Três Pontos Míticos por dia, na faixa ao lado das condições.
- 💀 **Divert Destiny (livre):** ao cair a 0 PV ou morrer, gaste 1 ponto e fique **de pé com 17 PV** (10 + nível), sem Ferido nem Morrendo.
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com **proficiência mítica** (nível + 10 no lugar da sua proficiência).
- 👂 **Ears that Hear the Truth:** iniciativa (Percepção) ou Sentir Motivação com proficiência mítica: **+18** no lugar de +10.
- 🗣️ **Unbelievably Believable:** Mentir, Causar Impressão, Pedir ou Coletar Informações com proficiência mítica: **+20** (Enganação ou Diplomacia). No app, marque a ação no diálogo da perícia (*Lie*, *Make an Impression*, *Request*, *Gather Information*) e o botão ✦ aparece com o nome do talento.
- 📜 **Runelord's Calling:** Identificar Magia, Aprender uma Magia e rituais com proficiência mítica. O **primeiro sucesso crítico do dia** em Identificar Magia (Arcanismo, Natureza, Ocultismo ou Religião) **devolve 1 Ponto Mítico**. Com a *Oddity Identification*, o Ocultismo ganha +2 para identificar efeitos mentais, de sorte e de revelação: identifique toda magia estranha que aparecer.
- 🍀 **Wish for Luck (1×/dia, livre, do antecedente Genie-Blessed):** antes de rolar ataque, salvaguarda ou perícia, role duas vezes e fique com o melhor. Não é mítico e não gasta ponto. É efeito de **fortuna**: não soma com *Sure Strike* nem com *Rewrite Fate* na mesma rolagem.

## 🎒 Itens & Recursos
- 🗡️ **Mirage Edge** (*Exquisite Sword Cane +1 striking*, prata de baixa qualidade, runa Astral): **+16 / +12 / +8** (ágil), 2d6+2 perfurante + 1d6 espírito; acuidade, ágil, ocultável e *parry*.
- 🛡️ **Bands of Force:** +1 de item na CA e nas salvaguardas (já somado aqui) e a reação **Return Force**.
- 🧥 **Cloak of Illusions:** *Figment* como truque inato, **+1 em Furtividade** e, **1×/dia (2 ações)**, invisibilidade ao puxar o capuz.
- ❤️ **Loki's Heart (a relíquia dele, nível 7 como ele; aspectos Time e Luck):** duas dádivas menores da AON. **Sands of the Hourglass (2 ações, 1×/hora, alcance 9 m):** o alvo faz **Fortitude**; sucesso: desajeitado 1 e enfraquecido 1; falha: desajeitado 2, enfraquecido 2 e **drenado 1**; falha crítica: 3, 3 e drenado 2; sucesso crítico: nada. Dura 1 minuto, e a AON não dá a CD, então o mestre define. **Whammy (reação, 1×/dia):** um inimigo a até 9 m tira um sucesso em ataque, salvaguarda ou teste de perícia, e rerrola ficando com o **pior** resultado. No app, o cartão **Relíquia** no Inventário cobra a ação ou a reação e marca "usada". Whammy disputa a **mesma reação** com *Reactive Strike*, Shield Block, Return Force e Correct the Story.
- 🔮 **2 Pontos de Foco**, um por magia de foco (*Dimensional Assault* e *Force Fang*), e é deles que saem também os amps dos truques psíquicos. O Pathbuilder exporta 3 pela regra antiga; o app usa a revisada. Refocus em 10 minutos.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 24 (25 com Parry ou Shield) · 87 PV.**
- 🎯 **Reflexos +16** (a melhor), Fortitude +14 e **Vontade +13 (a pior)**: medo e controle mental te pegam. O *Mental Balm* no *Shield* ajuda contra o amedrontado.
- 🧙 **Resistência 2 a dano de magias** enquanto estiver em Arcane Cascade.
- 🧪 **Unusual Anatomy (Fleshwarp):** +1 de circunstância nas salvaguardas contra doença e veneno.
- 👁️ **Uncanny Awareness:** sentido de movimento impreciso a 9 m (sabe onde está quem se mexe, mesmo invisível ou no escuro), além de visão na penumbra.
- 🏃 **Não deixe te cercarem:** o *Dimensional Assault* te tira do meio dos inimigos sem provocar *Reactive Strike*, e com 10,5 m em postura você escolhe onde lutar.

## 🗝️ Fora do Combate
- 🎭 **Enganação de mestre (+16)** com **Assurance**: um **23** garantido para Mentir sem rolar.
- 🖐️ **Pickpocket** com Ladroagem +15: furte de bolsos sem a penalidade de −5.
- 🔍 **Read Psychometric Resonance** (ver o rosto de quem marcou um objeto com emoção forte) e **Kreighton's Cognitive Crossover** (reação: um Recordar Conhecimento que não trouxe nada é repetido com a outra perícia escolhida).
- 🃏 **Untrained Improvisation:** em perícia sem treino você soma o **nível inteiro**. A ficha mostra Atletismo +0, mas o teste de verdade é **+7**.

## ⚠️ Erros Comuns
- ❌ **Segurar algo na outra mão:** perde os +3 do Laughing Shadow.
- ❌ **Spellstrike depois de outro ataque:** a magia de ataque leva a penalidade junto. Spellstrike primeiro, ou logo depois da Finta.
- ❌ **Esquecer de recarregar:** sem a ação de recarga ou uma magia de confluência, não há próximo Spellstrike. Feche o turno com *Force Fang* ou *Dimensional Assault*.
- ❌ **Magia de vários alvos no Spellstrike:** *Electric Arc* e o amp do *Imaginary Weapon* pegam só o alvo do Golpe. Para dois alvos, lance direto.
- ❌ **Somar Parry e Shield:** os dois são circunstância; vale um.
- ❌ **Gastar os 3 Pontos Míticos em Rewrite Fate:** é o mesmo estoque do Divert Destiny, a sua rede de segurança.
- ❌ **Ficar parado ao alcance de vários inimigos:** 87 PV e CA 24 não seguram a linha de frente.
- ❌ **Sure Strike com Wish for Luck:** dois efeitos de fortuna na mesma rolagem; vale um só.`

// ---------------------------------------------------------------------------
// MIRANDA STORMBLADE — Investigadora 7 (Empiricism), Humana (Skilled Human), arquétipo de
// Inventor. Mesa Arton 1515. Regras do Investigador pelo Player Core 2 (Remaster).
// Miranda's Arm é o nome que ela deu à relíquia dela, que é o Braço Sônico (o braço, com as runas). As dádivas são da AON: Scrap Shot e Dragon Strike.
// ---------------------------------------------------------------------------
const MIRANDA = `## 🎯 Papel em Combate
**Investigadora de Empiricism**: a cabeça do grupo. Estuda o alvo (Devise a Stratagem), bate uma vez com precisão (Strategic Strike, **2d6 de precisão**) e passa a vantagem aos aliados. Medicina de **mestre (+16)** faz dela a curandeira de reserva, e a Percepção de mestre (+15) a vigia do grupo. **CA 25 (27 com o escudo erguido) · 85 PV**: leve e sem Shield Block, então age de longe ou ao lado de quem segura a linha de frente.

## 🔁 Rotina de Turno
- 🧠 **Devise a Stratagem (1 ação, ou ação livre, 1× por rodada):** escolha uma criatura que você vê e rolle um d20. **O primeiro Golpe nela até o seu próximo turno usa esse d20 no lugar da rolagem** (traço fortune) e pode somar **INT** em vez de FOR/DES, desde que a arma seja **ágil ou de acuidade** (ou à distância). Seu INT e sua DES são os dois +4, então o número do ataque não muda: o que muda é o **Strategic Strike**.
- 🗡️ **Strategic Strike:** no Golpe que soma INT pelo estratagema, **+2d6 de dano de precisão** (1d6, mais 1 dado no nível 5; sobe de novo nos níveis 9, 13 e 17). Dobra no crítico. Não vale contra criatura imune a precisão.
- 🪄 **Ação livre quando há pista:** se a criatura é parte de uma **investigação ativa** (Pursue a Lead), o Devise a Stratagem não custa ação. Abra a investigação fora do combate.
- 🗡️ **Sword Cane (+15, 1d6+2 perfurante, ágil, acuidade):** a arma que **sempre** serve para o estratagema. Segundo ataque −4, terceiro −8.
- 🦾 **Miranda's Arm / Braço Sônico (+16, 2d6+2 sonoro + 1d6 elétrico da runa Shock):** o braço dela é a relíquia, e as runas (+1, striking, Shock) continuam nele. É o ataque mais forte da ficha e tem **acuidade** (não é ágil: segundo ataque −5, terceiro −10), então o estratagema soma INT e o Strategic Strike vale nele como na Sword Cane.
- 🧭 **Ordem típica:** Devise a Stratagem → Golpe (com o estratagema) → terceira ação para Battle Medicine, Tamper ou erguer o escudo. Contra um alvo que o grupo já está cercando, o Golpe com o estratagema primeiro.

## ⭐ Nunca Esqueça
- 📱 **No app:** no diálogo do Golpe, o chip **Devise a Stratagem** cobra a ação, troca para INT, soma o Strategic Strike e põe a anotação fortune na rolagem. O chip **Investigação ativa sobre o alvo** deixa o estratagema livre. O app não conta "1× por rodada": é você. **Nos testes de perícia**, o mesmo talento aparece como **Estratagema de perícia** (+1 no teste de INT, SAB, CAR ou Percepção sobre o alvo, e você não ataca essa criatura até o próximo turno).
- 🎲 **O d20 do estratagema é o do ataque:** não role de novo. A fortuna não soma com outro efeito de fortuna na mesma rolagem.
- 🔍 **Known Weaknesses:** ao Devise a Stratagem, você pode fazer um **Recall Knowledge antes do d20**. No sucesso crítico, você percebe uma fraqueza e cada aliado ganha **+1 de circunstância** no ataque contra o alvo até o seu próximo turno (o seu também).
- 🤝 **Shared Stratagem:** se o Golpe com o estratagema acertar, **designe um aliado**: o alvo fica **desprevenido** contra o próximo ataque dele antes do seu próximo turno. Combina bem com o ladino ou o guerreiro do grupo.
- 🛡️ **Escudo de aço (+2 na CA erguido):** custa uma ação para erguer e **não bloqueia** (ela não tem Shield Block). Só vale quando você vai ficar na linha de fogo.
- 🧪 **Armadura leve:** a Arachnid Harness (couro +1) dá **resistência 2 a veneno**, e a ativação (1×/dia, 1 ação, concentrar) abre membros de aranha: 1 minuto de **Deslocamento de escalar** igual à metade do terrestre, sem soltar as mãos.

## 🩺 Cura e Suporte
Medicina **+16** (mestre, bônus de item +1 das Healer's Gloves).
- ⚔️ **Battle Medicine (1 ação, manipular, kit de curandeiro):** CD 15/20/30/40, curando 2d8 (sucesso) ou 4d8 (crítico), com **+0/+10/+30/+50** conforme a CD. Como mestre, ela mira a **CD 30** (2d8+30). Não tira Ferido; o alvo fica imune ao seu Battle Medicine por 1 dia.
- 💚 **Godless Healing:** +5 PV quando a cura é **em você**, e o Battle Medicine em você só imuniza por **1 hora**. No app, aparece sozinho na opção "Em mim mesmo".
- 🏕️ **Treat Wounds (10 minutos, sem ação):** a mesma tabela; sucesso tira Ferido. **Ward Medic** atende **4 pacientes** na mesma rolagem (mestre em Medicina). Tratar por 1 hora dobra a cura.
- 🎯 **Assurance (Medicina):** abre mão de rolar para ter **23** (10 + 7 de nível + 6 de mestre), sem somar nenhum outro bônus. Bom para a CD 15 e a 20 sem arriscar. No app, o chip **Assurance** do diálogo de Medicina (e do Tratar Ferimentos e do Battle Medicine) usa o 23 sem rolar e sem ✦.
- 🔥 **Searing Restoration (1 ação, manipular, Unstable):** cura você ou uma criatura viva adjacente em **4d10** (1d10, mais 1d10 nos níveis 3, 5 e 7), e quem foi curado faz um teste simples imediato contra **sangramento persistente**. O traço **Unstable** pede um **teste simples CD 15** logo depois: na falha, a inovação **pifa** e não faz mais ações Unstable até 10 minutos de reajuste; na falha crítica, você também toma **3 de fogo** (metade do nível). No app, o botão **Curar** na aba Talentos rola tudo isso e soma ao seu PV; "Reajustei a inovação" devolve o efeito depois dos 10 minutos.
- 🧤 **Healer's Touch (Healer's Gloves, 1×/dia, 1 ação):** **2d6+7** PV em uma criatura viva adjacente, efeito de vitalidade (não machuca morto-vivo). No app, o botão **Curar** na linha da luva, no Inventário, rola e marca "usada hoje".
- 🔧 **Tamper (1 ação, Ofício +15 contra a CD de Reflexos):** escolha a arma ou a armadura do inimigo ao seu alcance. No **sucesso crítico**, a arma dá **−2** no ataque e no dano dele; na armadura, ele fica desprevenido e perde **3 m** de Deslocamento. O efeito dura até ele usar Interagir para tirá-lo. No **sucesso**, o mesmo, mas só até o início do seu próximo turno. **Falha crítica:** você toma dano de fogo igual ao seu nível. No app, é a ação de perícia **Tamper** no diálogo de Ofício (cobra a ação; a CD de Reflexos é do mestre).

## ⚡ Poderes Míticos
Três Pontos Míticos por dia, na faixa ao lado das condições.
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com **proficiência mítica** (nível + 10 no lugar da sua).
- 👂 **Ears that Hear the Truth:** Sentir Motivação ou Percepção na iniciativa com proficiência mítica: **+19** no lugar de +15.
- 🪞 **Correct the Story (reação):** um inimigo tirou um sucesso crítico em ataque ou salvaguarda; gaste 1 ponto e ele **rerrola** e fica com o novo resultado.
- 📚 **We've Met Before (1 ação):** gaste 1 ponto para ganhar uma Lore específica da criatura por 24 horas, com **proficiência mítica**, para Recall Knowledge sobre ela e tarefas afins. Entra no Devise a Stratagem: o Known Weaknesses fica muito mais confiável.
- 📖 **Bookkeeper's Calling:** anátema destruir livros ou registros, ou negar conhecimento a quem o busca sinceramente. O mestre decide a consequência.

## 🕵️ Fora do Combate
- 🔦 **Pursue a Lead (1 minuto):** nomeie um detalhe; o mestre confirma se há um mistério maior. Se houver, abra uma **investigação** e dê um nome. Você mantém **duas** ativas, e o bônus é **+1 de circunstância** em Percepção e perícias para responder à questão. Depois de usar, **10 minutos** até a próxima. No app, a faixa **Investigações** (fora das abas) guarda as duas, mostra o relógio de 10 minutos e lembra as abandonadas do dia; nos diálogos de teste aparece o chip **Investigação ativa · +1**.
- 📣 **Clue In (reação, 1× a cada 10 minutos):** quando outro faz um teste que o aproxima da resposta de uma investigação, ele ganha o seu bônus de investigação. O botão fica na faixa Investigações, gasta a reação e liga o relógio.
- 🛡️ **Detective's Readiness:** o bônus da investigação vale também nas **salvaguardas** contra a criatura ou o efeito ligado a ela, e o Clue In ajuda a salvaguarda de um aliado. No app, o chip aparece nos diálogos de Fortitude, Reflexos e Vontade quando há investigação aberta.
- 👁️ **Expeditious Inspection (ação livre, 1× a cada 10 minutos):** Recall Knowledge, Seek ou Sense Motive de graça (botão e relógio na faixa Investigações). **That's Odd** avisa que algo na sala está fora do lugar (o mestre decide o quê).
- 📚 **Thorough Research:** sucesso em Recall Knowledge dá informação extra; sucesso crítico, extra ou uma pergunta a mais. **Keen Recollection:** em Recall Knowledge, perícia destreinada soma o nível (7) em vez de 0. No app, qualquer diálogo de perícia oferece a ação **Recall Knowledge**, e com ela a destreinada soma o nível.
- 🗣️ **Hobnobber:** Gather Information leva metade do tempo.
- 🔮 **Arcane Sense:** Detect Magic à vontade (arcano inato, CAR). Alchemical Crafting, Inventor e Additional Lore completam a ficha de pesquisadora: Crafting +15, Heraldry, Planar e uma Lore de mestre.

## 🎒 Itens & Recursos
- 🗡️ **Sword Cane** (ferro frio de baixa qualidade): +15, ágil, acuidade, ocultável.
- 🦾 **Miranda's Arm (o nome que ela deu à relíquia; nível 7 como ela):** o Braço Sônico em ferro frio de baixa qualidade, com as runas mantidas. **Scrap Shot (2 ações):** ataque de magia com a relíquia (+10, o seu de magia) a até 9 m, **3d6 perfurante** (1d6 a cada 2 níveis); em alvo de metal ou armadura de metal, **+1** no ataque e **Desajeitado 1** até o próximo turno, e o disparo é de **ferro frio** (ignora resistências conforme o metal).  **Dragon Strike (1 ação, comando):** 1×/hora (a cada 10 minutos no 11º nível), por 1 minuto **+1d6 cortante** nos Golpes corpo a corpo desarmados. No app: faixa **Relíquia** no Inventário (botões **Atacar** e **Usar**) e o chip **Dragon Strike ativa** no diálogo do Golpe do braço e do Punho.
- 🧤 **Healer's Gloves:** +1 de item em Medicina e a cura do dia (acima).
- 🕸️ **Arachnid Harness:** couro +1, resistência 2 a veneno (já na Visão Geral e na Iniciativa) e escalada 1×/dia (botão **Usar** na linha do Inventário).
- 🛡️ **Steel Shield:** Dureza 5, PV 20, BT 10 (+2 na CA erguido).
- ⚗️ **Alchemical Crafting:** fórmulas de itens alquímicos comuns de 1º nível; com Crafting +15, ela fabrica o próprio estoque.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 25 (27 com o escudo) · 85 PV** (8 de ancestralidade + 11 por nível, com Toughness).
- 🎯 **Reflexos +15** (a melhor), **Fortitude +13** (Canny Acumen, perita) e **Vontade +13**. Percepção **+15** (mestre, Vigilant Senses).
- 🧪 **Resistência 2 a veneno** (Arachnid Harness).
- 🏃 **Deslocamento 7,5 m:** devagar. Escolha onde fica antes de entrar na luta.
- ➕ **Toughness:** reduz em 1 a CD dos testes de recuperação do estado Morrendo.
- 🍀 **Sem escape de morte:** ela não tem Divert Destiny. O Rewrite Fate refaz salvaguarda, não ressuscita ninguém: mantenha o grupo perto.

## ⚠️ Erros Comuns
- ❌ **Usar o Devise a Stratagem com arma pesada:** sem ágil, acuidade ou distância, não soma INT nem o Strategic Strike. Use a Sword Cane.
- ❌ **Rolar um d20 à parte no estratagema:** o d20 do estratagema é o do Golpe.
- ❌ **Devise a Stratagem duas vezes por rodada:** só uma, e vale para o **primeiro** Golpe na criatura escolhida.
- ❌ **Esquecer a ação livre:** com investigação ativa sobre o alvo, o estratagema não custa nada.
- ❌ **Gastar os 3 Pontos Míticos cedo:** o Correct the Story salva uma rodada ruim, e o We've Met Before só vale se o alvo for importante.
- ❌ **Curar no meio da luta sem o kit de curandeiro:** o Battle Medicine exige o healer's toolkit.
- ❌ **Contar com o escudo para bloquear:** ela não tem Shield Block.`

// ---------------------------------------------------------------------------
// HEARTS FOLLY — Monge 7, Humana (herança Dromaar), antecedente Artista, arquétipo Student of Perfection
// (Unfolding Wind). Mesa Arton 1515. Regras do Monge pelo Player Core 2 (Remaster) e do Student of Perfection
// pelo World Guide. As relíquias (Redenção Pelas Cinzas e Afinco do Artista) têm dádivas da AON.
// ---------------------------------------------------------------------------
const HEARTS_FOLLY = `## 🎯 Papel em Combate
**Monge de punhos e arco**: combatente móvel e resistente, sem armadura. Entra na luta com o **Flurry of Blows** (dois Golpes por 1 ação), canaliza o ki no ataque (**Ki Strike / Inner Upheaval**) e refaz o que errou (**Perfect Strike**). **CA 25 · 106 PV · Deslocamento 13,5 m**, com Reflexos, Fortitude e Vontade em **+15**. Aguenta pancada, move o campo (**Unfolding Wind Rush**) e ainda cura o grupo com as relíquias.

## 🔁 Rotina de Turno
- 👊 **Flurry of Blows (1 ação, flourish, 1× por turno):** **dois Golpes desarmados**. O 2º já leva a penalidade de ataques múltiplos do 1º, e se os dois acertam a mesma criatura o dano se **combina** para resistências e fraquezas. No app, é o chip do diálogo do Golpe, e a rolagem sai com os dois ataques no mesmo cartão.
- ✨ **Ki Strike / Inner Upheaval (1 ação, 1 Ponto de Foco):** um Golpe desarmado **ou um Flurry** com **+1 de status no ataque** e **+1d6 de dano extra** à escolha a cada Golpe: **força, espírito, vitalidade ou vazio**. A ação é a do próprio Golpe ou Flurry; só o ponto de foco é extra. As duas magias fazem o mesmo, então use a que tiver ponto.
- 🌀 **Stunning Blows:** no Flurry contra **uma criatura só**, se um Golpe acertar e causar dano, ela faz **Fortitude contra a sua CD de classe (22)** ou fica **atordoada 1** (atordoada 3 na falha crítica). É efeito de incapacitação.
- 🏹 **Monastic Archer Stance (1 ação, postura):** sem armadura e com um arco, os **únicos Golpes** passam a ser de arco, e o **Flurry vale com o arco**. Os talentos de Monge que pedem ataque desarmado também valem com o arco, dentro de **metade do incremento de distância** (15 m no longbow). No app, a faixa **Monge** liga e desliga a postura.
- 🎲 **Perfect Strike (reação, 1 Ponto de Foco, fortuna):** errou um Golpe **desarmado**? Rerrole o ataque e fique com o novo resultado. No app, é o botão do diálogo do Golpe desarmado, que rola o ataque de novo com a mesma conta.
- 💨 **Unfolding Wind Rush (1 ação, 1 Ponto de Foco):** **dois movimentos** (dois Andares, dois Passos ou um de cada), podendo subir em ângulo de até 45°; deixa uma **parede de vento** por 1 rodada nos espaços que você largou. Cai se terminar no ar depois de uma ação.
- 🧭 **Ordem típica:** Flurry com Ki Strike (1 ação + 1 foco) → mais duas ações para Andar ou o segundo Golpe, ou Unfolding Wind Rush para sair de cerco. Contra um alvo que não dá para alcançar, ligue a **postura do arqueiro** e atire.

## ⭐ Nunca Esqueça
- 🔮 **Mystic Strikes:** seus ataques desarmados são **mágicos** e passam por resistência a ataque não mágico. A runa **Decaying** do ataque especial soma **1d4 de vazio** em todo acerto e, no **crítico**, **2d4 de vazio persistente** (o escudo erguido toma o mesmo); esse vazio corrói objetos e construtos.
- 🥋 **Especialização crítica do Punho (Expert Strikes):** ataque desarmado do grupo brawling que acerta crítico: o alvo faz **Fortitude contra a CD de classe (22)** ou fica **lento 1** até o fim do seu próximo turno.
- ⚔️ **Weapon Specialization:** **+2 de dano** em ataques em que você é perito. Já vem no Punho do app (**1d6+5**: Powerful Fist d6, FOR +3 e +2).
- 🧱 **Reações, uma por rodada:** **Stand Still** (uma criatura ao alcance usa uma ação de movimento ou sai de um quadrado: Golpe corpo a corpo nela, e um **crítico interrompe** a ação de movimento), **Deflect Projectile** (você é alvo de ataque físico à distância, com uma mão livre e sem estar desprevenido contra ele: **+4 de circunstância na CA** contra ele; se errar, você o desviou), **Perfect Strike**, **Correct the Story** e **Dominant Emotion** disputam a **mesma** reação. Decida pela ameaça da rodada.
- 🐗 **Orc Ferocity (reação, 1×/dia):** ia cair a 0 PV sem morrer na hora? Fica com **1 PV** e o **Ferido sobe 1**. No app, o botão da aba Talentos faz isso, com confirmação.
- 📱 **Ponto de Foco:** 3 por dia (Ki Strike, Perfect Strike, Unfolding Wind Rush e Inner Upheaval gastam 1 cada). **Refocus** (10 minutos) devolve 1.

## ✨ Magias de Foco
Elas aparecem na aba Magias como magias de foco do Monge (qi, atributo SAB, tradição oculta). **Ki Strike**, **Inner Upheaval** e **Perfect Strike** se usam no **diálogo do Golpe** (a gaveta avisa); **Unfolding Wind Rush** se conjura pela gaveta (1 ação + 1 ponto).

## ⚡ Poderes Míticos
Três Pontos Míticos por dia, na faixa ao lado das condições.
- 🎲 **Rewrite Fate (livre):** rerrole uma perícia ou salvaguarda com **proficiência mítica** (nível + 10 no lugar da sua).
- 👂 **Ears that Hear the Truth:** Sentir Motivação ou Percepção na iniciativa com proficiência mítica: **+19** no lugar de +13.
- 🪞 **Correct the Story (reação):** um inimigo tirou um sucesso crítico em ataque ou salvaguarda; gaste 1 ponto e ele **rerrola** e fica com o novo resultado.
- 🐉 **Hydra's Bond:** na preparação diária, escolha até **3 criaturas dispostas** (metade do nível) para o vínculo: elas sempre sabem se outra do vínculo diz a verdade. Quando uma delas faz uma salvaguarda contra um efeito que a faria agir contra os aliados (confusão, dominação e afins), você pode **gastar 1 Ponto Mítico** para a salvaguarda ser feita com **proficiência mítica**. Falhando, os outros sabem que a criatura está controlada. Todos do vínculo ganham **+2 de circunstância** para neutralizar (counteract) o efeito.
- 🛡️ **Guardian's Calling (vocação mítica):** **dogma:** colocar-se em perigo para proteger aliados ou inocentes sob ameaça. **Anátema:** recuar de uma batalha enquanto aliados ou inocentes correm perigo, sem antes fazer todos os esforços razoáveis para resgatá-los.

## 🔥 Relíquias (nível 7, o do personagem)
- 🧤 **Redenção Pelas Cinzas** (luvas sem dedos de couro ressecado e cinza; aspectos **Life** e **Celestial**):
  - **Healing Wave (2 ações, 1×/hora):** onda de vitalidade num **cone de 4,5 m**: você e cada criatura viva na área recuperam **7d4 PV** (1d4 por nível da relíquia).
  - **Word of Faith (2 ações, 1×/hora):** mão em você ou num aliado: ele recupera **7d8 PV** e reduz o **Amedrontado em 1**.
- 🧥 **Afinco do Artista** (a relíquia da alma do personagem: sobretudo de couro marrom manchado de tinta colorida; aspectos **Life** e **Emotion**):
  - **Dominant Emotion (reação, 1×/hora):** você seria afetado negativamente por um efeito de **emoção**: a relíquia tenta neutralizá-lo com um **teste de counteract** (de **rank 4**, metade do nível arredondada para cima). Se passar, o efeito não pega em você. A AON não dá o modificador do teste: o mestre define.
  - **Bestow Life (2 ações, 1×/dia):** anima um objeto inanimado adjacente como um **objeto animado de nível 3** (metade do nível) por **1 hora**, para **uma tarefa simples sem combate**. O objeto não tem mente e segue só aquela tarefa.
- 📱 No app, as duas ficam no cartão **Relíquia**, no Inventário: os botões **Curar** rolam e somam ao seu PV (a Word of Faith também baixa o Amedrontado), e os de **Usar** cobram a ação ou a reação e marcam "usada" (o app não conta a hora).

## 🎒 Itens & Recursos
- 👊 **Ataque desarmado especial (+1 striking Decaying, ferro frio de baixa qualidade):** +16, **2d6+5** (contundente, perfurante ou cortante, à escolha) **+1d4 de vazio**. É o ataque forte da ficha, com o Flurry e o Ki Strike. Conta como o Punho: **ágil e de acuidade** (segundo ataque −4, terceiro −8) e do grupo brawling (especialização crítica do Punho).
- 🏹 **Striking Astral Longbow:** +15, **2d8+2 perfurante + 1d6 espírito** (a runa Astral, que também funciona como ghost touch: acerta incorpóreos). Especialização crítica do arco: no crítico, o alvo fica preso a uma superfície adjacente.
- 😶 **Mask of the Cursed Eye (invested):** a **primeira vez por dia** que uma criatura que você **não percebe** te alvejar com magia de **detecção, predição, revelação ou vidência**, ela faz **Vontade CD 24**. Falha: **enjoada 1 e ofuscada 1 minuto**; falha crítica: enjoada 2, ofuscada 10 minutos **e a magia é interrompida**. Sucesso: ela não é afetada, mas você sabe que foi alvo. É automático.
- 💰 15 po.

## 🛡️ Defesa & Sobrevivência
- ❤️ **CA 25 · 106 PV.**
- 🎯 **Fortitude +15, Reflexos +15, Vontade +15** e Percepção **+13** (perito).
- 🏃 **Deslocamento 13,5 m:** Incredible Movement (+4,5 m de status, sem armadura) e Fleet (+1,5 m).
- 🌑 **Darkvision** (Orc Sight) e visão na penumbra: enxerga bem no escuro, em preto e branco.
- 🛡️ **Deflect Projectile** e **Orc Ferocity** são as saídas defensivas; os 3 pontos míticos cobrem o resto.

## 🗝️ Fora do Combate
- 💪 **Atletismo de mestre (+16):** **Titan Wrestler** deixa Desarmar, Agarrar, Reposicionar, Empurrar e Derrubar criaturas até **dois tamanhos maiores**. **Underwater Marauder:** na água você não fica desprevenida nem sofre as penalidades de arma contundente ou cortante.
- 🎭 **Untrained Improvisation:** em perícia destreinada você soma o **nível inteiro** (nível 7). Por isso Arcanismo, Diplomacia, Intimidação, Ocultismo, Performance e Sociedade saem em **+8**, e Medicina, Natureza, Religião e Sobrevivência em **+9**. **Clever Improviser** ainda deixa tentar ações que exigem treino, mesmo sem treino. Acrobacia +13, Furtividade +15, Roubo +13, Ofício +10; Saberes (Warfare, Art, Streetwise) +10.
- 📦 **Experienced Smuggler:** quando o mestre rola a sua Furtividade contra observador passivo para um item pequeno escondido, vale o dado ou 10, o maior. **Specialty Crafting:** +1 de circunstância em Ofício para fabricar um tipo de item.
- 🗣️ Idiomas: comum, feérico e orc.

## ⚠️ Erros Comuns
- ❌ **Esquecer que o Flurry é flourish:** só **uma vez por turno**. O segundo Golpe é o do Flurry, não o de um segundo Flurry.
- ❌ **Ligar o Ki Strike sem ponto de foco:** ele gasta 1 ponto por Flurry ou Golpe. Sem foco, é só o Flurry normal.
- ❌ **Atacar sem armas em postura de arqueiro:** na Monastic Archer Stance só dá para atacar com arco. Saia da postura na faixa Monge.
- ❌ **Flurry com arco fora da postura ou longe:** exige a postura e **dentro de metade do incremento de distância**.
- ❌ **Gastar a reação em Perfect Strike e depois não ter para Stand Still ou Deflect Projectile:** é uma por rodada.
- ❌ **Stunning Blows em dois alvos:** só vale quando os dois Golpes do Flurry são **na mesma criatura**.
- ❌ **Contar com Perfect Strike no arco:** ele só refaz Golpe **desarmado**.`

export const COMBAT_GUIDES: CombatGuide[] = [
    { match: byName('Ardagar'), markdown: ARDAGAR, curated: true },
    { match: byName('Eldarion'), markdown: ELDARION, curated: true },
    { match: byName('Ghan Buri'), markdown: GHAN_BURI, curated: true },
    { match: (b) => (b.name || '').trim().toLowerCase().startsWith('brukuthur'), markdown: BRUKUTHUR, curated: true },
    { match: byName('Cerosqualhanthallas'), markdown: CEROSQUALHANTHALLAS, curated: true },
    // O Pathbuilder exporta "Nathaniel o Magus"; casa pelo começo, como o Brukuthur.
    { match: (b) => (b.name || '').trim().toLowerCase().startsWith('nathaniel'), markdown: NATHANIEL, curated: true },
    { match: (b) => (b.name || '').trim().toLowerCase().startsWith('thalos'), markdown: THALOS, curated: true },
    { match: byName('Loki'), markdown: LOKI, curated: true },
    { match: (b) => (b.name || '').trim().toLowerCase().startsWith('miranda'), markdown: MIRANDA, curated: true },
    { match: (b) => (b.name || '').trim().toLowerCase().startsWith('hearts'), markdown: HEARTS_FOLLY, curated: true },
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
    const saves = SAVES.map((s) => saveCheck(b, s.key, NO_MODIFIERS))
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

/** O guia curado que o app mostrava — base para a IA atualizar em vez de começar do zero. */
export function curatedBase(b: BuildInfo): string | null {
    const g = getCombatGuide(b)
    return g.curated ? g.markdown : null
}
