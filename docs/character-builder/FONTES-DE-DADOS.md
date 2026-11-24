# Fontes de dados do Criador

> **Resumo**: a AON é a fonte do catálogo e é importada para o **nosso banco** (carga inicial por script, depois só
> livros novos e erratas pela tela do admin) — desenho em [BASE-DE-REGRAS.md](BASE-DE-REGRAS.md). O Criador nunca
> consulta a AON. A camada de mecânica (o que cada talento faz) vem de campos da AON, de tabelas curadas e, se a
> decisão D1 permitir, do sistema PF2e do Foundry.

O Criador precisa de dois tipos de dado:

1. **Catálogo** — o que existe (classes, talentos, magias, itens), com nível, raridade, traços, fonte, pré-requisitos.
2. **Mecânica** — o que cada coisa *faz* na ficha (concede proficiência, abre escolha, dá magia, muda velocidade).

A plataforma já usa a **Archives of Nethys (AON)** para descrições e traduções. A AON resolve o catálogo, mas não a
mecânica (o efeito está na prosa). Para a mecânica, a fonte estruturada pública mais completa é o **sistema PF2e do
Foundry VTT** (repositório `foundryvtt/pf2e`, pacotes em `packs/pf2e/*`), que modela cada entrada com *rule elements*.

O Pathbuilder **não** é fonte: os dados dele estão embutidos no JS compilado do app (`Pathbuilder2eWebRemastered112.0.js`)
e não têm licença de reuso.

## 1. AON (já integrada)

- Índice Elasticsearch `elasticsearch.aonprd.com/aon/_search` (`api/_lib/aon.js`).
- Campos estruturados úteis (conferidos num talento, 2026-11-24): `category`, `name`, `level`, `rarity`, `trait`,
  `actions`, `prerequisite` (quando há), `primary_source`/`source_raw`, `remaster_id`/`legacy_id`, `summary`, `url`, `id`.
- Papel no Criador:
  - **Descrição** no detalhe do seletor (pt via cadeia de tradução, en direto) — pipeline atual, `descriptions`,
    correções humanas.
  - **Conferência** de regras (regra global 8) e de nomes (o nome exportado precisa resolver na AON para a Ficha).
  - **Remaster vs legado**: `remaster_id`/`legacy_id` para esconder a versão antiga.
  - Ligação `RuleEntry.aon` (id + url) para o botão "Ver na AON".

## 2. Sistema PF2e do Foundry (fonte complementar aprovada na D1)

- Use a release [PF2e 8.7.1](https://github.com/foundryvtt/pf2e/releases/tag/pf2e-8.7.1), fixada no commit
  [`397f125aea87e6d6fa36e878c9c07d0e672826cf`](https://github.com/foundryvtt/pf2e/commit/397f125aea87e6d6fa36e878c9c07d0e672826cf).
  Use o SHA completo em `--ref` e no manifesto para reproduzir a ingestão. Pacotes relevantes:
  `ancestries`, `ancestry-features`, `heritages`, `backgrounds`, `classes`, `class-features`, `feats`
  (`ancestry/ archetype/ class/ general/ …`), `spells`, `equipment`, `deities`, `familiar-abilities`, `actions`,
  `conditions`.
- O que ele traz que a AON não traz:
  - Classe: `classFeatLevels`, `ancestryFeatLevels`, `generalFeatLevels`, `skillFeatLevels`, `skillIncreaseLevels`,
    `keyAbility`, `hp`, `perception`, `savingThrows`, `attacks`, `defenses`, `trainedSkills`, e a lista de
    características por nível (`items` com `level`).
  - Ancestralidade: `boosts`, `flaws`, `hp`, `speed`, `size`, `languages`, `additionalLanguages`.
  - Rule elements por entrada (ex.: *Fighter Weapon Mastery* = `ChoiceSet` de grupo de arma + `MartialProficiency`;
    *Arcane School* = `ChoiceSet` filtrado + `GrantItem`).
  - `publication.remaster`, `traits.rarity`, `prerequisites` (texto).
- **Licenças**: o [README do Foundry](https://github.com/foundryvtt/pf2e#licenses) distingue a licença Apache-2.0 do código,
  a OGL 1.0a declarada para a mecânica e a permissão concedida ao projeto pela Paizo. A D1 aprova o uso como fonte
  complementar. Confira a licença aplicável a cada conjunto de dados antes da ingestão:
  - Usar só como **referência de estrutura** e extrair a mecânica (que é regra de jogo, sob ORC/OGL), sem copiar texto
    descritivo nem arte — descrições continuam vindo da AON;
  - Manter o aviso de licença ORC/OGL dos livros na página de créditos (RNF-13);
  - Ferramenta de fã, gratuita, sem conteúdo pago reproduzido além do que a AON publica.
- Alternativa sem Foundry: catalogar a mecânica à mão a partir da AON (muito mais trabalho; o motor fica igual, só a
  ingestão muda). O formato `RuleEntry` foi desenhado para aceitar as duas origens.

## 3. Tabelas curadas à mão (versionadas no repo)

Coisas que nenhuma fonte entrega pronto para o motor, ou que a fonte erra:

| Arquivo | Conteúdo | Conferência |
| --- | --- | --- |
| `scripts/rules-data/spell-slots.json` | slots por rank e nível de cada classe conjuradora Remaster e benefícios Basic/Expert/Master Spellcasting | **gerado** por `scripts/fetch-rules-tables.mjs` da tabela da classe na AON; arquétipo transcrito de Player Core pg. 215; o script compara com o `perDay` do elenco |
| `scripts/rules-data/wealth.json` | riqueza inicial por nível | **gerado** pelo mesmo script da "Table 10-10: Character Wealth" (GM Core pg. 61, `rules-2662`) |
| `scripts/rules-data/exports.json` | nomes de conjurador e rótulos de slot que o Pathbuilder usa (`"Cleric Font"`, `"Free Archetype"`) | os JSONs do elenco |
| `scripts/rules-data/corrections.json` | correções pontuais da ingestão (entrada errada, rule element que falta), cada uma com a referência AON | AON |
| `scripts/rules-data/prereq-patterns.json` | padrões extras do parser de pré-requisitos | casos no `check-builder` |

## 4. Ingestão da mecânica do Foundry (só se D1 = Foundry)

Roda dentro da importação (BASE-DE-REGRAS §4), por livro, preenchendo `rules_mechanics` com `origin: foundry`.

```
node --env-file=.env scripts/import-rules.mjs --mechanics foundry --ref <commit-ou-tag> [--source "<livro>"] [--check]
```

1. **Baixar** o tarball do repositório no commit **fixado** (nunca a ponta da branch; o commit vai no `manifest.json`).
   Arquivo baixado = dado não confiável: extrair numa pasta própria e só **ler JSON** (nada é executado).
2. **Ler** os pacotes necessários; descartar campos visuais (`img`, `description` HTML, `flags` de UI).
3. **Filtrar**: Remaster por padrão; legado marcado (`remaster: false`) para quando o GM liberar; descartar conteúdo de
   aventura que não é de jogador (bestiários).
4. **Normalizar** nomes, categorias e livros para o cruzamento (MODELO-DE-DADOS §4). Separe rule elements suportados
   em `rules` e o restante em `unsupported`.
5. **Casar com a AON** pelo nome exato normalizado (`matchKey`), nunca pelo `namesCompatible`, que é aproximado e serve
   para descrição, não para regra. Use o ID oficial `tipo:aon_id` da entrada casada. Ordem das tentativas: nome na
   categoria; nome nas categorias vizinhas (ritual, subclasse, ação ↔ talento); sem o parêntese final, que vira
   `variant` nos rule elements ("Advanced Vials (Bomber)"); sem o prefixo "X: ". Desempate de homônimos, em ordem:
   nível, classe/traço, marca Remaster, o grau (`item_parent_id`) e a edição mais recente. Uma característica de classe
   repetida em várias classes ("Evasion") vale para todas. Casou a versão legada de algo Remaster no Foundry: siga o
   `replaced_by`. Relate entradas sem correspondência ou com correspondência ambígua.
6. **Conferir a progressão** de cada classe com a tabela de avanço da AON (`checkProgression`): níveis de talento e de
   aumento de perícia têm de bater. Os extras de Skillful Lessons e Stylish Tricks contam como talento de perícia.
   Característica fora da linha é aviso de nome.
7. **Aplicar** `corrections.json` e as tabelas curadas.
8. **Particionar** em arquivos por tipo/lista; gerar `manifest.json` (versão, hash, contagem, bytes).
9. **Relatório** (`--dry-run` mostra só isto): entradas novas/removidas/alteradas desde a versão anterior, sem AON,
   rule elements não suportados mais comuns (prioriza o que implementar).
10. Rodar `check-builder.mjs` contra a versão nova antes de publicar.

**Versão**: `YYYY.MM.n` (`rules_catalog_versions`). Mudou o catálogo → pacotes novos em `rules/<versão>` no Storage; os
anteriores ficam até nenhum build referenciá-los (o cliente abre builds velhos com a versão deles e oferece "Atualizar
regras").

## 5. Idioma

- Nomes canônicos ficam em inglês no catálogo (chave da AON e do JSON).
- Na tela, português mostra o nome traduzido quando existe tradução **conferida** (dicionário de termos do Remaster, o
  mesmo vocabulário de `translateX`/`traitLabel`), com o original entre parênteses no detalhe. Sem tradução conferida, o
  nome fica em inglês (é o que a Ficha já faz com magias).
- Descrições: pipeline atual (pt traduzido e cacheado; en direto da AON).

## 6. Riscos

| Risco | Mitigação |
| --- | --- |
| Licença/uso dos dados do Foundry | Decisão D1 antes da fase 1; alternativa AON-à-mão mantém o motor |
| Rule element mal modelado na fonte | `corrections.json` + paridade com o elenco + aviso "efeito não calculado" |
| AON muda o índice (já aconteceu: `---` no `text`) | Ingestão roda offline e versionada; o Criador não depende da AON para compilar |
| Catálogo grande demais para o celular | Pacotes por lista, cache IndexedDB, só o que o personagem usa |
| Banco cheio (plano gratuito) | ~40 MB cru estimados para o Remaster; legado só sob demanda; conferir `pg_database_size` |
| Nome diferente entre Foundry, AON e Pathbuilder | Casamento por `namesCompatible` + relatório + `exports.json` |
