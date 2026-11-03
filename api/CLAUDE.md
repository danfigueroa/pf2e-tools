# Backend (`api/`, `api/_lib/`, `server/index.mjs`)

Dois modos servindo os mesmos endpoints: `api/*.js` (serverless, Vercel) e `server/index.mjs` (dev local). O núcleo é
compartilhado em `api/_lib/`. **Nunca crie arquivo novo em `api/`** — limite de 12 funções (ver raiz).

Domínios com doc própria — leia antes de mexer no handler/store deles:
mapa → `src/modules/battle-map/CLAUDE.md`; encontros → `src/modules/initiative-tracker/CLAUDE.md`; diário →
`src/modules/campaign-journal/CLAUDE.md`; wiki → `src/modules/wiki/CLAUDE.md`; troféus → `src/modules/trophies/CLAUDE.md`;
histórico (`?diary=`) → `src/modules/session-diary/CLAUDE.md`; rolagens e estado da mesa (lado cliente) →
`src/services/CLAUDE.md`.

## Endpoints

- Consulta à AON: `feat`, `search`, `spell`, `companion`, `creature`, mais os plurais em lote (`feats`, `searches`, `spells`,
  `companions`), `health` (faz `pingDatabase`: o cron diário do `vercel.json` evita a pausa do Supabase) e `clear-cache`.
- **Tudo que é novo entra num dos dois "guarda-chuvas"**:
  - `api/search.js` (sem tradução, dados estruturados do índice): `creature`, `?affliction=`, `?spells=1`, `?rule=`,
    `?items=`, `?shields=`, `?gear=`, `?traitRules=`.
  - `api/state.js` → `state-router.js` (o despacho é UM só, usado pela Vercel e pelo dev server): estado da mesa, fichas
    publicadas, rascunhos, rolagens, mapa, encontros, correções, diário, wiki, anotações, troféus, eventos, conta.
- Rotas do `state` (catálogo, para não reinventar):
  - Estado: `GET ?char=<slug>[&field=]`, `?incoming=<slug>`, POST sem `action` (escrita de fatia).
  - Fichas: `GET ?sheets=1` (traz `drafts`), `?sheet=`, `?sheetVersions=`, `?sheetDraft=`, `?sheetDescriptions=`; POST
    `draft-create`/`draft-step`/`draft-discard`, `publish`, `guide`, `guide-edit`, `restore` (`version` opcional),
    `sheet-descriptions`, `sheet-assign`.
  - Feed: `GET ?rolls=1&rev=N`, `?diary=days|summary|<YYYY-MM-DD>`; POST `roll-add`, `share-add`.
  - Mapa: `GET ?maps=1`, `?map=<id>`, `?mapRev=<id>`; POST `map-*`, `image-delete` (`blob-delete` aceito igual).
  - Encontro: `GET ?encounter=<mapId|none>`; POST `encounter-save`. Correções: `GET ?fixes=1`; POST `fix-save`.
  - Diário: `GET ?journal=list|<id>`, `?reveal=<id>`; POST `journal-save`/`journal-delete`/`journal-reveal`.
  - Wiki: `GET ?wiki=list|trash|recent|search|<id>`, `?wikiHistory=`, `?wikiRev=`; POST `wiki-save`/`-restore`/`-delete`/
    `-undelete`/`-purge`/`-flags`/`-show`.
  - Anotações: `GET ?notes=<slug>`; POST `notes-save`. Troféus: `GET ?trophies=me|summary|ranking|<userId>`. Eventos: `?events=1`.
  - Conta: `?me=1`, membros, convites, `register`, `member-reset-password`, `mesa-settings`.
- **Ordem do despacho importa**: `isRollRequest`, `isMapRequest`, encontros, correções, diário, wiki, anotações, troféus vêm
  **antes** de `isSheetRequest`, que aceita qualquer POST com `action` e engoliria os outros. A conta (`auth-handler.js`:
  `?me=1`, membros, convites, `register`) vem **antes do portão**, para quem não é membro resgatar convite.

## Busca na AON

- `searchAon` = busca por nome por relevância. `searchAonRaw` = filtro por faixa sem termo (`match_all` com **ordenação
  explícita**, senão embaralha), paginação (`from`) e `total`. Mesmo fetch e cache.
- **O AON parou de mandar `---` no `text`**: `parseAonText(text, markdown)` usa o `markdown` quando o `text` não tem
  estrutura. Descrição com cabeçalho colado na prosa = suspeite da marcação do AON antes do parse.
- **Nome cru primeiro** (`resolveEntry`): o parêntese às vezes É o nome ("Staff of Healing (Greater)"); só sem casamento
  exato cai no `cleanSearchName` ("Assurance (Athletics)").
- **Acerto aproximado só com nome compatível** (`namesCompatible`, igual em `descriptions.ts`): mesmas palavras; o pedido é
  o FIM do achado ("Cognitive Crossover" ↔ "Kreighton's…"); ou o achado é começo/fim do pedido e não é entrada genérica
  (traço, ação, perícia…); em item, só outro item diferindo pelo grau. Meio não vale. Sem acerto compatível = **sem
  descrição** — nunca texto inventado por LLM (`generateFallbackDescription` só completa prosa vazia de entrada achada).
  Acerto com nome diferente leva `matchedName`.
- **Característica de classe com nome repetido** ("Weapon Expertise (Magus)", `sharedClassFeatures.ts`, gerado): `classHint`
  em `feat-core.js` escolhe a entrada da classe, remaster primeiro; a busca em `class-feature` vai a 60 resultados.
- **Bastões** (`staff-parse.js`): o AON guarda a família inteira num documento; quebre por `<title level="2">` e monte a
  lista pela regra (o degrau mais os inferiores, nunca os superiores), cada magia com `tierLevel`. Sem lista legível, `null`.
- **Criaturas** (`creature-core.js`): não passam pela tradução (vocabulário curto traduzido no cliente). Aceita `q`,
  `minLevel`/`maxLevel` ou os dois (exige um), `limit`, `offset`; devolve `{ results, total, nextOffset, hasMore }`.
  - **Paginação por cursor em acertos do índice**: avance pelo `nextOffset`, nunca `página × tamanho` (a deduplicação de
    legacy come acertos). Quem decide o fim é `hasMore`; o `total` é aproximado. Quem acumula páginas deduplica por nome.
  - `creature?name=` = ficha completa para o Escalar Monstro (`monster-core.js` + `creature-parse.js`), com o degrau de
    benchmark de cada número. Ver `src/modules/monster-scaler/CLAUDE.md` para as armadilhas do índice.
  - `pickHit` procura o **nome exato antes** de descartar legacy ("Adult Red Dragon" só existe no Bestiary).
- `?affliction=` (`affliction-core.js`): só a primeira ocorrência de uma condição vira link no `stage_markdown`; casamento por
  texto contra `conditions.ts`; `flat-footed` = `off-guard`.
- `?spells=1` (`spell-list-core.js`): `level` é o RANK; `maxRank` é teto.
- `?rule=` (`rule-core.js`): em **inglês, sem tradução**; quem chama diz a categoria (`creature-ability`, `condition`,
  `trait`, `spell`, `action`, `rules`). Do markdown ficam só os rótulos mecânicos.
- `?items=`: traços e cura ("restores XdY+Z Hit Points", só com o traço `Healing`), `actions`. Busca por `name.keyword`, remaster.
- `?shields=` (`shield-core.js` + `shield-parse.js`): base da categoria `shield`; específico pelo `base_item`. Na criatura,
  só "shield (Hardness…)" com "shield" logo antes, senão a dureza do próprio constructo vira escudo.
- `?gear=` (`gear-core.js`): `trait_raw`, `weapon_type`, `group`, `check_penalty`, `strength`; específico segue o `base_item`.
- `?traitRules=a|b` (`resolveTraitRules`): regra de traço **em português**, `aon_lookups` `trait:v2` (em inglês, `traiten:v1`).
  Nome do vocabulário `TRAIT_PT` ou `translateTraitNames`. Só a regra **completamente traduzida** vai para o banco.
- **Cache de consultas por nome** (`lookup-cache.js`, tabela global `aon_lookups`): `kind` versionado (`gear:v1`,
  `pet:v1`…); o CHECK só aceita `letras:vN` (sem segundo `:`). Mudou o formato, suba a versão. Só grava o que a AON achou.

## Tradução (o ponto que mais quebra; só no caminho português)

- **Cadeia** `TRANSLATION_CHAIN` (`aon.js`): Gemini `gemini-3.1-flash-lite` → Groq `gpt-oss-120b` → Groq `gpt-oss-20b`, todos
  na API compatível com OpenAI (trocar = URL + chave em `PROVIDERS`). Cada provedor tem fila e intervalo (`scheduleCall`):
  Gemini por RPM (15), Groq por TPM (8.000). 400/404/sem chave pulam sem esperar; 429 respeita `retry-after`.
- **Provedores aposentam modelos sem aviso**: ficha inteira em inglês = confira https://ai.google.dev/gemini-api/docs/models
  e `GET https://api.groq.com/openai/v1/models`.
- Chaves (`GEMINI_API_KEY`, `GROQ_API_KEY`) lidas por provedor dentro de `callChat`; o que circula é só o gate
  `translationEnabled` (`hasTranslationKey()`).
- Prompt que pede JSON: `runChainedPrompt(..., { clean: false })` (o `cleanTranslation` corromperia o JSON).
- **Uma chamada por grupo**: metadados em prosa vão junto da descrição com marcadores `<<N>>` (`translateSegments`); magias,
  talentos, habilidades e itens são traduzidos em grupos de 6 (`resolveSpells`, `resolveEntries`; `PREFETCH_CHUNK_SIZE` no
  cliente). Cabe no TPM do Groq e no `maxDuration`.
- **Falha = `translationPending: true` e nada é cacheado** (memória, banco, `localStorage`). A próxima consulta retraduz.
- **Cache compartilhado** (tabela `translations`, global, sem validade): chave = sha1 do **inglês + preâmbulo + versão**.
  Só grava o que passou na validação; o upsert **nunca sobrescreve** (`ignoreDuplicates`: correção `source = 'human'` vence o
  LLM). Mudou `cleanTranslation` ou o formato? Suba `TRANSLATION_CACHE_VERSION` (o `clear-cache` só limpa a memória).
- Parse, heightening e números são refeitos a cada pedido; só o LLM é poupado.

## Idioma no servidor

- `api/_lib/i18n.js`: `langOf`; erros escritos em português nos handlers e trocados **na saída** (`localizeBody`, no
  `routeState` e no `apiLang` de cada `api/*.js`) pelo dicionário `EXACT`/`PATTERNS`.
- Em `en`, os núcleos (`resolveSpells`, `resolveFeats`/`Specials`/`Items`, `resolveCompanion`) desligam a tradução **e** os
  dicionários determinísticos (`translateMetadata`, `translateDamageType`, `translateHeightenedText`).
- `descriptions.lang` (`'pt'`/`'en'`), PK `(version, lang, kind, name)`. Use `sheet_descriptions(mesa, slug, lang)` (3
  argumentos); a de 2 é só português. **Misses são por idioma**: o inglês lê os do português e os próprios, grava os próprios.
- Guia "Como Jogar" em inglês é gerado **da ficha** (`buildPromptEn`), nunca traduzido do português (decisão do usuário);
  mora em `guide.en = { markdown, generatedAt }`. Troféus em inglês: `trophies-en.js`.
- Entrada escrita à mão no pacote estático (relíquias, itens caseiros, Anathema/Holy/Domain do Woyd, Wish for Luck do Loki)
  vai nas **duas** línguas, também para `descriptions` na versão do pacote, e sai de `description_misses`.

## Autorização (`access.js`, `state-router.js`)

- `resolveAccess` = identidade (JWT conferido localmente, `requestIdentity`) + papel, cache de 30 s. `gate`: 401 sem sessão,
  403 fora da mesa. Cada handler decide por `ctx.access`.
- `AUTH_REQUIRED=1` liga a cobrança; desligada, comporta-se como antes do login. Sem Supabase não cobra.
  **Exceções que exigem o papel real sempre**: gestão de conta, Diário de Campanha, permissões da Wiki.
- GM-only no estado: criar/renomear/revelar/ativar/apagar mapa, limpar desenhos, `map-sync`, campos `meta`/`hp:`/`fit:`,
  gravar o encontro. Jogador: desenhar, pingar, rolar livre, mover **só o próprio token** (`pos:` do PC com `slug` dele ou
  companheiro com `companionOf` dele). Rolar com `slug` = dono ou GM.
- **Feito de troféu de jogador só vale para o DONO da ficha** (`ownerOf`). Troféu sempre dentro de `safely`: nunca derruba a ação.
- Conta (`auth-handler.js`): criada pelo servidor no `register` (o convite é a credencial; resgate que falha apaga a conta
  recém-criada). Usuário 3–30 de `[a-z0-9._-]`, senha ≥ 6. Senha esquecida: o GM gera provisória (`member-reset-password`).
  `accept_invite` é atômica, quem já é membro não consome. Convite vale para a mesa onde foi criado. A mesa nunca fica sem GM (409).
  Só o servidor escreve `role` (grant de coluna).

## Fichas publicadas (`sheet-handler.js`, `sheet-store.js`, `sheet-draft.js`)

- Tabelas `sheets` + `sheet_versions` (até 30 versões, cada uma com o guia), teto 64 KB, sem validade. Fora do estado da mesa
  de propósito (seria arrastado a cada leitura). `publish_sheet`/`restore_sheet` são funções do banco com a linha travada;
  restaurar troca a atual pela do histórico (restaurar de novo desfaz).
- **O slug sai do `build.name` do próprio JSON, nunca do cliente** (é a identidade do estado da mesa).
- `published_by` = quem publicou por último; quem manda é `owner_id`.
- **Publicação preparada** (decisão do usuário: a ficha só abre para a mesa completa):
  - `draft-create` grava em `sheet_drafts` JSON, nomes (`characterDescriptionNames`), `CACHE_VERSION`, companheiros e guia
    curado de base. Mesmo portão do `publish`; igual à publicada = 409; ficha nova que outra pessoa prepara = 403 (GM passa).
  - `draft-step`, em ordem: `lookups` (`warmSheetLookups` sem corte), `companions`, `desc-pt`, `desc-en`, `guide-pt`,
    `guide-en` (**um idioma por chamada**: os dois passam dos 60 s), `finish` (`missingParts` confere tudo e
    `promote_sheet_draft` promove numa transação, já com o guia e o dono). Passo pesado só começa no início da chamada
    (`STARTS_BEFORE`). Trava `sheet-draft:<mesa>:<slug>` (outra aba recebe `busy`).
  - **Falha da IA/AON nunca promove pela metade**: devolve `waiting` com `retryIn` em recuo (15→30→60→120 s). Sem chave de IA
    é `error`. Só na promoção saem notificação e troféus.
  - O `publish` direto existe só para scripts (`seed-presets`, `check-rolls`, `check-auth`) e cliente antigo; corta o
    aquecimento em 8 s.
- **`guide`** (`guide-core.js`) parte do guia anterior (editado > da versão anterior > curado), com as seções no prompt
  explicitamente; proíbe descrever mecânica sem certeza; sai marcado "gerado por IA". Só grava se a ficha ainda for a que o
  gerou (`publishedAt`). `tidy` tira itálico e listas `*`/`1.` (o `GuideMarkdown` não entende).
- `guide-edit` (`editGuide`): troca o texto, marca `editedAt`, mantém `generatedAt`; 409 se republicada no meio. Regerar tira o `editedAt`.

## Descrições pré-traduzidas (`sheet-descriptions.js`)

- Pacote `{ version, entries: { spell, feat, special, item } }`, **payload idêntico ao da API**. Dois caminhos: estático
  (`public/descriptions/<slug>.json` e `en/`, `build-description-bundle.mjs`) e o da ficha publicada (banco).
- Descrições **globais** (`descriptions`); cada ficha guarda só a lista de nomes (`sheet_description_sets`).
  `GET ?sheetDescriptions=<slug>` monta numa chamada; `POST sheet-descriptions` resolve só o que falta.
- A primeira montagem parte do pacote **estático** do personagem (`vercel.json` `includeFiles: public/descriptions/**`; se
  faltar, busca em `VERCEL_PROJECT_PRODUCTION_URL`).
- **A lista de nomes é uma só** (`characterDescriptionNames` em `descriptionNames.ts`, com as mesmas funções das abas); o
  servidor a recebe do cliente e o script a importa via `ts-loader` — não a reescreva em JS.
- Incremental e acumulativo (teto 300 por tipo). Nunca grava inglês pendente. Trava de 70 s (`try_lock`); não começa grupo
  depois de 30 s e devolve `remaining` (o cliente chama de novo, até 12 rodadas). Nome que a AON não resolve vai para
  `description_misses` por 24 h (falha de tradução/429 NÃO é miss).
- **Mudou o payload (parse, `scaling`, heightening, bastão)? Suba a `CACHE_VERSION` (`src/services/descriptions.ts`) E
  regere os estáticos.**

## Outros stores

- `table-store.js` (estado da mesa): uma linha por (slug, campo); campo novo = `FIELD_RE` + CHECK em migration. Valida
  slug/campo por regex, 8 KB por escrita. `GET ?char=&field=` = uma fatia (`readField`). `GET ?incoming=<slug>` = o que os
  colegas passaram (`readIncoming`).
- `roll-store.js`: tabelas `rolls` e `shares` tiram o `seq` da **mesma sequência** (o `rev` é o maior `seq`); `at` é do
  servidor; GET devolve as últimas 30 (`read_feed`). Teto 8 KB por rolagem.
- `fix-store.js` (`description_fixes`): correções globais, só prosa (`FIX_FIELDS`), `previous` para desfazer, `fields: {}` volta à automática.
- `notes-store.js` (`character_notes`): um documento por mesa+slug, 128 KB, escrita condicional com `base` e 409.
- `images.js`: apagar imagem é do servidor; `imagePath` só aceita URL nossa. `isMapOwnedImage` nunca deixa apagar `tokens/`.
- `event-handler.js`: `GET ?events=1`; eventos vêm de triggers (ver `src/layouts/CLAUDE.md`).
- Cada store tem **fallback em memória** (Map por mesa) para rodar sem credenciais.
- `supabase.js`: chave `SUPABASE_SECRET_KEY` (passa por cima do RLS). Só o servidor escreve.
