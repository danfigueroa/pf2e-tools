# Ficha Virtual (`/ficha-virtual`, `src/modules/character-viewer/`)

Visualizador interativo da ficha do Pathbuilder: abas no desktop, acordeão abaixo de `sm` (e no painel do mapa). Seções em
`sections/*` (Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory, Notes); as vazias somem. Helpers em
`helpers.ts`. Estado da mesa: `src/services/CLAUDE.md`. Publicação no servidor: `api/CLAUDE.md`.

**Princípio da ficha**: o JSON do Pathbuilder **nunca é editado à mão nem regravado**. O que ele não exporta ou exporta errado
é corrigido no `normalizeBuild` ou num **catálogo por nome** (de personagem, arma, item, talento), para sobreviver a todo
export novo. Regra se confere na AON; o que não fecha vira aviso.

## Estrutura e desempenho

- `CharacterSheetView` (usado pela página e pelo painel do mapa) é um invólucro que decide o acesso (`canEditSheet` com o
  `ownerId`) e fornece o contexto (`sheetAccess.ts`) **acima** do corpo (`SheetBody`). A página só cuida de upload, publicação e restore.
- O acordeão monta **só a seção aberta** (`unmountOnExit`). As seções são `memo`: **prop nova numa seção precisa ser estável**
  (`useMemo`, setters), senão o `memo` vira enfeite.
- **Diálogo novo na ficha usa `EmbedDialog`**, não `Dialog`: dentro do painel do mapa os overlays ficam presos ao painel
  (`embedContext.ts`), sem trava de foco.
- **Efeito de classe/condição chega à rolagem por `ConditionModifiers`** (`rage`, `cascade`, `ranger`, `psyche`,
  `meleeDamage`, `reflexShield`), lido por `planStrike` (Golpe) e `buildCheck` (testes). Chip de situação do diálogo é uma
  chave em `extrasOn` (`STRATAGEM_KEY`, `LEAD_KEY`, `FLURRY_KEY`, `KI_KEY`, `DRAGON_STRIKE_KEY`, `CUSTOM_DICE_KEY`).
- Campos da mesa por classe: `rage` `{ active, since, endedAt, granted, titan }`, `magus` `{ cascade, cascadeType, spent,
  summoned }`, `ranger` `{ prey, gravity }`, `rogue` `{ poison, simpleUsed }`, `size` `{ active, used, since }`, `psyche`,
  `energy`, `investigator`. Todos no `FIELD_RE`.
- Faixas fora das abas (afetam a ficha toda): ações do turno, condições, pontos míticos, e as de classe (Fúria, Magus,
  Patrulheiro, Investigador, Monge, Psique, Energia). Cada uma só aparece para quem tem a característica.

## Ficha de outra pessoa = somente leitura (decisão do usuário: ver tudo, não rolar nem gastar)

Três camadas: `useSharedState` não escreve; `RollTrigger` vira texto e o `RollDialog` não monta; o tema aninhado
(`components/ReadOnlyTheme.tsx`) tira o clique de todo `Button`/`IconButton`/`Switch`/`Checkbox` **por estilo** (não por
`disabled`, que muitos botões já passam explícito). Vale nos portais.
- **Botão novo nasce travado.** Botão de VER leva `{...VIEW_OK}` (`data-view`: Trocar ficha, Atualizar, fechar/compartilhar
  descrição, Carregar todas, Corrigir tradução).
- `ButtonBase` escapa do tema: pips (`SlotPips`, `ActionsBar`) e envio de imagem (`TokenAvatar`, `CompanionsCard`, `ItemArt`)
  leem `useSheetReadOnly()` à mão — o envio subiria ao Storage antes de a mesa recusar.

## Publicação (cliente)

- `usePublication.ts`, `PublishDialog.tsx` (diff contra a versão da mesa, `sheetDiff.ts`), `PreparingDialog.tsx`,
  `PublishedBar.tsx`, `services/sheets.ts`, `services/sheetPreparation.ts`.
- **Toda ficha vai para o banco** (decisão do usuário): só Publicar ou Cancelar. Ficha igual à já publicada dispensa.
  Preset aberto não publicado é publicado sozinho (`publishPreset`, em segundo plano).
- "Publicar" cria um **rascunho** e abre o preparo; a ficha só abre quando completa. **Quem conduz é o navegador de quem
  publicou**: `sheetPreparation.ts` tem um laço por ficha na aba, independente do diálogo (fechar não para). Aba fechada: o
  `UploadCard` mostra "Em preparo" com "Continuar" para quem enviou, o dono e o GM. Em `waiting`, espera `retryIn` e tenta
  de novo, sem desistir. Barra: `progressView`.
- **"Nova versão publicada"** (`NewVersionBar.tsx` + `services/sheetNotices.ts`, canal `sheets`): faixa com "Abrir a nova
  versão"; **nada troca sozinho** (a ficha não muda embaixo do dedo). O guia que chega depois entra sem aviso (`attach`). O
  aviso da própria publicação é ignorado (`by`).
- `published` só existe quando a ficha na tela é a da mesa. Ao recarregar, o slug no `sessionStorage` relê a versão da mesa.
- O "Restaurar" chama `loadSheetDescriptionsBoth`; `useSheetDescriptionsStatus` mostra "Preparando as descrições…".

## Presets e personagens

- Ficha nova no dia a dia: o jogador **publica** pelo upload. Para virar preset fixo: JSON em `public/characters/`, entrada em
  `PRESETS_BY_MESA` (`campaignPresets.ts`) com `sheetName` = `build.name`, guia curado opcional em `combatGuides.ts`,
  `build-description-bundle`, e `seed-presets.mjs`.
- **Os presets alimentam três módulos** (Ficha, Iniciativa, Transformação), todos por `loadPresetJson` (publicada > arquivo).
  O nível vem de `usePublishedSheets().levelOf`, nunca do `level` do preset.
- **Dois nomes**: `name` (rótulo curto) e `sheetName` (`build.name`, de onde sai o slug). **Compare por `sheetName`** (o "já no
  combate" da Iniciativa por `name` duplicava o personagem). Guias do Brukuthur e do Nathaniel casam por `startsWith`.
- Elenco: Casa do Gordo (Brukuthur, Ceros, Eldarion, Ghan Buri, Nathaniel, Thalos — nível 10); Arton 1515 (Loki Magus 7,
  Miranda Investigadora 7, Hearts Folly Monge 7, Woyd Clérigo 7). O Ardagar saiu (guia `ARDAGAR` e `CHARACTER_ANIMALS` ficam).
- **Renomear um personagem sem perder o estado** = uma linha em `SLUG_ALIASES` (`charId.ts` **e** `sheet-store.js`): o export V3
  chama o Thalos de `Thalos Alba`, e o slug segue `thalos` (token, PV, slots, ficha publicada).
- `?ficha=<slug>` abre a ficha publicada.

## Correções do export do Pathbuilder (`normalizeBuild`, `src/pathbuilder/types.ts`)

Rodam no `parseCharacterJson` **e** no restore da sessão.
- `normalizeSpellCasters`: grimório (magus, mago) chega com o dia em `prepared` e `spells` vazio → copia para `spells`. O
  `perDay` do Magus traz slots que a classe não tem: na preparada, o slot é a cópia preparada.
- `fixWeaponExports` (`WEAPON_EXPORT_FIXES`): a Zarroc Sheilvean do Nathaniel vem 1 abaixo; corrige **só se o número exportado
  for exatamente 1 abaixo da conta** (reexport certo não soma de novo).
- `dropSizeSpecials`: tira os seis tamanhos de `specials` ("Medium" é a classe Medium na AON).
- `fixFocusPool`: pool = número de magias de foco, até 3 (truque de foco não conta). **Só reduz**; não toca no Psíquico.
- `addItemResistances`: resistência de item vestido (Arachnid Harness: poison 2) em `build.resistances`.
- O JSON do Nathaniel foi editado à mão: *Ring of Wizardry (Type I)* no lugar do Winder's Ring, +1 de Arcanismo em `mods`; os
  dois slots de 1º do anel não estão em `perDay`. Confira o anel antes de sobrescrever com export novo.

## Totais e condições

- **Totais dos testes têm UMA fonte** (`checks.ts`: `saveCheck`, `perceptionCheck`, `skillCheck`, `loreCheck`, com `parts`).
  Visão Geral, Perícias, Iniciativa (`pcFromBuild`), guia automático e rolagem leem daqui.
  - Bônus de item vem de `build.mods`. Penalidade de armadura nas perícias de FOR/DES (`useArmorPenalty`), só quando a FOR
    não alcança; não vale em ação de ataque (aviso).
  - **Untrained Improvisation**: perícia destreinada soma nível −2 (−1 do 5º, inteiro do 7º); salvaguarda e Percepção não.
- **Condições** (`conditions.ts` + `useConditions.ts` + `ConditionsBar.tsx`): catálogo do Remaster à mão com `effects` sobre
  alvos atômicos (`ac`, `reflex`, `attackStr`…) e grupos (`all`, `dexBased`, `mental`).
  - **Penalidade do mesmo tipo não empilha** (vale a pior; status e circunstância somam entre si). **"Testes e CDs" inclui a CA.**
  - Impostas (Inconsciente → Cego, Desprevenido, Caído) e **derivadas** (aflição, Enlarge, Titan Mauler, Psique) entram por
    `derived`: contam nos modificadores, **nunca são gravadas**.
  - O Pathbuilder não diz se a arma é de FOR ou DES: no total da arma entra só o que penaliza os dois (`sharedMod`), o resto
    vira aviso. Desarmado sabe (`usesDex`). O que não é modificador (ações perdidas, teste plano) vai em `note`.
  - Bônus que não pode passar por `effectiveParts` (guarda só a pior parcela de cada tipo), como o Reflexive Shield, entra em `buildCheck`.
- Aflições e persistente (`AfflictionsBar`, `PersistentDamageBar`): a ficha só **lê** e remove; quem aplica é a Iniciativa.

## Rolagens (`rolls.ts`, `strikes.ts`, `components/RollDialog.tsx`, `RollTrigger.tsx`)

Diálogo com memorial, MAP, chips de dano extra, ajuste livre (cru, com aviso) e dois botões: normal e **✦ mítico** (gasta o
ponto no mesmo clique). Tudo vai para o feed.
- **Golpe** parte do `weapon.attack` e acrescenta só o que o Pathbuilder não sabe. À distância DES, corpo a corpo FOR,
  acuidade = o melhor **depois** das condições. MAP −5/−10, ágil −4/−8. Enfraquecido no dano só se a arma soma FOR. Piso 1.
- **Crítico**: dobra o rolado (dados, fixo, extras, precisão); deadly soma 1/2/3 dados por fora; fatal troca o dado e soma
  +1 por fora. O cartão mostra acerto e crítico juntos (o app não sabe a CA — decisão do usuário).
- **Efeitos de crítico** (`critEffects.ts`, GM Core pg. 237-239): runa vale sempre (Flaming persistente, Shock, Corrosive,
  Frost/Thundering como aviso, Decaying 2d4 persistente). **Especialização crítica** pelo grupo (`search?gear=`) e só se a
  ficha permite (`specSourceFor`): Fighter com o grupo nas características e Swashbuckler sempre; Barbarian com Brutality em
  Fúria corpo a corpo; Ranger contra a presa (chip ligado); Rogue/Bard situacionais (chip desligado); Monge perito no
  brawling. Sem característica, sem chip. Persistente e dano fora do alvo vão na nota, nunca dobram.
- **Rank do ✦ da arma** (`weaponRank`): conta de volta (ataque − nível − atributo − potência); usa se fecha num rank real,
  senão a categoria; categoria desconhecida = sem ✦.
- **Chips de dano extra** lembrados por arma no `localStorage`: energia ligada, precisão desligada, perfil situacional
  ligado. **Chips de situação não são lembrados** (Hunter's Aim, Gravity "primeiro Golpe", estratagema, Flurry, Ki, Dragon
  Strike, Laughing Shadow): lembrar um "desligado" tiraria dano em silêncio no turno seguinte.
- **Dados extras digitados** (`ExtraDiceField.tsx` + `src/dice/extraDice.ts`): só faces de `DICE_FACES`, até 20 dados, sem
  fixo; inválido trava o rolar. No Golpe dobra no crítico; na magia, só no primeiro raio. Parcela demais junta as últimas
  (`fitParts`, teto 8) sem mudar o total.
- **Fortuna** (`fortune.ts`, 2d20 fica o maior): Sure Strike (só ataque; rolar com ele CONJURA, salvo crédito de
  `noteSureStrikeCast`) e Wish for Luck (1×/dia em `uses`; ataque, salvaguarda, perícia). Com fortuna o ✦ do Rewrite Fate
  some. O d20 descartado vai em `check.discarded`; **as estatísticas só leem `check.d20`**.
- Arma sem traços na AON: rola como corpo a corpo sem ágil, com aviso e seletor FOR/DES. Título do cartão = nome base.
- **Magia**: dano de `scaleSpell` no rank conjurado (o mesmo da linha e do drawer), um chip por componente (alternativas: só
  o primeiro ligado). `uncertain` não rola. **Persistente começa desligado e não dobra.** Salvaguarda básica mostra os quatro
  graus; a `defense` chega traduzida (regex nas duas línguas). Mythic Magic já rola com proficiência mítica, sem ✦.
  `MYTHIC_ATTACK_SPELLS` (`rolls.ts`) lista as magias míticas que atacam com proficiência mítica (o traço sozinho não diz).
- **Iniciativa pela ficha**: chip "Usar como iniciativa" (Percepção, Furtividade, Atletismo, Acrobacia) marca `initiative` no
  `TableRoll` (só com `check` de d20, nos dois sanitizadores). Bônus automáticos (`initiative.ts`: Incredible Initiative,
  Elven Instincts, Battlefield Surveyor) são circunstância e **não empilham**.
- **Tratar Ferimentos / Battle Medicine** (`treatWounds.ts`, dentro do diálogo de Medicina, só treinado+): mesma tabela
  (CD 15/20/30/40, bônus +0/+10/+30/+50; 2d8, 4d8, falha crítica 1d8 de dano). **Tratar Ferimentos não gasta ação e tira
  Ferido; Battle Medicine custa 1 ação (não a do Acelerado) e não tira Ferido.** "1 hora" dobra (ajuste no fixo para fechar),
  Risky Surgery (+2, sucesso vira crítico, 1d8 cortante antes). **Dano e cura numa escrita só de PV** (`restoreHp`).
  Godless Healing: +5 em si mesmo, somado ao fixo. Imunidade, Ward Medic e kit só avisam. Assurance também vale aqui.

## Ações do turno (`actions.ts`, `useActions.ts`, `ActionsBar.tsx`)

Campo `actions` (`{ used, quickUsed, reacted, shieldReacted, turn }`). **O app só conta.**
- Orçamento: 3 − o **maior** entre Lento e Atordoado. Acelerado dá +1 que só paga Golpe ou Andar de 1 ação
  (`'move-attack'`) e é gasta primeiro.
- Gastos automáticos: Golpe 1 (2 com Hunter's Aim/Spellstrike; chip "É uma reação" gasta a reação), magia pelo `actions` da AON,
  ativar Fúria/Gravity/Hunt Prey/Cascade/recarregar Spellstrike/Summon/veneno 1, escudo 1. Perícia só gasta se marcada.
- **Início do turno vem da Iniciativa** (`party.startTurn` no handler, nunca num efeito); "Novo turno" na ficha.
- O GM zera e o jogador vê pelo Realtime; sem canal, poll de 5 s só pela faixa. `pullField` nunca atropela escrita na fila.
- **Quick Shield Block**: reação extra só para Shield Block (`shieldReacted`), gasta primeiro; Reactive Shield ergue pela reação normal.

## Economia de uma conjuração (`spellCast.ts`, `useSpellCast.ts`)

Toda conjuração é **um evento que paga tempo e recurso**.
- Tempo (`castTimeOf`): 1/2/3 ações, reação (`spendReaction`, idempotente), livre/minutos não gastam, "1 a 3" pela escolha
  (ou o mínimo, com aviso); sem descrição = aviso.
- Recurso (`CastResource`, via `DescriptionRequest.cast` → `RollRequest.cast`): cópia preparada, slot do rank, foco, Ponto
  Mítico (Mythic Magic), truque nada. Sem recurso: avisa e não desconta.
- **Rolagem (`via: 'roll'`) e marcação à mão (`via: 'mark'`) são casadas por `pairCast`** (mesma magia, 90 s): paga UMA vez.
  Desfazer slot não devolve ação. Os pips do cabeçalho do espontâneo são só bookkeeping.
- Magia sem ataque nem dano ganha **Conjurar** no drawer (só magia da ficha com conjurador). Truque só tem esse caminho.
- Magus: confluência (Focus + Magus) com 1+ ação **recarrega o Spellstrike**; `STRIKE_SPELLS` deixam o Golpe pago
  (`prepayStrike`); magia estudiosa oferece entrar na Arcane Cascade como ação livre.
- Spellstrike já paga a magia e registra o crédito. Psi cantrip só paga foco ao amplificar.

## Magias de ação variável (`actionVariants.ts`)

Seletor "Quantas ações você gasta". **As regras são um CATÁLOGO à mão** (`CATALOG`, conferido na AON): Heal, Harm, Force
Barrage/Magic Missile, Blazing Bolt/Scorching Ray, Ki/Qi Blast, Disorienting Flash, Concordant Choir, Rebuke Death, Banishing
Touch. Fora do catálogo: só o seletor e o custo, com aviso — nunca número inventado. **Magia nova = entrada em `CATALOG` +
casos no `check-rolls`.**
- Fórmulas em (rank, ações). Healing Hands troca os d8 do Heal por d10 (`variantOptionsFor(build)`, só no diálogo).
- Blazing Bolt: **um raio por ação, cada um com ataque e dano**, numa rolagem só (`TableRoll.rays`, sem `check`/`damage` no topo).
  O ✦ gasta uma vez. Spellstrike aceita ação variável com 1–2 ações, um raio só.
- `id` dos componentes vem da posição (9500+i), não de contador (a seleção sobrevive ao render).

## Atividades, reações e Pontos Míticos (`activities.ts`, `useActivity.ts`, `ActivityButton`)

O custo vem da **própria AON** (`actions`, `traits`, `trigger`, `frequency`, e o texto "Gaste um Ponto Mítico").
`check-economy` falha se algo do elenco ficar sem caminho.
- `activityOf` (custo por `castTimeOf`): ação livre só ganha botão se gasta ponto ou tem limite diário.
- "Usar" genérico nas abas Talentos/Habilidades e no drawer. **`DEDICATED` lista o que tem caminho próprio** (Rage, Hunt
  Prey, Shield Block, Battle Medicine, Divert Destiny, Pursue a Lead, Devise a Stratagem…): ali o genérico não aparece, para
  não cobrar em dobro. Talento/ativável novo com botão próprio = entrada em `DEDICATED`.
- "Uma vez por dia": campo `uses` (`{ nome: vezes }`); "Usada hoje ↺" devolve; o **Novo dia** zera e fica habilitado com qualquer uso marcado.
- Atividade que inclui um Golpe (Sudden Charge, Vicious Swing…): deixa o Golpe pago (`prepayStrike`, 90 s, `takePrepaidStrike`).
- Item: "Usar/Beber" gasta a ação da AON; Desfazer devolve.
- **✦ estrito** (`mythicUse.ts`): só onde um talento da ficha permite, com o nome dele — Rewrite Fate (perícia, salvaguarda,
  Percepção), Mythic Strike (Golpe; Brukuthur, Nathaniel e Thalos não têm), Ears that Hear the Truth, Unbelievably Believable
  (`influence`), Feet that Stride the Sky/Arms that Cut the Waves, Prescience (`initiative-skill`), Sage's Calling (`recall`).
  Nenhum em ataque de magia. O ✦ troca a proficiência; não é reroll.
- Ação de perícia (`skillActions.ts`): chip opcional, desligado. Keen Recollection libera Recall Knowledge em qualquer perícia;
  Tamper exige o talento (`SkillAction.feat`).
- Talentos míticos do turno (`mythicFeats.ts` + `MythicFeatsRows.tsx`): Godspeed (liga Acelerado derivado e +3 m na Visão
  Geral; não chega ao mapa), Correct the Story, Arc of Destruction, Become Destiny, We've Met Before.
- Não automatizado: cargas de cajado, imunidade de alvo, Hydra's Bond, Sparkling Targe, efeitos dentro das atividades.

## Magias

- **Slots** (`useSpellSlots.ts` + `SlotPips.tsx`): guarde **contagem**, nunca índice (sobrevive a reordenar). Preparado:
  pips na linha; espontâneo: no cabeçalho (`perDay`) com botão de gastar; truque nunca tem slot; foco = contador único.
  "Novo dia" zera e pede confirmação. Recuperar pelo resumo: menu sempre (`SlotRecoverMenu.tsx`), mesmo com uma opção.
- **Heightening** (`api/_lib/spell-scaling.js` + `heightening.ts`): números do rank conjurado, chip "↑ 5º". **Conservador**:
  entrada só vira conta quando TODO número acha dono (`safe`, tudo ou nada); `resolved` = sem efeito sobrando. Rank fixo
  substitui; entrada fixa não lida = `uncertain` ("7d10 (?)"). Na prosa traduzida troca a k-ésima ocorrência só se a
  contagem bate. Casos no `check-heightening`.
- **Assinatura** (`signatureSpells.ts`, por personagem e bloco; hoje o "Psychic" do Thalos): repetida elevada em cada rank com slot.
- **Mythic Magic** (`isMythicMagicCaster`): os 5 slots de 5º **não existem**; cada conjuração gasta 1 Ponto Mítico. O "Novo dia"
  dos slots não conta esse bloco.
- **Bastão** (`StaffSpellList.tsx`): magias por rank com custo em cargas; tocar navega no drawer (`onNavigate`) com o rank como
  nível; truque vai sem nível. Nome de magia fica em inglês (é a chave da AON); preço/rank traduzidos (`formatPrice`).
- **Psi cantrips / amps** (`psiAmps.ts`, por nome): o chip "Amplificar · 1 Ponto de Foco" troca o dano; o ponto sai ao rolar
  (ou antes de fechar no "Conjurar"). Quem amplifica: Psíquico ou arquétipo com Psi Development (`canAmpPsiCantrips`).
  **Truque de foco não gasta ponto ao conjurar** (`FocusSpellEntry.cantrip`); só o amp.
- **Unleash Psyche** (`psyche.ts`, campo `psyche`: `idle` → `unleashed` → `strain`): +2×rank em magia de dano sem duração da
  conjuração de Psíquico, uma vez, na primeira parcela imediata. Ressaca (Estupefato 1) derivada. Trocas de fase são botões.
- **Conservation of Energy** (`energy.ts`, campo `energy`): Adicionar (fogo)/Remover (frio), depois só a oposta; volta ao
  neutro por botão.

## Mítico (`helpers.ts`, `useMythicPoints.ts`, `MythicPointsBar.tsx`)

- Mítico = tem algum Mythic Feat. **Proficiência mítica (nível + 10) SUBSTITUI a proficiência**: `mythicProficiencyDelta`
  desconta o embutido (`level + rank`, ou zero se destreinado). Nunca +10 por cima.
- Pool de 3 pontos (`MYTHIC_POINTS_MAX`, campo `mythic`), faixa fora das abas. Legenda única `MythicNote`.

## Inventário

- `inventoryRows` lista armas e armaduras junto do equipamento (derivado no render).
- **Consumíveis** (`useConsumables.ts`): consumível = traço `Consumable` da AON (o Pathbuilder marca poção como "Invested");
  fallback por nome (pergaminhos). Campo `consumed` guarda quantos por nome com `of` = quantidade **da ficha**: export com
  outra quantidade zera o contador. ＋ devolve 1 (teto: a quantidade da ficha), sem mexer no PV. Cura rolada e aplicada com
  memorial e Desfazer (tira só o que a cura somou). Teto por `characterMaxHp`.
- **Passar item** (`gifts.ts`, `useGifts.ts`, `GiveItemDialog.tsx`, campo `gave`): só consumível; direto, sem aceite.
  **Cada jogador escreve só na própria fatia**: `gave` guarda no remetente `{ destinatário: { item: n cumulativo } }`, quem
  recebe soma (`?incoming=` + `onStateChange`). Quantidade **derivada** (ficha + recebido − passado − usado). O passado entra
  como `extra` em `remaining`/`consume`, `consumed.of` segue sendo `sheetQty`. **Quem lê `build.equipment` à mão não vê o
  item recebido: use `useGifts().rows`.** O primeiro retrato não avisa, mas compara com o "visto" do `localStorage`.
- **Imagem de item** (`itemArt.ts`, campo `art` `{ nome minúsculo: url }`, pasta `items/`): até 25 por ficha (teto 8 KB);
  recuse antes de subir. Trocar apaga a antiga. A relíquia usa o mesmo campo, pela chave do nome dela (`RelicsCard`).
- **Dinheiro** (`money.ts`, `useMoney.ts`, `MoneyCard.tsx`, campo `money` `{ purse, of }`): o dono e o GM acertam na mesa;
  `of` = o dinheiro **da ficha** quando a edição foi feita. Ficha publicada com outro dinheiro vence (o gasto não conta duas
  vezes). Quem edita vê o cartão mesmo zerado.
- **Escudo** (`shield.ts`, `useShield.ts`, `ShieldCard.tsx`, campo `shield` `{ hp, raised }`): a CA exportada não inclui o
  escudo. Dureza/PV/BT da AON + runa de reforço (teto por grau). **Quebrado (PV ≤ BT) não ergue, não soma e não bloqueia**;
  o bloqueio que quebra abaixa. No bloqueio, o que passa da Dureza vai inteiro para os dois. Destructive Block (por golpe,
  `blockSplit`). Consertar: o jogador informa o grau. Barra própria (marca do BT e rachadura).
- **Relíquias** (`relics.ts`, `RelicsCard.tsx`, catálogo `RELICS` por personagem): nível = o do dono; dádivas pela Tabela
  2–22 (`GIFT_LEVELS`, `minLevel`). Descrição pela AON (categoria `relic`); só o que ela não estrutura vai no catálogo
  (`activation`, `facts`). Usar = `ActivityBody` com `giftActivity`; uso limitado em `uses` (`relic:<relíquia>:<dádiva>`).
  Runas de arma entram no `build` uma vez (`withRelicRunes`), potência/striking pelo **maior**; a versão maior de uma runa
  troca a menor (Greater Flaming no lugar da Flaming), e a Flaming põe o 1d6 fogo no `extraDamage` se a ficha não tem.
  **Regra da casa por mesa** (`HOUSE_RELIC_WEAPON_RUNES`): na Casa do Gordo toda relíquia que é arma tem +1 striking,
  aplicado antes das dádivas e mostrado no cartão. Runa de dádiva pode ter `activation` (Shifting). O cartão fica fora do
  "Inventário vazio". Atuais: Miranda's Arm (= o Braço Sônico; Scrap Shot, Dragon Strike), Loki's Heart (Sands of the
  Hourglass, Whammy — a AON não dá a CD), da Hearts Folly Redenção Pelas Cinzas e Afinco do Artista (curas pelo
  `HealActivityButton`), Brasão da Família do Woyd (Pride, `EMOTION_SURGE`), Solar Bloodthirsty do Brukuthur (o Greataxe; Flaming → Greater
  Flaming, Shifting).
- **Catálogos por nome** (o JSON não é editado): `customRunes.ts` (runas homebrew; `replaces`), `homebrewGear.ts` (traços de
  arma que a AON não tem: Braço Sônico com acuidade, o "Special Unarmed" da Hearts Folly como o Fist), `magicWeapons.ts`
  (perfis situacionais, ex. Gloom Blade), `unarmed.ts` (desarmados à mão — o Pathbuilder não exporta nenhum; `ITEM_ATTACKS`;
  Powerful Fist e Weapon Specialization somados), `itemActivities.ts` (ativação diária do Arachnid Harness).
- **Traços** (`TraitChips.tsx`): chips em português (`traitLabel`, pés → metros), regra em português com o original entre
  parênteses, buscada em lote ao aparecer (`prefetchTraitRules`). Use `traitName` ("Deadly d10" → "Deadly"), nunca o
  `traitTerm` do monstro.
- **Apelido de arma** (`attackNames.ts`, campo `names`): só apresentação. As regras casam pelo `name` **original**; chave =
  `name` + ocorrência (`w:longbow#0`, `u:<id>`). `Strike.label`/`detail` são só leitura — **nunca use em conta**. Até 40
  caracteres e 30 apelidos (`sanitizeAttackNames`).

## Classes e talentos (todos descobertos pela ficha, textos conferidos na AON)

- **Fúria** (`rage.ts`, campo `rage`): regra do **Remaster, sem −1 na CA**. PV temporários = nível + CON (não empilham; ao
  encerrar tira só o que a Fúria deu, `granted`; nova Fúria em 1 min não dá). +2 corpo a corpo, metade com ágil. Dano viaja
  como **regra** (`ConditionModifiers.rage` + `meleeBonusParts`), não número. Titan Mauler (`GIANT_BARBARIANS`, por nome):
  +6/+10/+18 com arma Grande e Desajeitado 1 **permanente enquanto a empunha** (derivado; decisão do usuário), interruptor
  `titan`. Raging Resistance só para Giant catalogado. Fim por inconsciência/encontro não é automático.
- **Magus** (`magus.ts`, `MagusBar`, campo `magus`): Arcane Cascade (+1/+2/+3 por especialização, tipo escolhido pelo
  jogador, só corpo a corpo, `planStrike` `key: 'arcane-cascade'`); Laughing Shadow (3/5/7 com o chip desprevenido).
  **Spellstrike** (`SpellstrikePanel`, `spellstrike.ts`): magias de **qualquer bloco** (inclui Mythic Magic, que gasta Ponto
  Mítico) e truques de foco, 1–2 ações com ataque ou salvaguarda; um clique rola Golpe + magia, gasta o recurso e marca gasto.
  Ataque dobra no crítico, salvaguarda não. Magia escolhida e não pronta = botão desabilitado. Summon Mythic Power (1×/dia) e
  Divert Destiny valem para qualquer mítico (a faixa vira "Poder mítico"). Fiery Rebirth também mora nessa faixa.
- **Patrulheiro** (`ranger.ts`, campo `ranger`): Hunt Prey (liga o `1d8 precision` do Precision), Gravity Weapon (gasta foco
  do mesmo contador; 2 × dados no primeiro Golpe com arma da rodada, chip ligado), Hunter's Aim (+2, só à distância).
- **Investigador** (`investigator.ts`, campo `investigator`): Devise a Stratagem — **o d20 vem primeiro** (decisão do usuário):
  "Rolar o d20 do estratagema" paga a ação; o d20 fica em memória (`stratagemPending.ts`) até usar, descartar, mudar o
  `turn` ou 15 min. INT no ataque só com ágil/acuidade/distância (`stratagemQualifies`; sem traços, avisa). Strategic Strike
  1d6 precisão (+1 dado em 5/9/13/17). Investigações (até duas, `dropped` até a nova preparação) e relógios de 10 min que
  **só mostram**. Assurance = 10 + proficiência, sem outro bônus, só nas perícias do talento (`check` com d20 = 10).
- **Monge** (`monk.ts`, `MonkBar`): Flurry of Blows (`flurryRoll`, `rays`, MAP um degrau acima), Ki Strike/Inner Upheaval
  (gasta foco; **sem "Conjurar" no drawer**, `isStrikeFocusSpell`, para não cobrar em dobro), Perfect Strike, Stunning Blows
  (nota). Monastic Archer Stance em `uses['stance:monastic-archer']`.
- **Ladino** (`rogue.ts`, campo `rogue`, sem faixa): tudo no diálogo do Golpe. Veneno simples é o padrão (`'@simple'`, doses =
  nível, 1d4/2d4 sem salvaguarda, **não dobra**, `simpleUsed`); venenos do inventário com `Poison` + `Contact`/`Injury`.
  Aplicar = chip "+1 ação" pago **antes** do Golpe; a lâmina fica envenenada até "Veneno usado". Debilitating Strike = nota.
- **Guerreiro** (`fighter.ts`): Fearsome Brute (2×/3× medo, **guardado pelo talento**), Exacting Strike (nota), Reflexive
  Shield (via `buildCheck`), Fiery Rebirth (não toca em Ferido).
- **Clérigo** (`cleric.ts`): Healing Hands, Selective Energy (aviso), Sacred Ground (cura fixa = nível), Banishing Touch.
- **Curas que são ação** (`healActivities.ts`, `HealActivityButton`): Searing Restoration, Healer's Touch (1×/dia).
  Traço Unstable: teste simples CD 15 (13 com Ofício lendário) no mesmo clique; falha "pifa" (`uses['unstable:broken']`).
- **Orc Ferocity** (`OrcFerocityButton`): reação 1×/dia, PV 1 e Ferido +1; o jogador toca quando o mestre disser.
- **Mudança de tamanho** (`sizeEffects.ts`, campo `size`): Enlarge/Shrink da runa do Brukuthur, 1×/dia; Desajeitado
  derivado, +4 corpo a corpo em `meleeDamage`. A Iniciativa e o mapa leem o campo, não escrevem.
- Auditoria de textos errados da AON corrigidos à mão no pacote estático: Anathema, Holy, Domain: Void, Healing Font, Scroll
  Robes (Woyd). Entradas sem descrição de propósito: Healing Font (aproximado), Storm Order, Thief Racket, Spellbook.

## Abas de leitura

- **Grupos** (`featGroups.ts`): talentos pelo tipo do Pathbuilder traduzido (`featTypeLabel`); habilidades pela `category` da
  AON (`specialGroup`), "Outras" até a descrição chegar. **Não use o `className` da AON** (casa "Weapon Specialization" com a
  primeira classe). Sentidos de ancestralidade pelo nome. `specialLookupName` busca "Weapon Expertise (Magus)".
- **Guia "Como Jogar"** (Visão Geral): (1) o gerado da ficha publicada, (2) o curado de `combatGuides.ts` por nome, (3)
  `buildFallbackGuide()`. O curado é só a **base da primeira geração**: editá-lo não muda o guia de ficha já publicada
  (republicar). No celular é uma aba fechada (`Collapse` com `unmountOnExit`, selos no cabeçalho). "Editar guia" (`guide-edit`,
  por idioma) e "Meus trechos" (campo `guide`, `guideNotes.ts`, até 3500 caracteres, nunca lido pela IA). Guia do Loki segue
  o Remaster do Magus (Impossible Magic). Guias em inglês: `combatGuidesEn.ts`.
- **Anotações** (`NotesSection.tsx` lazy, `useCharacterNotes.ts`, `notes.ts`, `services/notes.ts`, tabela `character_notes`):
  background + notas com etiqueta, busca, fixar, Markdown. Autosave 1,5 s, rascunho local, 409 por `base`. Aba sempre visível;
  `MarkdownEditor` com `plain`. Ficha de outro: só prévia.
- Descrições sob demanda no `DescriptionDrawer` (o corpo é `DescriptionContent`); última ficha no `sessionStorage`. "Carregar
  todas" traduz em grupos de 6, até 3 passadas.
