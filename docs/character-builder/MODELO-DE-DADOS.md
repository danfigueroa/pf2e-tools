# Modelo de dados do Criador

Dois mundos:

- **Do personagem e da mesa** (banco, por mesa): `character_builds`, `character_build_versions`, `mesa_rules`,
  `mesa_homebrew` (fase 9) e a coluna `sheets.build_id`.
- **Das regras** (banco, global, versionado): `rules_sources`, `rules_entries`, `rules_mechanics`, `rules_import_jobs`,
  `rules_catalog_versions`, `platform_admins` — esquema em [BASE-DE-REGRAS.md](BASE-DE-REGRAS.md) §2 — e os pacotes de
  leitura gerados no Storage (`rules/<versão>/<lista>.json`).

---

## 1. `BuildState` — o que o jogador escolheu

Formato gravado em `character_builds.state` (jsonb). Ids de conteúdo são **estáveis e em inglês**: `tipo:slug`
(`class:fighter`, `feat:power-attack`, `spell:force-barrage`, `item:longsword`), o mesmo slug do pacote de regras.

```ts
interface BuildState {
  schema: 1;                         // versão do formato (migração de BuildState no cliente e no servidor)
  rulesVersion: string;              // versão do catálogo usada na última compilação ("2026.12.1")
  name: string;                      // nome exibido (pode mudar; o slug do build não muda)
  level: number;                     // nível atual 1–20
  xp: number;
  options: {
    variants?: Partial<Record<'freeArchetype' | 'ancestralParagon' | 'abp' | 'pwl' | 'dualClass' | 'gradualBoosts', boolean>>; // sobrescreve a mesa só se o GM permitir
    mythic?: { enabled: boolean; startLevel?: number; rank?: number };  // Mixed Play, chamado tardio, progressão por provações (REGRAS-OPCIONAIS §1)
    separateKits?: boolean;
  };
  origin: {
    ancestry?: string;               // 'ancestry:human'
    heritage?: string;               // 'heritage:skilled-human' ou versátil 'heritage:aiuvarin'
    background?: string;             // 'background:barkeep'
    alternateBoosts?: boolean;       // dois boosts livres no lugar dos da ancestralidade
    voluntaryFlaws?: AttributeKey[];
    languages?: string[];            // 'language:draconic'
    deity?: string;                  // 'deity:sarenrae'
    sanctification?: 'holy' | 'unholy' | null;
  };
  class: { id?: string; keyAttribute?: AttributeKey; dual?: string };
  /**
   * Toda escolha que um slot pede, pela chave do slot. A chave é gerada pelo motor e é estável:
   *   'boosts-1', 'boosts-5', 'skills-1', 'skill-increase-3', 'class-feat-2', 'ancestry-feat-1',
   *   'general-feat-3', 'skill-feat-2', 'archetype-feat-2' (Free Archetype), 'mythic-feat-2',
   *   'paragon-feat-1', 'class-choice:arcane-school', 'class-choice:weapon-mastery-5',
   *   e filhos: 'class-feat-2/choice:skill', 'ancestry-feat-1/grant:feat'.
   */
  choices: Record<string, Choice>;
  manual: {
    attributeOverride?: Partial<Record<AttributeKey, number>>;  // modificador final (aviso)
    extraBoosts?: Record<number, AttributeKey[]>;                // "Custom Ability Increases"
    extraSkillIncreases?: Record<number, number>;
    extraFeatSlots?: { level: number; kind: 'general' | 'class' | 'ancestry' | 'skill' }[];
    adjustments?: Adjustment[];                                  // buffs permanentes com motivo
  };
  inventory: InventoryEntry[];
  money: { pp: number; gp: number; sp: number; cp: number };
  spellcasting: Record<string, CasterChoices>;   // chave = id do conjurador gerado pelo motor ('class', 'archetype:wizard', 'innate:aiuvarin')
  companions: CompanionChoice[];
  details: { age?: string; gender?: string; pronouns?: string; ethnicity?: string; nationality?: string; portrait?: string };
  history: { at: string; by: string; note: string; kind: 'retrain' | 'override' | 'gm-grant' }[]; // auditoria leve
}

type AttributeKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

type Choice =
  | { id: string; qualifier?: string }          // talento, herança, escolha de classe; qualifier = 'skill:athletics'
  | { boosts: AttributeKey[] }                  // slot de boosts
  | { skills: string[] }                        // treino/aumento ('skill:athletics', 'lore:alcohol')
  | { lore: string }                            // Lore livre digitada
  | { value: string };                          // escolha simples (grupo de arma, tipo de dano…)

interface InventoryEntry {
  key: string;                // id local estável ('inv-7f3a') — o apelido e o estado da mesa casam por nome, não por isto
  item: string;               // 'item:longsword' ou 'custom:<id>'
  qty: number;
  container?: string;         // key de outro InventoryEntry que é contêiner
  worn?: boolean; invested?: boolean; equipped?: boolean;   // armadura vestida, item investido, arma empunhada
  acquired: 'bought' | 'given';                              // comprado desconta do dinheiro
  runes?: { potency?: number; striking?: 0 | 1 | 2 | 3; resilient?: 0 | 1 | 2 | 3; reinforcing?: number; property?: string[] };
  material?: { id: string; grade?: 'low' | 'standard' | 'high' };
  weapon?: { attackAttribute?: AttributeKey; extraTraits?: string[]; extraDamage?: string[]; large?: boolean;
             increaseDice?: boolean; overrides?: { attack?: number; damage?: number; proficiency?: number } };
  customName?: string;
}

interface CasterChoices {
  repertoire?: Record<number, string[]>;   // espontâneo: rank → magias
  signature?: string[];
  spellbook?: string[];                    // preparado de grimório
  prepared?: Record<number, string[]>;     // rank → cópias preparadas (repetição = várias cópias)
  bonusSlots?: Record<number, number>;
}

interface Adjustment {
  id: string; label: string; reason: string;
  effect: { kind: 'resistance' | 'speed' | 'hp' | 'itemBonus' | 'proficiency' | 'sense' | 'language' | 'innateSpell';
            target?: string; value?: number | string };
}
```

**Regras do formato**

- Toda chave de `choices` é gerada pelo motor; chave órfã (o slot sumiu porque a classe mudou) **não é apagada**: vira
  aviso "escolha sem lugar" com botão "descartar" (o jogador não perde trabalho sem querer).
- Nada de número derivado no `BuildState` (exceto `manual`, que é explícito e gera aviso).
- Teto 64 KB (`sanitizeBuildState` corta o resto e devolve 413).
- Mudou o formato: `schema` sobe e `migrateBuildState` (cliente e servidor) converte.

## 2. Tabelas (migration `criador_de_personagem`)

```sql
-- Builds: um por personagem por mesa.
create table public.character_builds (
    id uuid primary key default gen_random_uuid(),
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,48}$'),   -- estável; = sheets.slug ao aplicar
    owner_id uuid references auth.users (id) on delete set null,
    name text not null,
    class_name text,           -- cabeçalho para listas sem abrir o state
    level smallint not null default 1 check (level between 1 and 20),
    state jsonb not null,
    rules_version text not null,
    rev integer not null default 1,                             -- escrita condicional (409)
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users (id) on delete set null,
    published_rev integer,                                      -- rev publicado por último (para "alterações não publicadas")
    deleted_at timestamptz,                                     -- lixeira
    unique (mesa, slug)
);
create index character_builds_owner_idx on public.character_builds (mesa, owner_id);

-- Uma versão por publicação (o BuildState que gerou aquela ficha).
create table public.character_build_versions (
    id bigint generated always as identity primary key,
    build_id uuid not null references public.character_builds (id) on delete cascade,
    mesa text not null references public.mesas (id) on delete cascade,
    state jsonb not null,
    rules_version text not null,
    level smallint not null,
    published_at timestamptz not null default now(),
    published_by uuid references auth.users (id) on delete set null
);
create index character_build_versions_build_idx on public.character_build_versions (build_id, published_at desc);

-- Regras de criação da mesa (o "Campaign Management" do Pathbuilder).
create table public.mesa_rules (
    mesa text primary key references public.mesas (id) on delete cascade,
    rules jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users (id) on delete set null
);

alter table public.sheets add column build_id uuid references public.character_builds (id) on delete set null;
```

**Privilégios e RLS** (o projeto não expõe tabela nova; RLS automático):

- Só o servidor escreve (chave secreta): `grant select, insert, update, delete ... to service_role` para as três tabelas.
- Nenhum `grant` ao `authenticated`/`anon` (o cliente lê pela API, que aplica a autorização). Se um dia o cliente ouvir
  Realtime de builds, o payload leva só `id`/`rev`/`by` e o cliente relê pela API (regra de conteúdo secreto).
- `check-migrations` antes do commit; `migration list` depois do push.

**Limites e limpeza** (`pg_cron`, mesma rotina das outras):

- Lixeira: apagar de vez `character_builds` com `deleted_at` > 30 dias **sem ficha publicada** (com ficha publicada o build
  fica; a ficha depende dele).
- `character_build_versions`: até 30 por build (como `sheet_versions`), apaga as mais velhas.

**Realtime** (opcional, fase 8): trigger em `character_builds` → `realtime.send` em `mesa:<mesa>:builds` com
`{ buildId, rev, by }`. Serve para o GM ver a ficha nascer e para duas abas do mesmo jogador. Ouvir por
`listenMesaChannel` e reler a cada `SUBSCRIBED`.

## 3. `mesa_rules.rules`

```ts
interface MesaRules {
  sources: { allow: string[]; deny?: string[] };     // ids de livro ('source:player-core', 'source:war-of-immortals'…)
  legacy: boolean;                                   // conteúdo pré-Remaster liberado
  rarity: { uncommon: 'allow' | 'ask' | 'deny'; rare: 'allow' | 'ask' | 'deny' };  // 'ask' = aviso "precisa do GM"
  variants: MesaVariants;                            // REGRAS-OPCIONAIS §6 (mítico com progressão por nível ou por provações)
  startingLevel?: number;                            // sugestão para personagem novo
  wealth?: 'table' | 'free';                         // riqueza inicial pela tabela do GM Core ou livre
  exceptions: { buildId: string; ids: string[]; note?: string }[];  // liberações pontuais
}
```

Valores iniciais para a migration de `mesa_rules` (F0.3):

| Mesa | Variantes | Livros liberados |
| --- | --- | --- |
| Casa do Gordo Online (`casa-do-gordo`) | Confirmadas em 2026-11-24: Free Archetype, Mítico e Ancestral Paragon | Confirmados em 2026-11-24: todos os livros Remaster da carga inicial. Livros legados e livros importados depois exigem liberação do GM. |
| Arton 1515 (`arton-1515`) | Confirmadas em 2026-11-24: Free Archetype, Mítico e Ancestral Paragon | Confirmados em 2026-11-24: todos os livros Remaster da carga inicial. Livros legados e livros importados depois exigem liberação do GM. |

Para as duas mesas, preencha `sources.allow` com os IDs dos livros Remaster da carga inicial concluída na F1 e semeie
`legacy: false`. A importação de livros posteriores só atualiza o catálogo global.

## 4. Pacotes de leitura do catálogo (Storage `rules/<versão>/`)

Gerados a partir do banco ao fim de cada importação (BASE-DE-REGRAS §5); o formato abaixo é o que o motor recebe.

Gerados, nunca editados à mão (correção = `rules-mechanics-save` ou entrada em `corrections.json`).

```
rules/2026.12.1/
  manifest.json           ← { version, generatedAt, files: { lista: { hash, count, bytes } }, sources: [...] }
  core/ancestries.json  core/heritages.json  core/backgrounds.json  core/classes.json
  core/class-features.json  core/deities.json  core/languages.json  core/sources.json  core/tables.json
  feats/class/<classe>.json  feats/ancestry/<anc>.json  feats/general.json  feats/skill.json
  feats/archetype/<arquetipo>.json  feats/mythic.json
  spells/arcane.json  spells/divine.json  spells/occult.json  spells/primal.json  spells/focus.json  spells/rituals.json
  items/weapons.json  items/armor.json  items/shields.json  items/runes.json  items/materials.json
  items/consumables.json  items/worn.json  items/held.json  items/staves-wands.json  items/gear.json
  companions/animal.json  companions/familiar-abilities.json
```

Formato de uma entrada (comum a todos os tipos):

```ts
interface RuleEntry {
  id: string;                 // 'feat:power-attack'
  name: string;               // nome canônico em inglês (chave da AON e do JSON exportado)
  type: 'ancestry' | 'heritage' | 'background' | 'class' | 'classFeature' | 'feat' | 'spell' | 'item' | 'deity' | ...;
  level: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  traits: string[];
  source: { id: string; page?: number };   // 'source:player-core'
  aon?: { id: string; url: string };       // para descrição/tradução e para "conferir na AON"
  remaster: boolean;
  replaces?: string;                       // id do legado que esta substitui
  summary?: string;                        // 1 frase, inglês (o detalhe traduzido vem da AON)
  actions?: '1' | '2' | '3' | 'reaction' | 'free' | null;
  prerequisites?: { text: string; parsed?: Prereq[] };  // parsed = o que o parser entendeu; o resto vira aviso
  rules?: RuleElement[];                   // subconjunto suportado (MOTOR-DE-REGRAS §10)
  unsupported?: string[];                  // chaves de rule element ignoradas → aviso "efeito não calculado"
  // específicos por tipo:
  ancestry?: { hp: number; size: string; speed: number; boosts: AttrSlot[]; flaws: AttrSlot[]; languages: string[];
               additionalLanguages: { count: number; pool: string[] }; senses?: string[]; traits: string[] };
  class?: { hp: number; keyAttribute: AttributeKey[]; perception: number; saves: Record<'fortitude'|'reflex'|'will', number>;
            attacks: Record<string, number>; defenses: Record<string, number>; trainedSkills: { fixed: string[]; additional: number };
            featLevels: { ancestry: number[]; class: number[]; general: number[]; skill: number[] };
            skillIncreaseLevels: number[]; features: { level: number; id: string }[]; spellcasting?: string };
  feat?: { category: 'ancestry' | 'class' | 'general' | 'skill' | 'archetype' | 'mythic' | 'bonus';
           dedication?: boolean; archetype?: string; maxTakable?: number };
  spell?: { rank: number; traditions: string[]; cantrip: boolean; focus: boolean; ritual: boolean; heighten?: string[] };
  item?: { category: string; price: { gp: number }; bulk: number | 'L'; hands?: string; usage?: string;
           weapon?: { die: string; damageType: string; group: string; category: string; range?: number; reload?: string };
           armor?: { ac: number; dexCap: number; strength?: number; checkPenalty?: number; speedPenalty?: number; category: string; group?: string };
           shield?: { ac: number; hardness: number; hp: number; bt: number };
           rune?: { kind: 'potency' | 'striking' | 'resilient' | 'property' | 'reinforcing'; value?: number; for: 'weapon' | 'armor' | 'shield' };
           consumable?: boolean; invested?: boolean; container?: { capacity: number; ignored: number } };
}
```

Tamanho esperado (só campos mecânicos, sem descrição): talentos ~3–4 MB cru / ~500 KB gzip somados, mas o cliente só
baixa as listas que o personagem usa (uma classe, uma ancestralidade, geral, perícia, arquétipos escolhidos).

## 5. Conteúdo caseiro (fase 9)

```sql
create table public.mesa_homebrew (
    id uuid primary key default gen_random_uuid(),
    mesa text not null references public.mesas (id) on delete cascade,
    kind text not null check (kind in ('feat','item','background','heritage','spell','rune')),
    entry jsonb not null,          -- mesmo RuleEntry, id 'custom:<uuid>'
    created_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now()
);
```

Mescla no `RulesData` do cliente depois do catálogo oficial; aparece no seletor com selo "Da mesa". As runas homebrew de
hoje (`customRunes.ts`) e itens caseiros (`homebrewGear.ts`) migram para cá quando a fase chegar.

## 6. Pares cliente × servidor (regra global 7)

- `sanitizeBuildState` (`src/modules/character-builder/sanitize.ts`) ↔ `build-sanitize.js`.
- `slugify` do build (`charId.ts`) ↔ `build-store.js` (e os `SLUG_ALIASES` já existentes).
- `MesaRules` (forma e valores padrão) ↔ `build-store.js`.
- O `check-builder.mjs` roda os mesmos casos nos dois lados.
