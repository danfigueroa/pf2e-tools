# Base de regras no banco

O Criador **nunca consulta a AON enquanto alguém monta um personagem**. Todo o conteúdo do Remaster (ancestralidades,
heranças, backgrounds, classes e características, talentos, magias, itens, divindades, idiomas, companheiros, relíquias,
traços, condições, ações…) é importado **uma vez** para o nosso banco. Depois, só se baixa o que é **novo ou mudou**,
livro a livro, por uma tela de configuração da plataforma.

Medições na AON (2026-11-24) que sustentam o desenho:

| Medida | Valor |
| --- | --- |
| Livros (`category: source`) | 343, cada um com data de lançamento, linha de produto e **errata mais recente** no texto ("Latest Errata 4.0 - 2023-01-03") |
| Entradas de jogador do Remaster (lançadas a partir de 2023-11 ou com `legacy_id`) | **~17.800**: talento 4.870 · equipamento 4.730 · ação 2.161 · magia 1.389 · bônus de item 766 · característica de classe 746 · divindade 463 · traço 443 · arma 286 · background 279 · herança 250 · arquétipo 185 · ritual 144 · relíquia 98 · habilidade de familiar 87 · companheiro animal 67 · domínio 61 · ancestralidade 48 · idioma 47 · armadura 38 · classe 28 … |
| Tamanho médio por entrada (campos úteis + markdown) | ~2,2 KB → ~40 MB cru, bem menos no Postgres (TOAST comprime) |
| Conteúdo legado sem versão Remaster | ~7.200 entradas (livros pré-2023 que não foram revisados) — importável **por livro**, só se alguma mesa liberar |

## 1. O que a AON entrega estruturado (e o que não)

Conferido em entradas reais:

| Tipo | Campos estruturados úteis |
| --- | --- |
| Classe | `hp`, `attribute` (atributo-chave), `perception_proficiency`, `fortitude/reflex/will_proficiency`, `attack_proficiency`, `defense_proficiency`, `skill_proficiency` (texto), `legacy_id` |
| Ancestralidade | `hp`, `size`, `speed_raw`, `attribute` (boosts, inclui "Free"), `attribute_flaw`, `language`, `vision`, `trait` |
| Background | `attribute` (opções de boost), `skill` (perícia + Lore), `feat` (talento concedido) |
| Talento | `level`, `trait`, `actions`, `archetype`, `prerequisite`, `rarity`, `legacy_name` (ex.: Power Attack → **Vicious Swing**) |
| Magia | `level` (rank), `tradition`, `trait`, `actions`, `heighten`, `heighten_level`, `range`, `area`, `target`, `duration`, `defense`, `spell_type` |
| Arma | `damage`, `damage_die`, `damage_type`, `weapon_category`, `weapon_group`, `weapon_type`, `hands`, `price` (em pc), `bulk`, `trait_raw` ("Versatile P") |
| Item | `level`, `price`, `bulk`, `usage`, `item_category`, `item_subcategory`, `item_parent_id` (família de graus) |

**Não vem estruturado**: o que um talento ou característica *faz* na ficha (concede proficiência, abre escolha, dá
magia), a progressão por nível da classe (níveis de talento, aumentos de perícia, "Expertise" por nível) e as tabelas de
slots de magia. Essa camada é a **mecânica** (§4), guardada ao lado da entrada, no mesmo banco.

## 2. Tabelas (globais — não são da mesa, como `translations` e `descriptions`)

```sql
-- Livros da AON e o estado de cada um na nossa base.
create table public.rules_sources (
    aon_id text primary key,                    -- 'source-1'
    name text not null,                         -- 'Player Core'
    product_line text,                          -- 'Rulebooks' | 'Lost Omens' | 'Adventures' | ...
    release_date date,
    errata text,                                -- 'Latest Errata 4.0 - 2023-01-03' (como a AON publica)
    remaster boolean not null,                  -- lançado a partir de 2023-11-15 (Player Core) ou marcado à mão
    aon_count integer,                          -- entradas de jogador na AON na última verificação
    our_count integer,                          -- entradas importadas
    status text not null default 'available'    -- 'available' | 'imported' | 'outdated' | 'ignored'
        check (status in ('available','imported','outdated','ignored')),
    checked_at timestamptz,
    imported_at timestamptz,
    imported_by uuid references auth.users (id) on delete set null
);

-- Uma linha por entrada da AON.
create table public.rules_entries (
    aon_id text primary key,                    -- 'feat-4775' (id estável da AON)
    id text not null unique,                    -- 'feat:feat-4387' (tipo:aon_id)
    category text not null,                     -- categoria da AON
    name text not null,                         -- nome canônico em inglês
    level smallint,
    rarity text,
    traits text[] not null default '{}',
    source_id text references public.rules_sources (aon_id),
    remaster boolean not null,
    legacy_ids text[] not null default '{}',    -- entradas antigas que esta substitui
    legacy_names text[] not null default '{}',  -- 'Power Attack' → útil na importação do Pathbuilder
    replaced_by text,                           -- se é legado com versão Remaster
    data jsonb not null,                        -- campos estruturados enxutos (§1), sem HTML
    markdown text,                              -- texto da regra em inglês (descrição offline e base da tradução)
    hash text not null,                         -- sha1 do conteúdo e dos metadados normalizados
    imported_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    removed_at timestamptz                      -- sumiu da AON numa reimportação (não apaga: builds podem usar)
);
create index rules_entries_category_idx on public.rules_entries (category, level);
create index rules_entries_source_idx on public.rules_entries (source_id);
create index rules_entries_name_trgm on public.rules_entries using gin (name gin_trgm_ops);  -- busca "Navegador"

-- Mecânica: o que a entrada faz no motor. Separada porque tem outra origem e outro ritmo.
create table public.rules_mechanics (
    aon_id text primary key references public.rules_entries (aon_id) on delete cascade,
    origin text not null check (origin in ('foundry','manual','derived')),
    rules jsonb not null default '[]',          -- rule elements suportados (MOTOR-DE-REGRAS §10)
    unsupported text[] not null default '{}',
    prereq jsonb,                               -- pré-requisitos já interpretados
    progression jsonb,                          -- classe: níveis de talento, aumentos, características por nível
    reviewed boolean not null default false,    -- conferido por alguém contra a AON
    updated_at timestamptz not null default now()
);

-- Importações e verificações (uma por vez).
create table public.rules_import_jobs (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('check','import','reimport')),
    sources text[] not null,
    status text not null default 'running' check (status in ('running','done','failed','cancelled')),
    cursor jsonb,                               -- onde parou (livro, categoria, search_after)
    counts jsonb not null default '{}',         -- novas, alteradas, sem mudança, removidas, sem mecânica
    report jsonb,                               -- lista legível do que mudou
    started_by uuid references auth.users (id) on delete set null,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

-- Versão do catálogo: sobe a cada importação que muda algo; os pacotes (§5) são gerados por versão.
create table public.rules_catalog_versions (
    version text primary key,                   -- '2026.12.1'
    created_at timestamptz not null default now(),
    job_id uuid references public.rules_import_jobs (id),
    summary jsonb                               -- contagens por categoria, livros incluídos
);

-- Quem administra a plataforma (a base de regras é de todas as mesas, então não é papel de GM).
create table public.platform_admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);
```

Grants só ao `service_role` (só o servidor lê e escreve; o cliente lê pela API ou pelos pacotes). `pg_trgm` para a
busca. Antes da carga inicial, conferir o espaço: `select pg_size_pretty(pg_database_size(current_database()))` (plano
gratuito: 500 MB).

## 3. Carga inicial (uma vez, por script)

```
node --env-file=.env scripts/import-rules.mjs --remaster            # todos os livros Remaster
node --env-file=.env scripts/import-rules.mjs --source "Player Core" # um livro (repita para mais)
node --env-file=.env scripts/import-rules.mjs --remaster --check     # só compara com a AON, não grava entradas
node --env-file=.env scripts/import-rules.mjs --mechanics-only       # refaz só a mecânica do Foundry
node --env-file=.env scripts/import-rules.mjs --resume <job>         # retoma do cursor do job que caiu
```

- O livro inteiro é paginado numa sequência só (`terms` com as categorias de `RULE_CATEGORIES`). Só a entrada cujo `hash`
  mudou é gravada. A entrada que sumiu da AON ganha `removed_at`, nunca é apagada.
- A persistência fica em `api/_lib/rules-store.js`. Ela é global e não recebe `mesa`, como `translations`.
- A mecânica do Foundry é refeita a cada importação contra todas as entradas não removidas. Ela nunca passa por cima de
  `origin: manual`.
- Entrada da AON sem nome (subações dentro de item, `exclude_from_search: true`) conta como inválida e fica de fora. Por
  isso `aon_count` = entradas de jogador na AON e `our_count` = importadas.
- O livro sem versão Remaster nem `legacy_id` e anterior a 2023-11-15 (Rage of Elements, com o Kineticist) não entra
  no `--remaster`; importe-o com `--source` quando uma mesa o liberar.

- Roda **na máquina de quem administra**, sem o limite de 60 s das funções da Vercel.
- Usa o mesmo núcleo da tela da plataforma (`api/_lib/rules-import.js`, JS puro), então o resultado é idêntico.
- Educado com a AON: uma consulta por vez, intervalo entre páginas, paginação por `search_after` com ordenação explícita
  (a mesma lição do `searchAonRaw`), `User-Agent` genérico, retomada pelo `cursor` se cair.

## 4. A camada de mecânica

A mecânica tem três origens:

1. **`derived`**: grave em `rules_entries.data.derived`, nunca em `rules_mechanics`. É uma projeção dos campos da própria
   AON, então muda junto com o `hash` da entrada e viaja no mesmo pacote. Assim a progressão do Foundry não sobrescreve as
   proficiências iniciais da classe. Cobre: boosts e PV da ancestralidade; boosts, perícias e talento do background;
   proficiências iniciais da classe (texto "Expert in…" → rank, "all armor" → leve/média/pesada, escolhas de perícia);
   dado, tipo de dano (a letra de `damage`, não o primeiro de `damage_type`, que inclui o versátil), grupo e categoria de
   arma; dados de magia. O texto que o parser não entende vai para `derived.unsupported`, para virar aviso no motor. Isso
   inclui o que depende de subclasse, divindade, armas de fogo e Lore à escolha.
2. **`foundry`** (D1 aprovada): rule elements e progressão de classe do sistema PF2e do Foundry, em `rules_mechanics`.
   Núcleo puro em `api/_lib/rules-foundry.js` e leitura do pacote em `scripts/rules-data/foundry-packs.mjs`. O casamento
   está em FONTES-DE-DADOS §4. Em `rules` ficam os rule elements suportados e os situacionais, estes marcados com
   `situational: true`, que a Ficha mostra como informação e o motor não compila. Os de aparência (`TokenLight`…) são
   descartados. Os demais vão para `unsupported` com a chave e, no `ActiveEffectLike`/`FlatModifier`, o caminho, para o
   relatório priorizar.
3. **`manual`** — tabelas curadas no repositório (slots de magia, riqueza, correções), conferidas na AON.

Entrada sem mecânica **continua escolhível**: o motor aplica o que sabe e mostra "efeito não calculado: <nome>"
(regra "avisa, não trava"; nunca número inventado). A tela de atualização mostra quantas entradas de cada livro estão
sem mecânica, para priorizar.

## 5. Como o Criador lê sem pesar

O banco é a **fonte**; a leitura do dia a dia não bate nele a cada toque:

1. **Pacotes por versão** — ao fim de cada importação que muda algo, o servidor gera pacotes enxutos por lista
   (`core`, `feats/class/<classe>`, `feats/ancestry/<anc>`, `feats/general`, `feats/skill`, `feats/archetype/<arq>`,
   `spells/<tradição>`, `items/<categoria>`…) e os grava no **Storage** (bucket público `rules`, só o servidor escreve),
   em `rules/<versão>/<lista>.json`. Servidos pelo CDN do Supabase: **nenhuma função e nenhuma consulta ao banco** por
   leitura.
2. **Cache no aparelho** — o cliente guarda cada pacote no IndexedDB (`pf2e:rules:<versão>:<lista>`, global, sem
   `mesaKey`). Abrir o Criador de novo não baixa nada.
3. **Versão atual** — vem no `?me=1` que o app já chama (`rulesVersion`); mudou, o cliente baixa só as listas que usar.
4. **Consulta pontual** — busca livre no catálogo inteiro (Navegador, F9) e entrada única fora dos pacotes vão por
   `api/search.js?rules=…` (sem arquivo novo em `api/`), com `Cache-Control` por versão.
5. **Descrições** — o markdown em inglês já está no banco: o detalhe em inglês sai dele, e a tradução pt usa o pipeline
   atual (`descriptions`, cadeia de LLMs, correções humanas) **sem buscar a AON**. Pré-traduzir um livro inteiro é um
   botão opcional (fila lenta, respeitando o limite dos provedores).

**Ganho para a plataforma toda (F10)**: `feat-core.js`, `spell-parse.js`, `sheet-warm.js` e afins podem consultar
`rules_entries` antes da AON — a Ficha também deixa de depender da AON ao vivo.

## 6. Atualizar a base pela plataforma

Tela **Plataforma → Base de regras** (rota `/plataforma/regras`, só para quem está em `platform_admins`; papel conferido
no servidor).

```
┌ Base de regras · versão 2026.12.1 · 17.812 entradas · verificado há 2 dias   [Verificar novidades] ┐
│ Filtro: [Remaster ▾] [Todos os tipos de livro ▾] [Busca]                                            │
│ ☐ Lost Omens: High Seas        2026-10  NOVO        412 entradas na AON                             │
│ ☐ Pathfinder Feybound          2026-08  ERRATA NOVA 1.1 → 1.2 · 37 entradas mudaram                 │
│ ✓ Player Core                  2023-11  Importado   1.934 · 12 sem mecânica                         │
│ ✓ War of Immortals             2024-08  Importado   …                                               │
│ ☐ Advanced Player's Guide      2020-08  Legado (sem Remaster) — importar só se uma mesa liberar      │
│                                                     [Importar selecionados (2)]                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Fluxo:

1. **Verificar novidades** (`rules-check`): lê os 343 livros da AON (uma consulta) e, por livro, a contagem de entradas
   de jogador; compara com `rules_sources` → marca **NOVO** (não importado), **ERRATA NOVA** (texto de errata mudou ou
   contagem diferente), **Importado**, **Legado**. Não baixa conteúdo.
2. **Importar selecionados** (`rules-import`): cria um job e baixa **só os livros escolhidos**, categoria por categoria,
   em passos curtos (cada chamada ≤ ~45 s, como o preparo de fichas). **Quem conduz é o navegador do admin**: laço com
   trava (`rules-import:<job>`), barra de progresso; fechar a aba não perde nada ("Continuar").
3. Para cada entrada: normaliza, calcula o `hash`, faz *upsert* por `aon_id` → **nova** / **alterada** / **igual**;
   entrada do livro que sumiu da AON ganha `removed_at` (não some: um build pode usá-la).
4. Mecânica das novas e alteradas (§4).
5. **Fim**: nova `rules_catalog_versions`, pacotes regenerados **só das listas afetadas** (as outras são copiadas da
   versão anterior), relatório: "High Seas: 412 novas (38 talentos de arquétipo, 61 itens…), 9 sem mecânica";
   notificação para os admins.
6. **Builds existentes** não mudam sozinhos: guardam a `rulesVersion` deles; ao abrir, o modo editar avisa "Regras
   atualizadas: 2 números mudaram" e o jogador aplica quando quiser (RN-13).

**Livros e mesas**: importar um livro coloca o conteúdo na base; **liberar** o livro para uma mesa continua sendo decisão
do GM em "Regras de criação" (`mesa_rules.sources`). Conteúdo de livro importado e não liberado aparece com o aviso
`SOURCE_NOT_ALLOWED`.

**Verificação automática (opcional)**: o cron diário que já chama `/api/health` também roda o `rules-check` uma vez por
semana e, havendo livro novo ou errata, cria uma notificação para os admins ("2 livros novos na AON"). Nunca importa
sozinho.

## 7. Rotas (no `state-router.js`; nenhuma função nova)

| Método | Rota | Quem |
| --- | --- | --- |
| GET | `?rulesSources=1` (lista de livros e estado) | admin |
| GET | `?rulesJob=<id>` (progresso e relatório) | admin |
| POST | `rules-check` | admin |
| POST | `rules-import` (`sources[]`) / `rules-import-step` (`jobId`) / `rules-import-cancel` | admin |
| POST | `rules-mechanics-save` (correção manual de mecânica de uma entrada, com referência AON) | admin |
| GET | `api/search.js?rules=<lista>&v=<versão>` (pacote, reserva do Storage) e `?rules=search&q=` | membro |

Mensagens de erro novas em `api/_lib/i18n.js`. `check-auth` cobre: jogador e GM comuns recebem 403 nas rotas de admin.

## 8. Remaster × legado

- **Remaster** = publicação a partir de 2023-11-15 ou entrada com `legacy_id`. Use a data informada para a entrada e recorra à data do livro quando a entrada não a tiver.
- `remaster_id` marca uma entrada como legado e tem precedência sobre a data. Guarde os IDs nativos em `data.remaster_ids`.
  Preencha `replaced_by` com o ID nativo quando houver uma única versão nova. Importe a entrada legada apenas quando o livro
  legado for selecionado. O seletor mostra a versão nova quando disponível (RN-14).
- `legacy_name` da AON resolve nomes antigos na importação do Pathbuilder (Power Attack → Vicious Swing, Magic Missile →
  Force Barrage).

## 9. Testes

- `check-builder`: o motor roda contra um **recorte fixo** da base (fixture versionada no repo, gerada do banco), para
  não depender da rede nem do banco nos testes.
- `import-rules.mjs --check` num livro pequeno: contagens batem com a AON; reimportar sem mudança = 0 alteradas
  (idempotência pelo `hash`).
- Teste de desempenho: abrir o Criador com cache vazio no celular baixa só `core` + as listas da classe/ancestralidade.
