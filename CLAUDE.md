# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório. Para detalhes de produto, veja o `README.md`.

## O que é

**Covil de Dados** (antes "PF2e Toolkit"; o repositório e o pacote seguem `pf2e-tools`) — SPA (React 19 + TypeScript + Vite + MUI 7) com ferramentas para Pathfinder 2e
Remaster. Textos de UI em **português (pt-BR)**.

Seis módulos ativos (rotas em `src/App.tsx`):
- `/ficha-virtual` → `src/modules/character-viewer/` — visualizador de ficha (JSON Pathbuilder) com
  descrições da AON traduzidas sob demanda.
- `/iniciativa` → `src/modules/initiative-tracker/` — gerenciador de iniciativa e combate.
- `/transformation` → `src/modules/transformation-statblock/` — gerador de stat block de battle forms.
- `/escalar-monstro` → `src/modules/monster-scaler/` — adapta a ficha de uma criatura da AON
  para outro nível, pelas tabelas de construção de criaturas do GM Core.
- `/mapa/:id?` → `src/modules/battle-map/` — mapa de combate (VTT): grid de 5 ft, imagem, tokens
  com barra de PV e régua.
- `/historico` → `src/modules/session-diary/` — Histórico de Rolagens: as rolagens de cada dia de jogo, com
  estatísticas por personagem e destaques (`/diario`, o nome antigo, redireciona).

**Todo módulo é `React.lazy`** (`App.tsx`); só a Início e o `MainLayout` vão no bundle principal.
Num bundle único (1,7 MB, 520 kB gzip), quem abria a Ficha Virtual no celular baixava o
html2canvas e o jsPDF das exportações, a Iniciativa e o Escalar Monstro. Hoje o caminho da ficha é
~880 kB (285 kB gzip). Import estático de um módulo pesado dentro da ficha desfaz isso: confira a
lista de chunks do `npm run build`.

**A Ficha em PDF foi REMOVIDA** (módulo `character-sheet`, com o `pdf.ts` e a página). Os tipos do Pathbuilder e
o `parseCharacterJson`/`normalizeBuild` (`BuildInfo`) moraram nela e hoje vivem em `src/pathbuilder/` — usados por
todos os módulos. O `jspdf` continua nas dependências: é o `ExportOptions` do gerador de Transformação que o usa.
`/character-sheet` ainda redireciona para a Início, para quem tiver o link salvo.

## Marca

Nome **Covil de Dados**, kit em `brand/covil-de-dados/` (`LEIA-ME.md` tem cores, fontes e qual arquivo usar). No app:
logo horizontal no cabeçalho da sidebar e na Início, símbolo no AppBar do celular (`src/assets/`); ícones, manifest e
`og-image` em `public/`. **Não recolora nem estica os SVGs** (texto já em curvas) e, sobre foto ou textura, use as
versões `-1cor-`. Abaixo de 48 px, o símbolo é o `covil-simbolo-reduzido`. A `og:image` usa o domínio de produção por
URL absoluta (`index.html`) — troque junto se o domínio mudar. O aviso "Ferramenta de fã, não oficial" fica no rodapé
da sidebar e da Início. Nome de pacote, rotas, chaves de storage e tabelas continuam com o nome antigo, de propósito.

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
node scripts/check-heightening.mjs      # confere o heightening das magias contra o índice inteiro
node scripts/check-rolls.mjs            # confere a matemática das rolagens contra as fichas do grupo
node scripts/check-economy.mjs          # confere que todo talento/item do elenco que custa ação, reação ou Ponto Mítico tem caminho
node --env-file=.env scripts/check-migrations.mjs
                                        # roda as migrations pendentes em produção dentro de BEGIN…ROLLBACK (antes do push!)
node --env-file=.env scripts/build-description-bundle.mjs [--published <url>] [--all]
                                        # regera public/descriptions/ (descrições pré-traduzidas) — ver abaixo
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
- **O AON parou de mandar o `---` no campo `text`** (out/2026): o texto passou a vir corrido, com o
  cabeçalho ("Spell 3 Fireball Two Actions … Deities …") colado na prosa e o "Heightened (+1)" no
  fim. Toda magia chegava sem entradas de heightening — o dano nunca era recalculado — e os
  talentos caíam no strip heurístico. `parseAonText(text, markdown)` usa o `markdown` (que ainda
  tem o separador) quando o `text` não tem estrutura. Se descrição voltar com cabeçalho colado,
  suspeite da marcação do AON antes do parse.
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
- **`search?spells=1`** lista magias por tradição e rank (`api/_lib/spell-list-core.js`), para
  escolher as magias de um monstro no escalar monstro. Como `creature` e `affliction`, **não passa
  pela tradução**: o índice já traz `tradition`, `level` (que na categoria `spell` é o RANK) e
  `spell_type` estruturados. O `maxRank` é TETO, não igualdade — magia de rank menor cabe em slot
  maior, que é como se prepara uma magia elevada. Mora dentro de `api/search.js` pelo limite de 12
  funções (ver acima), e a paginação/deduplicação é a mesma de `resolveCreatures`.
- **`search?rule=`** devolve a regra de um termo — condição, habilidade de criatura, traço, magia —
  **em inglês, sem passar pela tradução** (`api/_lib/rule-core.js`). É o que alimenta as caixinhas
  do stat block de monstro. Categorias, na ordem de busca: `creature-ability`, `condition`, `trait`,
  `spell`, `action`, `rules`; quem chama diz a categoria, porque "Attack of Opportunity" existe como
  talento, como feature de classe E como habilidade de criatura, e numa ficha de monstro vale a
  última. Do markdown ficam só os rótulos mecânicos (Requirements, Effect, Range, Saving Throw…) —
  sem isso a caixa de uma magia começaria pelas onze divindades que a concedem.
- **`search?items=a|b|c`** devolve os traços dos itens do inventário — `consumable` e, nos de cura,
  a fórmula (`healing: "3d6+6"`) — **sem tradução** (`api/_lib/item-traits-core.js`). Uma busca só
  por `name.keyword` (o nome vem exato do Pathbuilder), preferindo a entrada remaster. A cura é lida
  de "restores XdY+Z Hit Points" do `summary`, e **só** em item com o traço `Healing`; cura fixa ou
  cura acelerada (Soothing Tonic) fica `null` e o item é consumido sem cura. Mora em `api/search.js`
  pelo limite de 12 funções.
- **`search?shields=a|b`** devolve bônus na CA, Dureza, PV e BT dos escudos — que o Pathbuilder
  **não exporta** — **sem tradução** (`api/_lib/shield-core.js`). Escudo base vem estruturado da
  categoria `shield` (`hp_raw "24 (12)"` traz o BT); escudo específico (Clockwork Shield) está na
  `equipment` com os números só na prosa, e o bônus é o do `base_item`. A leitura da prosa mora em
  `shield-parse.js`, compartilhada com a busca de criatura, que devolve `shield` quando o texto do
  monstro traz "shield (Hardness 5, HP 20, BT 10)" — só com "shield" logo antes, senão a dureza
  do PRÓPRIO constructo viraria escudo. ~53% dos monstros com Shield Block têm os números; o resto
  o GM define à mão. Mora em `api/search.js` pelo limite de 12 funções.
- **`search?gear=a|b`** devolve os **traços das armas** (`trait_raw`: "Deadly d10", "Fatal 1d10",
  "Thrown 10 ft." e `weapon_type` Melee/Ranged) e a **penalidade das armaduras** (`check_penalty`,
  `strength`), que o Pathbuilder não exporta, **sem tradução** (`api/_lib/gear-core.js`). Item
  específico (Gloom Blade, Hero's Plate) segue o `base_item`. É o que as rolagens da ficha usam
  para o MAP de ágil, o atributo do ataque e o crítico. Mora em `api/search.js` pelo limite de 12
  funções.
- `state` também responde `GET ?incoming=<slug>`: o que os colegas passaram àquele personagem (`readIncoming`, uma
  consulta nas linhas `gave` da mesa). Ver "Passar item entre jogadores" no módulo character-viewer.
- `state` é o único endpoint com **estado**: guarda o jogo da mesa (ver a seção própria abaixo). `GET ?char=&field=`
  devolve UMA fatia (`readField`, 1 HGET) — hoje só o poll das ações do turno o usa.
  Fica em `api/state.js`, **um nível** — o glob `"api/*.js"` do `vercel.json` não pega subpastas,
  então `api/state/[char].js` perderia o `maxDuration`.
- **O mesmo `state` serve as fichas publicadas** (`api/_lib/sheet-handler.js`, compartilhado com o
  dev server): `GET ?sheets=1` (lista), `GET ?sheet=<slug>`, `GET ?sheetVersions=<slug>` (o histórico), e `POST`
  com `action` — `publish`, `guide` e `restore` (com `version` opcional: volta a qualquer versão do histórico). POST
  sem `action` continua sendo a escrita de fatia do estado. Mora aqui pelo limite de 12 funções.
  - **Autoria**: o cliente manda o JWT da sessão anônima (`authHeaders` em `services/supabase.ts`) e o servidor o
    confere localmente (`requestUserId`) e grava em `published_by`. Só registra — sem sessão, publica igual.
  - O slug da ficha publicada sai do `build.name` do PRÓPRIO JSON, nunca do cliente: é a mesma
    identidade do estado da mesa, e deixar o cliente escolher permitiria publicar por cima de outro.
  - **`guide` gera o "Como Jogar" pela cadeia de IA** (`api/_lib/guide-core.js`, 5–30 s), numa
    chamada separada da publicação para caber no `maxDuration` e o app mostrar o progresso. A base
    do prompt é o guia da versão anterior, senão o curado que o cliente manda — a IA ATUALIZA em
    vez de começar do zero, e as seções do guia anterior entram no prompt explicitamente (só
    "siga as seções dele" o modelo ignorava). Sem guia de base, o modelo inventava efeito de
    talento; o prompt proíbe descrever mecânica sem certeza, mas o guia gerado sai marcado "gerado
    por IA" com aviso para conferir.
  - O guia só é gravado se a ficha ainda for a que o gerou (`publishedAt`): duas publicações
    seguidas não terminam com o guia da primeira na segunda. `tidy` tira itálico e lista `*`/`1.`,
    que o `GuideMarkdown` não entende e mostrava crus.
- **O mesmo `state` serve o feed de rolagens** (`api/_lib/roll-handler.js` + `roll-store.js`):
  `GET ?rolls=1&rev=N` e `POST { action: 'roll-add', roll }`. No Postgres (tabelas `rolls` e `shares`, migration
  `feed_de_rolagens`): **toda rolagem fica** (é o Histórico de Rolagens), com `author` = a sessão de quem
  rolou; o GET devolve as últimas 30 numa consulta (`read_feed`), e só o `rev` quando nada mudou. As duas tabelas
  tiram o `seq` da MESMA sequência, e o `rev` é o maior `seq` da mesa: com sequências separadas, um compartilhamento
  abaixo da última rolagem não mudaria o máximo. `isRollRequest` vem **antes** de `isSheetRequest` nos dois
  servidores, pelo mesmo motivo do mapa. O `at` é do servidor.
  - **A validação existe duas vezes**: `sanitizeTableRoll` em `src/dice/tableRoll.ts` e
    `sanitizeRoll` em `roll-store.js` (o servidor é JS puro e não importa o TS). Mudou uma, muda a
    outra — o `check-rolls` confere as duas com os mesmos casos. A soma tem de fechar (`d20 + mod =
    total`, dados + fixo = total da parcela): número que não confere não vai à mesa.
- **O mesmo `state` serve o Mapa de Combate** (`api/_lib/map-handler.js` + `map-store.js`):
  `GET ?maps=1`, `?map=<id>`, `?mapRev=<id>` (o poll de reserva), `POST` com `action: 'map-*'` e
  `image-delete` (`blob-delete`, o nome antigo, aceito igual). Mora aqui pelo limite de 12
  funções. **`isMapRequest` vem ANTES de `isSheetRequest`** nos dois servidores: a rota da ficha
  aceita qualquer POST com `action` e engoliria as do mapa.
  - Imagens (mapa e tokens) vão **direto do navegador para o Supabase Storage** (bucket público `images`, migration
    `imagens`), com a sessão anônima: a política de insert só aceita as pastas `tokens/`, `maps/` e `monsters/`, nome
    `[a-z0-9-]` com extensão de imagem, de quem está em `mesa_members`, e só arquivo NOVO — sem política de update nem
    de delete, ninguém sobrescreve nem apaga a imagem de outro. O bucket barra mais de 8 MB e tipo que não seja
    WebP/PNG/JPEG. Passar pela função esbarraria no limite de 4,5 MB do corpo. Nome com sufixo aleatório e
    `cacheControl` de um ano: a URL nunca muda de conteúdo. **Apagar é do servidor** (`api/_lib/images.js`, chave
    secreta), e `imagePath` só aceita URL NOSSA — o endpoint é público. Sem Supabase, a imagem fica no IndexedDB de
    quem enviou (URL `idb:<chave>`) e os outros veem as iniciais.
  - **As imagens vieram do Vercel Blob no MESMO caminho** (`migrate-redis --domain images`, que copiou as 16 que o
    banco citava e reescreveu as URLs). URL antiga do Blob que ainda apareça — no `localStorage` de um encontro da
    Iniciativa, por exemplo — é traduzida na hora de desenhar (`displayUrl`, dentro do `useImageUrl`), e o servidor a
    apaga do Storage do mesmo jeito. Toda imagem do app passa pelo `useImageUrl`: `<img>` novo também tem de passar.

- **O mesmo `state` serve as correções de tradução** (`api/_lib/fix-handler.js` + `fix-store.js`): `GET ?fixes=1` e
  `POST { action: 'fix-save', kind, name, fields }`, globais (a mesa do pedido não muda nada). Antes de `isSheetRequest`.
  Ver "Correção de tradução pela mesa" em Tradução.
- **O mesmo `state` serve os encontros da Iniciativa** (`api/_lib/encounter-handler.js` + `encounter-store.js`):
  `GET ?encounter=<mapId|none>` e `POST { action: 'encounter-save', map, state }` (`map` null = "Sem mapa"). Vem
  antes de `isSheetRequest` nos dois servidores, pelo mesmo motivo do mapa. Ver "O encontro vai para a nuvem" na
  seção da Iniciativa.

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
- **Cache de traduções compartilhado** (`translateSegments` → `readTranslations`/`writeTranslations`
  em `aon.js`): a tradução de cada trecho fica no Postgres (tabela `translations`, chave = o sha1, SEM prazo de
  validade — no Redis eram 180 dias), global para todas as mesas, e só a primeira pessoa espera pelo LLM. Antes, o cache em memória morria com a função serverless e o
  `localStorage` era de um aparelho só: cada jogador, em cada aparelho, retraduzia as mesmas magias
  e gastava a cota da mesa. Medido no núcleo: 6 magias, 18,7 s com o cache vazio → 3 ms com ele quente
  (em produção ainda soma a busca no AON, ~1 s).
  - A chave é o hash do **texto em inglês** (com o preâmbulo do prompt e a versão), não o nome: o AON
    mudar a prosa ou alguém mexer no prompt muda a chave sozinho. Parse, heightening e números
    continuam refeitos a cada pedido — só o LLM é poupado.
  - Só grava o que passou na validação (nada de inglês); falha vira null e `translationPending`, como
    antes. Banco fora do ar é só um miss. Custo: 1 SELECT por chamada; o UPSERT só quando o LLM rodou, e ele
    **nunca sobrescreve** (`ignoreDuplicates`) — uma correção à mão (`source = 'human'`) não pode ser trocada pelo LLM.
    A tabela guarda o inglês (`en`) junto, menos no que veio do Redis, que só tinha o português.
  - Mudou `cleanTranslation` ou o formato da saída? Suba a `TRANSLATION_CACHE_VERSION` — o
    `clear-cache` limpa só a memória, não o banco (é de todas as mesas).
- **Descrições pré-traduzidas** — magias, talentos, habilidades e itens de cada personagem, prontos
  antes de alguém tocar. O elenco é pequeno e o que cada ficha descreve muda pouco, então tudo é
  resolvido e traduzido UMA vez; ao abrir a ficha o pacote entra no cache em memória
  (`seedEntries` em `descriptions.ts`) — o mesmo que as abas, o drawer e o Spellstrike leem —, e
  todo toque é instantâneo, sem "Carregar todas". O que nenhum pacote tem segue pela API, como sempre.
  Dois caminhos, mesmo formato (`{ version, entries: { spell, feat, special, item } }`):
  - **Estático** (`public/descriptions/<slug>.json`, CDN), gerado por
    `scripts/build-description-bundle.mjs` para os presets do repositório (`loadDescriptionBundle`).
  - **Da ficha PUBLICADA** (`api/_lib/sheet-descriptions.js`, no Postgres), que o servidor mantém sozinho — o level-up chega pela publicação, e depender de
    alguém rodar o script não funciona na mesa. As descrições são **globais** (`descriptions`, por versão, tipo e
    nome: a Heal do Thalos serve ao Ghan Buri e à outra mesa), e cada ficha guarda só a LISTA de nomes que descreve
    (`sheet_description_sets`). `GET ?sheetDescriptions=<slug>` monta o pacote no banco numa chamada (função
    `sheet_descriptions`, no formato que o Redis guardava); `POST { action: 'sheet-descriptions', char, names, version }` resolve SÓ o que falta.
    **Comportamento padrão: o pacote fica pronto NA PUBLICAÇÃO, antes de qualquer jogador abrir.** O
    "Publicar" (e o "Restaurar") dispara `loadSheetDescriptions` na hora (`CharacterViewerPage`), e a
    faixa da ficha publicada mostra "Preparando as descrições…" → "Descrições prontas"
    (`useSheetDescriptionsStatus`). A mesma função roda ao abrir a ficha da mesa
    (`CharacterSheetView`), como rede de segurança: se quem publicou fechou a aba no meio, o próximo a
    abrir completa. Os demais aparelhos fazem um GET só.
  - **A primeira montagem parte do pacote ESTÁTICO do personagem**, que o `vercel.json` empacota junto
    das funções (`includeFiles: public/descriptions/**`; se faltar no disco, busca no domínio de
    produção por `VERCEL_PROJECT_PRODUCTION_URL`). Num level-up quase tudo já está lá: medido em dev,
    publicar o Thalos nível 11 com uma magia nova deixou as 74 descrições prontas em **10 s** (antes,
    do zero, 101 s em 3 rodadas); o jogador abriu a ficha com zero chamadas à API. Personagem novo,
    sem pacote estático, monta do zero em algumas rodadas (~30 s cada).
  - **A lista é uma só** (`characterDescriptionNames` em `descriptionNames.ts`), com as MESMAS funções
    das abas (`characterSpellNames`, `parseFeatEntry`, `inventoryRows` de `inventory.ts`); o script a
    importa via `ts-loader`, e o servidor a recebe do cliente — reescrevê-la em JS seria cópia.
  - Payload IDÊNTICO ao da API (`resolveSpells`, `resolveFeats`, `resolveSpecials`). Talentos,
    habilidades e itens passaram a ser traduzidos **em grupo** como as magias (`resolveEntries` em
    `feat-core.js`, 6 por chamada): uma chamada por item servia ao drawer, mas montar ~100 descrições
    por ficha seriam cem chamadas a 4,2 s de distância no Gemini free.
  - Os dois levam a `CACHE_VERSION` do cliente: subiu a versão, o app ignora os pacotes até o script
    rodar de novo (sem `--all` ele percebe e refaz tudo), e o da ficha publicada recomeça do zero.
    **Mudou o payload (parse, `scaling`, heightening, bastão)? Suba a versão E regere os estáticos.**
  - **Incrementais**: o que já está no pacote fica, para o diff mostrar só o novo (retraduzir tudo
    trocaria palavras ao acaso a cada rodada) e para o nível 11 traduzir só o que é novo. O da ficha
    publicada é também **acumulativo** (o "Restaurar" continua coberto), com teto de 300 por tipo.
  - **Nunca gravam inglês**: `translationPending` fica de fora (o script sai com código 1; o servidor
    tenta de novo na próxima abertura).
  - No servidor: **trava** (`try_lock`, tabela `locks`, 70 s) para dois aparelhos não traduzirem a mesma ficha juntos (o
    segundo recebe `busy` e segue pela API); **cabe no `maxDuration`** (não começa grupo depois de
    30 s, devolve `remaining`, o cliente chama de novo — até 12 rodadas, parando se uma não avançou);
    nome que a AON não resolve vai para `description_misses` (global) e só é tentado de novo em 24 h (falha de tradução, 429,
    NÃO é miss). Só para slug publicado; endpoint público como o resto.
- **Correção de tradução pela mesa** (`services/translationFixes.ts` + `components/TranslationFix.tsx` →
  `api/_lib/fix-store.js`, tabela `description_fixes`, migration `correcoes_de_traducao`): "Corrigir tradução" no pé da
  descrição. **É uma CAMADA por cima, por (tipo, nome), aplicada na LEITURA** — `readCache` e o retorno das buscas em
  `descriptions.ts` passam por `applyFix`, e o `DescriptionContent` reaplica a cada correção nova. Corrigir a tabela
  `translations` não bastaria: a descrição também chega pelo pacote estático (arquivo do repositório), pelo da ficha
  publicada e pelo cache de cada aparelho. A camada vale para tudo o que lê o texto, inclusive `activities.ts` (que procura
  "Ponto Mítico"/"Mythic Point" nas duas línguas).
  - Global, como as traduções; lista inteira no `localStorage` (`pf2e:fixes:v1`, primeira pintura já corrigida), relida
    uma vez por sessão (na primeira leitura de descrição) e a cada reconexão, e o aviso de outro aparelho chega pelo canal
    `fixes` de CADA mesa (o trigger manda para todas). Medido: 0,2–0,7 s do "Salvar" à tela do outro.
  - **A releitura troca a lista local pela do servidor**: o que sumiu dele (linha apagada à mão no banco, que não gera
    aviso) sai do aparelho também — antes ficaria para sempre no `localStorage` de quem estava aberto. Só sobrevive o que
    chegou com o pedido em andamento (`arrivedDuringRefresh`, sem comparar relógios de aparelho e servidor).
  - Campos: só prosa — `description` e, em talento/habilidade/item, pré-requisitos, gatilho, requisitos, frequência,
    custo, acesso (`FIX_FIELDS`, igual no servidor). Grava só o que difere da tradução automática. Número, traço e o
    `defense` da magia (que a rolagem lê) ficam de fora; na magia o diálogo avisa para manter os dados, que é por onde a
    prosa é elevada.
  - Sem login, qualquer um corrige: `previous` guarda o estado de antes da última mudança ("Desfazer última correção";
    na primeira correção, desfazer é voltar à automática) e `fields: {}` é "Voltar à tradução automática".
  - **`applyFix` lembra o original de cada objeto corrigido** (`originals`): o drawer guarda o objeto já corrigido no
    estado, e uma correção desfeita tem de devolver o texto da tradução, não o corrigido.
  - **Os campos do editor NÃO são controlados** (`defaultValue` + ref, lidos ao salvar): com o valor no estado, digitar
    rápido fazia o textarea do MUI repintar e remedir em laço até "Maximum update depth exceeded" — pego pelo teste com
    navegador, que digita tudo de uma vez.
- Metadados em prosa (pré-requisitos, gatilho, requisitos…) são traduzidos junto com a descrição
  numa **única** chamada, via marcadores `<<N>>` (`translateSegments`). Uma chamada por item é o que
  mantém uma ficha inteira dentro do rate limit do tier gratuito.
- **"Carregar todas" (magias) traduz o GRUPO numa chamada só** (`resolveSpells` em `api/_lib/spells-core.js`, usado por
  `api/spells.js` e pelo dev server): busca no AON em paralelo, junta a prosa e as entradas de heightening que o dicionário
  não resolve num único `translateSegments`, e só então monta cada payload. O gargalo era o espaço de 4,2 s entre
  chamadas do Gemini com 1–2 chamadas por magia (~10 s cada; 6 magias = 60 s); agora 6 magias levam ~3 s. O grupo é
  de 6 no servidor e no cliente (`PREFETCH_CHUNK_SIZE`): cabe no TPM do Groq (fallback) e no `maxDuration`. Falha de
  tradução continua marcando `translationPending` (nada de cachear inglês) e o cliente refaz em até 3 passadas.
  `resolveSpell` (uma só) usa o mesmo caminho.

## Supabase

Toda a persistência é o Supabase: **Postgres** (estado da mesa, fichas publicadas com histórico, descrições e
traduções e as correções delas, feed de rolagens, mapas, encontros da Iniciativa), **Realtime** (o tempo real do estado, do feed e do mapa) e **Storage** (imagens).
Até out/2026 eram o Upstash Redis e o Vercel Blob, com polling; a troca foi domínio a domínio, sem mudar o contrato
das rotas (cada store do servidor manteve as funções exportadas). O Redis e o Blob saíram do código. Projeto
`htgrzvdzxepbbgbaqkir`, em **São Paulo** (`sa-east-1`) porque a mesa é toda brasileira, e as funções da Vercel também
(`"regions": ["gru1"]` no `vercel.json`): do clique à tela do outro aparelho, ~0,1 s.

- **Cada store tem um fallback em memória** (Maps de processo), como na época do Redis: sem as credenciais o app
  funciona, só que nada sai do aparelho. Em dev, **o `.env` tem as chaves do projeto de PRODUÇÃO** — o `dev:api` lê e
  grava no banco real (não há projeto de dev: a organização já usa os 2 projetos do plano gratuito). Teste na mesa
  `arton-1515` com slugs `teste-*` e apague no fim.

- **Só o servidor escreve** (`api/_lib/supabase.js`, chave `SUPABASE_SECRET_KEY`, que passa por cima do RLS). O
  navegador (`src/services/supabase.ts`, chave publicável) abre uma **sessão anônima** por aparelho
  (`signInAnonymously`, sem tela de login) e se registra em `mesa_members` — a única escrita do cliente, limitada pelo
  RLS à própria sessão. O SDK é `import()` com o app ocioso, num chunk próprio (~60 kB gzip): não o importe
  estaticamente.
- **Permissões são explícitas**: o projeto foi criado SEM "expose new tables" e COM RLS automático (`ensure_rls`), então
  tabela nova não dá privilégio a ninguém — nem ao `service_role`. Toda migration faz os `grant` do que usa.
- **Migrations**: crie com `npx supabase migration new <nome>`. Não há Docker no projeto (decisão do usuário) nem branch
  de preview no plano gratuito, então antes do commit rode `node --env-file=.env scripts/check-migrations.mjs`, que
  executa as PENDENTES no banco de produção dentro de `BEGIN … ROLLBACK`. A integração com o GitHub devia aplicá-las no
  push da `main`, mas **no primeiro push não aplicou** (ficou pendente por minutos): depois do push, confira com
  `npx supabase migration list` e, se seguir pendente, `npx supabase db push` (com o `.env` carregado). **Nunca edite
  uma migration já aplicada** — crie outra.
- **Pausa por inatividade**: o plano gratuito pausa o projeto depois de 7 dias parado, e a mesa joga 1–2 vezes por mês.
  O cron do `vercel.json` chama `/api/health` todo dia, e o `health` faz uma consulta (`pingDatabase`).
- **Backup**: `.github/workflows/backup-supabase.yml`, semanal, artefato de 90 dias. O repositório é PÚBLICO e artefato
  de repositório público é baixável por qualquer pessoa logada, então o dump sai **criptografado** (segredos
  `SUPABASE_DB_URL` e `BACKUP_PASSPHRASE`); sem a senha o workflow falha em vez de publicar aberto.
- **Conexão direta ao banco**: o host `db.<ref>.supabase.co` só tem IPv6; fora daqui (GitHub Actions) use o pooler em modo
  sessão, `aws-1-sa-east-1.pooler.supabase.com:5432` (o `aws-0` recusa). A CLI dá a chave secreta MASCARADA sem
  `--reveal`.
- `pg_cron` limpa os usuários anônimos sem atividade há 180 dias, as travas vencidas, os misses velhos, os
  compartilhamentos de mais de um dia e o estado de personagem parado há 180 dias.
- **Tempo real é sempre do banco**: um trigger chama `realtime.send` no canal PRIVADO `mesa:<mesa>:<nome>` (`state`,
  `rolls`, `map:<id>`, `maps`, `encounters`, `fixes`, `sheets`), e só quem está em `mesa_members` ouve (RLS em `realtime.messages`). Nenhum cliente
  transmite — a única exceção é a presença (abaixo). No cliente, `listenMesaChannel` (`services/supabase.ts`) é o único jeito de ouvir; a cada SUBSCRIBED
  (inclusive reconexão) quem ouve relê o que pode ter perdido. O Realtime põe um `id` próprio no payload quando ele
  não tem um — não use `id` como campo da mensagem.
- **Presença** (`services/presence.ts` + `components/PresenceList.tsx`, migration `presenca`): quem está com o app aberto
  na mesa, na sidebar ("Na mesa agora"), com o nome do aparelho, a ficha aberta e a página. Usa o Presence do Realtime no
  canal `mesa:<mesa>:presence`, e é o ÚNICO lugar onde o cliente manda algo pelo Realtime: a política de insert em
  `realtime.messages` libera só a extensão `presence`, e só nesse tópico. Transmitir (`broadcast`) pelo cliente continua
  recusado — conferido: o `send` volta `error` e ninguém recebe.
  - Sem login, a pessoa é o APARELHO (sessão anônima, `presence.key`); duas abas são uma linha (vale a visível mais
    recente). O nome é opcional, do aparelho (`pf2e:device-name`, global, editado no próprio item da lista); sem ele,
    vale o personagem da ficha aberta. A ficha se anuncia por `announceSheet` (`CharacterSheetView`, página e painel do
    mapa); a página, pelo `MainLayout`.
  - Medido: a troca de página chega ao outro em 1,5–3 s, e quem fecha a aba some em 0,2–3 s. É presença, não estado —
    nada disso vai ao banco.
  - **A lista é `React.lazy`** (`PresenceSlot` no `MainLayout`), baixada só quando há alguém: ela mostra o token da ficha
    pelo `TokenBadge`, que traz o estado da mesa junto, e o chunk principal crescia 12 kB gzip.
  - No mapa, token de PC com a ficha aberta em OUTRO aparelho ganha o ponto verde (`online` no `Token`, um booleano —
    o `memo` continua comparando primitivos).
- **O `jsonb` reordena as chaves dos objetos**: comparar valor do banco com `JSON.stringify` acusa mudança onde não
  há. No servidor use `sameJson` (`api/_lib/json.js`).
- O script que copiou o Redis e o Blob para cá (`scripts/migrate-redis.mjs`) cumpriu o papel e saiu; está no
  histórico do git, se um dia for preciso.

## Mesas

Duas (ou mais) mesas de jogo no mesmo site, cada uma vendo só o que é dela: fichas publicadas, presets, estado dos
personagens, mapas e mapa ativo, encontro da Iniciativa, feed de rolagens e regras compartilhadas.

- **No banco é a coluna `mesa`** de cada tabela (chave estrangeira para `mesas`), e os canais do Realtime são
  `mesa:<mesa>:…`. **A mesa legada (a Casa do Gordo Online, `casa-do-gordo`, a de antes das mesas) é a padrão**: o
  pedido dela vai sem `?mesa=`, e aparelho que nunca escolheu mesa continua nela.
- **No `localStorage` é um namespace de chave** (`mesaKey` em `src/services/mesa.ts`): `pf2e:<resto>` vira
  `pf2e:m:<mesa>:<resto>`, e a legada fica SEM prefixo, com as chaves de sempre. Não "normalize" a legada para ter
  prefixo — o cache de todo aparelho da mesa se perderia.
- **A lista de mesas existe três vezes** (`MESA_IDS` em `mesas.js`, `MESAS` em `mesa.ts` e a tabela `mesas`, que as
  chaves estrangeiras exigem) — mudou uma, muda as outras, e mesa nova é também uma migration (`insert into
  public.mesas`). O servidor recusa id desconhecido (400), para um link digitado errado não criar uma mesa fantasma.
- **A mesa vai na query, também no POST** (`?mesa=`), e `api/state.js`/`server/index.mjs` a resolvem UMA vez e a
  repassam: todo store recebe `mesa` como **primeiro parâmetro explícito** (`readCharacter(mesa, slug)`,
  `listMaps(mesa, gm)`…), de propósito no lugar de `AsyncLocalStorage` — uma chamada esquecida aparece no grep. O
  fallback em memória (sem banco) também é por mesa.
- **Trocar de mesa recarrega a página** (`switchMesa`). Por isso `currentMesa` é uma constante lida no boot
  (`main.tsx` importa `services/mesa` antes de tudo) e `CAMPAIGN_PRESETS = PRESETS_BY_MESA[currentMesa.id]`: os caches
  em memória dos serviços (`tableState`, o store do mapa, os ids vistos do feed) e os consumidores dos presets não
  precisam saber de mesa. O `?mesa=<id>` do link vira a escolha do aparelho (`localStorage` `pf2e:mesa`, global) e sai da
  URL; o seletor fica na sidebar (`MesaSwitcher`), com "Copiar link da mesa".
- **Fica global de propósito**: cache de traduções e descrições resolvidas (tabelas `translations` e `descriptions`),
  caches da AON no cliente, pacotes estáticos
  `public/descriptions/<slug>.json` (são do personagem) e as pastas do bucket de imagens (nomes aleatórios). No `localStorage`, só o
  que é da mesa ganhou `mesaKey` (cache do estado, encontro da Iniciativa, ficha aberta, personagem do painel do mapa);
  preferência de interface (Modo GM, ferramenta, extras de rolagem) é do aparelho.
- A migração do `localStorage` antigo (`legacy` do `useSharedState`) só roda na mesa legada: em outra, levaria o PV de
  lá para um personagem de mesmo nome.
- Mesas hoje: **Casa do Gordo Online** (`casa-do-gordo`, legada, os 6 personagens) e **Arton 1515** (`arton-1515`,
  4 jogadores; o primeiro preset é o **Loki**, os outros JSONs vêm depois). Mesa nova = uma entrada nas duas listas + a migration com a
  linha em `mesas` + `PRESETS_BY_MESA[<id>]` (pode começar vazia).

## Estado compartilhado da mesa

PV, PV de companheiros, slots de magia, pontos de foco, pontos míticos e condições são **da mesa,
não do navegador**: os jogadores veem os mesmos números. A sincronia é **em tempo real**: lê ao abrir a ficha e,
depois, cada escrita chega sozinha pelo Realtime do Supabase (o indicador diz "Ao vivo" e o "Atualizar" some). Sem
Supabase, ou com o canal fechado, volta a ser **sob demanda** — ao abrir e no botão "Atualizar". Não há login: quem
abrir o site entra na mesma mesa (a do aparelho — ver "Mesas").

- **Backend**: `api/_lib/table-store.js` (núcleo, compartilhado com `server/index.mjs`) sobre o **Postgres do
  Supabase**, tabela `character_state`. **Sem credenciais, cai num `Map` de processo** e o app segue funcionando; o
  indicador avisa "Só neste aparelho".
- **Tempo real** (`startRealtime`/`applyRemote` em `services/tableState.ts`): um trigger do banco transmite cada
  escrita no canal PRIVADO `mesa:<mesa>:state`, já com `{ slug, field, data, updatedAt, by }`. Só quem está em
  `mesa_members` ouve (RLS em `realtime.messages`); ninguém transmite por ele além do banco. Quem recebe aplica como um
  snapshot PARCIAL (`{ [campo]: data }`), que `useSharedState` e `useEncounterParty` já sabem ler. Três travas, todas
  necessárias: **nunca atropela escrita local na fila** (`pending`), **ignora o eco da própria escrita** (`by` = a
  sessão deste aparelho, que o servidor grava em `updated_by`) e **descarta o que for mais velho** que o `updatedAt`
  conhecido (`lastSeen`, alimentado pela leitura e pela resposta do POST). A cada SUBSCRIBED (inclusive a primeira) e
  ao voltar de mais de 10 s com a aba oculta, os personagens abertos são relidos — transmissão perdida não volta
  sozinha. A releitura também sobrepõe o que está na fila, para não desfazer na tela uma edição ainda não gravada.
- **Uma LINHA por fatia** (`hp`, `slots`, `conditions`, `afflictions`,
  `persistent`, `mythic`, `consumed`, `shield`, `token`, `size`, `rage`, `psyche`, `energy`, `magus`, `ranger`, `rogue`,
  `actions`, `uses`, `companions`, `gave`, `pet:<kind>:<slug>#<i>`). Campo novo precisa entrar no `FIELD_RE` de
  `table-store.js`, senão o POST volta "Campo inválido" e o estado fica só no `localStorage`.
  A mesma lista está no CHECK da tabela (migration `estado_da_mesa`) — mudou um, muda o outro, e campo novo é
  migration nova. Documento único faria dois jogadores editando ao mesmo tempo se sobrescreverem — quem marcasse
  condição apagaria o dano do outro. O upsert por linha dá atomicidade por fatia sem transação, e a leitura continua
  sendo uma consulta só. Dentro da **mesma** fatia a última escrita ainda vence.
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
- **Duas instâncias da mesma fatia se enxergam** (`subscribeField` em `tableState.ts`): `saveField`
  avisa os outros hooks do mesmo `slug/campo` neste aparelho. Sem isso, a cura de uma poção no
  Inventário não aparecia no `HpTracker` da Visão Geral — no celular os acordeões ficavam montados
  juntos, cada um com seu `useHpTracker`. Hoje montam só o aberto, mas os dois coexistem durante a
  animação de troca, e o canal continua.
- **Chave sem ficha** (`noCharKey` em `charId.ts`): os hooks que a página monta antes de haver
  ficha usam slug vazio, que nenhum nome gera, e `useSharedState` não vai à rede com ele.
- Sendo público, o endpoint valida slug/campo por regex e limita a escrita a 8 KB.
- **O mapa recebe o PV dos PCs pelo mesmo canal** (`onStateChange`, que avisa toda fatia mudada, daqui ou de fora —
  antes da comparação com o cache local, porque o mapa pode estar com um valor mais velho). No poll de reserva dele,
  o "contador da mesa" é a escrita mais recente no estado (`table_rev`, no banco).
- **A ficha publicada NÃO mora no estado da mesa** (`api/_lib/sheet-store.js`, tabelas `sheets` e
  `sheet_versions` no Supabase): o estado é lido inteiro a cada abertura e a cada "Atualizar", e arrastar 8 KB de
  ficha e 7 KB de guia toda vez seria desperdício. Sem prazo de validade — uma ficha publicada é a fonte da verdade do
  personagem —, teto de 64 KB, e o **histórico** (até 30 versões por ficha, cada uma com o guia dela) é a salvaguarda
  de não haver login. Publicar e restaurar são funções do banco (`publish_sheet`, `restore_sheet`) com a linha
  travada; restaurar tira a versão do histórico e põe a atual no lugar, então restaurar de novo desfaz. O cliente
  mostra só a versão anterior (`previous`), de propósito: a linha do tempo completa foi descartada (decisão do usuário).

## Ações do turno

Faixa **Ações** (`actions.ts` + `components/useActions.ts` + `ActionsBar.tsx`), fora das abas, em TODA ficha:
3 pips, a ação extra do Acelerado e a reação. Estado da mesa, campo `actions`
(`{ used, quickUsed, reacted, turn }`). O app **só conta**: gastar além do que há é permitido (uma ação livre mal
classificada não pode travar a ficha) e avisa — Alert no diálogo e, ao zerar, "Sem ações neste turno".

- **Orçamento** (`actionBudget`): 3 − o MAIOR entre Lento e Atordoado (os dois não somam; o atordoado consome
  primeiro). **Acelerado/Haste** dá +1 ação que só paga **Golpe ou Andar** de 1 ação (`ActionKind =
  'move-attack'`) e é a PRIMEIRA a ser gasta; atividade de 2+ ações e Interagir/Sacar nunca a usam.
- **Desconto automático**: Golpe = 1 (2 com Hunter's Aim ou Spellstrike; o chip "É uma reação" gasta a reação, não
  ação), magia = o `actions` da AON (`actionCost`; reação, ação livre e "1 a 3" NÃO gastam sozinhas), ativar
  Fúria/Gravity Weapon/Hunt Prey/Arcane Cascade/recarregar Spellstrike/Summon Mythic Power/aplicar veneno = 1.
  Teste de perícia só gasta quando o jogador marca a ação no diálogo (ver "Atividades, reações e Pontos Míticos"); Andar, Interagir,
  Sacar e o resto: botões da faixa. Erguer o escudo gasta 1 ação (o Reactive Shield ergue por REAÇÃO).
- **Início do turno vem da Iniciativa** (`party.startTurn`, no handler de `passTurn` e no "Iniciar", nunca num efeito):
  grava `newTurn()` no campo `actions` do PC que entra. Botão "Novo turno" na ficha para quem não usa a Iniciativa.
- **O mestre zera do aparelho dele e o jogador vê na hora**, pelo Realtime como o resto do estado. O poll antigo
  ficou só como plano B, quando o canal não está aberto (`isLive()`): `GET /api/state?char=&field=actions`
  (`readField`) a cada 5 s, só com a aba visível e só pela faixa (as outras instâncias do hook não ligam o `poll`). **`pullField` nunca atropela escrita
  local na fila** (seria um valor mais velho). Ordem de grandeza: 6 jogadores × 4 h ≈ 17 mil comandos.
- **Reações do Shield Block** (`blockReactionSource`/`spendBlockReaction`): o **Quick Shield Block** (Fighter 8) dá, no
  início de cada turno, uma reação ADICIONAL que só serve para Shield Block — campo `shieldReacted`, pip próprio na faixa
  (só com o talento, `hasQuickShieldBlock`) e devolvida em `newTurn`. O bloqueio do `ShieldCard` gasta a extra PRIMEIRO e
  depois a normal (que fica para Reactive Strike, Reactive Shield e magia de reação); sem nenhuma, o aviso diz e o bloqueio
  vale mesmo assim, como todo gasto de ação. O Desfazer do bloqueio devolve a reação de onde ela saiu. **Reactive Shield**
  (botão "Erguer como reação" no cartão) ergue o escudo gastando a reação NORMAL. Shield Warden usa o mesmo bloqueio.
- Não lido pelo mapa nem pelo cartão da Iniciativa (o GM não vê as ações do jogador).

## Magias de ação variável

Magia que custa "1 a 3 ações" (Heal, Harm, Force Barrage, Blazing Bolt…): o diálogo da magia mostra **"Quantas ações
você gasta"** e o custo no contador de ações, o dano/cura, os alvos e os efeitos seguem a escolha
(`actionVariants.ts`; `actionRange` lê "Single Action to Three Actions", "…or Two Actions").

- **As regras são um CATÁLOGO escrito à mão** (`CATALOG`), conferido contra o texto da AON, como `psiAmps.ts`: a AON
  descreve cada magia de um jeito (lista por ação, "+1 projétil por ação", "dano sobe com 2+ ações"…) e ler isso com
  segurança é inviável. Hoje: **Heal, Harm, Force Barrage/Magic Missile, Blazing Bolt/Scorching Ray, Ki Blast/Qi
  Blast, Disorienting Flash, Concordant Choir, Rebuke Death**. Fora do catálogo a magia ganha só o seletor (e o custo
  certo) com o aviso de que o efeito muda — nunca um número inventado. **Acrescentar magia = uma entrada nova em
  `CATALOG` + os casos no `check-rolls`.**
- As fórmulas são em função de (rank, ações): ex. Blazing Bolt = `rank`d6 com 1 ação e `2×rank`d6 com 2–3; Heal = `rank`d8
  e +8×rank com 2 ações (cura de VIVO; contra morto-vivo é só o d8, e o Harm tem o inverso); Force Barrage = 1d4+1 por
  projétil, `ações × (1 + ⌊(rank−1)/2⌋)` projéteis.
- **Um raio por ação** no Blazing Bolt: cada raio tem o PRÓPRIO ataque e dano (MAP igual para todos; ele só sobe depois),
  mas tudo vai numa rolagem SÓ — `TableRoll.rays` (`RollRay { check, damage }`, até 6): um cartão com os raios e, no fim, o
  total e o "se todos forem críticos" (`rayTotal`/`rayCritTotal`). Com `rays`, o `check`/`damage` do topo ficam ausentes.
  Mexeu no formato, mexa nos DOIS sanitizadores (`tableRoll.ts` e `roll-store.js`); o teto de bytes do servidor subiu de
  4 → 8 KB por causa deles. O ✦ mítico gasta o ponto uma vez só.
- **Spellstrike aceita magia de ação variável** (Blazing Bolt!) com 1 ou 2 ações — antes ela era recusada por "não ter
  1 ou 2 ações". O Golpe é um só, então só um raio vale; o dano segue a escolha.
- O `id` dos componentes vem da POSIÇÃO (9500+i), não de um contador: a seleção de chips do jogador tem de sobreviver
  a cada render.

## Economia de uma conjuração (ações, slot, foco, Ponto Mítico)

Conjurar custa **ações (ou a reação) E um recurso**, e antes só a rolagem do diálogo pagava as ações — a magia sem
dano (Guidance, Bless…) só tinha o pip do slot, que não contava ação alguma, e o Ponto Mítico do Mythic Magic só saía no
botão da lista. Hoje (`spellCast.ts` + `components/useSpellCast.ts`) toda conjuração é UM evento que paga os dois:
- **Tempo** (`castTimeOf`, do campo `actions` da AON): `Single/Two/Three Actions` gastam 1/2/3; `Reaction` gasta a
  **reação** (`spendReaction`, idempotente); `Free Action` e minutos/rodadas/horas não gastam; "1 a 3" usa a escolha do
  diálogo (ou o mínimo, com aviso, na marcação à mão); sem descrição baixada vira aviso, nunca número chutado.
- **Recurso** (`CastResource`, montado por linha em `SpellsSection` e levado no `DescriptionRequest.cast` → `RollRequest.cast`):
  preparado = a cópia preparada (`slot`), espontâneo = o slot do nível, foco = 1 ponto, **Mythic Magic = 1 Ponto Mítico**,
  truque = nada. Sem slot/ponto disponível o app avisa e não desconta (nunca trava a conjuração).
- **Dois caminhos, uma cobrança**: a **rolagem** do diálogo (`via: 'roll'`) e a **marcação à mão** na lista — pip do slot
  preparado, botão de gastar do espontâneo/foco/Mythic Magic (`via: 'mark'`). `pairCast` casa um com o outro (mesma magia,
  até 90 s): rolar e depois marcar o slot, ou o contrário, paga UMA vez; duas conjurações pagam duas. O pip de um slot
  que a rolagem já gastou é ignorado (e o aviso diz isso); recuperar um slot continua sendo só desfazer, sem devolver ação.
- **Magia sem ataque nem dano** ganha o botão **Conjurar** no drawer/diálogo (só magia da ficha, com conjurador): registra
  o gasto sem rolagem no feed. Magia de bastão/consulta não tem conjurador e segue sem ele.
- O Spellstrike já paga a magia (slot/ponto, e as 2 ações são do Golpe) e registra o crédito, então marcar o slot depois não
  duplica. O psi cantrip (Amplificar) paga o ponto de foco só ao amplificar. Truque não tem marcação: o botão do drawer é
  o único caminho. Os pips do CABEÇALHO do espontâneo continuam sendo bookkeeping (não sabem qual magia foi).
- **O que a conjuração faz na economia do Magus** (`useSpellCast`, nos dois caminhos — rolar e marcar):
  - **Magia de confluência** (traços Focus + Magus: Dimensional Assault, Force Fang, Shielding Strike, Runic Impression)
    com 1 ação ou mais **recarrega o Spellstrike**; magia de foco de outro tipo (Hand of the Apprentice) não.
  - **Magia que inclui um Golpe** (`STRIKE_SPELLS`: Dimensional Assault, Shielding Strike — texto conferido na AON) deixa
    o Golpe pago (`prepayStrike`), como as atividades do "Usar": rolar esse Golpe na aba de Combate não cobra ação.
  - **Magia estudiosa** (`isStudiousSpell`, pelos `specials` "Studious Spell: Blur"): o diálogo da magia oferece entrar na
    **Arcane Cascade como ação livre** (chip ligado por padrão); fora dele, a postura custa 1 ação.
  - Auditado com navegador nas magias do Loki (ações, slot, foco e Spellstrike lidos do banco depois de cada conjuração).
- `check-rolls` cobre `castTimeOf`, o casamento e a economia do Magus acima.

## Atividades, reações e Pontos Míticos

Varredura nas 6 fichas do grupo (talentos, habilidades e itens do `public/descriptions/*.json` contra o código) achou dezenas de
ativáveis que não gastavam nada. Hoje o custo vem da PRÓPRIA AON — o pacote já traz `actions`, `traits`, `trigger` e
`frequency`, e o texto traduzido ainda diz "Gaste um Ponto Mítico" — e `scripts/check-economy.mjs` falha se algum item do
elenco ficar sem caminho (rode depois de publicar um personagem novo ou regerar pacote).
- **"Usar" genérico** (`activities.ts` + `components/useActivity.ts` + `ActivityButton`, nas abas Talentos e Habilidades):
  `activityOf` devolve o custo (`castTimeOf` de `spellCast.ts`: N ações, **reação**, ação livre só se gasta ponto ou tem limite
  diário, "1 a 3") e se gasta **Ponto Mítico** (traço `Mythic` + o texto manda gastar). Avisa falta de ação/reação/ponto e não
  impede. **`DEDICATED`** lista o que tem caminho próprio (Rage, Hunt Prey, Shield Block, Battle Medicine, Divert Destiny,
  Summon, Rewrite Fate…) — nesses o botão genérico NÃO aparece, para não cobrar em dobro. Descrição ainda não baixada = sem botão.
  O mesmo botão aparece **dentro do drawer** do talento/habilidade (`renderActions` do `DescriptionContent`, ligado pelo
  `CharacterSheetView`), para quem foi ler a regra usar dali; o cartão da regra compartilhada não o recebe.
- **"Uma vez por dia"**: campo da mesa `uses` (`{ nome: vezes }`, no `FIELD_RE`); o botão vira "Usada hoje ↺" (toque devolve) e
  o **Novo dia** (aba Magias e faixa dos Pontos Míticos) zera. O Summon Mythic Power segue com o `magus.summoned` dele.
- **Atividade que inclui um Golpe** (Sudden Charge, Vicious Swing, Slam Down, Quick Reversal… — só em ação, nunca reação):
  o custo da atividade já paga o Golpe, então ela deixa um "Golpe pago" (`prepayStrike`, 90 s) que o PRÓXIMO Golpe do diálogo
  consome (`takePrepaidStrike`) sem gastar ação. Metamagia (Reach Spell, Snowdrift Spell) é só 1 ação à parte, antes da magia.
- **Itens**: "Usar/Beber" gasta a ação que a AON diz (`actions` em `search?items=`, cache `v2`); o Desfazer devolve a ação.
- **✦ estrito** (`mythicUse.ts`): o botão só aparece onde um talento da ficha permite, com o nome dele: **Rewrite Fate** em
  teste de perícia/salvaguarda/Percepção (todos têm), **Mythic Strike** no Golpe (Ceros, Eldarion e Ghan; Brukuthur, Nathaniel e
  Thalos NÃO têm → sem ✦), **Ears that Hear the Truth** na Percepção de iniciativa e no Sense Motive, **Unbelievably Believable** (Loki) em Lie,
  Make an Impression, Request e Gather Information (contexto `influence`; as três que não cabem no turno entram no seletor
  com `actions: 0` e a duração em `time`, só para escolher o ✦ — não gastam ação), **Feet that Stride the
  Sky** / **Arms that Cut the Waves** em salto e natação (cai no Rewrite Fate sem eles), **nenhum** em ataque de magia (o Mythic
  Magic já é mítico). O ✦ continua trocando a proficiência na rolagem, sem ser um reroll de um resultado anterior.
- **Ação de perícia** (`skillActions.ts`): chip opcional no diálogo da perícia (Demoralize, Trip, Seek, Pick a Lock…, Saberes =
  Recall Knowledge), desligado por padrão; paga as ações dela. Salto/natação/Sense Motive escolhem o ✦ do talento certo.
- **Talentos míticos do turno** (`mythicFeats.ts` + `components/MythicFeatsRows.tsx`, na faixa do `MagusBar`): Godspeed (1 ação +
  ponto; liga o **Acelerado** derivado e +3 m de Deslocamento na Visão Geral — NÃO chega ao mapa/Iniciativa; o jogador encerra),
  Correct the Story e Arc of Destruction (reação + ponto), Become Destiny (livre + ponto, escolhe uma condição marcada para
  tirar), We've Met Before (1 ação + ponto). O custo escrito lá é conferido contra a AON pelo `check-economy`.
- **Não automatizado**: cargas do cajado (Mentalist's Staff), imunidade de alvo, Hydra's Bond, Sparkling Targe, efeitos dentro
  das atividades (o Deadly Aim cobra a ação, mas o Golpe dele é rolado à mão no diálogo).

## Feed de rolagens da mesa

Toda rolagem — da ficha, do rolador do mapa — vai para o feed (`services/rolls.ts` →
`api/_lib/roll-store.js`) e aparece para **todo mundo, em qualquer página**: o `RollFeedLayer` é
montado UMA vez no `MainLayout` (trocar de rota não refaz o "já visto"), e o histórico das últimas
30 abre pelo item "Últimas rolagens" da sidebar ou pelo dado da AppBar no celular. O banco guarda todas.

- **A rolagem vem sorteada** (`TableRoll`, `src/dice/tableRoll.ts`): quem recebe só apresenta, com o
  memorial junto para a mesa conferir. `DiceTray` aceita dados de tamanhos diferentes na mesma
  bandeja (o d8 da arma e o d6 da runa).
- **Cada id aparece uma vez por aparelho**; o que já estava no feed ao abrir conta como visto,
  menos o que saiu DESTE aparelho (`isOwnRoll`) — a otimista pode chegar antes da primeira leitura.
- **Tempo real**: cada inserção em `rolls`/`shares` é transmitida pelo banco (trigger) no canal privado
  `mesa:<mesa>:rolls`, eventos `roll` e `share`, já com o conteúdo (`listenMesaChannel` em `services/supabase.ts`).
  Com o canal aberto **não há poll nenhum**: a lista só é lida na abertura e a cada (re)conexão (com o `rev` de antes,
  o servidor devolve só o número se nada mudou) e ao voltar a aba visível. Medido: rolagem de outro aparelho em ~80 ms,
  regra compartilhada em ~125 ms, zero GETs em 6 s com o canal aberto.
- **Poll de reserva, sem canal** (sem Supabase, rede ruim): o de antes — 1,5 s com a aba visível, rajada de 1 s por
  5 s depois de uma rolagem, nada com a aba oculta. A carona no MGET do mapa (`rollsRev`, `noteRollsRev`) saiu: o
  mapa só quer saber que a mesa rolou algo para acelerar o próprio poll, e assina `onFeedActivity`.
- O cartão fica **30 s** na tela (com 8 s sumia antes de a mesa ler a conta) e fecha antes pelo
  **×** — só por ele: com o cartão inteiro clicável, um toque perdido o fechava no meio da
  leitura. Fica acima da AppBar e das gavetas (`zIndex` 1250), abaixo dos diálogos. Vale para
  toda rolagem, da ficha ou do mapa: as duas passam pelo mesmo `RollFeedLayer`.

## Histórico de Rolagens

`/historico` (`modules/session-diary/` + `services/diary.ts`): as rolagens de um dia de jogo, para o resumo do fim da
sessão e para conferir o que rolou. **Chamava-se "Diário da Sessão"** (rota `/diario`, que redireciona), e o nome
fazia pensar num diário escrito; o código e o endpoint (`?diary=`) mantêm o nome antigo. O banco guarda toda rolagem (`rolls`, ver "Feed de rolagens"); aqui só se agrupa.

- **O dia de jogo vai das 6h às 6h no horário de Brasília** (`diary_day` no banco, migration `diario_da_sessao`, com
  índice): a mesa joga à noite, e uma sessão que passa da meia-noite continua sendo uma só. `diaryDayOf` (cliente) e o
  fallback em memória do servidor fazem a mesma conta — o `check-rolls` confere a fronteira.
- `GET ?diary=days` (dias com rolagem, quantas, de quantos) e `GET ?diary=<YYYY-MM-DD>` (as rolagens do dia, em
  ordem, até 3000), no `roll-handler` — mesmo endpoint do feed.
- **As contas são puras** (`stats.ts`, cobertas pelo `check-rolls`): por personagem (slug; sem slug, o nome livre do
  rolador do mapa, sem caixa nem espaços), testes de d20 (**cada raio do Blazing Bolt conta como um**), média do d20,
  20 e 1 naturais, ✦ (**um por rolagem**, não por raio), maior teste e dano. **"Dano rolado", nunca "dano causado"**: o
  app não sabe a CA do alvo e o cartão mostra acerto e crítico juntos, então soma-se o dano do ACERTO; persistente fica
  de fora (já fica do `damage.total`). Destaque com EMPATE não elege ninguém.
- Aberto durante a sessão, o dia de hoje relê sozinho a cada rolagem nova (`onFeedActivity`, com 1,2 s de junção —
  uma rodada rola muito). Medido: ~1,4 s da rolagem à recontagem.
- A lista usa a `HistoryRow` das "Últimas rolagens" da sidebar (`components/RollFeed.tsx`), que ganhou "Ver o histórico
  completo". A sidebar chamava essa gaveta de "Rolagens da mesa"; virou "Últimas rolagens" para não parecer o mesmo item.

## Regra compartilhada com a mesa

No drawer de descrição da ficha (talento, habilidade, item, magia), o ícone de compartilhar ao lado do × manda a regra
para a tela de todo mundo, em qualquer página, para a mesa ler o mesmo texto e chegar a um consenso.

- **Viaja a REFERÊNCIA, não o texto** (`TableShare` em `services/tableShare.ts`: tipo, nome, rank e, na magia, CD e
  ataque de quem conjura). Quem recebe busca a descrição pelos `fetch*Description` de sempre — sem prosa na rede, a
  validação é pequena.
- **Antes de buscar, o cartão lê os pacotes já traduzidos de quem compartilhou** (`share.slug`): o estático
  (`loadDescriptionBundle`) e o da ficha publicada (`readSheetDescriptions` — só o GET, sem completar o que falta; relê
  depois de 5 min), com teto de 4 s de espera. Basta o PRIMEIRO pacote que trouxer a descrição (o outro termina em
  segundo plano), e se ela já está no cache deste aparelho o cartão nem espera. Sem isso, quem não estava com aquela ficha aberta caía na API — AON +
  LLM do zero, porque as traduções dos pacotes estáticos não estão no cache de traduções do banco — e o texto demorava dezenas de
  segundos. Medido em dev: texto junto com o cartão, zero chamadas à API de descrições. Mesma regra das rolagens: **duas validações** (`sanitizeTableShare` e `sanitizeShare` em
  `roll-store.js`), o `check-rolls` confere as duas.
- **Anda no feed de rolagens**: POST `{ action: 'share-add' }`, tabela `shares` (o GET devolve as da última hora, até 5;
  pg_cron apaga as de mais de um dia), mesmo canal (`share`) e mesmo `rev`. Sem histórico na interface (decisão do usuário).
- **O cartão desenha o mesmo `DescriptionContent` do drawer** (o corpo foi extraído do `DescriptionDrawer`, que hoje é
  só a gaveta). A camada (`SharedRuleLayer`, no `MainLayout`) só assina `useTableShares`; o cartão é `React.lazy` e é baixado
  com o app ocioso depois da primeira leitura do feed (`prefetchCard`, ~18 kB gzip; na ficha quase tudo já veio com o
  drawer) — antes, o primeiro compartilhamento da sessão esperava o código e só então lia os pacotes. Não importe o
  `DescriptionContent` estaticamente fora da ficha.
- Um cartão por vez (o novo substitui), **fica até o ×** — discutir uma regra leva mais que os 30 s de uma rolagem. O
  que já estava na mesa ao abrir não aparece, e quem compartilhou não vê o próprio cartão (`isOwnRoll`).
- O botão só aparece depois de a descrição carregar: nome que a AON não resolve chegaria vazio à mesa.

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

## Responsividade

A plataforma é usada na mesa, no celular. Toda mudança de layout precisa passar por 320px —
**exceto o Mapa de Combate**, que é só desktop (ver a seção dele).

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

## Armadilha do `sx` do MUI: `width: 1` é 100%

No `sx`, número entre 0 e 1 em `width`/`height` vira PORCENTAGEM (`1` = `100%`). Uma caixa "só para leitor de tela" escrita
com `width: 1, height: 1` virou uma caixa do tamanho do cartão de rolagem: invisível, mas ela estendia a área rolável e o
cartão (com `overflowY: auto`) mostrava uma barra levando a um espaço vazio. Para 1 pixel, `'1px'`. A `DiceTray` também
não pode ter largura fixa maior que o cartão (`maxWidth: min(340px, 100%)`), senão aparece barra horizontal. O cartão
só rola quando o conteúdo de fato passa da altura da tela (`maxHeight: calc(100vh - 32px)`).

## Animações

Primitivas em `src/motion/` (keyframes do Emotion + `requestAnimationFrame`, sem biblioteca nova).

- **O estado muda na hora; a animação só apresenta.** A cura da poção é gravada no clique e a
  `PotionOverlay` recebe o antes/depois já aplicados — fechar no meio não perde nada, e o
  "Desfazer" segue no aviso que aparece quando ela fecha. Nenhuma animação segura escrita na mesa.
- **Primeira pintura nunca anima** (`useArmed`, 1 s): o PV vem do cache, depois do servidor, e o
  máximo do companheiro chega da AON — nada disso é "alguém tomou dano". Mudança vinda da mesa
  DEPOIS disso anima de propósito: é a que ninguém na tela viu acontecer.
- **Animação que se repete no mesmo elemento usa keyframes gêmeos** (`twin` em `motion.ts`):
  trocar o nome é o que reinicia a animação. Trocar a `key` do contêiner remontaria o formulário
  com o foco dentro.
- **`prefers-reduced-motion`**: sem tremor, giro nem contagem; os números aparecem direto.
- O delta flutuante ("−9") é `aria-hidden` e fica **dentro** do cartão: o `Card` do MUI tem
  `overflow: hidden`, e um delta acima de um PV colado no topo do cartão sumia cortado.
- `DiceRoll` não rola nada — mostra o `RollDetail` que `rollFormulaDetailed` já sorteou, então os
  números da animação são exatamente os do memorial no aviso.
- Onde há animação: poção (frasco → dados → barra enchendo), PV da Ficha, do companheiro e do
  cartão da Iniciativa (conta, treme no dano, brilha na cura — inclusive o dano automático do fim
  do turno), pips de slot/foco/míticos, chips de condição novos, troca de turno e de rodada, o escudo
  (erguer, bloquear, quebrar com rachadura, consertar) e o token que muda de tamanho no mapa.
  Nada disso fica no subtree do `html2canvas`.

## Convenções

- Um módulo por funcionalidade em `src/modules/`. Padrão: `*Page.tsx` (UI/estado), lógica em
  arquivos próprios, tipos em `types.ts`/`src/types/index.ts`.
- Tipos globais em `src/types/index.ts`. Tipos do formato Pathbuilder e `parseCharacterJson` em
  `src/pathbuilder/types.ts` (reutilizados por todos os módulos).
- Helpers reutilizáveis do viewer: `src/modules/character-viewer/helpers.ts` (`abilityMod`, `totalHp`, …).
- Fichas de exemplo (formato Pathbuilder, campo `build`) em `public/characters/*.json`; presets em
  `src/modules/character-viewer/campaignPresets.ts`.

## Módulo character-viewer (Ficha Virtual)

- Visualizador interativo em `/ficha-virtual`. Reusa `parseCharacterJson`/`BuildInfo` de
  `src/pathbuilder/`. Layout: **abas no desktop, acordeões no mobile**; áreas em `sections/*`
  (Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory) — as vazias somem sozinhas.
- **Desempenho da página** (a ficha roda no celular, na mesa):
  - O acordeão monta **só a seção aberta** (`unmountOnExit`). O padrão do MUI montava as oito
    recolhidas — hooks e buscas na AON de todas ao abrir a ficha.
  - As seções são `memo`, e o que a página passa a elas tem identidade estável (`guide` em
    `useMemo`, retorno de `useMythicPoints` em `useMemo`, setters de estado). Abrir o drawer ou o
    diálogo de rolagem não repinta a aba. Prop nova numa seção precisa ser estável, senão o `memo`
    vira enfeite.
  - **Quem desenha a partir de um cache precisa assiná-lo.** A aba de Magias lê o resumo da linha
    de `getCachedSpell` no render; antes, o resumo aparecia porque fechar o drawer repintava a
    página inteira. Com `memo`, ela assina `useDescriptionCacheVersion`.
- **Guia "Como Jogar"** (Visão Geral), em ordem de precedência: (1) o **gerado por IA** da ficha
  publicada, quando a ficha aberta É a da mesa; (2) o curado à mão em `combatGuides.ts`, casado
  **por nome** (`byName`, `curated: true`); (3) `buildFallbackGuide()`, heurístico e marcado como
  automático. Os curados continuam valendo para quem abre o JSON "só neste aparelho" e servem de
  BASE para a primeira geração. A decisão de não usar IA foi revista quando os jogadores passaram a
  publicar a própria ficha: o guia curado seguia descrevendo o nível anterior.
  - **No celular o guia é uma aba que abre e fecha**, começando fechada (`OverviewSection`, `compact` vem do
    `SectionContext`): é o layout de acordeão — celular E painel estreito do mapa; de `sm` para cima fica aberto como
    sempre. O texto só monta aberto (`Collapse` com `unmountOnExit`); fechado, os selos "gerado por IA"/"automático" e
    "gerando…"/"não gerou" continuam no cabeçalho para o aviso não sumir.
  - **O guia curado é só a BASE da primeira geração por IA**: a IA seguinte parte do guia ANTERIOR, então editar o
    `combatGuides.ts` (o do Nathaniel ganhou a seção da Animated Armor) NÃO muda o guia gerado de uma ficha já publicada —
    só o de quem abre o JSON "só neste aparelho" e o plano B. Para o guia gerado mudar, é preciso republicar a ficha.
- **Publicar a ficha para a mesa** (`components/usePublication.ts`, `PublishDialog.tsx`,
  `PublishedBar.tsx`, `services/sheets.ts`): enviar um JSON abre um diálogo com o que muda
  (`sheetDiff.ts` — nível, talentos, habilidades, magias, itens) contra a versão da mesa (a
  publicada, senão o arquivo fixo). "Só ver neste aparelho" é o comportamento antigo; "Publicar"
  grava, pede o guia e abre a ficha (que completa as descrições traduzidas da mesa — ver "Descrições
  pré-traduzidas"). Sem login, **qualquer pessoa publica** — decisão do usuário —,
  então a diferença à vista e o "Versão anterior" da faixa sob o cabeçalho são a salvaguarda.
  PV, condições e slots não mudam: a identidade é o slug do nome, igual antes.
  - **"Nova versão publicada"** (`components/NewVersionBar.tsx` + `services/sheetNotices.ts`, migration
    `aviso_de_ficha_publicada`): um trigger em `sheets` avisa no canal `mesa:<mesa>:sheets` — `published` quando o
    `published_at` muda (publicar e restaurar: o `restore_sheet` grava a hora de agora) e `guide` quando o guia da MESMA
    versão fica pronto. Quem está com a ficha aberta numa versão mais velha (ou com o JSON "só neste aparelho") vê a
    faixa com "Abrir a nova versão"; nada troca sozinho, para a ficha não mudar embaixo do dedo no meio do turno. Quem
    hospeda a ficha troca (`onOpenPublished`, na página e no painel do mapa); sem ele a faixa não aparece. O guia que
    chega depois entra sem aviso (`attach`), e os cards de nível (`usePublishedSheets`) releem a lista a cada publicação.
    O aviso da publicação feita por ESTE aparelho é ignorado (`by`), senão piscaria antes de a resposta chegar.
    Medido: 160 ms da publicação à faixa no outro aparelho.
  - `published` só existe quando a ficha na tela é a da mesa. Quem abriu "só neste aparelho" não
    vê o guia gerado para outra versão. Ao recarregar, o slug publicado no `sessionStorage` faz a
    página reler a versão da mesa (alguém pode ter publicado outra no meio-tempo).
- **Ao adicionar uma ficha nova**: o caminho do dia a dia é o jogador PUBLICAR pelo upload — ela
  aparece na tela inicial como "publicada pela mesa", com guia gerado. Para virar preset fixo:
  (1) copiar o JSON para `public/characters/`; (2) registrar em `PRESETS_BY_MESA` (`campaignPresets.ts`),
  na lista da MESA do personagem, com `sheetName` igual ao `build.name` do JSON; (3) opcionalmente, um guia curado em
  `combatGuides.ts` casando pelo nome; (4) rodar o `build-description-bundle` (a versão
  PUBLICADA não precisa: o servidor traduz sozinho).
- **Os presets alimentam três módulos**: Ficha Virtual, diálogo de personagens da Iniciativa e
  gerador de Transformação (que aceita qualquer personagem, não só conjurador). Tirar uma ficha de
  `campaignPresets.ts` tira dos três. Elenco atual da Casa do Gordo Online: Brukuthur, Ceros (Cerosqualhanthallas),
  Eldarion, Ghan Buri, Nathaniel e Thalos, todos nível 10; da Arton 1515: Loki (Magus 7) — tabela e observações no
  README. **O guia do Loki segue o Remaster do Magus (Impossible Magic, jul/2026)**: Arcane Cascade sem requisito e com
  resistência a magia, Laughing Shadow com o dano extra contra desprevenido, *Force Fang* sem ataque (só recarrega). A AON
  guarda as duas versões; a revisada é a que tem `legacy_id`.
- **Os três carregam o preset por `loadPresetJson`**: a versão publicada pela mesa, se houver,
  senão o arquivo fixo. O `level` de `CAMPAIGN_PRESETS` é o do arquivo, então os cards leem o nível
  por `usePublishedSheets().levelOf` — senão mostrariam "10" depois de um level-up publicado.
  Personagem publicado que não é preset só aparece na tela inicial da Ficha Virtual (`extras`).
- **Preset tem dois nomes**: `name` é o rótulo curto (cards, botões e o nome do combatente na
  Iniciativa, via `pcFromBuild`); `sheetName` é o `build.name` do JSON, de onde sai o slug da mesa.
  O "já no combate" da Iniciativa compara pelo `sheetName` — pelo `name`, "Ceros" não bateria com
  a ficha e o personagem entraria duas vezes, dois cartões no mesmo PV. Já foi bug com o Brukuthur.
  O upload de JSON também filtra repetidos, e o reducer (`addCombatants`) descarta PC cujo slug já
  está no encontro, como trava final. Os guias do Brukuthur e do Nathaniel casam por `startsWith`
  porque o Pathbuilder exporta `Brukuthur, The Barbarian Android` e `Nathaniel o Magus`.
- **Edição à mão num JSON de ficha**: o do Nathaniel troca o *Winder's Ring* pelo
  **Ring of Wizardry (Type I)** (erro do jogador, AON 462), com o +1 de Arcanismo em `mods`. Os dois
  slots de 1º rank do anel **não** estão em `perDay` — são preparados no dia. Ao receber um export
  novo do Nathaniel, confira se o anel já vem certo antes de sobrescrever.
- **O Ardagar saiu da campanha**: preset e JSON removidos. O guia curado (`ARDAGAR`) e a entrada
  de `CHARACTER_ANIMALS` em `unarmed.ts` ficaram, porque casam por nome e servem a quem carregar o
  JSON à mão.
- **Magias de assinatura** (`signatureSpells.ts`): o Pathbuilder não as exporta, então o catálogo casa pelo
  NOME do personagem e pelo bloco de conjuração (hoje só o bloco "Psychic" do Thalos: Breathe Fire, Blazing
  Bolt, Fireball, Ice Storm, Howling Blizzard). Só **espontâneo**. A aba de Magias mostra a magia com o chip
  "assinatura" no rank do repertório e a REPETE, já elevada, em cada rank acima que tenha slot (`perDay > 0`);
  o botão de gastar usa o slot daquele rank. Personagem novo = uma entrada no catálogo + caso no `check-rolls`.
- **Conjurador de grimório** (magus, mago, arquétipo de mago) chega do Pathbuilder com as magias do
  dia em `prepared` e o grimório em `spells` — que vem vazio quando o jogador não o preenche. Tudo no
  app lê `spells`, e o bloco inteiro sumia da aba de Magias (foi o caso do Nathaniel).
  `parseCharacterJson` chama `normalizeSpellCasters`, que copia `prepared` para `spells`; a ficha
  restaurada do `sessionStorage` passa pela mesma função. O `perDay` do Magus vem com slots nos
  ranks baixos que a classe não tem (só os dois ranks mais altos têm slot) — ignore: na preparada,
  o slot é a cópia preparada, não o `perDay`.
- **Mythic Magic** sai do Pathbuilder como conjurador espontâneo com 5 slots de 5º rank, que **não
  existem**: cada conjuração gasta um Ponto Mítico. `isMythicMagicCaster` (casa pelo nome do bloco)
  faz a aba de Magias trocar os pips pelo botão que gasta do pool de `useMythicPoints` — que por isso
  viaja no `SectionContext` —, e faz `spellcasterStats` usar a proficiência mítica. O "Novo dia"
  dos slots não conta esse bloco: ele não devolve Ponto Mítico.
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
- **Export do Pathbuilder com o ataque 1 abaixo** (`fixWeaponExports`, em `pathbuilder/types.ts`, chamada por
  `normalizeBuild` no `parseCharacterJson` e no restore da sessão): a Zarroc Sheilvean do Nathaniel (+1 striking) vem com
  +18 — 10 + Perito 4 + FOR 4, SEM o +1 de potência; todas as outras armas do grupo batem com a conta. O app corrige para
  **+19** pelo nome do personagem e da arma, **só se o número exportado for exatamente 1 abaixo da conta** (nível +
  proficiência + FOR + potência): se o jogador reexportar já certo, a correção deixa de agir em vez de somar o +1 duas
  vezes. Efeito colateral bom: `weaponRank` (rank do ✦) volta a fechar em Perito. Armas novas com o mesmo defeito entram
  em `WEAPON_EXPORT_FIXES`. O ideal continua sendo corrigir na origem (Pathbuilder).
- **Tamanho listado entre as características**: exports mais novos do Pathbuilder põem "Medium" (o tamanho) em
  `specials` — o do Loki veio assim —, e na AON "Medium" é a **classe** do médium espiritual: a aba Habilidades mostrava a
  descrição dela e o pacote de descrições a traduzia. `normalizeBuild` (`dropSizeSpecials`) tira os seis tamanhos de
  `specials`; o tamanho continua no `sizeName`. O `check-rolls` confere.
- **Pool de foco pela regra do Remaster** (`fixFocusPool`, no `normalizeBuild`): o Pathbuilder ainda conta uma fonte a
  mais, e o Loki saía com 3 Pontos de Foco. No Remaster o pool é o número de magias de foco, até 3 (Player Core pg. 298;
  truque de foco não conta, e o Psi Development só dá 1 ponto a quem não tem pool) — o Loki tem 2. Só reduz, nunca
  aumenta, e não toca no Psíquico, cujo pool vem da classe (o Thalos tem só truques de foco). O `check-rolls` confere o elenco.
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
- **Consumíveis** (`useConsumables.ts` + `services/itemTraits.ts`): poção, elixir, veneno,
  pergaminho e talismã ganham botão "Usar" ("Beber" quando curam). Quem diz o que é consumível é o
  traço `Consumable` do AON (`search?items=`), porque o Pathbuilder exporta poção e veneno como
  `"Invested"`, igual a um anel — por isso esse chip some num consumível confirmado. Sem entrada no
  AON (pergaminho vem como "Scroll of Heal (Rank 1)"), vale um fallback por nome.
  - O gasto é da mesa (campo `consumed`) e guarda **quantos** foram usados por nome, com `of` = a
    quantidade da ficha quando o uso foi marcado. Export novo com outra quantidade zera o contador
    daquele item: o jogador já tirou do Pathbuilder, e contaria duas vezes. "Novo dia" não mexe.
  - O **＋** ao lado devolve 1 ao inventário (poção bebida sem querer, fora da janela do
    "Desfazer"), vale para todo consumível e **não mexe no PV**. O teto é a quantidade da ficha:
    acima disso o item nunca existiu — para ganhar mais, é no Pathbuilder.
  - **A cura é rolada e aplicada sozinha** no PV do personagem (quem bebe), com o `rollFormulaDetailed`
    do `initiative-tracker/dice.ts` — mesma política do dano automático da Iniciativa: memorial da
    rolagem e "Desfazer", que devolve o item e tira **só o que a cura somou**, sobre o PV de agora.
    O teto da cura sai de `characterMaxHp`, o mesmo helper da Visão Geral.
- **Passar item entre jogadores** (`gifts.ts` + `components/useGifts.ts` + `GiveItemDialog.tsx` +
  `services/gifts.ts`, migration `gave_no_estado_da_mesa`): botão **Passar** no consumível do Inventário (poção, elixir,
  pergaminho, veneno, talismã… — só `row.equipment && isConsumable`; arma, armadura e permanentes ficam de fora). Direto,
  sem aceite; o destinatário vê "Fulano te enviou 2× X" em qualquer aba e pode **devolver** (é só passar de volta).
  - **Cada jogador escreve só na PRÓPRIA fatia.** Estado da mesa é "última escrita vence" por (slug, campo): dois
    remetentes gravando no mesmo destinatário se atropelariam. O campo `gave` guarda no REMETENTE
    `{ destinatário: { item: n cumulativo } }`; quem recebe soma o que aponta para ele (`GET ?incoming=`, depois o
    `onStateChange` do Realtime). Não há lógica de devolução: devolver é o outro `gave` apontando de volta.
  - **A quantidade é DERIVADA**: ficha + recebido − passado − usado (`withGifts`, `deltaOf`), piso 0. O JSON do
    Pathbuilder não é editado. Item só recebido vira linha extra "Recebido"; quem passou tudo perde a linha.
  - **`consumed.of` continua sendo a quantidade DA FICHA** (`ItemRow.sheetQty`), e o que foi passado entra como `extra`
    em `remaining`/`consume` — senão passar um item zeraria o contador de uso pela regra anti-contagem-dupla. Para item
    só recebido `of = 0` (o sanitize aceita). Quem lê `build.equipment` à mão não vê o item recebido: use
    `useGifts().rows` (o veneno do Ladino, `usePoisonOptions`, já usa).
  - **O primeiro retrato do `incoming` nunca avisa**, mas compara com o "visto" guardado no `localStorage`: o que chegou
    com o app fechado aparece como aviso na volta. Reler: ao abrir, ao reconectar o canal e ao voltar a aba.
  - Fora do escopo, de propósito: histórico de transferências; a descrição do item recebido vem da API (o pacote
    pré-traduzido de quem recebeu não o conhece). Teto de 12 destinatários × 40 itens por fatia.
- **Relíquias** (`relics.ts` + `components/RelicsCard.tsx`, no Inventário): catálogo À MÃO por nome de personagem
  (`RELICS`, hoje vazio — cada relíquia entra quando o jogador informa o que ela é e que dádivas tem), como
  `customRunes.ts`. Regras do GM Core, Advancing a Relic (pg. 309): o **nível da relíquia é o do dono**; a Tabela 2–22
  dá o nível típico de cada dádiva pela posição (1º, 5º, 9º, 13º, 17º — `GIFT_LEVELS`, `minLevel` sobrepõe); o jogador
  pode ter trocado uma dádiva por **runa** ("Runes as Gifts").
  - **A descrição vem da AON pelo nome** (categoria `relic`, o `/api/searches` já resolve pela rede de segurança e
    traduz); só vai texto à mão em `description` quando a AON não serve. O que a AON não entrega estruturado — custo e
    frequência da "Activate" — é escrito no catálogo (`activation`), conferido contra o texto dela.
  - **Usar** = `ActivityBody` (exportado de `ActivityButton`) com o `ActivityInfo` de `giftActivity`: paga ações/reação
    por `useActivity`, "uso limitado" marca no campo `uses` (chave `relic:<relíquia>:<dádiva>`, zerada pelo Novo dia). O
    app não conta o tempo: "uma vez por minuto" também vira "Usada ↺" devolvido à mão. **Sem campo novo da mesa.**
  - **Runas de arma** entram no `build` UMA vez, no `useMemo` do `CharacterSheetView` (`withRelicRunes`): o Combate, a
    rolagem e o inventário leem a mesma ficha. Potência e Striking valem pelo MAIOR (não empilham, e fica idempotente se o
    Pathbuilder já exportou a runa); o ataque sobe pela diferença de potência. Runa de propriedade só rende efeito de
    crítico se o nome estiver em `critEffects.ts`. Runas de armadura/avulsas são texto, sem automação de CA/salvaguarda.
  - O cartão fica FORA do "Inventário vazio" (relíquia em ficha sem itens aparece). `check-rolls` e `check-economy` cobrem.
- **Escudo** (`shield.ts` + `components/useShield.ts` + `ShieldCard.tsx`, Visão Geral): o
  Pathbuilder manda o escudo em `build.armor` com `prof: 'shield'`, runas e `acTotal.shieldBonus`
  — a CA exportada **não** inclui o escudo. Dureza/PV/BT vêm da AON (`services/shields.ts`, com
  cache, como `itemTraits.ts`) e a **runa de reforço** é somada aqui, com o teto por grau (GM Core
  p. 232, transcrita da AON); escudo específico não recebe runa.
  - Regras: erguer soma o bônus de circunstância na CA; **quebrado (PV ≤ BT) não ergue, não soma
    CA e não bloqueia** (condição Broken do Player Core) — por isso o bloqueio que quebra também
    abaixa o escudo; destruído em 0. No Bloqueio com Escudo, o que passa da Dureza vai **inteiro**
    para a criatura E para o escudo, não dividido. Só com o talento Shield Block.
  - Estado na mesa, campo `shield` (`{ hp, raised }`, `hp: null` = inteiro, como o PV): o GM vê na
    Iniciativa o escudo que o jogador ergueu aqui. A CA da Visão Geral e da aba Combate somam o
    bônus erguido.
  - **Destructive Block** (Bastion 10, Player Core 2 p. 187) é opção **por golpe**, só para quem
    tem o talento (`ShieldItem.destructive`, casado pelo nome como o Shield Block — hoje só o Ghan
    Buri): a criatura desconta o **dobro** da Dureza e o escudo toma o dano cru **dobrado, menos a
    Dureza** ("double the damage … before applying its Hardness"). A conta mora em `blockSplit`,
    usada pela ficha, pelo cartão e pelo dano em lote. O card da ficha mostra as duas contas lado a
    lado, porque a escolha é feita depois de saber o dano.
  - Consertar: sucesso `5 + 5×rank` de Ofício, crítico `10 + 10×rank`. O app não rola o teste —
    o jogador informa o grau. Destruído não se conserta; "Restaurar tudo" é o escudo novo.
  - A barra é própria (não `LinearProgress`): precisa da marca do BT e da rachadura, que é
    desenhada só no trecho preenchido. Cor `SHIELD_COLOR` — item, não criatura.
- **Runas homebrew** (`customRunes.ts`): sem entrada na AON, casadas pelo NOME do personagem e
  pelo tipo de item (armadura vestida ou arma por nome), como `magicWeapons.ts` — o JSON não é
  editado, e a runa sobrevive a export e publicação. `replaces` esconde a runa da AON que ela
  substituiu (a Size-Changing do Brukuthur) nos chips e no nome de exibição.
- **Unleash Psyche** (`psyche.ts` + `components/usePsyche.ts` + `PsycheBar.tsx`): só aparece para quem
  tem a característica. Estado da mesa, campo `psyche` (`idle` → `unleashed` → `strain`). Liberada, as
  magias de dano da **conjuração de Psíquico** (bloco "Psychic" e os psi cantrips do `build.focus`;
  Aeromancer não) ganham bônus de status de **2 × rank** — truque pelo rank em que é elevado — em magia
  **sem duração**, uma vez só, na primeira parcela de dano imediato (nunca persistente; Psi Burst não é
  magia). Viaja em `ConditionModifiers.psyche`, e o `SpellBody` do diálogo soma ao componente; a linha
  da magia mostra o chip "+N psique". A ressaca (Estupefato 1) é DERIVADA, como o Titan Mauler. **O app
  não conta rodadas da ficha**: as duas trocas de fase são botões ("As 2 rodadas passaram",
  "Recuperada"). A Iniciativa ainda não lê o campo.
- **Amps dos psi cantrips** (`psiAmps.ts`): transcritos da AON e casados pelo NOME do truque
  (o Pathbuilder só manda "Frostbite (Amped)"), rank base 1 com o "Amp Heightened (+1)" por rank
  acima. No diálogo da magia, o chip "Amplificar · 1 Ponto de Foco" TROCA o dano normal pelo do amp
  (Frostbite 3d4+2d4/rank, Ignition d10/d12 com o persistente do crítico, Redistribute 6d6+2d6/rank
  em frio OU fogo) e o ponto sai ao rolar, da mesma fatia `slots` da aba (as instâncias se enxergam).
  Efeito sem número (PV temporários, respingo, fraqueza, motes) vira nota. Catalogados: a Oscillating Wave (Thalos) e, da
  The Tangible Dream, o **Imaginary Weapon** (2d6 por rank amplificado: 8d6 no 4º) e o **Shield** (camadas; Dureza ×1,5 e
  ×2 ao quebrar duas ou três). Outro conscious mind é uma entrada nova; "Shield (Archetype)" casa com "Shield".
  - **Quem amplifica** (`canAmpPsiCantrips`): o Psíquico, e o arquétipo com o **Psi Development** — no Dark Archive
    (Remastered) a dedicação dá o truque SEM o amp. Os psi cantrips do arquétipo são "occult psychic spells", então o
    `focusCasterInfo` os marca `psychic` (o Loki); a psique e a Conservation of Energy continuam exigindo o que exigiam.
  - **Truque de foco não gasta Ponto de Foco ao conjurar** (`FocusSpellEntry.cantrip`, de `focusCantrips`); só o amp gasta.
    Antes, todo item de foco cobrava o ponto, menos os psi cantrips catalogados do Psíquico — o Imaginary Weapon do Loki
    cobrava a cada conjuração. No "Conjurar" (o Shield não tem o que rolar), o ponto do amp sai ANTES de o diálogo fechar:
    também já foi bug.
- **Conservation of Energy** (`energy.ts` + `components/useEnergy.ts` + `EnergyBar.tsx`), para quem tem
  "The Oscillating Wave": campo `energy` da mesa guarda a ÚLTIMA escolha (`add`/`remove`, ausente =
  neutro). Nas magias concedidas e em Frostbite/Ignition o diálogo oferece Adicionar (fogo) / Remover
  (frio) — depois de uma, só a oposta —, converte TODO o dano para o tipo e registra ao rolar. Voltar ao
  neutro (Refocus) é um botão: a ficha não vê o fim do encontro.
- **Magus e poder mítico** (`magus.ts` + `components/useMagus.ts` + `MagusBar.tsx`): faixa fora das abas
  que só mostra o que a ficha tem (`specials`/`feats`, sem catálogo por nome). Estado da mesa, campo `magus`
  (`{ cascade, cascadeType, spent, summoned }`, já no `FIELD_RE`).
  - **Arcane Cascade** (Secrets of Magic pg. 38): postura ligada à mão — o app não sabe a última ação. Dano
    extra nos Golpes corpo a corpo: +1, **+2 com Weapon Specialization**, +3 com a Greater. Viaja em
    `ConditionModifiers.cascade` e `planStrike` o injeta como parcela extra (`key: 'arcane-cascade'`, sempre
    ligada, dobra no crítico; arremesso e à distância não levam). **O tipo é escolha do jogador** (seletor na
    faixa): a regra manda usar o da última magia que causava dano, e a ficha não vê isso; força é o padrão.
  - **Spellstrike** é indicador "Carregado/Gasto" + "Recarregar · 1 ação" (também recarrega ao conjurar
    magia de conflux de 1+ ação), E vive dentro do diálogo do Golpe (`SpellstrikePanel` + `useSpellstrike` +
    `spellstrike.ts`): o Magus escolhe a magia, e UM clique rola Golpe + magia, gasta o slot (truque não
    gasta), marca o Spellstrike como gasto e, se o chip estiver ligado, entra na Arcane Cascade com o tipo
    da magia. Entram as magias de **QUALQUER bloco** da ficha (Magus, arquétipo de Mago, inatas e **Mythic Magic** — esta gasta 1 Ponto
    Mítico em vez de slot, e o ataque é o do Golpe, sem a proficiência mítica da magia) de 1–2 ações com ataque ou
    salvaguarda (`spellstrikeIssue`); a característica Spellstrike é que liga a seção. Houve um bug: só o bloco "Magus"
    entrava, e o Blazing Bolt (que está no Mythic Magic) nunca aparecia. Magia de ATAQUE usa o resultado do Golpe e dobra no crítico; de
    SALVAGUARDA não dobra (o alvo rola a dele). `spellstrikeRoll` (`rolls.ts`) soma as parcelas num `TableRoll`
    só. Escolhida a magia e ainda não pronta (buscando, sem slot), o botão de rolar fica desabilitado:
    rolar sem ela em silêncio enganaria. Só vale em Golpe corpo a corpo.
    Entram também os **truques de foco** (`build.focus`, fora dos blocos — o Imaginary Weapon do arquétipo de Psíquico),
    em "Truques de foco", com a CD do grupo de foco (`option.focus.dc`, `casterIndex` −1); psi cantrip que dá para
    amplificar ganha o chip "Amplificar · 1 Ponto de Foco", que troca o dano pelo do amp (só no alvo do Golpe) e gasta
    o ponto ao rolar.
  - **Laughing Shadow** (`hasLaughingShadow`/`withLaughingShadow`): em Arcane Cascade, o chip do diálogo do Golpe "alvo
    desprevenido, outra mão livre" leva o dano da postura a 3 / **5 com Weapon Specialization** / 7 com a Greater
    (Impossible Magic pg. 13). O app não sabe do alvo nem da mão, e o chip não fica lembrado (é da situação).
  - **Summon Mythic Power** (1×/dia, +1 Ponto Mítico) e **Divert Destiny** (reação: gasta 1 ponto, PV =
    10 + nível limitado ao máximo, zera ferido e morrendo, não mexe em condenado, com confirmação) valem
    para QUALQUER personagem mítico que tenha o talento — Brukuthur, Ghan Buri etc. também têm, e a faixa
    vira "Poder mítico" quando não há nada de Magus. "Novo dia" da Summon é o botão ao lado dela; não
    reseta sozinho com o do pool de pontos.
  - A Iniciativa **não lê** o campo `magus`. `check-rolls` cobre a postura, o dano e o estado.
- **Patrulheiro** (`ranger.ts` + `components/useRanger.ts` + `RangerBar.tsx`): faixa fora das abas com
  **Hunt Prey** (presa marcada sim/não — qual criatura é, é da mesa) e **Gravity Weapon** (gasta 1 Ponto de
  Foco do MESMO contador da aba de Magias; dura 1 minuto, encerrada à mão). Campo `ranger` da mesa
  (`{ prey, gravity }`), viaja em `ConditionModifiers.ranger`. O que muda nos Golpes (`planStrike`):
  - **Gravity Weapon**: bônus de status = **2 × dados da arma** (com striking) no *primeiro* Golpe com ARMA
    da rodada — desarmado não leva. O app não conta rodadas: o chip "Primeiro Golpe da rodada" vem
    ligado e o jogador o desliga nos seguintes. **Chip não persiste** (nem o do Hunter's Aim): lembrar um
    "desligado" tiraria o dano do primeiro Golpe da rodada seguinte em silêncio.
  - **Hunt Prey + Hunter's Edge: Precision**: o `1d8 precision` da arma (que o Pathbuilder já manda como
    chip desligado) vem LIGADO com a presa marcada (`extraEnabled(e, on, mods)`); a escolha do jogador vence.
    Vale só no primeiro acerto da rodada — a legenda avisa, o app não conta.
  - **Hunter's Aim** (talento, 2 ações): chip só em Golpe à distância/arremesso, +2 de circunstância no ataque.
  Quem tem cada coisa vem da ficha (`specials`/`feats`/`focus`). `check-rolls` cobre. A Iniciativa não lê `ranger`.
- **Investigador** (`investigator.ts`, sem campo da mesa nem faixa): tudo vive no diálogo do Golpe. **Devise a Stratagem** (Player Core 2
  pg. 103) é o chip "Devise a Stratagem · +1 ação · 1× por rodada" (`STRATAGEM_KEY` em `extrasOn`, **não lembrado** de um Golpe para
  o outro, como o Hunter's Aim): cobra a ação **antes** do Golpe pelo mesmo `prepay` do veneno (de qualquer tipo; a ação extra do
  Acelerado fica para o Golpe), troca FOR/DES por INT no ataque e soma o **Strategic Strike** (`1d6 precision`, +1 dado nos níveis 5, 9,
  13 e 17) como parcela extra, dobrada no crítico. O d20 não é rolado à parte: Golpe e estratagema saem no mesmo clique, então o d20 da
  rolagem JÁ É o do estratagema (`note` diz "fortune"). O chip "Investigação ativa sobre o alvo" (`LEAD_KEY`) zera o custo (ação livre).
  - **A arma tem de poder somar INT** (`stratagemQualifies`): ágil, acuidade ou à distância; sem traços da AON (arma caseira) o app
    **não afirma** e avisa. O Strategic Strike vale mesmo com INT = DES (a regra é "somar INT pelo estratagema"). Condição que mexe em INT
    (Estupefato) entra por `skillInt`, no lugar das de FOR/DES.
  - **Known Weaknesses** e **Shared Stratagem** são chips que viram só anotação da rolagem (dependem do alvo e do aliado). Não há
    contador de "uma vez por rodada": o app **não conta**.
  - **Não automatizado ainda**: Pursue a Lead e as duas investigações ativas (+1 de circunstância nos testes, Clue In,
    Detective's Readiness — pediria um campo novo da mesa), o estratagema de perícia, Expeditious Inspection, Assurance, Searing
    Restoration e a cura das Healer's Gloves. `check-rolls` cobre dados por nível, INT, arma sem ágil e a aceitação pelo servidor.
- **Godless Healing** (`hasGodlessHealing`, `treatWounds.ts`): +5 PV quando o Tratar Ferimentos ou o Battle Medicine é **em si mesmo**
  (`TreatVariant.godless`, ligado por `onSelf`), somado ao FIXO da parcela de cura para os dados + fixo continuarem fechando no servidor;
  no Battle Medicine em si, a nota diz que a imunidade cai de 1 dia para 1 hora.
- **Ladino** (`rogue.ts` + `components/useRogue.ts` + `usePoisonOptions.ts` + `usePoison.ts`) — **sem faixa no topo da ficha**: tudo vive no diálogo do Golpe (aplicar, "Veneno usado", "Nova preparação"); a faixa `RogueBar` foi removida a pedido: **Poison Weapon**
  (talento) escolhe, entre os itens do inventário com os traços `Poison` + `Contact`/`Injury` (via
  `fetchItemTraits`; veneno inalado como o Breath of the Mantis God NÃO serve), aplica 1 na arma e **gasta
  uma unidade** pelo mesmo contador dos consumíveis (`useConsumables`, campo `consumed`). Campo `rogue` da
  mesa (`{ poison }`). A lâmina fica envenenada **até alguém clicar "Veneno usado"** — o app não sabe se o
  Golpe acertou. O diálogo do Golpe mostra o chip "Arma envenenada · Fearweed (CD 30 Fortitude)" (CD e
  salvaguarda lidas da AON por `searchAfflictions`) e a rolagem leva isso na anotação; o dano e o efeito do
  veneno são do GM (aflição na Iniciativa), o app não rola nada.
  - **O veneno SIMPLES é o padrão** (Special do Poison Weapon, Player Core pg. 171): na preparação diária o Ladino
    prepara **tantas doses quanto o nível** de injeção que causam **1d4 de veneno, 2d4 com o Improved Poison
    Weapon, sem salvaguarda**, e que expiram na próxima preparação. Vem SEMPRE como primeira opção do seletor, com
    "N/10 por dia", e os venenos do inventário são as alternativas. Fica gravado como `poison: '@simple'`
    (`SIMPLE_POISON`) e as doses usadas em `simpleUsed` (campo `rogue`); "Nova preparação" devolve as doses e
    tira o veneno simples da lâmina. No Golpe, o dano é ROLADO junto (`withSimplePoison`) e **não dobra no
    crítico** (é efeito da injeção, não dano do Golpe); vale se o Golpe acertar. O Improved Poison Weapon também
    diz que a dose não se perde num erro crítico — o app só avisa, não sabe do erro.
  - **O veneno se aplica NO diálogo do Golpe** (arma ainda limpa + talento Poison Weapon): o chip "Aplicar veneno
    antes do Golpe · +1 ação" abre o seletor (`usePoisonOptions`, a lista e o gasto — simples primeiro, depois o inventário). Ao rolar: gasta a ação da aplicação (1, qualquer tipo, paga
    ANTES — o Golpe pode então usar a ação extra do Acelerado), gasta a dose/unidade, deixa a lâmina envenenada e
    o Golpe já sai com o veneno. A falta de ações é a soma dos dois pagamentos em sequência. Com a arma envenenada o
    diálogo mostra o chip e o botão "Veneno usado" (o app não sabe se o Golpe acertou); "Nova preparação" devolve as
    doses do dia. Aplicar sem atacar não existe mais: a ficha não tem o botão.
  - **Debilitating Strike** (ação livre, nível 9): chips "Deslocamento −3 m" / "Enfraquecido 1" no diálogo
    do Golpe, também só como anotação da rolagem (precisa acertar um alvo desprevenido).
  - **`TableRoll.note`** (novo, até 300 caracteres) leva essas anotações: o `sub` é cortado em 80 e é para o
    rótulo curto. Como todo campo do feed, **duas validações** (`tableRoll.ts` e `roll-store.js`); o
    `check-rolls` confere as duas. O Spellstrike com muitas parcelas de dano junta as da magia numa só, porque
    o feed recusa a rolagem inteira com mais de 8.
- **Guerreiro / Bastion** (`fighter.ts`): quatro talentos do Ghan Buri, todos descobertos pela ficha.
  - **Fearsome Brute**: o diálogo do Golpe pergunta o medo do alvo (0–4; não é persistido) e `planStrike`
    soma bônus de circunstância de **2 × medo** (3 × se mestre em Intimidação, rank 6). **Guardado pelo talento**
    — já houve bug de somar sem checar a ficha, pego pelo `check-rolls`.
  - **Exacting Strike**: chip no diálogo; vira anotação da rolagem ("se errar, não conta para o MAP") — o app
    não sabe se errou.
  - **Reflexive Shield**: com o escudo erguido e inteiro (estado da mesa, `useCharacterShield`), o bônus dele
    entra nos Reflexos via `ConditionModifiers.reflexShield`, tratado em `buildCheck` (e NÃO por
    `effectiveParts`, que só guarda a pior parcela de cada tipo — um bônus de circunstância sumiria ao lado
    de uma penalidade de circunstância).
  - **Fiery Rebirth** (talento mítico): linha na faixa mítica (`MagusBar`, que vira "Poder mítico" para quem não
    é Magus). Confirmação, gasta 1 Ponto Mítico, +nível PV, tira Inconsciente e Morrendo e posta a explosão (fogo
    2 × nível, Reflexos básico, CD de classe) no feed (`fieryRebirthRoll`). Lembra: não toca em Ferido.
  - Não automatizado: Devoted Guardian, Quick Reversal e as reações que dependem do alvo
    (Disarming Block; o Quick Shield Block e o Reactive Shield só contam a reação) — dependem de turno, aliados e alvos que a ficha não vê.
- **Mudança de tamanho** (`sizeEffects.ts` + `components/useSizeEffect.ts`): a runa do Brukuthur
  liga Enlarge 4º ou Shrink com um clique e desliga pelo "Voltar ao normal". Estado da mesa no
  campo `size` (`{ active, used, since }`; `used` trava a ativação 1×/dia até o "Novo dia").
  - O Desajeitado 1 do Enlarge é **derivado**, como o de aflição (`useConditions` recebe as duas
    origens juntas, com `derivedSources` para o tooltip). O +4 de estado no corpo a corpo viaja em
    `ConditionModifiers.meleeDamage` (`withSizeEffect`), que é o que já chega ao `planStrike` — e
    só entra em Golpe corpo a corpo (nem à distância, nem arremesso).
  - A Iniciativa LÊ o campo (`PartySlice.size`) e deriva o mesmo Desajeitado; não liga nem
    desliga. O mapa lê o campo no `readPcs` e `withPcSizes` (cliente) troca o tamanho do token na
    renderização — o `tok:` é da Iniciativa, e desligar volta ao original sem regravar nada.
    Miúdo ocupa 1 quadrado (alvo de toque) mas é desenhado com metade do tamanho (`tiny`).
  - O token cresce para a direita e para baixo (a posição é o canto superior esquerdo): deslocar
    a posição só na tela faria o arrasto gravar a posição deslocada.
  - **A troca de tamanho é animada no mapa** (`useResizeAnimation` em `Token.tsx`): o token
    brilha no tamanho antigo, cresce ou encolhe passando um pouco do ponto, com um anel dourado
    que se abre ou se fecha; barra e nome acompanham. O tamanho novo já está no DOM — cada peça
    parte do desenho antigo (Web Animations, porque o ponto de partida depende dos dois tamanhos).
    Borda, brilho e anel são divididos pela escala do quadro: sem isso, um Grande → Miúdo
    começava com um disco dourado 8× maior cobrindo o mapa. A barra anima `left/right`, não
    `scaleX`, que esticava o "80/120". Nada anima no primeiro segundo do token montado.
- **Fúria do bárbaro** (`rage.ts` + `components/useRage.ts` + `RageBar.tsx`): liga e desliga pela
  faixa "Fúria", fora das abas, e a ficha inteira acompanha. Estado da mesa, campo `rage`
  (`{ active, since, endedAt, granted, titan }`). Só aparece para quem tem a habilidade `Rage`.
  - **É a regra do Remaster (Player Core 2), sem o −1 na CA do Core antigo.** Quem lembra desse
    −1 está lendo a regra errada; foi conferido na AON. Entrar dá PV temporários = nível + CON
    (14 no Brukuthur); +2 de dano em Golpe corpo a corpo, **metade se a arma é ágil** (o punho
    leva +1); nada de ação com o traço concentrar. Dobra no crítico, porque soma ao dano.
  - **O dano da Fúria depende da arma, então viaja como regra, não como número**:
    `ConditionModifiers.rage` + `meleeBonusParts` (que também devolve o +4 do Enlarge) resolvem
    golpe a golpe, em `planStrike` e na linha da aba de Combate. À distância e arremesso não levam.
  - **Titan Mauler (Giant Instinct)**: com arma Grande, a Fúria vai a +6, +10 no nível 7 e +18 com
    Greater Weapon Specialization, em troca de **Desajeitado 1 que não sai enquanto a empunha — com
    Fúria ou sem**. É derivado, nunca gravado (como o do Enlarge), e baixa a CA e os Reflexos do
    Brukuthur de forma permanente: foi decisão do usuário. O interruptor "Arma Grande em mãos"
    (`titan`) é o escape para quem larga o machado. O Pathbuilder não exporta o tamanho da arma
    nem a energia do Raging Resistance, então `GIANT_BARBARIANS` casa pelo NOME do personagem
    (Brukuthur: Greataxe Grande, resistência a **fogo**), como `customRunes.ts`.
  - **Raging Resistance** (3 + CON = 7, contundente e a energia escolhida) só vale em Fúria e só
    para Giant com entrada no catálogo; outro instinto fica sem resistência, em vez de chutar.
    A Visão Geral mostra "Em fúria: …" e a Iniciativa soma à defesa do PC
    (`withRageResistance`: no mesmo tipo vale a MAIOR, não a soma).
  - **PV temporários são do `RageBar`, não do `useRage`**: o hook entra antes das condições e o PV
    precisa do corte de Drenado que sai delas. Ao entrar, temporários não empilham (vale o maior) e
    `granted` guarda só o que a Fúria pôs; ao encerrar, tira-se **só isso** — se sobrou mais do
    que ela deu, é de outra fonte (Renewed Vigor) e fica. Fúria dentro de 1 min da anterior não dá
    temporários (`rageGivesTempHp`).
  - **Não automatizado, de propósito**: o fim por inconsciência/fim do encontro (um efeito que lê
    a mesa e escreve na mesa é o laço que a seção da Iniciativa proíbe) e o bloqueio de ações com
    concentrar (vira aviso). "Encerrar Fúria" existe porque a mesa é quem sabe que acabou.
  - A **Iniciativa só lê**: `PcCombatant.rage` (o `rageSpec`, gravado ao importar) + `PartySlice.rage`
    dão o chip "Em fúria", a resistência e o Desajeitado. Encontro montado antes do campo: tirar e
    pôr o personagem de novo, como o escudo. `check-rolls` cobre dano, ágil, Grande, resistência e
    a janela de 1 minuto.
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
- **Magia no rank em que está** (`api/_lib/spell-scaling.js` + `heightening.ts`): a linha e o drawer
  mostram os números do rank conjurado — slot preparado, ou ⌈nível/2⌉ para truque e foco — com o
  chip "↑ 5º" quando elevada. O backend lê do INGLÊS, antes da tradução, os números da prosa
  (dado de dano, dano fixo, cura, Dureza, resistência, fraqueza, PV temporários) e, para cada
  entrada de heightening, para qual número vai cada valor (`scaling`); o cliente aplica no rank.
  - **Conservador de propósito.** Uma entrada só vira conta quando TODO número dela acha dono sem
    dúvida (`safe`), e é tudo ou nada: meia conta certa ao lado de meia errada não tem como ser
    distinguida por quem lê. O que não fecha aparece como texto em "Neste rank". `resolved` é
    `safe` sem efeito sobrando ("…, and the attack ignores cover"): a conta entra E o texto some.
  - As armadilhas que a amostra pegou, todas no `check-heightening`: "by 1d12 electricity and 1d4
    sonic" são DOIS valores; "by 10 on a failure, or 5 on a success" tem número sem dono;
    "initial damage by 2d6, and the secondary damage by 1d6" com os dois do mesmo tipo é a mesma
    regra pegando o mesmo número duas vezes; "the maximum damage from the scale explosion" é um
    sujeito qualificado que fala de UM dos danos — só sujeito genérico ("The damage") vale para
    todos. "X damage and persistent Y damage each" pega os dois.
  - Rank fixo SUBSTITUI o anterior. Se a entrada fixa que vale não foi lida, o número fica marcado
    `uncertain` ("7d10 (?)") em vez de voltar ao da prosa — que seria mentir.
  - Na prosa traduzida, os dados elevados são trocados no lugar: a k-ésima "2d4" do inglês é a
    k-ésima da tradução (dados sobrevivem ao LLM), e só troca quando a contagem bate nos dois.
    Número solto (Dureza 5) não é trocado na prosa — vai para as linhas de metadado.
  - Cobertura medida: ~71% das entradas "+N" do índice viram conta; todas as magias de dano do
    grupo. `computeHeightenedDamage` (um dado só) ficou como caminho para payload sem `scaling`.
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
- **Totais dos testes têm UMA fonte** (`checks.ts`): salvaguardas, Percepção, perícias e Saberes
  saem de `saveCheck`/`perceptionCheck`/`skillCheck`/`loreCheck`, com a conta parcela por parcela
  (`parts`). A Visão Geral, as Perícias, a Iniciativa (`pcFromBuild`), o guia automático e a
  rolagem leem daqui — duas contas para o mesmo número sairiam de sincronia.
  - **O bônus de item vem do `build.mods`** do Pathbuilder (`{"Fortitude": {"Item Bonus": 1}}`,
    "Stealth", "Arcana"…). Antes ficava de fora e o grupo inteiro aparecia com as salvaguardas 1
    abaixo do real (runa resiliente).
  - **Penalidade de armadura** nas perícias de FOR/DES, com os números do AON (`search?gear=`,
    `useArmorPenalty`), só quando a FOR não alcança a exigência. Hoje ninguém do grupo é afetado.
    Não vale em ação com o traço ataque — o diálogo avisa, a ficha não tem como saber.
  - O ✦ é `total + mythicDelta`, que TROCA a proficiência (`mythicProficiencyDelta`), nunca +10
    por cima.
- **Rolagens** (`rolls.ts`, `strikes.ts`, `components/RollDialog.tsx`, `RollTrigger.tsx`): tocar
  num save, na Percepção, numa perícia/Saber, no "Rolar" de uma arma ou desarmado, no "Atq" do
  conjurador ou no botão do drawer de uma magia abre o diálogo com o **memorial** (a conta que
  soma o modificador), o MAP, os chips de dano extra, um ajuste livre (cru — o diálogo avisa que
  não aplica a regra de empilhamento) e dois botões: normal e **✦ mítico**, que gasta o Ponto
  Mítico no MESMO clique (`mythicPoints.spend`). A rolagem vai para a mesa inteira (feed).
  - **Golpe** (`strikes.ts`): parte do `weapon.attack` do Pathbuilder e acrescenta só o que ele
    não sabe. À distância é DES; corpo a corpo FOR; com acuidade vale o melhor DEPOIS das
    condições (Desajeitado 3 faz o Ceros atacar de FOR). MAP −5/−10, ágil −4/−8. Enfraquecido no
    dano só se a arma soma FOR (corpo a corpo, arremesso, propulsiva). Piso 1 no dano.
  - **Crítico**: dobra o ROLADO (dados, fixo e extras, precisão inclusa); deadly soma 1/2/3 dados
    por fora (até striking/greater/major); fatal troca os dados da arma pelo dado fatal (rolados
    de novo) e soma +1 dado fatal por fora. O app não sabe a CA do alvo: o cartão mostra acerto e
    crítico juntos (decisão do usuário).
  - **Efeitos do crítico além de deadly/fatal** (`critEffects.ts`): o Pathbuilder só exporta os
    NOMES das runas, então a tabela é escrita à mão (GM Core pg. 237-239). **Runa vale sempre** no
    crítico: Flaming = 1d10 persistente de fogo (2d10 Greater), Shock repete o dano elétrico ROLADO em
    até 2 criaturas, Corrosive dana a armadura/escudo, Frost e Thundering viram aviso com a CD. A
    **especialização crítica** vem do grupo
    da arma (`group` em `search?gear=`) e **a ficha decide se vale** (`specSourceFor`, lendo
    `build.specials` + classe, texto conferido na AON): Fighter com o grupo da arma nas
    características (o Pathbuilder lista "Hammer") e Swashbuckler valem sempre; Barbarian com
    Brutality vale em Fúria e corpo a corpo (`mods.rage`); Ranger vale contra a presa caçada — liga por
    padrão, com chip para desligar; Rogue (Weapon Tricks, ágil/acuidade, alvo desprevenido) e Bard são
    situacionais — chip desligado. Sem característica na ficha (Magus, Psychic) o chip nem aparece.
    Faca/Dardo/Besta = sangramento persistente (+ bônus de item), Pick = +2 por dado da arma; o resto
    vira aviso. Nada disso é
    dobrado; persistente e dano fora do alvo ficam na nota, não no total imediato. A nota do feed
    subiu de 200 para 500 caracteres nos DOIS sanitizadores (`tableRoll.ts` e `roll-store.js`).
  - **Rank do ✦ da arma**: o Pathbuilder exporta a CATEGORIA (`martial`), mas o guerreiro é Mestre
    no GRUPO. `weaponRank` faz a conta de volta (ataque − nível − atributo − potência) e usa o
    rank quando fecha num rank de verdade; senão, a categoria. O ✦ do Ghan Buri saía 2 acima.
  - **Dano extra é chip liga/desliga** (decisão do usuário), lembrado por arma no `localStorage`:
    runa de energia começa ligada, **precisão desligada** (Ataque Furtivo, Hunter's Edge são
    condicionais), e o dano extra de um perfil situacional (`magicWeapons.ts`) começa ligado — o
    perfil escolhido já É a situação dele.
  - Sem traços no AON (arma caseira), rola como corpo a corpo sem ágil, com aviso e um seletor
    FOR/DES. O título do cartão usa o nome base (`Warhammer`), não o do Pathbuilder com as runas.
  - **Magia**: o dano é o de `scaleSpell` no rank conjurado — o mesmo da linha e do drawer —, um
    chip por componente, porque às vezes somam e às vezes são alternativas (mesma fórmula com tipo
    diferente: só o primeiro começa ligado). `uncertain` não rola. **Persistente começa desligado e
    não dobra no crítico**: o 5d4 da Ignition só existe no sucesso crítico, e a prosa decide.
    Salvaguarda básica mostra os quatro graus (½ para baixo); a `defense` chega TRADUZIDA
    ("Reflexos básico"), por isso o regex casa as duas línguas. O bloco Mythic Magic já rola com a
    proficiência mítica e não oferece o ✦ (o ponto saiu ao conjurar).
- **Tratar Ferimentos e Battle Medicine** (`treatWounds.ts` + `CheckBody` do `RollDialog`): vivem DENTRO do diálogo de
  Medicina, como o "Usar como iniciativa", só com Medicina Treinado ou melhor. Regras conferidas na AON (Player Core
  pg. 242 e 253); os dois dividem a tabela de CD e cura (15/20/30/40, bônus +0/+10/+30/+50; sucesso 2d8, crítico 4d8,
  falha crítica 1d8 de **dano** sem bônus), a CD é escolha do jogador (a mais alta do rank vem marcada), e a rolagem
  faz teste E cura juntos (`treatWoundsRoll`, `TableRoll` com `check` + `free`), somando ao PV da mesa ("Em mim mesmo").
  - **Contabilidade de ações — a diferença que importa:** **Tratar Ferimentos é exploração de 10 minutos, NÃO gasta
    ação** e tira **Ferido** (sucesso e crítico; some o valor guardado em `conditions`). **Battle Medicine** (chip só com o
    talento) custa **1 ação** (`healActionCost`, `actions.spend(1, 'any')` ao rolar, com o aviso de falta de ações como
    no Golpe), **não tira Ferido** e deixa o alvo imune ao *seu* Battle Medicine por 1 dia — sem afetar o Tratar
    Ferimentos. A ação extra do Acelerado NÃO paga Battle Medicine (só Golpe/Andar).
  - Só no Tratar Ferimentos: "1 hora" dobra a cura (a parcela `free` leva o fixo ajustado para o total fechar, o
    sanitizador exige `dados + fixo = total`); **Risky Surgery** (talento) dá +2 de circunstância no teste, sucesso vira
    crítico e o paciente toma 1d8 cortante ANTES da cura (vai em `damage` da rolagem). Dano e cura entram numa escrita só
    de PV (`restoreHp`): duas escritas seguidas no hook partem do PV de antes do clique e se atropelariam.
  - **Só avisa, não automatiza**: imunidade do alvo (1 h, 10 min com Continual Recovery, 1 dia no Battle Medicine),
    Ward Medic (quantos alvos), kit de curandeiro. `check-rolls` cobre graus, ações, Ferido, dobro e Risky Surgery.
- **Iniciativa pela ficha**: no diálogo de Percepção, Furtividade, Atletismo ou Acrobacia o chip
  "Usar como iniciativa" (desligado por padrão, por rolagem) marca o `TableRoll` com `initiative`.
  A marca só sobrevive com um `check` de d20 — nos DOIS sanitizadores. A Iniciativa
  (`useInitiativeRolls` + `initiativeRolls.ts`) lê o feed e dá `setInitiative` ao PC de mesmo slug;
  cada rolagem vale UMA vez (ids tratados no `localStorage`), então o ajuste manual do GM depois não é
  desfeito. Escreve só no encontro local, nunca na mesa. Rolagem de até 10 min vale ao abrir a página
  ou ao PC entrar no encontro; mais velha é descartada. O `check-rolls` cobre.
  **Bônus de iniciativa** (`initiative.ts`): ao ligar o chip, o diálogo soma sozinho o que a ficha tem —
  Incredible Initiative (+2, qualquer perícia), Elven Instincts e Battlefield Surveyor (+2, só Percepção;
  o Elven Instincts também vence empate). São de circunstância e **não empilham**: vale o maior, e o memorial
  cita todas as fontes do mesmo +2. Scout's Warning de aliado e o Shadow Mark (que penaliza o ALVO) vão no ajuste livre.
- Descrições da AON são buscadas **sob demanda** ao tocar num item (`DescriptionDrawer` →
  `services/descriptions.ts`); a última ficha fica em `sessionStorage`. O cache tem uma camada em
  memória na frente do `localStorage` (como `gear.ts`): sem ela, cada render da aba de Magias
  refazia um `JSON.parse` por linha.

## Companheiros de combate (Animated Armor do Nathaniel)

Criaturas da AON que entram no encontro (e no mapa) sozinhas quando o personagem entra — **não** são os
`pets`/`familiars` do Pathbuilder (esses têm ficha própria na aba). Configuração do PERSONAGEM, da mesa:
campo `companions` (`companions.ts`, até 6, `{ id, name, token? }`), editado no `CompanionsCard` da aba
**Inventário** (no fim; a aba Companheiros continua só para pets/familiares do Pathbuilder). O jogador digita o nome EXATO da AON (se não achar, a busca
oferece os parecidos) e envia o token UMA vez.

- **O token é permanente**, pasta `tokens/` do bucket, como o do personagem. Por isso o `setTokenImage` da Iniciativa
  **nunca apaga** URL de `tokens/` ao trocar a imagem do cartão (antes apagaria), e o servidor já nunca apaga
  `tokens/` ao apagar um mapa.
- **Na Iniciativa** (`addWithCompanions`, `InitiativePage`): ao adicionar um PC — por qualquer aba do diálogo —,
  relê a ficha da mesa com `loadCharacter(slug, true)` (FORÇADO: a lista pode ter mudado depois da última leitura
  deste aparelho), busca cada criatura (`searchCreatures`, nome exato), monta o NPC com `npcFromCreature` e põe o
  `tokenImage`, o `companionOf` (slug do dono) e o `companionId`. Criatura que a AON não acha vira aviso, e o
  personagem entra do mesmo jeito. Entra na AON no nível base: escalar é à mão, pelo Escalar Monstro.
- **Enquadramento**: o círculo do token tem "Enquadrar" (o mesmo `TokenFitDialog` do mapa; centro + ampliação, `fit` no
  companheiro). O upload guarda a imagem INTEIRA (`NPC_TOKEN_MAX_SIDE`, sem recorte), e o enquadramento vai junto:
  `NpcCombatant.tokenFit` → descriptor `fit` em `tok:` → o mapa o usa como padrão, e o `fit:<id>` do Modo GM, se
  existir, vale POR CIMA (apagá-lo — "Centralizar" no mapa — devolve o enquadramento do companheiro). Imagem nova
  zera o enquadramento.
- **O token e o enquadramento são lidos da ficha quando o companheiro ENTRA — e relidos depois**: o jogador pode
  mexer neles com o encontro já montado. A Iniciativa (`refreshCompanions`) relê a ficha dos donos (`loadCharacter` forçado)
  ao ABRIR a página e no botão "Atualizar" do cabeçalho, e atualiza os companheiros que já estão no encontro
  (só estado LOCAL; o mapa acompanha pelo `useMapSync` — não é o laço "efeito lê a mesa e escreve na mesa"). Só
  sobrescreve o token se a ficha tem um, para não apagar a imagem que o GM pôs à mão no cartão. Não há push: sem a
  Iniciativa aberta ou o "Atualizar", a mudança na ficha não chega ao mapa.
- **Sem duplicar**: o reducer (`addCombatants`) descarta NPC cujo par `companionOf/companionId` já está no encontro —
  mesma trava dos PCs por slug. O enquadramento do token no mapa (Modo GM) continua valendo para eles.

## Módulo initiative-tracker (Iniciativa)

Gerenciador de turnos e combate em `/iniciativa`. A decisão que explica o módulo inteiro é **onde
cada fatia de estado mora**:

| Fatia | Onde vive |
| --- | --- |
| Combatentes, rodada, turno, durações, defesas | `useReducer` + `localStorage` (`pf2e:initiative:v1`) + nuvem (tabela `encounters`) |
| PV e condições de **personagem** | estado da mesa (Supabase), **as mesmas chaves da Ficha Virtual** |
| PV e condições de **monstro** | dentro do encontro (reducer) |
| Aflições e dano persistente de **personagem** | estado da mesa (`afflictions`, `persistent`) |
| Aflições e dano persistente de **monstro** | dentro do encontro (reducer) |

- **O encontro é do GM, o personagem é da mesa.** O dano que o GM aplicar num personagem aparece na Ficha Virtual
  de quem estiver jogando, e vice-versa. O dano em PC usa os campos `hp`/`conditions` que a Ficha Virtual já tinha, e
  **monstro nenhum entra no estado da mesa** — as fatias de monstro vivem inteiras no reducer, e viajam DENTRO do
  documento do encontro. De `table-store.js` o módulo só precisou de dois campos novos no `FIELD_RE`, `afflictions` e
  `persistent`.
- **O encontro vai para a nuvem** (`useEncounterCloud` + `services/encounters.ts` → `api/_lib/encounter-store.js`,
  tabela `encounters`, migration `encontros`): o GM monta no computador e abre no tablet. Um documento por (mesa,
  mapa) — `map_key` '' é o "Sem mapa" —, o mesmo `EncounterState` do `localStorage`, e a última escrita vence: quebrar
  em campos, como o mapa, só serviria a dois GMs editando juntos. Por isso, **dois GMs na mesma mesa veem o MESMO
  encontro** (antes cada aparelho tinha o seu). O `localStorage` continua sendo a primeira pintura e o encontro sem rede.
  - **Quem vence não depende de relógio de aparelho**: cada encontro guarda no `localStorage`
    (`pf2e:initiative:sync:<mapa>`, `EncounterSync`) o `updatedAt` da nuvem que este aparelho viu por último e se ele
    mexeu desde então. Nuvem vazia recebe o daqui; nuvem igual à vista + mexido sobe; nuvem mudou + não mexido baixa;
    **nuvem mudou E mexido**: baixa a da nuvem e o aviso oferece "Desfazer" com a daqui. O encontro guardado antes da
    nuvem não tem registro e conta como mexido — no primeiro aparelho que abrir, sobe; num segundo, cai no "Desfazer".
  - **A marca "igual à nuvem" é gravada junto do encontro** (`saveEncounter` dentro do hook, sem a junção de 300 ms da
    página): um recarregar no meio deixaria o `localStorage` com o encontro velho marcado como sincronizado, e ninguém
    mais o atualizaria. Foi bug, pego pelo teste com dois navegadores.
  - Sobe com 800 ms de junção (e na hora, ao esconder a aba). O aviso do banco leva só `{ map, updatedAt, by }` — um
    encontro grande passaria do tamanho de uma mensagem do Realtime —, e quem está com aquele encontro aberto o relê pela
    API. Edição daqui ainda na fila vence o aviso, como no estado da mesa. Medido: ~1 s do clique ao outro aparelho.
  - **O canal é um só, aberto no módulo e nunca fechado** (`listenEncounters`): sair e entrar no mesmo tópico em seguida
    (o StrictMode faz isso a cada montagem) devolvia o canal que estava saindo, e o aparelho parava de ouvir.
  - O servidor só confere forma e tamanho (256 KB, 80 combatentes); o conteúdo passa por `sanitizeEncounter`, o mesmo do
    `localStorage`. Apagar o mapa apaga o encontro dele (trigger), e o `writeEncounter` recusa mapa que não existe — o
    encontro de um mapa apagado continua neste aparelho e mostra "Não subiu". `appendCombatants` (o escalar monstro)
    marca o encontro como mexido, senão o monstro novo perderia para a nuvem.
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
- **Escudo** (`useShieldCatalog.ts`, `CombatantShield.tsx`, `NpcShieldDialog.tsx`): o do
  **personagem** é o da Ficha Virtual — `shieldItem` no combatente (sai do build em `pcFromBuild`)
  + números da AON na página + campo `shield` da mesa; o do **monstro** vive inteiro no encontro
  (`NpcShield`), lido da AON ou definido à mão. Encontro montado antes do escudo existir não tem o
  `shieldItem`: é preciso tirar e pôr o personagem de novo.
  - **Abaixa no handler de `passTurn`** para quem ENTRA no turno (Raise a Shield vale até o início
    do próximo turno de quem ergueu) — nunca num efeito, mesma razão das durações.
  - Bloqueio no cartão é um toggle ("Bloquear com escudo") que vale para o PRÓXIMO dano e desliga
    sozinho: é uma reação, gasta num golpe. No dano em lote é uma caixa por alvo, habilitada só
    para tipo físico (ou sem tipo). Em `computeDamage` o escudo entra **depois da resistência e
    antes dos temporários**; quem aplica refaz a conta por `view.blockDamage(blockFrom)` para
    gastar o escudo junto.
- **O que o app rola e o que não rola** (`dice.ts` é o único ponto que rola NESTE módulo): rolagem
  de quem está jogando continua com o jogador — que agora pode rolar pela Ficha Virtual e a
  Iniciativa VÊ pelo feed de rolagens, mas nada disso preenche o tracker sozinho: a iniciativa é
  digitada, e salvaguarda, salvaguarda de estágio e teste
  plano de dano persistente são informados pelo GM em botões. O app rola os dois danos que o RAW
  manda cair sem ninguém pedir: o do **estágio de uma aflição** e o **persistente do fim do turno**.
  Pedir esses dois ao GM seria um clique por turno por combatente afligido, que é o trabalho que o
  módulo existe para tirar da mesa. Em troca, **toda aplicação automática traz o memorial da rolagem
  e um "Desfazer"** (`AutoDamage` em `useCombatantViews.ts`, com aviso próprio no topo — o dano
  automático e a queda a 0 PV caem no mesmo handler e disputando um Snackbar só um seria lido).

## Módulo battle-map (Mapa de Combate)

VTT em `/mapa/:id?`. Sem id na URL abre o mapa para onde a mesa está (`pf2e:maps:active`, um por mesa — ver "Mesas").

- **Exclusivamente desktop** (decisão do usuário): a regra dos 320px da seção de Responsividade
  NÃO vale para este módulo. Não gaste esforço com layout de celular aqui; o que já existe de toque
  (pinça, alvos maiores) fica, mas não é requisito.

- **Desempenho molda o `MapCanvas` inteiro.** Um único "mundo" com uma `transform` CSS: pan, zoom
  e pinça escrevem a transformação **direto no DOM, num `requestAnimationFrame`** — nenhum render
  React durante o gesto (o rótulo "80%" só atualiza quando o gesto para). Arrastar token move o
  elemento pelo ref e só no soltar vira escrita. Grid é **um `<svg>` com `<pattern>`**, nunca um
  elemento por quadrado. Medido: 40 tokens sobre imagem de 4096 px, pan e zoom a 60 fps e zero
  mutação de DOM nos tokens durante o gesto. Não troque por estado React "porque é mais simples".
  - `will-change: transform` **só durante o gesto**: ligado o tempo todo, o navegador congela a
    rasterização na escala inicial e o mapa fica borrado ao aproximar.
  - O efeito de limpeza **zera** `frame`/`settle` além de cancelar: no StrictMode o efeito
    desmonta e remonta, e um `frame` cancelado mas não zerado fazia `schedule` nunca mais pedir
    quadro — o mapa abria sem transformação nenhuma. Já foi bug.
  - Rótulo da régua fica FORA do mundo (tamanho fixo em qualquer zoom); a linha fica dentro, com
    `vector-effect: non-scaling-stroke`.
- **Barra de PV acima de TODO token** (depois o nome, depois o círculo). Por isso o token é
  posicionado por `left/top` e não `transform`, e a opacidade do derrotado vai nas peças e não no
  contêiner: os dois criariam um contexto de empilhamento por token, e o token de baixo cobriria a
  barra do de cima — foi o que aconteceu na primeira versão.
- **O grid cobre só a imagem** depois de dimensionada (arredondada a quadrados inteiros, com folga
  de ¼ para um desalinhamento mínimo não ganhar uma coluna). Na camada do mapa volta a área
  inteira, que mostra até onde a imagem pode crescer. Sem imagem, a área padrão de 40×30.
- **Mundo em quadrados**, pixel só no desenho (`CELL_PX = 70`). Quadrado = 5 ft / 1,5 m, e a régua
  usa as diagonais alternadas do Player Core (`squaresBetween`: 5-10-5). Token de tamanho N ocupa
  N×N (`sizeSquares`; Minúsculo ocupa 1, para não ficar menor que o dedo) e encaixa nas LINHAS do
  grid (`snapToken` usa o centro do token, não o canto).
- **Uma linha por campo, campos com donos diferentes** (`map-store.js`, tabela `map_fields`, migration `mapas`):
  `tok:<id>` (o que o token É — só a Iniciativa escreve), `pos:<id>` (onde ESTÁ — só o mapa escreve), `hp:<id>` (PV do
  monstro — os dois). Num campo só, o GM renomeando um goblin devolveria o goblin ao quadrado de antes do arrasto. O
  `tokenId` é o id do combatente. `private` é coluna de `maps`; o mapa ativo é `mesas.active_map_id`.
- **Sincronia é em tempo real** (`services/maps.ts`; antes era poll, e a mesa passou a usar o Supabase — decisão do
  usuário). Toda escrita é uma função do banco (`map_write`, `map_clear_drawings`, `map_set_private`) que sobe a
  revisão e grava numa transação; um trigger transmite cada campo MUDADO no canal privado `mesa:<mesa>:map:<id>` (evento
  `field`, com valor e a revisão daquela escrita; `private` quando esconde ou revela). A lista e o mapa ativo vão pelo
  `mesa:<mesa>:maps` (`changed`, que o `MapListDrawer` assina), e o PV/token/tamanho dos PCs chega pelo canal do
  estado da mesa (`onStateChange` do `tableState`). O mapa inteiro só desce na abertura e a cada (re)conexão
  (`read_map`: uma consulta, coerente, já com os PCs). Medido com o `maps.ts` real: token movido em outro aparelho
  na tela junto com a resposta do POST; zero polls em 6 s com o canal aberto.
  - **As travas do cliente**, todas necessárias: transmissão com revisão ≤ a da última leitura inteira ou ≤ a do
    campo (`fieldRev`, que a resposta do próprio POST também alimenta) é descartada — o eco atrasado de dois arrastos
    seguidos devolveria o token ao quadrado anterior; campo ainda na fila ou sobreposto (`overrides`) não é tocado; e
    uma leitura inteira que saiu ANTES de uma transmissão e chegou depois não a desfaz (`recent`, reaplicado por cima).
  - **Campo igual não é regravado nem transmitido** (o `map_write` compara no banco), e o `syncTokens` não sobe a
    revisão quando nada mudou — com `sameJson` (`api/_lib/json.js`), porque o `jsonb` reordena as chaves e o
    `JSON.stringify` acusaria mudança em toda sincronia da Iniciativa.
  - Mapa privado: o servidor não o entrega a quem não pede como GM, como antes; o canal do mapa é o de qualquer
    membro da mesa — sem login de verdade, "GM" é interface (o `gm=1` de antes também era).
- **Poll de reserva, sem canal** (sem Supabase, rede ruim): o de antes. `?mapRev=` lê os contadores numa consulta
  (`map_revs`: rev do mapa, a escrita mais recente no estado da mesa, mapa ativo). O cliente manda junto o que já
  tem (`&rev=&tableRev=`) e, se mudou, **o mapa vem na mesma resposta**.
  - Três marchas: **rajada de 700 ms por 5 s** depois de qualquer mudança (daqui ou de fora — na
    mesa uma ação puxa a seguinte), 1,5 s com atividade no último minuto, 2 s parado, **nada com a
    aba oculta**. Rolagem ou regra compartilhada nova (`onFeedActivity`, de `services/rolls.ts`) também conta
    como atividade — põe na marcha de 1,5 s, sem rajada e sem baixar o mapa —, senão quem estava no
    mapa via o cartão até 4 s depois de quem estava na ficha. O parado era 4 s e caiu para 2 s porque
    a mesa joga 1–2 vezes por mês e a cota tem folga (decisão do usuário).
  - Rolagem, token solto e ping sobem **na hora** (`writeMapField(…, { now: true })`), sem os
    150 ms de junção. Por isso as escritas saem **uma por vez** (`flushing`): dois arrastos
    seguidos em dois pedidos simultâneos podiam chegar invertidos e o servidor ficar com a posição
    de antes.
- **Token de outro aparelho desliza** até o quadrado novo (`TOKEN_GLIDE` no `MapCanvas`, 240 ms em
  `left/top`) em vez de saltar — a posição chega de uma vez pela transmissão. Quem arrasta não vê o
  deslize (`data-dragging`, devolvido um quadro depois do encaixe), e movimento reduzido não desliza.
- **Escrita otimista com override**: o campo escrito fica sobreposto até a escrita voltar, para uma
  transmissão ou um poll que cheguem no meio não devolverem o token ao quadrado de antes. O PV de PC mexido no mapa vai
  para o MESMO campo `hp` da mesa (`saveField`); como o `tableState` sobe com 600 ms de debounce,
  o override dele dura 5 s.
- **O mapa não cria token.** Quem está no mapa é o encontro da Iniciativa ligado a ele; o mapa
  posiciona, move e aplica dano. Token novo nasce no primeiro quadrado livre da faixa de cima
  (`freeSpot`, no servidor, que é quem conhece as posições de todo mundo).
- **Quem vê número**: PC sempre; monstro só a barra, com "Ferido/Muito ferido…" no popover, e os
  números no Modo GM. O Modo GM é só interface (sem senha — "todos podem tudo", decisão do usuário)
  e mostra também a camada do mapa (enviar e dimensionar a imagem) e criar/apagar/ativar mapas.
- **Mapas privados** (decisão do usuário): mapa novo **nasce privado** e só o Modo GM o vê, até ser
  revelado (olho na lista, ou "Revelar à mesa" no aviso do próprio mapa). Mapa antigo, sem o
  campo, é público.
  - **O servidor não entrega** o privado a quem não manda `gm=1` (`?maps=`, `?map=`, `?mapRev=`):
    nem nome, nem imagem, nem tokens. Continua sem senha — quem liga o Modo GM vê, como o resto.
  - Campo **`private` à parte do `meta`**, fora do `FIELD_RE` (só `map-visibility` mexe): o cliente
    regrava o `meta` inteiro com a cópia que tem (imagem, alinhamento, nome), e um ajuste logo
    depois de revelar esconderia o mapa de novo.
  - **"Levar a mesa" revela junto** (`map-activate`), e esconder o mapa onde a mesa está tira a
    mesa dele — o `activeId` nunca aponta para um privado. `setMapPrivate` não sobe a revisão
    quando nada muda, senão cada "Levar a mesa" faria todo aparelho rebaixar o mapa.
  - Quem está num privado vê "Mapa ainda não revelado" e continua no poll: o 403 do `?map=` traz
    `rev`/`tableRev` (`hiddenRevs` no cliente), então a espera segue custando só o MGET, e o
    `?mapRev=` responde `hidden: true` quando o GM esconde o mapa com alguém olhando.
  - O acesso GM é **por entrada** do store (`useMapData(id, gm)`): trocar o Modo GM recarrega o
    mapa. A **Iniciativa sempre lê como GM** (`useMapSync`, `EncounterMapPicker`, com "· privado")
    — é lá que se monta o encontro do mapa escondido.
- A imagem do mapa supõe **70 px por quadrado** ao chegar (padrão do Roll20); o GM ajusta pelas
  quatro alças (proporção travada, canto oposto parado) ou digitando largura/altura em quadrados.
  As alças têm **36 px na tela em qualquer zoom** (`--inv-zoom`, escrita no `apply`): presas à
  escala do mundo, a 40% viravam um alvo de 11 px. Entrar na camada do mapa reenquadra com folga
  (`fit(0.6)`), senão as alças de baixo caíam sob o painel e o zoom, e o grid não some no zoom
  baixo ali — é a régua do alinhamento. Toda imagem é reduzida no navegador antes
  de subir (`shrinkImage`: mapa ≤ 4096 px, token 256 px recortado no centro). Safari não codifica
  WebP e devolve PNG calado — aí cai para JPEG.
- **Desenhos** (`drawing.ts`, `DrawingLayer.tsx`, `DrawPanel.tsx`, ferramenta Desenhar — para
  todos, não só o GM: quem conjura a Wall of Fire é o jogador). Livre, Linha (pontas encaixam a
  cada ½ quadrado e o rótulo mostra o comprimento) e Apagar (um desenho por vez). No modo
  Apagar cada desenho ganha um **×** vermelho no início do traço, e o traço inteiro vira alvo com
  28 px a mais de folga — os dois em px de TELA (`--inv-zoom`). Na primeira versão o alvo era o
  traço na escala do mundo: com zoom baixo virava 2–3 px, e a impressão era de que só existia o
  "Limpar todos".
  - **Um campo `drw:<id>` por desenho**, como `pos:<id>`: apagar um não toca nos outros e dois
    desenhando ao mesmo tempo não se sobrescrevem. Teto de 300 por mapa; "Limpar todos" (Modo
    GM) é uma ação própria, `map-clear-drawings`, que também tira os desenhos da fila de subida.
  - Pontos em QUADRADOS, simplificados por Ramer–Douglas–Peucker (tolerância 0,04 quadrado) antes
    de gravar: um traço chega com um ponto por evento de ponteiro, e sem isso estouraria o campo
    de 8 KB. Traço longo demais afrouxa a tolerância em vez de ser cortado.
  - Camada entre o grid e os tokens (o efeito fica sob as criaturas), memoizada à parte. A
    transparência vai no traço com `strokeOpacity`; o traço provisório do arrasto é desenhado pelo
    DOM, como o token arrastado, e só sai depois de o desenho de verdade entrar no estado.
  - Dois dedos (pinça) e o botão do meio do mouse movem o mapa em qualquer ferramenta — no
    Desenhar o arrasto de um dedo é o traço.
- **Áreas de efeito** (`areas.ts`, `AreaPanel.tsx`, ferramenta Área — para todos): explosão,
  emanação, cone e linha. **São CONSULTA, como a régua** (decisão do usuário): a área aparece só
  para quem mede, fica parada depois do clique (`areaPinned`) até o próximo clique ou a troca de
  ferramenta, e **nunca é gravada**. A primeira versão gravava cada área num `drw:` e o usuário
  não queria isso — áreas gravadas nessa época ainda são desenhadas pelo `DrawingLayer` (ramo
  `type: 'area'`) e saem pelo Apagar/Limpar do Desenhar.
  - Distância é a da régua (5-10-5) **contando o próprio quadrado**, como uma criatura andando até
    ele. É o que dá os moldes do livro: explosão de 5/10/15/20 ft = 4/12/24/44 quadrados; emanação
    de 5 ft num Médio = 3×3. Explosão e cone saem de um CRUZAMENTO do grid; a linha, de qualquer
    ponto de ½ em ½, com 5 ft de largura — no empate (linha correndo sobre uma linha do grid) fica
    um lado só, senão teria 10 ft.
  - Cone = 90° encaixado em 45° (reto ou diagonal); o diagonal é exatamente ¼ da explosão. O reto é
    aproximação pelo ângulo, como fazem os VTTs.
  - A prévia conta as criaturas cuja pegada toca a área ("Explosão 20 ft · 3 criaturas"), sem a
    que emana. Explosão e emanação seguem o mouse antes do clique; cone e linha precisam de
    arrasto para ter direção (clique seco só limpa a anterior).
  - Os × do Apagar do Desenhar ficam numa camada ACIMA dos tokens (`EraseBadgeLayer`), e apagando
    os tokens deixam o clique passar (`[data-erasing]`): na camada dos desenhos, o × caía embaixo
    de um token e o clique ia para ele — foi bug.
- **Alcance de movimento**: ao arrastar um token com `speed`, três anéis (1, 2 e 3 Andares, pela
  mesma distância 5-10-5) calculados UMA vez no início do arrasto, e o rótulo diz "2 ações" ou
  "fora de alcance". Não sabe de terreno difícil, paredes nem condições (Lento, Imobilizado).
  - O `speed` vem do combatente da Iniciativa. **Personagem: `attributes.speed + max(0,
    speedBonus)` — nunca reduzido** (`pcSpeed` em `importCharacter.ts`, decisão do usuário): o
    `speedBonus` do Pathbuilder embute a penalidade da armadura pesada, e o Ghan Buri (25, −10 da
    Hero's Plate) anda 25 na mesa. Bônus positivos (Fleet, bárbaro) somam. Monstro: `land` da AON,
    ou o maior deslocamento de quem só voa (`creatureSpeed`). A Ficha Virtual ainda soma o
    `speedBonus` inteiro na Visão Geral.
  - Combatente importado antes do campo não tem `speed`: tirar e pôr de novo no encontro.
- **Ping** (clique duplo, qualquer ferramenta, menos sobre token — lá o clique abre o painel de
  dano). Foi Alt+clique na primeira versão: ninguém achava a dica nem sabia a tecla, e segurar o
  clique brigaria com o início do arrasto, da régua e do traço. Campo `ping:<id>` que quem pingou apaga em 6 s. Quem
  recebe decide se pisca **pelo id, não pelo relógio** (`PingLayer`): o que já existia quando o
  mapa abriu conta como visto. Chega aos outros pela transmissão do campo, como qualquer escrita. (Um ping sem
  passar pelo banco — Broadcast entre aparelhos — exige liberar a transmissão pelos clientes no RLS do Realtime: fica
  para depois, junto da prévia do arrasto ao vivo.)
- **Rolador de dados** (`dice.ts`, `DicePanel.tsx`, `motion/DiceTray.tsx`): botão
  "Dados" na barra, **fora** do seletor de ferramentas — abre um painel sem trocar a ferramenta ativa,
  para rolar com a régua na mão. d4–d100, 1–**100** dados, bônus ±999, cor de `DRAW_COLORS`. O
  sorteio é `rollGroups` (`src/dice/roll.ts`), sem piso: `1d20−2` pode dar negativo.
  - **A rolagem vai para o feed da mesa** (`postRoll`), o mesmo das rolagens da Ficha Virtual, e
    aparece pelo `RollFeedLayer` do layout em qualquer página. O campo `roll:<id>` do mapa e o
    `DiceResultLayer` eram o caminho antigo; o `roll:` continua no `FIELD_RE`, sem quem o escreva.
    Sem nome (não há login), vale o campo livre do painel.
  - **`DiceTray` não reusa `DiceRoll`** (que é do diálogo de poção): aquele re-renderiza o React ~14×/s
    por dado. Aqui giro e estouro são CSS com `animation-delay` por dado, e o número que passa durante
    o giro é UM `requestAnimationFrame` escrevendo `textContent` — só os 24 primeiros dados trocam de
    número. Total da animação ≤ ~1,3 s em qualquer quantidade. A camada fica fora do "mundo" do mapa.
- **Enquadrar a imagem do token** (Modo GM — `tokenFit.ts`, `TokenFitDialog.tsx`, `TokenFitEditor.tsx`): no popover
  do token com imagem, "Enquadrar a imagem" abre um diálogo onde o GM arrasta a imagem para escolher o ponto que
  fica no CENTRO do círculo e ajusta a ampliação (1–4×). A imagem inteira aparece esmaecida atrás, para ver o que
  fica de fora; "Centralizar" volta ao padrão e há um "aplicar às cópias com a mesma imagem".
  - **É escolha de exibição, não do que o token É**: mora num campo próprio do mapa, `fit:<id>` (`{ x, y, z }`,
    frações da imagem + ampliação), escrito pelo MAPA como o `pos:` — a Iniciativa (dona do `tok:`) nunca o
    toca, e sobrevive a renomear. Sai junto do token em `syncTokens`. O padrão (centro, 1×) APAGA o campo.
  - **O mesmo diálogo envia a imagem** (só monstro): "Enviar outra imagem" sobe a imagem inteira para `monsters/` e
    ela vale POR CIMA da que a Iniciativa mandou — grava-se em `fit:<id>.url`, nunca em `tok:` (da Iniciativa, que
    reescreveria na próxima sincronia). "Usar a imagem original" a tira. Imagem nova zera o enquadramento (o de
    antes era para a outra). O que sobe e não é salvo é apagado do armazenamento ao cancelar; a imagem própria que ficou
    para trás também, se nenhum outro token a mostra. No servidor, o `deleteMap` apaga as dos `fit:` e o
    `syncTokens` registra a do token que saiu em `imgs`, para não ficar órfã. Monstro sem imagem também abre o diálogo.
  - **Por isso o envio da imagem do monstro deixou de recortar no centro**: `NPC_TOKEN_MAX_SIDE` (512) guarda a
    imagem INTEIRA, e o recorte é só no render (`Token` mede a proporção no `onLoad` e usa `fitStyle`; antes de
    medir, o `cover` de sempre). Tokens enviados antes continuam quadrados 256 px — o ajuste funciona nelas só
    com ampliação, porque o recorte já foi feito; reenviar a imagem recupera o resto. Token de PC (Ficha Virtual)
    segue quadrado, mas aceita o enquadramento também.
  - Geometria em `fitStyle`/`clampFit`: o ponto escolhido nunca deixa um canto do círculo sem imagem. O `Token`
    recebe `fitX/fitY/fitZ` como números soltos (não um objeto), para o `memo` não repintar todo token a cada poll.
- **Vida de cada imagem, pela pasta no bucket** (`ImageFolder` em `services/images.ts`):
  `tokens/` é token de PERSONAGEM, permanente (campo `token` da mesa, enviado na Ficha Virtual pelo
  `TokenAvatar`); `maps/` e `monsters/` são do mapa e somem quando ele é apagado. A trava mora no
  servidor (`isMapOwnedImage`): apagar um mapa nunca apaga nada de `tokens/`, mesmo que uma URL de
  lá apareça por engano na lista.
  - O mapa guarda em `imgs` TODA imagem de monstro que já passou por ele (`syncTokens` acrescenta,
    nunca tira). Sem isso, o monstro que saiu do encontro antes de o mapa ser apagado levava a
    referência junto e a imagem ficava órfã no armazenamento.
  - Imagem de monstro só com o encontro ligado a um mapa: sem mapa ela não teria dono nem hora de
    ser apagada, então o item do menu fica desabilitado ("escolha um mapa").
  - Erro de envio aparece com o motivo (`ImageError` / `imageErrorText`, com a mensagem crua do
    Storage). A primeira versão engolia o erro e o envio "não fazia nada".
  - `shrinkImage` tenta `createImageBitmap` e cai para `<img>` + `decode()` quando o navegador o
    recusa (PNG enorme no Safari, perfil de cor exótico).
- A página sangra até a borda desfazendo o padding do `MainLayout`; barra e avisos ficam numa
  coluna só porque a barra quebra em duas linhas no celular.

- **Tela dividida: mapa + ficha** (`components/SheetPanel.tsx`, `sheetChoice.ts`): painel de ~420px à
  direita com a Ficha Virtual em modo `compact` (acordeão do celular, qualquer que seja a janela). Aberto
  ou recolhido e o personagem escolhido ficam no `localStorage` (`pf2e:map:sheet-open`, `pf2e:map:sheet`) —
  **chaves próprias**: `pf2e:viewer:lastBuild/lastPublished` são da Ficha Virtual e colidiriam. O
  popover do token de PC tem "Ver ficha". A ficha é `React.lazy` (chunk `CharacterSheetView`), só baixa
  com o painel aberto.
  - **O corpo da ficha é `CharacterSheetView`** (character-viewer), usado pela página e pelo painel; a
    página ficou só com upload, publicação e restore. Recebe o `usePublication()` de quem hospeda.
  - **Overlays presos ao painel** (`embedContext.ts`): `EmbedContext` leva o elemento do painel;
    `DescriptionDrawer`, `RollDialog` e os demais diálogos (`EmbedDialog`) viram `position: absolute` dentro
    dele, sem trava de foco — o mapa segue usável. Diálogo novo na ficha usa `EmbedDialog`, não `Dialog`.
    O cartão de rolagem do feed continua `fixed` por cima de tudo.
  - **O seletor de personagem mostra o token** (`TokenBadge`, só leitura, lê o campo `token` da mesa — o mesmo que o
    `TokenAvatar` grava): sem personagem escolhido o painel é uma **grade de cartões** (token, nome, classe e nível);
    escolhido, o cabeçalho é um `Select` com o token e o nome, e cada item do menu traz token, nome e "Classe · nível".
    Quem ainda não enviou token aparece com as iniciais. Nível vem de `usePublishedSheets().levelOf`.
  - **A gaveta de descrição ocupa a largura do painel** quando embutida (`DescriptionDrawer`: `width: 100%`,
    `maxHeight: 88%`, sobe de baixo): os 520 px do desktop vazavam para fora do painel de 420 px e cortavam o texto.
  - **Menu lateral some em `/mapa`** (`MainLayout`): sem sidebar, AppBar nem padding; o botão dourado
    "Menu", primeiro item da barra do mapa, abre a gaveta temporária (o layout entrega `openMenu` pelo `<Outlet context>`,
    lido por `useLayoutMenu`). Os itens da navegação são `<Link>` de verdade (botão direito e Ctrl/⌘+clique funcionam):
    não volte a usar `onClick` + `navigate`. O `MapCanvas` tem `ResizeObserver`: câmera intocada reenquadra, câmera
    mexida mantém o centro.

### Ligação com a Iniciativa

- **Um encontro por mapa** (`encounterStorage.ts`): chave `pf2e:initiative:v1:map:<id>`, e a
  chave antiga é o encontro "Sem mapa". O mapa aberto na Iniciativa fica em `pf2e:initiative:map`
  e é para onde o `appendCombatants` do escalar monstro manda. Trocar no `EncounterMapPicker`
  grava o encontro atual e hidrata o do outro mapa.
- **`useMapSync`**: manda a lista INTEIRA de combatentes (com `size`, `tokenImage`, derrotado) e o
  turno ativo, com debounce de 400 ms — o servidor cria, mantém e apaga os tokens. Do PV de
  monstro sobe só o que mudou desde o último envio (`lastHp`).
  - É um efeito, e pode ser: lê só o estado LOCAL e escreve só no mapa. O laço que a seção da
    Iniciativa proíbe é o de efeito que lê a mesa e escreve na mesa.
  - **Volta do PV**: o que o mapa traz diferente do último valor enviado/recebido vira
    `npcSetVitals`. Na ABERTURA o mapa vence (tudo daqui já tinha subido; o que difere foi dano no
    token com a Iniciativa fechada). Enquanto há envio pendente ou a revisão lida é mais velha que
    a da última escrita (`waitRev`), não desce nada — senão um poll atrasado desfazia o dano que o
    GM acabou de dar.
- **Ordem de turnos no mapa** (`components/TurnOrder.tsx`): lista só de leitura no canto superior esquerdo (nomes, número,
  turno ativo em destaque, derrotado riscado; recolhe, `pf2e:map:turns-open`). A ordem viaja como `order` (índice em
  `combatants`) dentro do `tok:<id>` — o mapa guarda os tokens num dicionário e perderia a sequência —, e o turno ativo é o
  `turn` que já existia. Sem campo novo no servidor. Mapa sincronizado antes do campo mostra os tokens por nome até a
  Iniciativa sincronizar de novo.
- `CombatantBase.size` (inglês, da AON/Pathbuilder) vira a pegada do token; Ghan Buri é Large,
  2×2. O **monstro digitado à mão** escolhe o tamanho na aba "Monstro" do "Adicionar combatente"
  (`CREATURE_SIZES` em `battle-map/geometry.ts`: os seis do Player Core, com o espaço de cada um),
  gravado no mesmo formato da AON — os dois caminhos chegam iguais ao mapa.
- **Minúsculo ocupa 1 quadrado mas é desenhado menor** (`tiny` no `tok:`): a Iniciativa marca a
  criatura que É minúscula (`isTinySize`, no `useMapSync`), da AON ou digitada; o Shrink de um
  personagem continua sendo aplicado só no cliente, por `withPcSizes`. `NpcCombatant.tokenImage`: trocar a imagem de um monstro troca a das cópias dele que tinham
  a antiga (ou nenhuma), e a antiga só sai do armazenamento se ninguém mais a usa.

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
  - **A marcação do AON muda.** As tabelas passaram a sair como `<table class="inner">`, e o regex
    `/<table>/` literal deixou de casar com TODAS as dez de uma vez — o script morria em "Sem tabela
    para: …". Falha barulhenta, felizmente; o `<table[^>]*>` de hoje é a correção. Se o script
    reclamar de todas as tabelas ao mesmo tempo, suspeite da marcação antes da rede.
- **A regra que explica o motor** (`scaling.ts`): preserva-se a **diferença** em relação ao
  benchmark, nunca o benchmark cru. Criaturas publicadas são feitas à mão e não batem com a tabela;
  trocar o número pelo da tabela apagaria a personalidade do monstro e faria reescalar para o
  **próprio nível** devolver uma ficha diferente da original.
- **A origem usa o degrau da AON, o destino usa o degrau escolhido.** Usar o escolhido dos dois
  lados faz o ajuste fino **não fazer nada**: as colunas sobem quase em paralelo e a diferença se
  cancela. Foi bug real, e o painel parecia funcionar.
- **PV usa razão, não diferença** (cresce quase geometricamente: 9 no nível -1, ~500 no 24).
  **Dano** pega os dados da tabela do nível-alvo e deixa o modificador fixo absorver o desvio.
- **O que NÃO é reescalado, por decisão de produto**: a prosa das habilidades (fica em inglês; só
  as CDs e as fórmulas de dano dentro dela mudam — ver abaixo), a lista de magias (só a CD e o
  ataque mudam) e o dano extra dos golpes (`plus 2d6 fire`, que fica no `riders` do golpe e não na
  prosa). Tudo isso vira `warnings`, exibidos na página. A ferramenta **nunca inventa um número que
  o GM não conferiu** — mesma política de `creature-core.js`.
- **As CDs escritas na prosa** (`abilityDc.ts`) são a exceção: a CD de conjuração vinha estruturada
  do índice, mas a de "Breath Weapon … (DC 36 basic Reflex save)" só existe como texto — e 82% das
  criaturas do índice têm pelo menos uma. Deixá-la intacta entregava um monstro de nível 16 pedindo
  a salvaguarda de um de nível 3, que é o número que mais importa na mesa depois da CA. Reescalar é
  só trocar os dígitos; o resto da prosa continua intocado.
  - Benchmark é o de **CD de magia** (`SPELL_DC_TABLE`, derivado do `SPELL_TABLE` gerado): o GM Core
    manda usá-lo para qualquer efeito da criatura que peça salvaguarda, não só para as magias.
  - **Teste plano nunca escala**: "DC 15 flat check" é CD fixa do sistema. E o `\b` depois do `\d+`
    no regex não é enfeite — sem ele o motor faz backtracking, casa só o "1" de "DC 15 flat check"
    (o lookahead passa, porque sobra "5 flat check") e a CD do teste plano viraria 275.
  - Agrupadas **por valor**, não por ocorrência: nenhuma criatura da amostra passa de quatro CDs
    distintas, e CDs iguais são iguais de propósito (a Breath Weapon e a Frightful Presence de um
    dragão saem do mesmo benchmark, então têm que continuar iguais depois da escala).
  - Quando a CD do texto é a mesma que o índice publicou em `spell_dc`, o degrau vem de lá em vez de
    ser deduzido — senão o bloco de conjuração e a prosa andariam por caminhos diferentes.
- **O dano escrito na prosa** (`abilityDamage.ts`) segue a mesma ideia, pela tabela de **Dano em
  Área** (GM Core pg. 124, `AREA_DAMAGE_TABLE`), cujas colunas não são degraus: **uso ilimitado** (à
  vontade) e **uso limitado** — a baforada de dragão é o exemplo que o livro dá do segundo. Sem
  isso, um dragão levado para o nível 24 saía com CA, CD e golpes de nível 24 e uma baforada de
  nível 14.
  - **Aqui é RAZÃO, não diferença** — ao contrário do dano dos golpes. `shiftDamage` troca os dados
    pelos do nível-alvo e joga o desvio no modificador fixo, o que só funciona porque todo golpe fica
    perto do benchmark. Na prosa convivem a baforada (que É o benchmark) e o `1d6` persistente de
    uma aura, e a mesma conta aplicada ao segundo devolvia fórmulas como `6d8-19`. Multiplicando a
    fórmula pela razão entre os benchmarks, cada dano cresce na própria escala — mesmo raciocínio do
    PV.
  - **Só vira dano o que tem um TIPO ao lado ou a palavra `damage`**, a mesma regra de
    `initiative-tracker/dice.ts` (de onde vem a lista de tipos). Sem ela, o "1d4 rounds" da recarga
    da baforada entraria na conta. Dano fixo sem dado ("takes 3 fire damage") fica de fora: a tabela
    do livro é toda em dados.
  - A escala confere com o livro nos dois sentidos: a baforada 15d6 do Adult Red Dragon (nível 14)
    vira 18d6 no 17, 25d6 no 24 e 9d6 no 8 — exatamente as linhas de uso limitado da tabela.
- **`ScaleOverrides` fala duas línguas** (`BenchColumn = ScaleColumn | AreaColumn`), porque a linha
  de dano em área não tem degrau. Por isso `pick()` valida o degrau escolhido contra as colunas
  DAQUELA linha: os overrides viajam para o cartão da Iniciativa e voltam do `localStorage`, então
  um ajuste guardado antes pode chegar com "Extremo" numa linha cujas colunas são
  "Ilimitado"/"Limitado". Degrau inválido é ignorado, não quebra a ficha.
- **`scripts/check-scaling.mjs` é o teste que vale**: contra criaturas de verdade, confere
  identidade (mesmo nível devolve a ficha original: números, prosa caractere por caractere e a
  conjuração inteira — blocos, ranks, magias e os slots que o índice declara),
  monotonia (inclusive a das CDs e a do dano da prosa, e que a CD do teste plano NÃO se move), ida e
  volta, e que o ajuste fino ajusta. Não há framework de teste no repositório, por isso é script avulso. A ida e volta existe
  porque a identidade não prova nada sobre o dano, que tem saída curta quando os níveis são iguais.
- **Conjuração** (`spellcasting.ts`): antes só a CD e o ataque mudavam de nível, e um dragão levado
  para o 24 continuava com o cardápio de magias do 14. A regra é o GM Core pg. 122: o rank mais alto
  é **metade do nível arredondada para cima**, cinco truques, e os slots por rank saem do nível ser
  par (3 no topo) ou ímpar (2 no topo), com 3 em cada rank inferior.
  - **A escada anda inteira**, preservando a forma — a mesma ideia de `scaling.ts`. O modo fica no
    ajuste fino, uma linha por bloco: em **Acompanham**, todo grupo anda o mesmo tanto que o rank
    máximo do nível andou, e os ranks que abrem são os de BAIXO; em **Originais**, cada magia fica
    onde estava e os que abrem são os de CIMA. Magia inata, pelo RAW, não é limitada por nível, então
    os dois são legítimos e quem decide é o GM.
  - **O truque anda nos dois modos**, e é o único: truque é conjurado no rank de quem conjura,
    sempre. Ele anda preservando a DIFERENÇA, e a diferença existe: o Mitflit é nível -1 com truque
    de 1º e inata de 2º, e a Sacuishu é nível 9 (teto 5º) com "Cantrips (4th)". Mandar o truque para
    o teto do nível, ou para o topo do bloco, reescrevia a ficha desses dois no PRÓPRIO nível.
  - **Só abre o rank que o nível abriu.** Completar a escada de 1 até o topo parecia óbvio e
    reescrevia fichas publicadas: o Elder Child of Belcorra é nível 9 e conjura do 2º ao 4º; o
    Fortune Archdragon é nível 23 e tem UM grupo, de 10º. O próprio livro diz que não é preciso
    preencher todo slot (pg. 122).
  - **A contagem de slots preserva o desvio da ficha**, como todo número do módulo. A Ryta tem 4
    slots de 1º rank no nível 4 — a opção generosa do livro — e continua com quatro; ninguém precisa
    escolher "a opção generosa" num menu. Em espontânea o número vem escrito na ÚLTIMA magia do rank
    ("Ventriloquism (4 slots)") e é do GRUPO, não da magia; em preparada, o número de magias
    preparadas É o número de slots (com `×2` valendo dois).
  - **Ritual fica intocado** (conjurado de um livro, em downtime — pg. 123) e é o único bloco sem
    linha no ajuste fino.
  - **A mesma magia pode entrar várias vezes**, que é como se preenchem três slots de 3º com
    Fireball duas vezes e Haste uma. A contagem é a notação do próprio índice (`Fear (2)`,
    `Charm (×3)`) e é um TOKEN da anotação, não a anotação inteira — o Wyrmwraith escreve
    "Charm (×3; undead targets only)" e o Horned Archon põe a contagem no fim, em
    "Charm (animals only; x3)". Repetir só faz sentido em **preparada** (slots) e em **inata**
    (vezes por dia): no repertório de uma espontânea, saber a mesma magia duas vezes não conjura
    nada a mais, e truque/constante não têm o que contar.
  - **Espontânea não tem slot vazio** enquanto souber alguma magia do rank: quatro slots de 1º com
    três magias conhecidas é ficha normal (o Virulak Necromancer é assim), e marcar isso como vazio
    acusava 60 grupos das fichas publicadas. Só rank sem magia nenhuma deixa slot inútil.
  - **Slot que abre fica VAZIO**, marcado no bloco e no aviso: a ferramenta não escolhe magia pelo
    GM, mesma política de todo o resto. E nada é apagado — lista que passou do número de slots vira
    aviso, não exclusão.
- **A lista editada à mão vira a nova ORIGEM da escada** (`SpellEdits`, com o `level` em que foi
  montada). É o que faz a escolha do GM sobreviver a uma troca de nível-alvo: a conta parte da lista
  dele, não da ficha da AON. O `SpellEditorDialog` é **totalmente controlado** — não guarda cópia da
  lista, devolve tudo a cada mudança —, porque o nível-alvo é trocado no painel ao lado com o
  diálogo aberto. E, como os `scaleOverrides`, a edição viaja para o cartão da Iniciativa
  (`spellEdits` em `NpcCombatant`), senão a ficha do cartão mostraria as magias da AON.
- **Caixinha de regra no stat block** (`RuleTip.tsx` + `ruleTerms.ts` + `services/rules.ts`): passar
  o mouse (ou segurar o dedo) numa condição, habilidade, traço ou magia abre a regra vinda da AON.
  Vale também na ficha dentro do cartão da Iniciativa, que desenha o mesmo componente.
  - **Em inglês, e isso é decisão de produto**, não limitação: a prosa das habilidades do monstro já
    é inglesa no módulo, e uma caixa traduzida ao lado dela seria a mistura pior. Some-se que um
    hover por termo estouraria o rate limit do tier gratuito.
  - **Aqui o inglês PODE ser cacheado** (memória + `localStorage`, com versão), ao contrário do que
    manda a regra geral. "Nada de cachear inglês" existe para tradução que FALHOU e precisa ser
    tentada de novo; aqui o inglês é o resultado pretendido e regra publicada não muda.
  - A busca acontece ao ABRIR a caixa, nunca no render: uma ficha tem dezenas de termos, e
    pré-carregar todos seria uma enxurrada de requisições para ler talvez uma.
  - O nome vai para a AON **sem o que a ficha anexa**: "reach 15 feet" é o traço `Reach`
    (`traitTerm`), mesma limpeza que `cleanSearchName` faz no backend. As condições saem do catálogo
    de `character-viewer/conditions.ts` pelo campo `en`, casadas por texto na prosa — inclusive
    `flat-footed`, o nome pré-Remaster de off-guard.
  - O **tracejado entra no PNG exportado de propósito**: num stat block impresso, marcar o termo de
    glossário é o comportamento certo. O chip de traço não leva tracejado, que ali só sujaria.
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
