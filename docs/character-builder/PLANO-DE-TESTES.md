# Plano de testes do Criador

O projeto não tem framework de testes: **os scripts são os testes** (`scripts/check-*.mjs`, `ts-loader.mjs` para importar
TS). O Criador segue o mesmo padrão.

## 1. `scripts/check-builder.mjs` (novo)

```
node scripts/check-builder.mjs            # tudo
node scripts/check-builder.mjs parity     # só a paridade com o elenco
node scripts/check-builder.mjs --verbose
```

Sai ≠ 0 se qualquer caso falhar. Entra na tabela "Mexeu em → Rode" do `AGENTS.md` raiz ("motor do Criador, catálogo de
regras, export").

### 1.1 Paridade com o elenco (o critério CA-01)

Para cada `public/characters/*.json` (10 personagens) e `ardagar8.json`:

1. `importPathbuilder(json) → BuildState`.
2. `compileBuild(state, rules) → build`.
3. Comparar com `normalizeBuild(json.build)` campo a campo:
   - `abilities` (e `breakdown`), `attributes`, `proficiencies`, `lores`, `acTotal`, `mods`, `resistances`,
     `languages`, `size`, `focusPoints`;
   - `feats` (nome, qualificador, tipo, nível — conjunto, ordem livre), `specials` (conjunto);
   - `weapons[].attack/damageBonus/die/str/pot`, `armor[]`;
   - `spellCasters[].perDay/proficiency/spells/prepared`, `focus`.
4. Diferença esperada = entrada em `scripts/rules-data/parity-known.json` com motivo ("export do Pathbuilder 1 abaixo —
   `fixWeaponExports`"). Diferença não listada = falha.

### 1.2 Unidades do motor (casos pequenos e nomeados)

| Grupo | Casos |
| --- | --- |
| Atributos | boosts distintos por grupo; parcial acima de +4 (dois parciais = +1); flaw; boosts alternativos; override |
| Proficiência | rank máximo vence; teto de perícia (mestre < 7, lendário < 15 = aviso); PwL |
| Perícias | duplicidade vira livre; INT extra; Lores |
| PV | ancestralidade + (classe + CON) × nível; Toughness |
| CA | teto de DES; potência; sem armadura; escudo fora da CA |
| Armas | FOR/DES/acuidade; propulsivo; striking; especialização (só com a característica) |
| Slots | níveis de talento por classe; Free Archetype; Mítico; Ancestral Paragon; Ladino/Investigador |
| Concessões | `GrantItem` simples; `ChoiceSet` com filtro; escolha aninhada (parent/child) |
| Pré-requisitos | cada padrão da tabela do MOTOR §11 com ok/fail/unknown |
| Conjuração | tabela de slots por progressão; foco pelo Remaster; preparado de grimório; inato |
| Inventário | carga e sobrecarga; investidos > 10; compra desconta, dar não; contêiner |
| Variantes | Free Archetype; Mítico (chamado no 1º ou depois, talentos pares, destino obrigatório no 12º, talentos do destino do 14º); Ancestry Paragon; ABP (sem runas fundamentais); PwL |
| Avisos | cada código do MOTOR §15 com um caso que o dispara |

### 1.3 Invariantes (CONTRATO-FICHA §8)

Rodados sobre **todo** build gerado nos casos acima:

- `parseCharacterJson` aceita; `normalizeBuild` idempotente; ≤ 64 KB; nomes existem no catálogo; CA fecha; `perDay`
  coerente.

### 1.4 Determinismo e desempenho

- Compilar o mesmo `BuildState` duas vezes = `JSON` idêntico (byte a byte).
- Compilar um nível 20 completo 100× em Node: média ≤ 10 ms (folga para o celular, RNF-03).

### 1.5 Pares cliente × servidor

`sanitizeBuildState` (TS) e `build-sanitize.js` (JS) com os mesmos casos (válido, campo extra, id malformado, nível 0/21,
65 KB). Slug: `slugify` dos dois lados + `SLUG_ALIASES`.

## 2. Base de regras (`import-rules.mjs --check` e a tela do admin)

- Toda entrada tem `aon_id`, `id`, `name`, `category`, `level`, `rarity`, `source_id`, `hash`.
- Contagem por livro igual à da AON (o `--check` lista as diferenças).
- Reimportar um livro sem mudança = 0 alteradas (idempotência pelo `hash`); entrada que sumiu ganha `removed_at`.
- Nenhum id duplicado; nenhum `GrantItem` apontando para entrada inexistente.
- Contagem por categoria não cai mais de 2% entre versões sem explicação no relatório.
- Job interrompido no meio continua do `cursor` sem duplicar.
- Na aba de rede do navegador, abrir o Criador e montar um personagem não chama `aonprd.com`.

## 3. Servidor (`check-auth.mjs` estendido)

Na mesa `arton-1515`, slugs `teste-*`, apagados no fim (o `.env` aponta para produção):

- Jogador cria, salva (rev), conflito 409, lê o próprio.
- Jogador **não** grava build alheio (403); lê somente leitura.
- GM grava build alheio, atribui dono, muda regras da mesa.
- `build-apply` com slug do build (o `build.name` diferente não muda o slug); ficha de outro dono = 403.
- `mesa-rules-save` exige GM real mesmo com `AUTH_REQUIRED` desligado.

## 4. Migrations

`node --env-file=.env scripts/check-migrations.mjs` (pendentes em `BEGIN…ROLLBACK`); depois do push,
`npx supabase migration list`.

## 5. Interface

- **320px**: cada passo do fluxo de criação, o seletor (lista e detalhe), os diálogos de atributos/perícias/arma, a
  revisão. Método do projeto: `<iframe>` da largura certa servido pelo Vite (o Chrome headless do macOS não desce de
  500px); sem login: `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite`.
- Desktop (≥ 900px): três colunas sem barra horizontal.
- Tema claro e escuro; `check-contrast` se houver cor nova.
- Inglês: conta English vê tudo em inglês; `npm run lint` (inclui `check-i18n`).
- `npm run build`: o Criador num chunk próprio; nada dele no bundle principal (conferir a lista de chunks).

## 6. Regressão nos módulos existentes

Depois de cada fase que toca a Ficha ou a publicação: `check-rolls`, `check-economy`, `check-heightening`; abrir as 10
fichas do elenco na Ficha Virtual e conferir Visão Geral, Combate e Magias.

## 7. Aceite com usuários (por fase de lançamento)

- Fase 7 (beta): o GM e 1 jogador de cada mesa refazem o próprio personagem no Criador e comparam com a ficha atual.
- Fase 8: um personagem novo do zero por mesa, no celular.
- Critérios: zero número divergente sem aviso; tempo para subir de nível < 5 min; nenhum bloqueio que obrigue voltar ao
  Pathbuilder.
