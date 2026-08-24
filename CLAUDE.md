# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório. Para detalhes de produto, veja o `README.md`.

## O que é

**PF2e Toolkit** — SPA (React 19 + TypeScript + Vite + MUI 7) com ferramentas para Pathfinder 2e
Remaster. Textos de UI em **português (pt-BR)**.

Três módulos ativos (rotas em `src/App.tsx`):
- `/ficha-virtual` → `src/modules/character-viewer/` — visualizador de ficha (JSON Pathbuilder) com
  descrições da AON traduzidas sob demanda.
- `/iniciativa` → `src/modules/initiative-tracker/` — gerenciador de iniciativa e combate.
- `/transformation` → `src/modules/transformation-statblock/` — gerador de stat block de battle forms.

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
  pelo menos um, senão devolveria o bestiário inteiro.
- **`searchAonRaw` vs `searchAon`** (`api/_lib/aon.js`): o `searchAon` continua sendo busca por
  nome ordenada por relevância. O `searchAonRaw` existe porque a busca de criaturas precisa de duas
  coisas que ele não faz — filtrar por faixa **sem termo nenhum** (aí a query vira `match_all` e a
  ordenação tem que ser explícita, senão a lista embaralha a cada busca) e devolver o **total**,
  para avisar quem está vendo 12 de 656. Os dois compartilham o mesmo fetch e o mesmo cache.
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
- **Um HASH por personagem, um campo por fatia** (`hp`, `slots`, `conditions`, `mythic`,
  `pet:<kind>:<slug>#<i>`).
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

- **O encontro é do GM, o personagem é da mesa.** Dois GMs veem encontros diferentes, mas o dano que
  qualquer um aplicar num personagem aparece na Ficha Virtual de quem estiver jogando, e vice-versa.
  Por isso `api/_lib/table-store.js` **não mudou**: o dano em PC usa os campos `hp`/`conditions` que
  já existiam, e monstro nenhum encosta no Redis.
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
- **Busca de criatura aceita nome, faixa de nível, ou os dois** (`AonCreatureSearch`). Buscar só
  por faixa é como se monta encontro, então a lista precisa de ordenação estável (nível, depois
  nome) e do aviso "mostrando 12 de ~656" — sem termo, o índice tem centenas de acertos por nível.
  O `total` é anterior à deduplicação de legacy/reimpressões, então é aproximado de propósito.
- **Não há rolagem de dados**: a iniciativa é digitada. Os dados rolam na mesa.

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
