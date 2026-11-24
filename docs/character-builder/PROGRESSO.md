# Progresso do Criador de Personagem

## F0 — Decisões e preparação concluídas

- **0.1 e 0.5 concluídas em `01c64ee`.** D1 aprovada em 2026-11-24. O sistema PF2e do Foundry complementa a mecânica e a progressão, com dados de licença compatível em um commit fixo. O catálogo e as descrições vêm da AON. O guia do módulo e seu link no guia da raiz foram criados.
- **0.4 concluída em `9b689b4`.** A fonte complementar foi fixada na release `pf2e-8.7.1` e no SHA completo em [FONTES-DE-DADOS.md](FONTES-DE-DADOS.md). A cobertura das classes será validada na F1.
- **0.2 concluída em `ff7a255`.** D2 e D3 aprovadas em 2026-11-24. Conteúdo caseiro fica para a F9 e as relíquias permanecem no catálogo atual da Ficha. Rascunhos são por mesa e a cópia entre mesas fica para a F9.
- **D4 aprovada em 2026-11-24.** Na F8, o GM poderá criar um personagem e atribuí-lo a um jogador da mesma mesa.
- **D5 aprovada em 2026-11-24.** Exportação em PDF fica fora do escopo. O backup opcional em JSON segue previsto na F7.
- **D6 aprovada em 2026-11-24.** Acima do nível 1, a tabela Character Wealth do GM Core será exibida como referência. O Criador avisa sobre divergências e permite seguir com o valor escolhido.
- **D7 aprovada em 2026-11-24.** A ficha publicada muda após revisar e confirmar **Aplicar na mesa**, durante e fora de sessão. As escolhas são salvas no rascunho ao editar.
- **D8 aprovada em 2026-11-24.** Stamina, Dual Class e Gradual Boosts ficam para a F9 sob pedido de uma mesa.
- **D9 aprovada em 2026-11-24.** `danfigueroa` será a conta administradora inicial da base. A conta foi conferida em consulta somente leitura. A semente entra na F1.
- **0.3 concluída em `6794e1d`.** Casa do Gordo Online e Arton 1515 confirmaram Free Archetype, Mítico, Ancestral Paragon e todos os livros Remaster da carga inicial em 2026-11-24. Livros legados e livros importados depois dependem de liberação do GM. Veja a tabela de sementes em [MODELO-DE-DADOS.md](MODELO-DE-DADOS.md#3-mesa_rulesrules).
- **0.6 concluída em `9fcaaaf`.** A regra global 7 agora registra os pares de validação de `sanitizeBuildState`, `MesaRules` e slug do build para a F2.
- **0.7 concluída em `f5c3f18`.** O export real do Pathbuilder foi preservado em `scripts/rules-data/samples/pathbuilder-inventory-formula.json`. O [contrato da ficha](CONTRATO-FICHA.md#4-equipamento) registra a posição do ID do contêiner e a forma dos grupos de fórmulas.
- **Verificação.** `npm run build`, `npm run lint` e `git diff --check` passaram. O Vite emitiu o aviso de tamanho de bundles.
- **Ajuste proposto para a F7.** Explicitar a leitura do catálogo local na publicação do Criador e a propagação do slug estável aos consumidores do estado da mesa.

## F1 — Base de regras no banco em andamento

- **1.1 concluída em `a0bc4a0`.** Migration local criada e validada em `BEGIN…ROLLBACK`. `pg_database_size` retornou 26.523.315 bytes (25 MiB). A estimativa preliminar é ~40 MB de dados brutos, antes dos índices e da mecânica do Foundry. A projeção final depende da amostra normalizada.
- **1.2 concluída em `c5c5d6a`.** A leitura usa `search_after` e `id.keyword`, com uma requisição por vez e intervalo entre consultas. Verifiquei duas páginas de livros e duas de talentos do Player Core na AON, além de uma falha HTTP simulada com retentativa no mesmo cursor.
- **Verificação.** Build, lint, checagem de whitespace e validação da migration passaram. Os dez exports do elenco cobrem nove classes, e a análise e o roadmap já refletem a contagem.
- **1.3 e 1.4 concluídas em `41199c5`.** A identidade é `tipo:aon_id`, porque a AON repete nomes dentro de `feat`, `equipment` e `class-feature`. O nome e o slug ficam para exibição e busca.
- **1.5 concluída.** A derivação fica em `rules_entries.data.derived` (decisão: é projeção da própria AON e acompanha o `hash`; `rules_mechanics` fica para `foundry` e `manual`, sem conflito de origem na classe). Conferida ao vivo contra as 29 classes Remaster, 500 backgrounds e 371 armas. O que depende de subclasse, divindade, armas de fogo e Lore à escolha vai para `derived.unsupported`. A Longsword sai `Slashing`; armas `modular` ficam sem tipo de dano.
- **Catálogo: `tactic`, `element` e `epithet` incluídos.** Commander, Kineticist e Exemplar. São categorias de jogador da AON que faltavam em `RULE_CATEGORIES`. A AON não tem `ancestry-feature`; essas entradas do Foundry ficam sem casamento.
- **1.6 concluída.** Núcleo em `api/_lib/rules-foundry.js` e leitura do tarball em `scripts/rules-data/foundry-packs.mjs` (commit fixado, só os 11 pacotes de jogador, só JSON, pasta temporária apagada no fim). Conferido contra um despejo completo da AON nas 68 categorias:
  - 17.587 documentos, 16.446 casados (93,5%), 19 ambíguos, 1.122 sem par. Os sem par são sobretudo tesouros e gemas sem mecânica, ações de arquétipo e características que a AON não separa. Resultado: 16.004 linhas (~3,2 MB); 4.040 com rule elements e 1.639 com algo em `unsupported`.
  - Progressão: os níveis de talento (classe, ancestralidade, geral, perícia) e de aumento de perícia das 29 classes batem com a tabela de avanço da AON (`checkProgression`). As características das nove classes do elenco casam, exceto as seis Doctrines do Cleric (a AON tem uma entrada "Doctrine"), Weapon Mastery do Ranger (via `replaced_by` → Martial Weapon Mastery) e Psychic Weapon Specialization. Esses aliases entram no `corrections.json` da 1.7.
  - Não suportados mais frequentes, para priorizar a F4: `ItemAlteration` (861), `AdjustModifier` (154), `DamageAlteration` (77), `Aura` (76), `ActorTraits` (54), `ActiveEffectLike` de habilidades de familiar (32), `CreatureSize` (28).
- **Pendências registradas.**
  - Stylish Tricks também dá um aumento de perícia restrito nos níveis 3, 7 e 15, que o `skillIncreaseLevels` do Foundry não inclui. O motor da F3 trata.
  - Kineticist (Rage of Elements, ago/2023) não tem versão Remaster e sai `remaster: false` pela regra da 1.4. Para a classe entrar, o livro precisa ser liberado na mesa.
- **1.7 concluída.**
  - `spell-slots.json` e `wealth.json` são **gerados** da AON por `scripts/fetch-rules-tables.mjs`, não digitados (decisão: mesma razão do `fetch-creature-tables`). Cobrem as 12 classes conjuradoras e a Character Wealth.
  - As notas de rodapé das tabelas (`*`, `†`) ficam em `notes`. O Animist guarda pares `[classe, aparição]`.
  - Os benefícios de arquétipo vêm de Player Core pg. 215.
  - Conferência com o elenco: Magus 10, Psychic 10 e Cleric 7 batem. O Loki (Magus 7) tem um truque a mais no export, que vem de talento e não da tabela.
  - `exports.json` traz os rótulos e nomes de conjurador do Pathbuilder, tirados do elenco.
  - `corrections.json` traz os aliases da progressão (Doctrines do Cleric, Premonition Reflexes, Psychic Weapon Specialization), cada um com o livro e a página. Com eles, as nove classes do elenco têm progressão 1–20 com todas as características casadas.
- **1.8 concluída.** `scripts/import-rules.mjs` e `api/_lib/rules-store.js`. Migration `base_de_regras` aplicada em produção em 2026-11-24, com a semente de `platform_admins`: 1 linha.
  - **Carga inicial feita.** 161 livros Remaster, 17.613 entradas e 11.774 linhas de mecânica do Foundry. Versões do catálogo: `2026.11.1` (Player Core) e `2026.11.2` (carga completa).
  - **Espaço.** O banco foi de 25 para 67 MB: `rules_entries` ocupa 37 MB e `rules_mechanics` 4,3 MB.
  - **Idempotência.** Reimportar o Player Core deu 0 alteradas. As 45 inválidas são subações sem nome dentro de itens.
  - **Progressão.** Os níveis de talento e de perícia batem com a AON nas 29 classes. As características das nove classes do elenco estão todas casadas.
  - **Aliases novos em `corrections.json`.** Ranger Weapon Mastery, Rogue Debilitating Strikes, Witch Hexes e Magus Studious Spells. Eles eram necessários porque, sem os livros legados, o caminho pelo `replaced_by` não existe.
  - **Sem par na AON, fora do elenco.** Inventor (Churning Mind, Perception Expertise, Anvil's Hardness), Oracle (Oracular Curse, Revelation Spells), Sorcerer (Bloodline Spells) e Thaumaturge (Exploit Vulnerability, Reflex Expertise). O motor avisa; os aliases entram conforme essas classes forem conferidas.
- **1.9 concluída.**
  - **Pacotes da versão `2026.11.2` no bucket `rules`.** 322 arquivos e 10,2 MB no total. Os maiores: `items/consumables` com 1 MB e `core/actions` com 756 KB; os de classe têm dezenas de KB com gzip.
  - **Conferido pelo CDN.** `core/classes` traz as 28 classes, com `featLevels`, `skillIncreaseLevels` e as características ligadas a `class-feature:<aon_id>`.
  - **Rota de reserva.** `?rules=` e `?rules=search` testadas no servidor de dev: 200 com cache imutável, 400 para lista inválida e 404 para lista inexistente, com o erro no idioma do pedido.
  - **`?me=1`** agora traz `rulesVersion`, com cache de 60 s.
- **Próximo passo.** 1.10: `src/modules/character-builder/rules/loader.ts` (pacotes do Storage, IndexedDB `pf2e:rules:<versão>:<lista>`) e `rules/index.ts` (`featsFor`, `spellsFor`, `itemsBy`).
