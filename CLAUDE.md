# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório. Para detalhes de produto, veja o `README.md`.

## O que é

**PF2e Toolkit** — SPA (React 19 + TypeScript + Vite + MUI 7) com ferramentas para Pathfinder 2e
Remaster. Textos de UI em **português (pt-BR)**.

Quatro módulos ativos (rotas em `src/App.tsx`):
- `/ficha-virtual` → `src/modules/character-viewer/` — visualizador de ficha (JSON Pathbuilder) com
  descrições da AON traduzidas sob demanda.
- `/iniciativa` → `src/modules/initiative-tracker/` — gerenciador de iniciativa e combate.
- `/transformation` → `src/modules/transformation-statblock/` — gerador de stat block de battle forms.
- `/escalar-monstro` → `src/modules/monster-scaler/` — adapta a ficha de uma criatura da AON
  para outro nível, pelas tabelas de construção de criaturas do GM Core.

**`src/modules/character-sheet/` (Ficha em PDF) está DESATIVADO** — fora da rota, do menu e da home.
O código continua no repositório e `types.ts` (`parseCharacterJson`, `BuildInfo`) **segue sendo usado
pelos outros módulos**, então não apague a pasta. Para reativar, descomente os três pontos marcados
com `Desativado`: o import e a rota em `App.tsx`, o item em `layouts/MainLayout.tsx` e o card em
`pages/HomePage.tsx` (o import de `SheetIcon` está comentado junto em cada um). `/character-sheet`
hoje redireciona para a Início.

## Comandos

```bash
npm run dev        # Vite dev server (Vite escolhe a porta, ~5173)
npm run dev:api    # servidor de scraping/tradução da AON (server/index.mjs, porta 3001)
npm run dev:full   # ambos (concurrently)
npm run build      # tsc -b && vite build  ← rode antes de considerar algo pronto
npm run lint       # eslint
```

Sempre valide mudanças não triviais com `npm run build` (roda `tsc -b`) e `npm run lint`.

Scripts avulsos, rodados à mão (não entram no build):

```bash
node scripts/fetch-creature-tables.mjs  # regera as tabelas do GM Core (confira o diff!)
node scripts/check-scaling.mjs 200      # confere o motor de escala contra criaturas de verdade
```

Depois de mexer em `monster-scaler/scaling.ts` ou nas tabelas, rode o `check-scaling` — ele sai com
código diferente de zero quando alguma das quatro propriedades quebra.

## Backend

Dois modos servindo os mesmos endpoints de consulta à AON:
- `api/*.js` — funções serverless (deploy Vercel).
- `server/index.mjs` — mesmo backend para dev local.
- Núcleo compartilhado: `api/_lib/` — `aon.js` (busca no Elasticsearch da AON + tradução via Groq),
  `aon-parse.js` (escolha do hit remaster-aware e split do texto), `spells-core.js` (magias),
  `feat-core.js` (talentos, features de classe, heritages, ações, itens).
- Requer `GEMINI_API_KEY` e/ou `GROQ_API_KEY` no `.env` (tradução das descrições da AON).
- Endpoints: `feat`, `search`, `spell`, `companion`, `health`, `clear-cache`, mais as variantes
  plurais (`feats`, `searches`, `spells`, `companions`) para busca em lote. Cliente no frontend:
  `src/services/descriptions.ts` (com cache).
- `creature` é a exceção: **não passa pela cadeia de tradução**. A categoria `creature` do
  Elasticsearch já devolve PV, CA, percepção, salvamentos, resistências, fraquezas e imunidades
  **estruturados**, e traduzir 8 resultados a cada tecla estouraria o rate limit do tier gratuito.
  O vocabulário curto é traduzido no cliente (`transformation-statblock/i18n.ts`).
  Núcleo em `api/_lib/creature-core.js`, cliente em `src/services/creatures.ts`.
  Aceita `q` (nome), `minLevel`/`maxLevel` (faixa de nível, negativo incluído) ou os dois — exige
  pelo menos um, senão devolveria o bestiário inteiro — mais `limit` e `offset` (paginação).
  Devolve `{ results, total, nextOffset, hasMore }`.
- **Paginação de criaturas é por cursor, contado em acertos do índice** — não em criaturas
  devolvidas. Os dois números divergem porque a deduplicação de legacy/reimpressões come parte dos
  acertos, então `offset` avança pelo `nextOffset` que a página anterior devolveu (quantos hits ela
  consumiu), nunca por `página × tamanho`. Quem decide se acabou é o `hasMore`: o `total` é anterior
  à deduplicação e sozinho mentiria nos dois sentidos. A deduplicação é **por página**, então quem
  acumula páginas deduplica por nome ao concatenar (`appendUnique` no cliente).
- **`searchAonRaw` vs `searchAon`** (`api/_lib/aon.js`): o `searchAon` continua sendo busca por
  nome ordenada por relevância. O `searchAonRaw` existe porque a busca de criaturas precisa de três
  coisas que ele não faz — filtrar por faixa **sem termo nenhum** (aí a query vira `match_all` e a
  ordenação tem que ser explícita, senão a lista embaralha a cada busca), paginar (`from`) e
  devolver o **total**, para avisar quem está vendo 20 de ~329. Os dois compartilham o mesmo fetch e
  o mesmo cache.
- **Bastões (staves)** (`api/_lib/staff-parse.js`): o AON guarda a **família inteira** num
  documento só — pedir "Staff of Healing (Greater)" devolve base (item 4), Greater (8), Major (12) e
  True (16) no mesmo `markdown`. Sem parse próprio, a prosa vinha com os quatro degraus colados num
  parágrafo, preços e magias de rank 7 incluídos. O parse quebra por `<title level="2">` e monta a
  lista pela regra do bastão (GM Core p. 278): **o próprio degrau mais todos os inferiores**, nunca
  os superiores. Cada magia carrega o degrau de origem (`tierLevel`), e o payload sai em
  `entry.staff`. Bastão sem lista legível (a entrada do Staff of Providence, p.ex.) devolve `null` e
  segue pelo caminho genérico.
- **O qualificador entre parênteses às vezes É o nome no AON.** `cleanSearchName` existe para
  "Assurance (Athletics)", que não existe assim no AON — mas aplicá-lo sempre resolvia
  "Staff of Healing (Greater)" como o item **base**, com nível, preço e magias errados. Por isso
  `resolveEntry` tenta o **nome cru primeiro** e só cai na limpeza quando ele não casa exato.
- **`creature?name=`** é a ficha COMPLETA de uma criatura, para o módulo de escalar monstro
  (`api/_lib/monster-core.js` + `creature-parse.js`). Vive no MESMO arquivo que a busca porque o
  plano Hobby da Vercel permite **12 funções serverless por deploy** e `api/*.js` já tinha 12 —
  um `api/monster.js` separado virava a 13ª, o `vercel build` passava e o deploy falhava depois,
  na criação das funções, deixando produção parada no deploy anterior sem erro de build nenhum.
  **Ao acrescentar endpoint novo, confira a contagem antes.** Devolve os números **com o degrau de
  benchmark de cada um** (`ac_scale`, `strike_damage_scale`, …) e o stat block parseado do campo
  `markdown` — que já vem de graça, porque `searchAonRaw` não filtra `_source`. Como `creature`,
  **não passa pela cadeia de tradução**: a prosa das habilidades fica em inglês de propósito.
  - O degrau é o **mais próximo, não um valor exato**: o Bugbear Tormentor é "CA Alta" com CA 20,
    e a tabela diz 19 no nível 3. Quem consome precisa preservar essa diferença.
  - A AON **colapsa** `attack_bonus_scale`/`strike_damage_scale` nos degraus distintos usados
    (quase sempre um item), e **ordena** `attack_bonus`/`strike_damage_average` de forma crescente
    — nenhum dos dois casa por índice com a ordem dos golpes. Ver `formulaAverage` em `scaling.ts`.
  - Para criatura fora da faixa das tabelas (a Tarrasque é nível 25) a AON guarda a **string
    `"undefined"`** no lugar do degrau. `scale()` valida contra a lista de degraus conhecidos.
  - `pickHit` procura o **nome exato antes** de descartar entradas legacy, não depois: "Adult Red
    Dragon" só existe como entrada do Bestiary, e filtrar primeiro fazia a busca cair no melhor
    acerto remaster que sobrava — o Adult Sea Dragon.
- **`search?affliction=`** busca venenos e doenças com estágios (`api/_lib/affliction-core.js` +
  `affliction-parse.js`). ~230 aflições não-legacy; o índice já traz `stage`, `saving_throw`,
  `onset_raw` e `duration_raw` estruturados, então **não passa pela tradução**, como `creature`.
  - **Só a primeira ocorrência de uma condição vira link** no `stage_markdown` — o estágio 3 do
    Giant Centipede Venom traz "clumsy 1, and fatigued" cru. O casamento é por TEXTO contra o
    catálogo de `conditions.ts`; `flat-footed` é o nome pré-Remaster de `off-guard`.
  - Mora dentro de `api/search.js` por causa do limite de 12 funções (ver acima).
- `state` é o único endpoint com **estado**: guarda o jogo da mesa (ver a seção própria abaixo).
  Fica em `api/state.js`, **um nível** — o glob `"api/*.js"` do `vercel.json` não pega subpastas,
  então `api/state/[char].js` perderia o `maxDuration`.

### Tradução (o ponto que mais quebra)

- **Cadeia de provedores** em `TRANSLATION_CHAIN` (`api/_lib/aon.js`): Gemini
  `gemini-3.1-flash-lite` → Groq `gpt-oss-120b` → Groq `gpt-oss-20b`. Todos falam a API
  compatível com OpenAI, então trocar de provedor é trocar URL + chave (tabela `PROVIDERS`),
  não formato. Cada provedor tem sua própria fila e intervalo (`scheduleCall`) — o Gemini free
  é limitado por RPM (15), o Groq por TPM (8.000).
- **Provedores aposentam modelos sem aviso** — foi o que quebrou tudo uma vez. Se todos os itens
  da cadeia derem 404, a ficha volta inteira em inglês. Confira em
  https://ai.google.dev/gemini-api/docs/models e `GET https://api.groq.com/openai/v1/models`.
  400/404 (e chave ausente) pulam para o próximo item sem esperar; 429 respeita o `retry-after`.
- Chaves são lidas do env **por provedor**, dentro de `callChat`. O que circula pelas funções
  (`resolveFeat`, `resolveSpell`, …) é só o gate `translationEnabled` (`hasTranslationKey()`).
- Prompts que pedem **JSON** (companheiros animais) usam `runChainedPrompt(..., { clean: false })`
  — o `cleanTranslation`, feito para prosa, corromperia o JSON.
- **Nada de cachear inglês.** Quando a tradução falha, o payload volta com `translationPending: true`
  e ninguém cacheia (nem o cache em memória do backend, nem o `localStorage` do cliente) — a próxima
  consulta retraduz e o drawer troca o texto sozinho. Ao mexer no cache, bump da `CACHE_VERSION`
  em `src/services/descriptions.ts` (e `DESC_CACHE_VERSION` no módulo de PDF).
- Metadados em prosa (pré-requisitos, gatilho, requisitos…) são traduzidos junto com a descrição
  numa **única** chamada, via marcadores `<<N>>` (`translateSegments`). Uma chamada por item é o que
  mantém uma ficha inteira dentro do rate limit do tier gratuito.

## Estado compartilhado da mesa

PV, PV de companheiros, slots de magia, pontos de foco, pontos míticos e condições são **da mesa,
não do navegador**: os jogadores veem os mesmos números. A sincronia é **sob demanda** — puxa ao abrir a
ficha e no botão "Atualizar" do cabeçalho. Não há polling, SSE nem WebSocket, e não há login: quem
abrir o site entra na mesma mesa.

- **Backend**: `api/_lib/table-store.js` (núcleo, compartilhado com `server/index.mjs`) sobre
  **Upstash Redis** via REST — `@upstash/redis`, não `@vercel/kv`, porque o dev server é `node:http`
  puro e precisa do mesmo store. Aceita os dois pares de env (`KV_REST_API_*` da integração da
  Vercel e `UPSTASH_REDIS_REST_*` do console da Upstash). **Sem credenciais, cai num `Map` de
  processo** e o app segue funcionando; o indicador avisa "Só neste aparelho".
- **Um HASH por personagem, um campo por fatia** (`hp`, `slots`, `conditions`, `afflictions`,
  `persistent`, `mythic`, `pet:<kind>:<slug>#<i>`). Campo novo precisa entrar no `FIELD_RE` de
  `table-store.js`, senão o POST volta "Campo inválido" e o estado fica só no `localStorage`.
  Documento único faria dois jogadores editando ao mesmo tempo se sobrescreverem — quem marcasse
  condição apagaria o dano do outro. `HSET` por campo dá atomicidade por fatia sem transação, e a
  leitura continua sendo um `HGETALL` só. Dentro da **mesma** fatia a última escrita ainda vence.
- **Identidade em `charId.ts`**: o slug é só o **nome** normalizado (`Ghan Buri` → `ghan-buri`). O
  Pathbuilder não exporta id nenhum, e a chave antiga incluía o nível — qualquer level-up órfãva o
  estado. As chaves entregues aos hooks são `"<slug>/<campo>"`; o serviço corta no primeiro `/`.
  `legacyCharKey`/`legacyPetKey` existem só para **migrar** uma vez o que já estava no `localStorage`.
- **Cliente**: `src/services/tableState.ts` (dedupe de in-flight como em `descriptions.ts`, debounce
  de 600 ms na escrita) + `components/useSharedState.ts`, que os três hooks consomem. As **APIs
  públicas de `useHpTracker`/`useSpellSlots`/`useConditions` não mudaram** — a UI não sabe da rede.
  O `localStorage` virou cache: pinta antes da rede e segura a sessão offline.
- **`maxHp` não participa da carga.** Ele já foi dependência do efeito de releitura, e marcar Drenado
  (ou os stats do companheiro chegarem da AON) relia o storage. Hoje `null` significa "ninguém mexeu"
  e o clamp acontece no render. Não volte a colocar `maxHp` nas deps.
- **Ações destrutivas agora são coletivas**: "Novo dia" zera os slots da mesa inteira, por isso pede
  confirmação. O mesmo raciocínio vale para qualquer reset novo.
- Sendo público, o endpoint valida slug/campo por regex e limita a escrita a 8 KB.

## Tema (verde/pergaminho/ouro)

Identidade da linha **Remaster**: verde profundo, bege pergaminho e ouro/latão — não o
vermelho/carmesim do Pathfinder antigo. Estrutura: **moldura verde** (sidebar, AppBar, cabeçalhos de
seção com filete dourado) e **conteúdo em pergaminho** com tinta escura. Títulos em Cinzel, corpo em
Source Sans 3 (ambas num único `<link>` no `index.html`).

- `src/theme/palette.ts` — tokens (`green`, `parchment`, `gold`, `ink`, `rule`) e os mapas semânticos:
  tradições de magia, proficiência, moedas, PV, tipo de item, raridade. `src/theme/index.ts` monta o
  `createTheme` a partir deles. **Componente não declara hex próprio** — importa daqui.
- **Tudo em hex de 6 dígitos.** Nada de `oklch`/`color-mix`: o `html2canvas` (1.4.1) que exporta o
  stat block não entende funções de cor modernas. E vários componentes concatenam alpha na string
  (`accent + '22'`), o que só funciona com hex — token que seja caminho de tema (`'primary.light'`)
  produz `'primary.light22'`, CSS inválido que some sem erro. Já foi bug real nos chips de perícia.
- **Acento é cor de texto também.** Antes de escolher um tom, cheque contraste sobre
  `parchment.paper` (alvo ≥4,5:1). É por isso que `gold.main` (#A8842C, 3,1:1) só entra em filetes e
  bordas, e o texto dourado usa `gold.deep` (#7E611D).
- **Sem override global de `MuiDrawer`**: o drawer de navegação é moldura (verde, pintado no
  `MainLayout`) e o `DescriptionDrawer` é conteúdo (pergaminho padrão). Um override global quebra um
  dos dois.
- `StatBlockGenerator.tsx` mantém hex literais de propósito — é justamente o subtree que o
  `html2canvas` captura. Ao mexer nele, acompanhe a folha de impressão escrita à mão em
  `ExportOptions.tsx`, que replica classes do MUI e desanda em silêncio.
- Fora do tema: `character-sheet/pdf.ts` tem paleta própria monocromática para o jsPDF.

## Responsividade

A plataforma é usada na mesa, no celular. Toda mudança de layout precisa passar por 320px.

- **Breakpoints**: `xs` é celular, `sm` (600) é tablet, `md` (900) é onde a sidebar vira permanente.
  A ficha virtual usa acordeão só abaixo de `sm`; de `sm` para cima são abas roláveis (sem ícone
  até `md`, para caber mais rótulo na faixa).
- **Nada de `minWidth` fixo dentro de `flex-wrap`** — era o que estourava os formulários do gerador
  no celular. Use `display: grid` com `repeat(auto-fit, minmax(Npx, 1fr))`, que se dobra sozinho.
- **Irmãos em JSX não têm espaço entre si**: uma fileira de `<span>` nunca ganha ponto de quebra e
  vaza para fora do card (aconteceu com as perícias do companheiro). Liste em flex com `flexWrap`.
- **Alvo de toque**: o tema dá `minHeight: 40` a todo `Button` sob `@media (pointer: coarse)`. Os
  pips de slot e os +/−/× das condições crescem no `xs` por conta própria — são os alvos mais
  apertados da ficha.
- **Títulos já encolhem no tema** (`h1`–`h4`, via `fluidTitle`): não redefina `fontSize` de título
  em componente sem motivo. A escala usa media query e não `clamp()` porque o `html2canvas` da
  exportação não entende funções de tamanho modernas.
- `main` tem `minWidth: 0` e o `body` tem `overflow-x: clip` como rede de segurança. Se aparecer
  barra horizontal, o culpado é um filho largo — ache e conserte, não confie na trava.
- **Para conferir no navegador**: o Chrome/Brave headless do macOS não desce de 500px de viewport.
  Carregue a página num `<iframe>` da largura desejada (servido pelo próprio Vite, para o script da
  página hospedeira poder clicar dentro do app) e tire o print da página que hospeda o iframe.

## Convenções

- Um módulo por funcionalidade em `src/modules/`. Padrão: `*Page.tsx` (UI/estado), lógica em
  arquivos próprios, tipos em `types.ts`/`src/types/index.ts`.
- Tipos globais em `src/types/index.ts`. Tipos do formato Pathbuilder e `parseCharacterJson` em
  `src/modules/character-sheet/types.ts` (reutilizados por outros módulos).
- Helpers reutilizáveis do viewer: `src/modules/character-viewer/helpers.ts` (`abilityMod`, `totalHp`, …).
- Fichas de exemplo (formato Pathbuilder, campo `build`) em `public/characters/*.json`; presets em
  `src/modules/character-viewer/campaignPresets.ts`.

## Módulo character-viewer (Ficha Virtual)

- Visualizador interativo em `/ficha-virtual`. Reusa `parseCharacterJson`/`BuildInfo` do
  `character-sheet`. Layout: **abas no desktop, acordeões no mobile**; áreas em `sections/*`
  (Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory) — as vazias somem sozinhas.
- **Guia "Como Jogar"** (Visão Geral): `combatGuides.ts`. Cada guia casa **por nome** da ficha
  (`byName`) e é escrito à mão (`curated: true`); sem guia catalogado, `buildFallbackGuide()` gera
  um resumo heurístico (marcado como automático). Guias curados **sem IA** — ver memória.
- **Ao adicionar uma ficha nova**: (1) copiar o JSON para `public/characters/`; (2) registrar em
  `campaignPresets.ts`; (3) escrever um guia curado em `combatGuides.ts` casando pelo nome.
- **Ataques desarmados** (`unarmed.ts`): o JSON do Pathbuilder **não exporta desarmado nenhum** —
  nem o punho padrão. A tabela é escrita à mão a partir das regras (Howl of the Wild pg. 22 para os
  ataques animais) e os números são calculados aqui: ataque = nível + prof. desarmada + atributo
  (acuidade permite DES) + potência de handwraps; dano sempre com FOR; MAP −4/−8 se ágil. Onde a
  ficha não registra a escolha do jogador (Awakened Animal escolhe **um** ataque animal com o GM),
  listamos as opções típicas da herança marcadas como `choice`. Itens que dão ataque (ex.: Wolfjaw
  Armor) casam **pelo nome** em `ITEM_ATTACKS`. A aba de Combate nunca fica vazia: sem armas, ainda
  mostra desarmados, armadura e a CA.
- **Mítico** (`helpers.ts` + `useMythicPoints.ts` + `MythicPointsBar.tsx`): personagem mítico é o
  que tem algum talento do tipo Mythic Feat (`isMythicCharacter`). Duas partes:
  **(1) proficiência mítica** (nível + 10) ao lado do valor normal em salvaguardas, perícias e
  ataques — ela **substitui** a proficiência, então `mythicProficiencyDelta` desconta o que já está
  embutido no número (`level + rank`, ou zero se destreinado, que no Remaster não soma o nível) em
  vez de somar +10 por cima. A categoria da arma vem de `weapon.prof` e vira rank por
  `weaponProficiencyRank`; categoria desconhecida devolve `null` e a linha **não** mostra ✦ —
  melhor sem número do que com número errado. **(2) pool de 3 Pontos Míticos**
  (`MYTHIC_POINTS_MAX`), compartilhado com a mesa no campo `mythic`, com a mesma mecânica de pips
  dos slots. A barra fica **fora das abas**, ao lado das condições, porque o ponto é gasto de
  qualquer aba. A legenda do ✦ é uma só (`MythicNote`), usada nas três seções.
- **Armas que mudam de número conforme a situação** (`magicWeapons.ts`): o Pathbuilder exporta um
  conjunto de números só por arma, o do caso padrão — a Gloom Blade do Eldarion no escuro vira um
  `+2 striking shortsword` e isso não aparecia em lugar nenhum. O catálogo casa **pelo nome** da
  arma (como `ITEM_ATTACKS` em `unarmed.ts`) e declara perfis situacionais; a aba de Combate
  calcula cada linha a partir dos números da própria ficha (a runa striking do perfil substitui a
  da ficha em `weaponDamageFormula`), então level-up e runas novas continuam certos sozinhos.
- **O Inventário lista armas e armaduras junto do equipamento** (`inventoryRows`). Elas são
  inventário como qualquer item, mas o Pathbuilder as manda em listas próprias (`weapons`/`armor`),
  então sumiam da aba. A lista é derivada no render — o JSON da ficha **não** é editado à mão, que
  seria perdido no próximo export.
- **Bastão abre com a lista de magias do degrau** (`StaffSpellList.tsx`): as magias vêm agrupadas
  por rank, com o custo em cargas ao lado (conjurar gasta cargas iguais ao rank; truque é de graça —
  GM Core p. 278) e etiqueta de degrau nas herdadas do bastão inferior. Quem filtra o degrau é o
  backend (ver "Bastões" no Backend) — o componente só desenha. Tocar numa magia troca o conteúdo do
  drawer pelo dela, via o `onNavigate` que a página liga ao próprio `setDrawerReq`; o rank vai como
  nível de conjuração, então a magia aparece já elevada. Truque vai **sem** nível: o bastão o eleva
  ao rank dos truques de quem conjura, e o drawer não sabe o nível do personagem.
- **Nome de magia fica em inglês** na lista do bastão, como no resto do módulo: é a chave de busca
  na AON. Já preço e rótulo de rank são vocabulário mecânico e são traduzidos no render
  (`formatPrice`, "470 gp" → "470 po").
- **Slots de magia** (`useSpellSlots.ts` + `SlotPips.tsx`): estado do dia compartilhado com a mesa
  (ver "Estado compartilhado"), na mesma chave por personagem do PV (`slotsKeyFor`). Guarda **contagem** de gastos, nunca índice de slot —
  assim sobrevive a um re-upload em que a ordem da lista mudou. Preparado/inato: cada cópia
  preparada é um slot, os pips ficam na linha da magia. Espontâneo: os slots são do nível
  (`perDay`), os pips ficam no cabeçalho e a linha ganha botão de gastar. Truques (nível 0) são à
  vontade e **nunca** têm slot, inclusive os inatos. Foco é um contador único (`build.focusPoints`).
  "Novo dia" zera tudo.
- **Condições** (`conditions.ts` + `components/useConditions.ts` + `ConditionsBar.tsx`): catálogo do
  Remaster escrito à mão (o Pathbuilder não exporta condição nenhuma), com o efeito mecânico de cada
  uma declarado em `effects` sobre alvos atômicos (`ac`, `reflex`, `attackStr`, `skillDex`…) e
  atalhos de grupo (`all`, `dexBased`, `strBased`, `mental`). O cálculo respeita as duas regras que
  mais confundem: **penalidade do mesmo tipo não empilha** (vale a pior; status e circunstância
  somam entre si) e **"testes e CDs" inclui a CA** — por isso Amedrontado baixa a CA e Fatigado, que
  fala só de CA e salvaguardas, não toca em perícias. Condições impostas (Inconsciente → Cego,
  Desprevenido, Caído) são derivadas em cascata, nunca guardadas: o `localStorage` só tem o que o
  jogador marcou. A barra fica **fora das abas** (a condição afeta a ficha inteira) e o estado é
  compartilhado com a mesa, na mesma chave por personagem do PV (`conditionsKeyFor`).
- **O que a condição não consegue ajustar sozinha** vira aviso, nunca número errado: o Pathbuilder
  não registra se uma arma é de Força ou de Destreza, então no total da arma entra só o que penaliza
  os dois casos (`sharedMod`) e o resto aparece como "FOR −2 · DES −1 a mais". Desarmados sabem o
  atributo (`usesDex`), então ali o ajuste é exato. Efeitos que não são modificador (ações perdidas
  por Lento, teste plano do Estupefato) ficam em `note` e saem no painel de detalhes.
- **Aflições** (`useAfflictions.ts` + `AfflictionsBar.tsx`) e **dano persistente**
  (`usePersistentDamage.ts` + `PersistentDamageBar.tsx`): a ficha é a ponta de LEITURA do que o GM
  aplicou no combate — mesmas fatias da mesa (`<slug>/afflictions`, `<slug>/persistent`). O dano cai
  no gerenciador de Iniciativa; aqui só se vê e se remove. As condições do estágio entram em
  `useConditions` pelo parâmetro `derived`: contam nos modificadores (o veneno baixa os números de
  verdade) mas nunca no estado gravado.
- Descrições da AON são buscadas **sob demanda** ao tocar num item (`DescriptionDrawer` →
  `services/descriptions.ts`); a última ficha fica em `sessionStorage`.

## Módulo initiative-tracker (Iniciativa)

Gerenciador de turnos e combate em `/iniciativa`. A decisão que explica o módulo inteiro é **onde
cada fatia de estado mora**:

| Fatia | Onde vive |
| --- | --- |
| Combatentes, rodada, turno, durações, defesas | `useReducer` + `localStorage` (`pf2e:initiative:v1`) |
| PV e condições de **personagem** | estado da mesa (Redis), **as mesmas chaves da Ficha Virtual** |
| PV e condições de **monstro** | dentro do encontro (reducer) |
| Aflições e dano persistente de **personagem** | estado da mesa (`afflictions`, `persistent`) |
| Aflições e dano persistente de **monstro** | dentro do encontro (reducer) |

- **O encontro é do GM, o personagem é da mesa.** Dois GMs veem encontros diferentes, mas o dano que
  qualquer um aplicar num personagem aparece na Ficha Virtual de quem estiver jogando, e vice-versa.
  O dano em PC usa os campos `hp`/`conditions` que a Ficha Virtual já tinha, e **monstro nenhum
  encosta no Redis** — as fatias de monstro vivem inteiras no reducer. De `table-store.js` o módulo
  só precisou de dois campos novos no `FIELD_RE`, `afflictions` e `persistent`.
- **`useEncounterParty` levanta o estado compartilhado para a página**, em vez de chamar
  `useHpTracker`/`useConditions` num componente por combatente (como faz `PetsSection`). O diálogo
  de dano em área precisa **ler** PV, PV temporário e resistência de todos os alvos para montar a
  prévia antes de aplicar; com o estado preso em hooks de filhos isso viraria um registro imperativo
  de refs, vazio no primeiro paint. Por baixo são as mesmas primitivas de `services/tableState.ts`.
- **A API do party expõe `snapshot`** justamente porque todo o resto lê de um `ref` (para duas
  escritas no mesmo handler não se perderem). Sem esse campo o objeto teria identidade constante,
  `useCombatantViews` nunca reprocessaria e o cartão abriria com PV cheio até a primeira interação.
  Já foi bug.
- **Durações decrementam no handler de `nextTurn`, nunca num efeito.** Um efeito que lê estado e
  escreve na mesa reagiria ao próprio `subscribeSnapshot` e amplificaria escrita a cada releitura.
  O mesmo handler também limpa duração órfã — de condição que o jogador tirou pela Ficha Virtual.
- **A ordem de turnos é o próprio array `combatants`**, reordenado só em eventos explícitos (entrar
  no encontro, mudar iniciativa, botão "Reordenar"). Derivar no render apagaria o desempate manual
  das setas ↑↓ a cada repintura. Desempate RAW: em empate entre PC e adversário, **o adversário age
  primeiro** (`kindRank`); `Array.sort` é estável, então o ajuste manual sobrevive.
- **O turno ativo é `activeId`, nunca índice** — índice muda de dono quando alguém entra, sai ou adia.
- **Adiar segue o RAW**: ao voltar, a iniciativa passa a ser **permanentemente** a da nova posição.
  Sem isso o próximo "Reordenar" teleporta o combatente de volta para o topo.
- **Dano** (`damage.ts` + `defenses.ts`) na ordem do Player Core: multiplicador da salvaguarda
  (falha crítica ×2, falha ×1, sucesso ÷2, sucesso crítico ×0) → imunidade → fraqueza → resistência
  → PV temporários. Resistência e fraqueza **não somam entre si**: vale a maior aplicável, e os
  guarda-chuvas (`all`, `physical`, `energy`) contam. O que não vira número
  ("physical 5 except cold iron") vira `defenseNotes` e sai como chip de aviso — nunca número.
- **Queda a 0 PV é sugestão, nunca automatismo**: Morrendo `1 + Ferido` para personagem (RAW),
  Derrotado para monstro. A detecção mora no `applyDamage` da view, então vale tanto para o −/+ do
  cartão quanto para o diálogo em lote.
- O catálogo de condições, o cálculo de modificadores e o `ConditionsDialog` vêm inteiros do
  `character-viewer` — inclusive a cascata de condições impostas (Inconsciente → Cego, Desprevenido,
  Caído). Nada disso foi reescrito.
- **A lista é uma coluna só, e o cartão é uma faixa.** A ordem de turnos *é* a lista: em várias
  colunas o olho perde quem age depois de quem, e rolar deixa de ser o gesto de ver os próximos
  turnos. A partir do `sm` o cartão vira faixa (identidade à esquerda, PV numa coluna de 240px à
  direita) para a coluna única não desperdiçar a largura nem alongar a rolagem.
- **Dano e cura são botões escritos, sempre habilitados.** Desabilitados até haver número, a lista
  inteira ficava acinzentada e parecia travada; sem número, o clique manda o foco para o campo.
  Cada um leva `aria-label` com o nome do combatente — numa lista longa, "Dano, Dano, Dano" não
  diz de quem. Pelo mesmo motivo o bloco de ↑↓⋮ é renderizado **uma vez** (via `useMediaQuery`, não
  com dois `display: none`): dois botões de mesmo rótulo no DOM atrapalham teclado e leitor de tela.
- **Condição, aflição e dano persistente são três botões escritos** (`CombatantActions.tsx`), pela
  mesma razão do "Dano"/"Cura": condição era um ⚡ mudo e os outros dois só existiam dentro do menu
  `⋮`, então envenenar um alvo exigia adivinhar onde a opção estava. O `⋮` ficou só com o que
  governa a **presença** do combatente no encontro (adiar, derrotado, duplicar, remover) — dois
  caminhos para a mesma ação convidam a procurar no lugar errado.
  - Cada botão é também o **resumo** da sua fatia (leva a contagem do que está ativo) e vira **âmbar
    sólido** quando aquela fatia espera resposta do GM: salvaguarda de estágio vencida
    (`roundsLeft === 0`) ou teste plano pendente (`checkDue`). Sem isso, um veneno vencido só
    aparecia para quem rolasse até a caixa dele.
  - A contagem de condições sai de `mods.active`, **não** do estado cru — é a mesma lista que os
    chips logo abaixo desenham, já com as impostas e as do estágio de aflição. Duas contas para a
    mesma lista sairiam de sincronia.
  - Largura **pelo conteúdo** (`flex: '0 0 auto'`), como os chips de condição: com `flex-grow`, o
    botão que quebra para a segunda linha virava uma barra larga sozinha.
- **A ficha completa do monstro abre DENTRO do cartão** (`CombatantSheet.tsx`, botão "Ficha" em
  `CombatantActions`): o GM já escolheu a criatura na AON, e abrir outra aba no meio do turno para
  reler um Golpe é a ida e volta que o módulo existe para evitar. **Nada foi reescrito** — a ficha
  vem de `services/monster.ts` (`fetchMonster`, o cliente do escalar monstro) e é desenhada pelo
  `MonsterStatBlock` dele, como o `ConditionsDialog` veio inteiro do character-viewer.
  - **Buscada ao abrir, nunca guardada no encontro.** A ficha completa é grande e o encontro mora no
    `localStorage`; gravá-la lá seria uma segunda cópia capaz de divergir da AON — a mesma razão
    pela qual `pcFromBuild` não guarda o `BuildInfo` inteiro. O componente só monta enquanto aberto,
    e reabrir bate no cache em memória.
  - **`aonName` é um campo à parte porque o `name` do combatente DIVERGE dele**: a cópia numerada
    vira "Goblin Warrior 2" e o escalar monstro marca "Bugbear Tormentor (N8)". Encontro salvo antes
    do campo é resgatado por `aonNameOf`, que desfaz os dois sufixos nessa ordem (eles se acumulam)
    e exige `aonUrl` — combatente digitado à mão não tem ficha e não ganha o botão.
  - **O alvo da escala é `npc.level`, não o nível da AON.** Um monstro comum tem os dois iguais e
    `scaleMonster` devolve a ficha original (a identidade que o `check-scaling` verifica); um vindo
    do escalar monstro reproduz os números do próprio cartão. Um campo resolve os dois casos.
  - **`scaleOverrides` viaja junto** (`npcFromScaled`) por um motivo medido: sem os ajustes finos,
    reabrir um Bugbear Tormentor escalado para o nível 8 desenhava **CA 28 enquanto o cartão dizia
    20**. Ficha que contradiz o cartão é pior que ficha nenhuma.
  - O bloco mostra os números **publicados**, e o cartão mostra os números **com as condições**.
    Não "conserte" isso aplicando os modificadores no bloco: teriam de valer também para
    salvaguardas, perícias e ataques, e é o mesmo componente que o escalar monstro exporta em PNG.
    O aviso só aparece quando há condição ativa, senão seria ruído.
- **Busca de criatura aceita nome, faixa de nível, ou os dois** (`AonCreatureSearch`). Buscar só
  por faixa é como se monta encontro, então a lista precisa de ordenação estável (nível, depois
  nome) e de **chegar até o fim**: 20 por página e "Carregar mais" até `hasMore` virar falso — uma
  faixa de um nível só já passa de 100 criaturas, e antes a lista parava na primeira dúzia. O
  `total` do aviso é anterior à deduplicação de legacy/reimpressões, então é aproximado de
  propósito; ver "Paginação de criaturas" no Backend para o cursor.
- **Aflições** (`afflictions.ts` + `components/AfflictionDialog.tsx` + `CombatantAfflictions.tsx`):
  veneno e doença com estágios, buscados na AON. O motor é puro e aplica o RAW sobre o GRAU que o
  GM informa — o app não rola dados. Crítico ✓ −2, ✓ −1, ✗ +1, crítico ✗ +2; **Virulento** troca a
  recuperação (crítico melhora 1 em vez de 2, e sucesso simples exige dois seguidos).
  - **As condições do estágio são DERIVADAS, nunca gravadas** — mesma política das condições
    impostas. Tirar a aflição tira as condições dela junto, sem precisar lembrar o que foi
    aplicado, e em conflito vale o pior valor. Por isso elas aparecem com borda tracejada e sem
    botões, nos dois módulos: não há o que remover.
  - Na view, `stored` (o que alguém marcou) e `conditions` (o que vale) passam a ser coisas
    diferentes. **Os setters mexem em `stored`** — senão desmarcar um Enfraquecido vindo do veneno
    gravaria a remoção de algo que nunca foi gravado.
  - **Só 35% dos estágios são em rodadas**; o resto é minuto, hora ou dia. Os em rodadas descem no
    handler de `nextTurn` (nunca num efeito, mesma razão das durações) e pedem a salvaguarda ao
    vencer; os outros ganham um botão de avançar à mão. Fingir que cabem no relógio do combate
    seria pior do que dizer que não cabem.
  - **O dano do estágio cai ao ENTRAR no estágio, nos dois sentidos.** RAW, os efeitos de um estágio
    valem quando a criatura entra nele — e um sucesso na salvaguarda também é entrar num estágio, o
    anterior. Por isso a condição em `enterStage` é a mudança de número, não "piorou"; estágio que
    não mudou (o sucesso simples de uma aflição virulenta) não causa dano nenhum.
  - **A fórmula de dano é lida da prosa no CLIENTE** (`dice.ts`), e não em `affliction-parse.js`
    como o resto do parse: o texto do estágio já está gravado no estado da mesa, então parsear aqui
    faz o dano valer para os venenos aplicados antes, sem migração de campo. Só vira dano o que tem
    um TIPO ao lado ou a palavra `damage` — senão "clumsy 1" entraria na conta. Das 565 prosas de
    estágio reais do índice, 262 têm dano legível; as demais realmente não falam de dano.
  - **A duração máxima encerra a aflição sozinha** (`maxRoundsLeft`), quando cabe no combate. Aqui
    o minuto entra (10 rodadas exatas), ao contrário da duração de ESTÁGIO: das 174 aflições reais,
    59 usam "6 rounds" e 20 "6 minutes". Hora e dia continuam de fora, e o GM encerra à mão.
  - A do **personagem vive na mesa** (campo `afflictions`) e aparece na Ficha Virtual; a do
    **monstro vive no encontro**.
- **Dano persistente** (`persistentDamage.ts` + `components/CombatantPersistent.tsx` +
  `PersistentDamageDialog.tsx`): RAW (Player Core), cai ao **final de cada turno** do alvo, com os
  dados rolados de novo, e só então vem o **teste plano de CD 15** para acabar — CD 10 com ajuda
  apropriada. Pode ser removido a qualquer momento, que é como cura e fim de combate o encerram.
  - **O alvo é quem está SAINDO do turno, não quem entra.** `applyPersistent(state.activeId)` roda
    antes do `dispatch` de `nextTurn` em `passTurn`; o tique de durações e de aflição continua sendo
    do PRÓXIMO. Confundir os dois faz o dano cair uma posição adiantada na ordem.
  - **`checkDue` só liga depois de o dano cair**: sem dano não há teste plano, e o cartão não deve
    oferecer um botão que ainda não vale.
  - **Estágio de aflição que impõe dano persistente cria a entrada sozinho** (`syncFromAffliction`),
    com `fromAffliction` apontando para a aflição. A entrada é REGERADA a cada troca de estágio e
    sai junto quando a aflição sai — nunca acumula uma cópia por tique. O que já existia com a mesma
    fórmula e tipo é preservado, para o `checkDue` e a CD baixada não se perderem.
  - Mesma divisão das aflições: a do **personagem vive na mesa** (campo `persistent`, visível na
    Ficha Virtual por `PersistentDamageBar`); a do **monstro vive no encontro**.
- **O que o app rola e o que não rola** (`dice.ts` é o único ponto que rola): rolagem de quem está
  jogando continua na mesa — a iniciativa é digitada, e salvaguarda, salvaguarda de estágio e teste
  plano de dano persistente são informados pelo GM em botões. O app rola os dois danos que o RAW
  manda cair sem ninguém pedir: o do **estágio de uma aflição** e o **persistente do fim do turno**.
  Pedir esses dois ao GM seria um clique por turno por combatente afligido, que é o trabalho que o
  módulo existe para tirar da mesa. Em troca, **toda aplicação automática traz o memorial da rolagem
  e um "Desfazer"** (`AutoDamage` em `useCombatantViews.ts`, com aviso próprio no topo — o dano
  automático e a queda a 0 PV caem no mesmo handler e disputando um Snackbar só um seria lido).

## Módulo transformation-statblock (contexto que se perde fácil)

- **Todas as battle forms do Remaster** estão em `data/` (1 arquivo por magia, agregadas em
  `data/spells.ts`). Ao adicionar uma magia: criar `data/<x>.ts` (exporta `<x>Spell` + `<x>Forms`),
  registrar em `spells.ts` (imports, re-export, `transformationSpells`) e adicionar a progressão de
  stats em `components/StatBlockGenerator.tsx` (`spellProgression[<id>]`).
- **Dados reais do personagem** vêm do JSON Pathbuilder via `data/from-pathbuilder.ts`. As
  proficiências no Pathbuilder são o bônus `2×rank` (0/2/4/6/8); o modificador só soma o nível quando
  proficiente (rank>0) — ver `profMod`.
- **Regras (RAW)**: AC = base da magia + nível; ataque/atletismo = `max(magia, personagem)`;
  saves/percepção/PV são os reais do personagem (não mudam). Battle forms não alteram atributos nem
  dão ataque/DC de magia. Ooze Form tem CA baixa de propósito (`7 + nível`).
- **Tradução (pt-BR)**: `i18n.ts` traduz o vocabulário mecânico **no render** — por isso os campos
  mecânicos em `data/` (tamanho, tipos de dano nas strings de ataque, traits, sentidos, imunidades,
  nomes de magia/forma/ataque) ficam **canônicos em inglês**. Já **nomes e descrições de habilidades**
  são armazenados **em pt-BR** nos `data/`. Ao adicionar formas/habilidades novas, siga esse split.
- O bloco exibido (`StatBlockGenerator`) é o mesmo que a exportação captura via `html2canvas`;
  `form.description` e `spell.description/heightened` não são exibidos.

## Módulo monster-scaler (Escalar Monstro)

Pega a ficha de uma criatura na AON e adapta para outro nível, pelas dez tabelas de construção de
criaturas do GM Core (pg. 112-121, níveis -1 a 24).

- **As tabelas são geradas, não digitadas**: `scripts/fetch-creature-tables.mjs` transcreve do
  índice da AON (categoria `rules`, fonte `GM Core`, que publica as tabelas como `<table>` HTML)
  para `data/creatureTables.ts`. São 1.400 números; digitados à mão erram em silêncio. Rode à mão e
  **confira o diff** — é o passo em que um erro de parse vira monstro errado na mesa. Armadilhas:
  travessão (não hífen) no nível negativo e nas faixas, traço longo para "não existe", PV e perícia
  Baixa em faixa, dano como `"4d12+42 (68)"`.
- **A regra que explica o motor** (`scaling.ts`): preserva-se a **diferença** em relação ao
  benchmark, nunca o benchmark cru. Criaturas publicadas são feitas à mão e não batem com a tabela;
  trocar o número pelo da tabela apagaria a personalidade do monstro e faria reescalar para o
  **próprio nível** devolver uma ficha diferente da original.
- **A origem usa o degrau da AON, o destino usa o degrau escolhido.** Usar o escolhido dos dois
  lados faz o ajuste fino **não fazer nada**: as colunas sobem quase em paralelo e a diferença se
  cancela. Foi bug real, e o painel parecia funcionar.
- **PV usa razão, não diferença** (cresce quase geometricamente: 9 no nível -1, ~500 no 24).
  **Dano** pega os dados da tabela do nível-alvo e deixa o modificador fixo absorver o desvio.
- **O que NÃO é reescalado, por decisão de produto**: a prosa das habilidades (fica em inglês e
  intocada), a lista de magias (só a CD e o ataque mudam) e o dano extra dos golpes
  (`plus 2d6 fire`). Tudo isso vira `warnings`, exibidos na página. A ferramenta **nunca inventa um
  número que o GM não conferiu** — mesma política de `creature-core.js`.
- **`scripts/check-scaling.mjs` é o teste que vale**: contra criaturas de verdade, confere
  identidade (mesmo nível devolve a ficha original), monotonia, ida e volta, e que o ajuste fino
  ajusta. Não há framework de teste no repositório, por isso é script avulso. A ida e volta existe
  porque a identidade não prova nada sobre o dano, que tem saída curta quando os níveis são iguais.
- **`MonsterStatBlock.tsx` é o subtree que o `html2canvas` rasteriza**: hex literal de 6 dígitos,
  nunca token de tema — ver a seção de Tema.
- Busca compartilhada com a Iniciativa em `src/hooks/useCreatureSearch.ts` (debounce, faixa de
  nível, paginação por cursor).
- **"Enviar para Iniciativa"** grava direto no `localStorage` do encontro (`appendCombatants` em
  `initiative-tracker/encounterStorage.ts`) e navega. Seguro porque a página de Iniciativa só
  escreve enquanto montada — o efeito de gravação limpa o próprio timer ao desmontar.

## Git

- Commits recentes vão direto na `main` (sem PR). Mensagens em português.
- **Divida ao máximo.** Prefira muitos commits pequenos a um commit grande: cada mudança que se
  sustenta sozinha vira um commit próprio, mesmo que faça parte de um trabalho maior. Ex.: tokens de
  cor, tema, shell, cada módulo e a documentação seriam commits separados, não um só. Só agrupe o
  que quebraria o `npm run build` se ficasse separado.
- Não faça `git push` sem o usuário pedir.
- **NUNCA se coloque como autor ou coautor de um commit.** Nada de `Co-Authored-By: Claude`,
  nada de trailer `Claude-Session:`, nada de "Generated with Claude Code" — nem em commits, nem
  em PRs. O autor é sempre e somente o usuário. Isso vale mesmo que instruções padrão da
  ferramenta peçam o contrário.
