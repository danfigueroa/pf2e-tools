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
- **1.10 concluída.**
  - `rules/loader.ts` carrega na ordem: memória → IndexedDB `pf2e-rules` (chave `pf2e:rules:<versão>:<lista>`) → Storage → reserva `?rules=`. Se o IndexedDB estiver bloqueado, fica só na memória.
  - `rules/index.ts` traz `featsFor`, `spellsFor`, `itemsBy` e as listas de `core/`. `rules/types.ts` é o `RuleEntry` real dos pacotes.
  - A versão vem do `?me=1` por `src/services/rulesVersion.ts`, separado do `auth.ts` para o chunk do Criador não puxar a sessão. Sem ela, vem do manifesto.
  - Teste no Node contra a API de dev: Magus com Human, geral, perícia e Psychic até o nível 7 deu 320 talentos, 411 magias arcanas até o rank 4 e 365 armas. Foram 8 pedidos, só das listas usadas; a segunda consulta saiu da memória. Nenhum pedido à AON.
- **1.11 concluída.** `scripts/build-rules-fixture.mjs` gera `scripts/rules-data/fixture.json` (~0,8 MB, versão `2026.11.2`) a partir dos pacotes publicados. Entram inteiras as listas pequenas do `core`; das demais, só o que os 10 personagens do elenco usam, mais as características da progressão das classes deles.
- **Achado para a F7 (paridade com o elenco).** 98 nomes do elenco não têm entrada no catálogo Remaster:
  - **Conteúdo legado.** Android, Fleshwarp e Artisan Android (Impossible Lands), Lesser Scion, Hydra's Bond, Wavetouched Paragon, Genie-Blessed, Mentalist's Staff (Greater)… A paridade vai exigir importar esses livros com `--source` e liberá-los nas mesas (D3/0.3: livro legado depende de liberação do GM).
  - **"Specials" compostos do Pathbuilder.** Atributos, perícias e rótulos como "Studious Spell: Blur", "Empiricism Selected Skill: Occultism" e "Standard Cantrip: Shield (Archetype)". O compilador gera esses rótulos; eles não vêm do catálogo.
  - **Caseiros.** Braço Sônico, Miranda's Arm e Loki's Heart, todos do catálogo de relíquias da Ficha (D2).
  - **Opções com outro nome na AON.** "Thief Racket" é "Thief"; "Giant Instinct" é "Giant". Entram no `exports.json` ou no `corrections.json` na F7.
- **1.12 concluída.**
  - `/creditos` (`src/pages/CreditsPage.tsx`, chunk próprio de 2,8 KB gzip) tem um link no rodapé da sidebar, ao lado do aviso de fã.
  - O texto da Community Use Policy (paizo.com/licenses/communityuse) e o ORC Notice (paizo.com/orclicense, seção a) estão citados literalmente, em inglês nos dois idiomas, porque são texto legal. A Attribution Notice lista os livros importados como "© Paizo Inc.", lidos de `core/sources`.
  - Os pacotes passaram a listar só livros com entradas importadas: 80 de 161.
  - Conferido em 320 px e no desktop pela captura via CDP do Brave; o `--screenshot` do Brave headless trava neste Mac.
- **F1: estado do "Pronto quando".**
  - As contagens por livro batem com a AON. A diferença está só nas 45 subações sem nome.
  - As nove classes do elenco têm progressão 1–20 completa.
  - O carregador não faz chamada à AON. Conferido na rede com a primeira tela do Criador (F2): abrir "Criação de personagem" em `/mesa` pediu só o manifesto e `core/sources` do nosso catálogo e listou os 80 livros, com 0 pedidos à AON.

## F2 — Esqueleto e persistência concluída

- **2.1** Migration `criador_de_personagem` aplicada em produção em 2026-11-25. `character_builds` (teto de 96 KB no `state`, além dos 64 KB do servidor), `character_build_versions`, `mesa_rules` e `sheets.build_id`.
  - O teto de 30 versões por build é um trigger no insert, não `pg_cron`: corta na hora, como o `publish_sheet`. A lixeira (30 dias, só sem ficha aplicada) é `pg_cron`.
  - Semente de `mesa_rules` nas duas mesas: os 80 livros Remaster com entradas, `legacy: false`, Free Archetype, Mítico (progressão por nível) e Ancestral Paragon.
  - **Decisões.** Raridade padrão `ask` (incomum e raro geram aviso "pedir ao GM", nada é negado). Nível inicial 1 e riqueza pela tabela do GM Core. A chave da variante ficou `ancestralParagon` nos dois tipos; a REGRAS-OPCIONAIS dizia `ancestryParagon`.
- **2.2–2.5** `build-sanitize.js`, `build-store.js` e `build-handler.js`, despachados antes da ficha. O `server/index.mjs` já usa o mesmo `routeState`, então o dev local ganhou as rotas sem mudança.
  - Escrever é do dono ou do GM **real** mesmo com `AUTH_REQUIRED` desligado, porque o build tem dono desde o nascimento. Criar exige estar logado.
  - O slug é o primeiro livre na mesa entre builds e `sheets` (`ana`, `ana-2`…). Renomear não muda o slug.
  - `build-assign` (GM troca o dono) entrou já, porque o `check-auth` pedia. O "Criar para…" na tela fica para a F8.
  - A lista traz `ownerName` pela função `member_names`, a mesma da autoria da Wiki.
  - Sem Supabase, o handler usa um GM local (`local`), para a interface rodar no modo memória.
- **2.6** `types.ts`, `sanitize.ts` e `mesaRules.ts` no cliente. `buildSlugFromName` em `charId.ts`. `scripts/check-builder.mjs` roda 62 conferências com os mesmos casos nos dois lados.
- **2.7–2.10** Rota `/personagens/:buildId?` (chunk próprio de 8 KB gzip) e item "Personagens" em JOGO, com palavras-chave na busca.
  - A lista tem "Meus personagens", "Da mesa" (de quem é) e a lixeira com Restaurar. O estado mostra Rascunho, Publicado ou Alterações não publicadas.
  - O editor tem nome, nível e Detalhes, além de mandar para a lixeira. O personagem de outra pessoa abre somente leitura, com `ReadOnlyTheme`.
  - O `useBuild` salva 1,5 s depois da última mudança e guarda o rascunho local por mesa. Ele reenvia quando a rede volta e abre o diálogo de conflito no 409.
  - Conferido no navegador em 320 px e no desktop. Digitar mudou o estado para "Salvo" e o servidor recebeu o `rev` 2. Uma gravação concorrente abriu o diálogo de conflito.
  - **Fora da F2.** O retrato no cartão espera os detalhes chegarem ao cabeçalho da lista (F8, com o portrait). "Importar do Pathbuilder" é da F7.
- **2.11** Seção "Criação de personagem" em `/mesa`, em chunk próprio. Tem as variantes, a raridade, o nível e a riqueza inicial, além dos livros com filtro e o conteúdo legado. Variantes que o motor ainda não calcula (ABP, PwL, Dual Class e Gradual Boosts) podem ser ligadas, com a nota de que saem com aviso.
- **2.12** O `check-auth` cobre criar, salvar com `rev`, 409, 403 para build alheio, leitura somente leitura e lista sem `state`. Cobre também GM gravando e atribuindo dono, 413, lixeira e regras da mesa: GM real exigido inclusive com a cobrança desligada. Tudo certo, sem sobra de dados de teste.
- **Verificação.** Build, lint, `check-builder`, `check-auth` e `check-migrations` passaram. Nada do Criador entrou no bundle principal.
- **Próximo passo.** F3 (origem, classe nível 1, atributos e perícias) e F1B (atualização da base pela plataforma). A F3 depende de F1 e F2, ambas prontas.

## F1B — Atualização da base pela plataforma concluída (exceto 1B.10, opcional)

- **Núcleo em `api/_lib/rules-platform.js`.** Verificar, importar em passos e publicar. O `import-rules.mjs` passou a usar os mesmos passos sem prazo, então só existe uma lógica de importação.
  - **Verificar novidades.** Os livros vêm em 4 páginas da AON e a contagem por livro numa agregação só, em ~4 s. Um livro importado vira "errata nova" (`status = 'outdated'`) quando o texto da errata ou a contagem na AON muda. Primeira verificação em produção: 161 importados, 137 legados, 45 sem conteúdo de jogador e nada novo.
  - **Importar.** O passo lê páginas por até 35 s e grava o cursor a cada página; o navegador repete até acabar. Reimportar Wake the Dead #5 pela API de passos deu 0 alteradas e nenhuma versão nova.
  - **Publicar.** Montar os 322 pacotes leva ~2 s. Só as listas com hash novo são gravadas; as outras são copiadas da versão anterior (16 por vez). Teste em produção: a versão `2026.11.3`, idêntica à `2026.11.2`, copiou 321 listas em 20 s, com 8 por vez na época.
  - **Decisão: o Foundry fica só no script.** A mecânica do Foundry precisa do tarball fixado e não roda na Vercel. Pela tela, as entradas novas entram com a mecânica derivada da própria AON; o relatório conta as "sem mecânica". O admin preenche o que faltar pela correção manual ou roda `--mechanics-only` quando o commit do Foundry subir. As tabelas curadas vêm da versão anterior.
- **Rotas de admin em `rules-handler.js`.** Ficam no `state`, antes do Criador, e são só para `platform_admins`. Um passo por vez usa a trava `rules-import:<job>`. Falha da AON ou do Storage devolve 502 e o job segue com o cursor salvo.
- **1B.7 Correção manual de mecânica.** Exige a referência (livro e página) e grava `origin = 'manual'` com `reviewed`; o Foundry não passa mais por cima. Para chegar ao Criador, a tela tem "Publicar versão nova".
  - **Migrations.** A `correcao_manual_de_mecanica` foi aplicada **vazia**: o comando que a escrevia foi interrompido. Como migration aplicada não se edita, as colunas `note` e `updated_by` vieram na `nota_da_correcao_de_mecanica`.
- **1B.8 Verificação semanal.** O cron diário do `/api/health` verifica de novo quando a última verificação tem mais de 7 dias. Ela nunca importa sozinha. O aviso ao admin é o selo "N novidades" no item Base de regras (`?me=1` traz `platformAdmin` e `rulesNews`), em vez de notificação de mesa, porque a base não é de mesa nenhuma.
- **1B.6 Tela `/plataforma/regras`.** Fica em chunk próprio, com item só para admin na seção MESA, visível em qualquer mesa e com qualquer papel.
  - Mostra a versão, as entradas e quando foi a última verificação. Tem filtros por estado e linha de produto, busca, seleção, barra de progresso com "Continuar" e "Cancelar", o relatório das últimas importações e o editor de mecânica.
  - Conferida em 320 px e no desktop, com a resposta da API real interceptada no navegador de teste, porque o modo local não tem login.
- **1B.9 Faixa "Regras atualizadas" no editor.** Aparece quando a `rulesVersion` do build difere da atual. "Usar as novas" atualiza o build. O "N números mudaram" depende do motor (F3+).
- **1B.11.** O `check-auth` confere que jogador e GM comum recebem 403 em todas as rotas de admin, também com a cobrança desligada, e que o `?me=1` deles não traz `platformAdmin`.
- **Fora.** 1B.10 (pré-traduzir um livro) é opcional e ficou para depois.
- **"Pronto quando" da F1B.** Reimportar sem mudança não altera nada (conferido). Importar um livro novo pela tela depende de a AON publicar um; hoje não há nenhum Remaster novo. Um livro legado importado pela tela entraria na base sem aparecer nas mesas, até o GM liberar.

## F3 — Origem, classe (nível 1), atributos e perícias concluída (falta a conferência M1 no Pathbuilder)

- **Regras conferidas na AON Remaster antes de codificar, com livro e página no código.** Os 🔎 de nível 1 do MOTOR viraram ✅:
  - Atributos: Player Core pg. 17 (boost, parcial em +4, grupos distintos), pg. 23 (boosts alternativos, flaws voluntários), pg. 84 (background) e pg. 92 (boosts a cada 5 níveis).
  - Perícias: Player Core pg. 225 e pg. 84 (treino repetido vira livre) e pg. 92 (aumentos e tetos). pg. 29: aumento de INT dá uma perícia e um idioma a mais.
  - Idiomas, Player Core pg. 89. Derivados: Player Core pg. 11 (proficiência), pg. 91 (PV), pg. 271 (CA), pg. 26 (salvaguardas), pg. 25 (Percepção) e pg. 27 (CD de classe).
  - As 29 classes Remaster da AON dizem "Trained in <classe> class DC".
- **Duas lacunas da derivação, achadas pelo motor e corrigidas na base.**
  - **Boosts do Humano e do Orc.** A AON escreve "Two free ability boosts", que se perdia. O Player Core foi reimportado pela plataforma: 2 alteradas, versão `2026.11.4`, 1 lista regravada e 320 copiadas, em 11 s. Foi o primeiro uso real da F1B.
  - **Ancestralidade da herança.** A AON não liga a herança à ancestralidade em campo nenhum. Ela veio do Foundry (`system.ancestry`), na coluna nova `rules_mechanics.extra` (migration `dados_extras_do_foundry`). Depois veio o `--mechanics-only`, que agora publica versão nova (`2026.11.5`) em vez de sobrescrever a atual, cujo caminho é imutável no CDN.
- **Motor em `engine/`** (`compile.ts`, `attributes.ts`, `skills.ts`, `types.ts`): TS puro, sem rede.
  - Calcula atributos com parciais e o `breakdown` do export, proficiências iniciais da classe, PV, CA sem armadura, salvaguardas, Percepção, CD de classe, deslocamento, tamanho e sentidos (inclusive o `Sense` da herança).
  - Calcula também as perícias: automáticas, escolha da classe, livres + INT + repetidas, Lore livre, perícia pela INT e aumentos com teto.
  - E os idiomas pela INT.
  - **Avisos.** Boost repetido ou fora das opções, flaw duplo, livro, legado e raridade pelas regras da mesa, herança de outra ancestralidade, efeito não calculado, escolha órfã com "descartar", PV de ancestralidade desconhecido. Acima do nível 1, avisa que as características de classe ainda não entram (F4).
- **`check-builder`: 105 conferências.**
  - Um Humano Guerreiro nível 1 com números tirados das regras: PV 20, CA 15, FORT/REF +7, VON +4, Percepção +6, CD 17.
  - Casos de borda e a herança vinda do Foundry.
  - **Atributos do elenco.** Ceros, Eldarion, Ghan Buri, Thalos e Woyd batem exatamente com o export do Pathbuilder, parciais incluídos. Brukuthur, Loki, Miranda e Nathaniel usam conteúdo legado. Hearts Folly tem atributos editados à mão (o export não traz a memória dos boosts).
- **Interface.**
  - O seletor (`ContentPicker`) tem busca, raridade, "só o liberado na mesa", ↑/↓/Enter, tela cheia no celular com detalhe em segunda camada e duas colunas no desktop. A descrição completa sai do pipeline de descrições, sob demanda.
  - Abas Origem (com idiomas, boosts alternativos e flaws voluntários), Classe (atributo-chave), Atributos (grupos com "Restam N") e Perícias (pips T/E/M/L, Lore livre).
  - Resumo fixo com a conta de cada número no `title`. Pendências e avisos ficam ao lado no desktop e numa gaveta no celular.
  - Conferido no navegador em 320 px e no desktop, com o catálogo real do Storage e builds em memória. Os números da tela batem com o caso do `check-builder`.
- **Decisões.**
  - Lista de livros da mesa vazia = sem restrição, para uma mesa nova não esconder o catálogo inteiro.
  - Heranças versáteis saem do seletor de ancestralidade.
  - Lista sem virtualização: a maior das listas da F3 tem ~300 itens. A virtualização entra com os talentos (F4), se medir lentidão.
- **Pendente.**
  - **3.10.** Os textos de tela são bilíngues. Os nomes do conteúdo (ancestralidades, classes) seguem em inglês canônico, como no export e na AON; a tradução desses nomes depende do pipeline de descrições.
  - **"Pronto quando" M1.** Criar um nível 1 de cada classe do elenco no Pathbuilder e comparar PV, CA, salvaguardas, Percepção e perícias. O gabarito automático cobre os atributos de 5 personagens e o Guerreiro calculado pelas regras; a conferência no Pathbuilder, pelo Brave, fica para a próxima sessão.
- **Próximo passo.** F4: progressão 1–20, talentos (com `ContentPicker` e pré-requisitos), características de classe por nível e as variantes (Free Archetype, Mítico, Ancestral Paragon).

## F4 — Progressão 1–20, talentos e variantes concluída (com pendências registradas)

- **Variantes conferidas na AON.** Free Archetype: GM Core pg. 84, um talento de arquétipo extra no 2º e em todo par. Mítico: War of Immortals pg. 77, talento mítico extra nos pares e destino obrigatório no 12º. Ancestry Paragon: Gamemastery Guide pg. 194, só legado — dois talentos de ancestralidade no 1º e um em cada ímpar. Arquétipo ocupa slot de classe e a trava da dedicação vêm do Player Core pg. 215. Combat Flexibility e Improved Flexibility: Player Core pg. 136. Path to Perfection: Player Core 2 pg. 114.
- **Achado sobre a semente das mesas.** O elenco usa o **talento geral** "Ancestral Paragon" (Thalos e Woyd, no 3º), não a variante Ancestry Paragon. Com a variante ligada, sobram slots de ancestralidade no 3/7/11… em todos os personagens. A semente de `mesa_rules` (F0.3) liga a variante nas duas mesas; **o GM deve desligá-la em `/mesa`** se a intenção era o talento. Não mudei a regra em produção porque foi decisão confirmada pelas mesas.
- **Proficiências por nível.** As regras do Foundry para "Fortitude Expertise", "Juggernaut" e afins vêm vazias. A fonte passou a ser o texto da AON, derivado em `classFeature.proficiencies` (`rules-derived.js`):
  - Formas aceitas: "proficiency rank for X increases to R", "…increases to R with X", "gain expert proficiency in X" e "become an expert in X".
  - Vão para `unsupported`: o que depende de escolha (grupo de arma, a salvaguarda escolhida), frase condicional ("If you have qi spells") e arma específica (armas de fogo, bombas).
  - Base reimportada inteira duas vezes pelo script: `2026.11.6` (279 alteradas) e `2026.11.7` (4 alteradas, Weapon Tricks e afins), ambas só com `core/class-features` regravada. Na segunda, o download do tarball do Foundry estourou o tempo; o loader passou a aceitar `FOUNDRY_TARBALL=<arquivo do mesmo commit>` e o limite subiu para 15 min.
- **Motor.** `slots.ts` (slots por nível, variantes e slots de característica), `feats.ts` (validações e efeitos), `prereqs.ts` (pré-requisitos por parte, `ok/fail/unknown`), `classChoices.ts` (subclasses e salvaguarda do Path to Perfection) e `rulesIndex.ts` (por id e por nome).
  - **Efeitos suportados.** `FlatModifier` sem predicado (Toughness, Fleet), `ActiveEffectLike` de rank com a escolha do `ChoiceSet` (Canny Acumen, Fighter), `ChoiceSet` (lista, perícias ou talento filtrado → slot filho) e `GrantItem` de talento.
  - **Concessões.** Talento do background e talentos concedidos por característica (Shield Block do Fighter).
  - **Avisos.** `LEVEL_TOO_LOW`, `WRONG_SLOT`, `DUPLICATE_FEAT`, `DEDICATION_LOCK`, `PREREQ_FAIL`/`PREREQ_UNKNOWN`, `UNSUPPORTED_EFFECT`, `UNSUPPORTED_CHOICE` e `SAVE_CHOICE_REPEAT`.
- **`check-builder`: 132 conferências.**
  - **M2.** Os slots de talento dos 10 personagens do elenco são iguais aos do Pathbuilder. Os talentos do export preenchem os slots sem pendência fantasma; 22 talentos legados ficam fora do recorte.
  - **Ghan Buri nível 10.** Percepção, salvaguardas, armas e armaduras iguais ao export.
  - **Comparação de proficiências sem talentos.** Sete das dez classes batem no nível atual, inclusive o Rogue (Weapon Tricks, "gain expert proficiency"). As três diferenças dependem de escolha: Monk (Path to Perfection), Investigator (o talento Canny Acumen) e Cleric (a doutrina, ainda com aviso).
- **Interface.** Aba Progressão com acordeão por nível (níveis futuros esmaecidos como "planejado") e o seletor de talentos: candidatos pelo tipo e pelo teto de nível, motivo de inelegibilidade na linha e no detalhe. Há ainda escolhas de classe, de salvaguarda e escolhas filhas (lista ou talento) e um navegador de arquétipo que baixa a lista dele. Conferida em 320 px e no desktop: Fighter 3 com Toughness dá PV 47, Vontade +8 (Bravery) e CD 19.
- **Também feitos.** `Sense`, `BaseSpeed` e `Resistance`/`Weakness`/`Immunity` fixos. Ancestralidade e herança passam pelo caminho dos talentos: Versatile Human abre o talento geral e Cavern Elf dá visão no escuro. O chamado mítico é escolha quando o personagem é mítico; no 12º, um aviso lembra que o talento mítico é o de destino.
- **Falta (fica para depois, com aviso no motor).**
  - **4.2:** `MartialProficiency` (armas de fogo do Gunslinger).
  - **4.3:** ikons, táticas, runas, aparições, lições e tese arcana têm contagem por conferir. A progressão da doutrina do Cleric ainda não é calculada.
  - **4.7:** qualificador de talento (Assurance (X)) e repetíveis pela regra do talento.
  - **4.8a:** conferir o traço dos talentos de destino (o aviso do 12º não confere o traço) e o mítico por personagem na tela.
- **Próximo passo.** F5: magias.

## F5 — Magias concluída (núcleo; pendências registradas)

- **Conjuração da classe derivada da AON** (`class.casting` em `rules-derived.js`).
  - Tradições vêm de `tradition_markdown`; mais de uma significa que a subclasse decide (Witch, Sorcerer, Summoner), e o jogador escolhe a tradição.
  - O tipo sai da seção "Spellcasting": "repertoire" é espontâneo, "prepare" é preparado.
  - O atributo sai da frase "spell DC use(s)/calculated using your X modifier"; o Magus conjura com INT, e o Psychic usa o atributo-chave.
  - O Animist mistura preparado e repertório: fica `mixed`, com aviso.
- **Motor** (`engine/spells.ts`).
  - Conjurador da classe: magias por dia pela tabela gerada da AON (`spellSlots`), proficiência inicial (`class.spellcasting`) com as subidas das características ("Expert Spellcaster"…), CD e ataque.
  - Escolhas: grimório (Wizard, Magus), preparadas com cópias e "Restam N" e repertório. O tamanho do repertório por rank ainda não é conferido e fica com aviso.
  - Validação de rank e tradição.
  - Foco: escolha do jogador na lista de foco, porque o Foundry quase nunca concede por regra. O pool é o número de magias de foco que gastam ponto, até 3 (Player Core pg. 298), e elas são lançadas na metade do nível.
  - Rituais.
- **Aba Magias.** Um cartão por conjurador (tradição, atributo, CD/ataque, magias por dia, grimório, ranks), mais foco e rituais. Conferida em 320 px e no desktop com um Magus 7: CD 21, ataque +11 e as magias por dia do Impossible Magic pg. 9.
- **Base reimportada** com `casting`: versão `2026.11.8` (12 classes alteradas, só `core/classes` regravada).
- **`check-builder`: 152 conferências.** Thalos (Psychic 10), Woyd (Cleric 7), Nathaniel (Magus 10) e Loki (Magus 7) batem em tradição, tipo, atributo e magias por dia. O Loki tem um truque a mais, que vem de talento. A proficiência bate em todos, menos no Woyd, porque segue a doutrina do Cleric. Pool de foco e tradição com maiúscula da AON também têm caso.
- **Pendente.**
  - Conjuradores de arquétipo (Basic/Expert/Master Spellcasting) e inatos: o Aeromancer, o Caster Arcane Sense e o Mythic Magic do elenco.
  - Magias concedidas por escolha (escola, domínio, mistério).
  - Tamanho do repertório espontâneo.
  - O truque extra do Loki, que vem de talento.

## F6 — Equipamento e companheiros concluída (núcleo; pendências registradas)

- **Regras conferidas na AON.**
  - Player Core: Volume (pg. 269, 5 + FOR e máximo 10 + FOR); moedas (pg. 269, mil = 1 Volume, arredondado para baixo); CA com teto de DES e Força da armadura (pg. 271); ataque e dano com acuidade, arremesso e propulsiva (pg. 275); riqueza inicial de 15 po (pg. 10).
  - GM Core: investidos até 10 (pg. 219), runas de armadura (pg. 226) e de arma (pg. 236).
  - Grupo de arma do Fighter Weapon Mastery e da Weapon Legend: Player Core pg. 136. Especialização em armas, 2/3/4 e na versão maior 4/6/8: texto das características na AON.
- **Motor (`engine/equipment.ts`).**
  - Itens resolvidos pelo catálogo (o item específico usa os números da base); preço, compras e sobra; Volume com moedas; investidos.
  - Armadura vestida: CA, teto de DES, Força, penalidades. O escudo fica fora da CA, como no export. O resiliente entra nas salvaguardas.
  - Golpes das armas e o punho do catálogo: ataque, dados com striking, dano com FOR/propulsiva/especialização e overrides com aviso.
  - **Avisos.** `ENCUMBERED`, `OVER_BULK`, `INVESTED_LIMIT`, `NEGATIVE_MONEY`, `RUNE_SLOTS`, `SPECIFIC_ITEM` e `WEAPON_OVERRIDE`. Dano extra de runas de propriedade sai como "efeito não calculado".
  - A escolha de grupo de arma é calculada e aparece na aba Progressão.
- **Livro de fórmulas:** campo novo `formulas` no `BuildState`, nos dois sanitizadores, com caso no par cliente × servidor.
- **Companheiros:** companheiro animal (tipo, avanço e especialização do catálogo) e familiar (específico e habilidades). Os números continuam com a Ficha (`companionStats.ts`). O número de habilidades do familiar ainda não é conferido.
- **Aba Equipamento:**
  - Dinheiro, com a referência de riqueza (15 po no nível 1; acima, a tabela do GM Core pg. 61).
  - Inventário por categoria, com quantidade, origem (comprado/ganho), vestido/investido e o diálogo de runas.
  - Golpes com a conta no `title`, livro de fórmulas e companheiros.
  - Conferida em 320 px e no desktop com o catálogo real: Fighter 10 com CA 29 e deslocamento 20 (Full Plate com a Força atendida).
- **`check-builder`: 164 conferências.** Ghan Buri: Warhammer com ataque +23, dano +8 e 2d8; CA 29 com o Hero's Plate +1; resiliente +1; escudo de 3 fora da CA; punho. Também: carga, dinheiro negativo e o Volume das moedas. O recorte passou a incluir a base dos itens específicos e o punho.
- **Redesign da aba (Mochila e bancada, canvas "Equipamento").**
  - Medidores de dinheiro livre, Volume (com a marca de sobrecarga em 5 + FOR) e investidos; cartões "Em uso" com os encaixes de runa em losango; mochila por tipo ou por onde está, com − e + nos consumíveis.
  - Bancada: degraus de potência, striking, resiliente e reforço com nível e preço do catálogo (⚠ acima do nível, sem travar); encaixes de propriedade; material; ajustes do golpe; golpe e CA na hora; custo; transferir runas, duplicar e remover.
  - "Gravar runa": runas de propriedade do tipo do item, com ✗ e o motivo quando o "Usage" da AON não cabe (arremesso, corpo a corpo, tipo de dano, traço, categoria de armadura).
  - Catálogo com sacola: categorias e subcategorias de consumíveis, "até o nível", "permitido na mesa", ordem, Comprar/Ganhei e onde guardar; o grupo sem preço some quando tem variantes. Item caseiro na mesma janela.
  - **Motor:** runa comprada entra no gasto, pelo preço da variante no catálogo (GM Core pg. 223–224: upgrade custa a diferença, então o item vale a base mais cada runa no degrau atual). `check-builder` com o caso do +2 Striking Flaming.
  - Sem conferência no navegador nesta rodada (renderizado em SSR com o catálogo real).
- **Pendente.**
  - Comprado/Ganho por runa (hoje a runa segue o item).
  - Custo da transferência de runa (10% do preço, GM Core pg. 224) e do material: aparecem como texto, não descontam.
  - Dano extra das runas de propriedade (o dado de runa não está no catálogo).
  - Materiais além do rótulo; contêineres (capacidade).
  - Penalidade de teste da armadura nas perícias; Adventurer's Kit separado.
  - Arachnid Harness e o companheiro do Ardagar, que ficam para a paridade da F7.

## F7 — Modo editar, aplicar na mesa e importação concluída (beta; pendências registradas)

- **Retrato (`engine/export.ts`).** É o `BuildInfo` completo do CONTRATO-FICHA:
  - Identidade, atributos com o `breakdown`, proficiências sem nível, talentos em tupla com o rótulo do slot do Pathbuilder, `specials` (com Path to Perfection e a escolha).
  - Armas sem o punho (a Ficha já soma o dela), armaduras e escudos, equipamento, dinheiro depois das compras.
  - Conjuradores com grimório e preparadas, foco, rituais, companheiros e familiares, `acTotal`, `mods`, resistências e fórmulas.
  - Extensões em `build.covil`: `buildId`, avisos, ids das escolhas, variantes, chamado mítico e o punho em `unarmed`.
- **Importação (`engine/import.ts`).**
  - Origem, boosts (alternativos e flaws), idiomas e talentos pelo rótulo do slot; filhos pelo `ChoiceSet` do pai; Path to Perfection pelo nome; grupo de arma pela proficiência específica.
  - Perícias: as automáticas, depois as livres, depois os aumentos do nível mais baixo, respeitando os tetos.
  - Inventário com runas, magias da classe (repertório, grimório e preparadas), foco, rituais e companheiros.
  - Relatório do que não casou.
- **Paridade (PLANO §1.1) no `check-builder`: 214 conferências.** Os 10 personagens fazem importar → recompilar → exportar.
  - Invariantes: `parseCharacterJson` aceita o retrato, até 64 KB, CA = 10 + partes.
  - Diferenças: o **Ghan Buri não tem nenhuma**. As outras 71 estão em `scripts/rules-data/parity-known.json`, cada uma com a explicação: conteúdo legado ou caseiro fora do catálogo Remaster, ranks de perícia vindos de talentos que o motor não modela (Additional Lore, por exemplo), conjuradores de arquétipo e inatos, doutrina do Cleric, truque extra de talento.
  - Diferença nova faz o teste falhar.
- **Servidor.**
  - `build-apply` (dono ou GM) usa o slug estável do build e o mesmo preparo da publicação: `createSheetDraftFor`, extraído do `draft-create`.
  - Ao fim do preparo, liga `sheets.build_id`, grava `character_build_versions` e marca `published_rev`.
  - Também: `?buildVersions=`, `build-version-restore` e `build-create` com `fromSheet` (herda o slug da ficha; só o dono da ficha ou o GM).
  - O `check-auth` cobre: aplicar com o nome trocado mantém o slug; o colega leva 403 ao aplicar e ao ler as versões.
- **Cliente.**
  - "Aplicar na mesa" (avisos e pendências antes, preparo com progresso, "Abrir na Ficha"), "Baixar JSON" (backup) e "Versões" com restaurar.
  - Na Ficha: "Editar no Criador", quando há `covil.buildId`, ou "Importar para o Criador" na ficha publicada. Só para quem edita e fora do painel do mapa.
  - A importação (`/personagens?importar=<slug>`) carrega as listas que a ficha usa, importa e cria o build com o mesmo slug; se já existe, só abre. A ficha da mesa não muda até aplicar.
- **Decisões.**
  - O modo editar abre na rota do Criador (`/personagens/:id`), em vez de embutido na Ficha em `?modo=editar`: mesmo efeito, sem pôr o Criador no chunk da Ficha. Embutir fica para a F8.
  - O punho não vai em `weapons[]`, porque a Ficha soma o próprio (`unarmed.ts`); vai em `covil.unarmed`.
- **Completados depois.**
  - **7.8.** A Ficha usa o ataque e o dano de `covil.unarmed` para o desarmado de mesmo nome; o `unarmed.ts` fica de reserva. Casos no `check-rolls`.
  - O diálogo de aplicar mostra o diff contra a ficha da mesa (`sheetDiff`).
  - "Subir de nível" na Ficha abre o Criador no nível seguinte, na aba Progressão.
- **Pendente.**
  - "Trocar talento" a partir do drawer da Ficha.
  - Aceite M3 com o GM e um jogador de cada mesa, que precisa de pessoas.

## F8 — Polimento e integrações concluída (falta o aceite com usuários)

- **8.1.** A Início, sem ficha do jogador, leva ao Criador ("Criar meu personagem" ou "Continuar rascunho: <nome>"). O Pathbuilder fica como alternativa.
- **8.2.** O GM escolhe o dono no editor (`build-assign`, e `sheet-assign` se a ficha já está na mesa) e filtra "Da mesa" por dono.
- **8.3.** Ajustes manuais na aba Detalhes, todos nos números e com aviso `MANUAL_*`: atributo à mão, boosts e aumentos extras, talento concedido (slot extra) e ajustes permanentes com motivo (PV, deslocamento, resistência, sentido, idioma, proficiência, bônus de item).
- **8.4. ABP** conferida no GM Core pg. 83 (Table 4-11). Potências de ataque, defesa, Percepção e salvaguarda; ataques devastadores no lugar do striking; potência de perícia pela ordem escolhida. O apex de atributo fica com aviso. Caso: Ghan Buri sem runas, com ABP, iguala o +2 Striking e o Hero's Plate +1 e ganha +1 de Percepção.
- **8.5.** O GM libera uma entrada só para o personagem com "Liberar" no aviso (exceção em `mesa_rules`, filtrada pelo `buildId`). Livro, legado e raridade agora valem também para talentos e itens.
- **8.6.** Trocar a escolha de um slot num personagem já aplicado grava `history` (retrain: quem, quando, de quê para quê), listado nos Detalhes.
- **8.7.** Duplicar cria um build novo com as mesmas escolhas. A lixeira já existia.
- **8.8.** Trigger `broadcast_builds` (migration `tempo_real_dos_builds`, aplicada) manda `{buildId, rev, by}` em `mesa:<mesa>:builds`. O editor relê quando outro aparelho grava e não há mudança local pendente; relê também a cada SUBSCRIBED.
- **8.9.** O background dos Detalhes é o das Anotações da Ficha (`character_notes`), sem campo novo, quando o personagem já está na mesa.
- **8.10.** O seletor desenha 150 linhas por vez, com "Mostrar mais".
- **8.11.** Link de créditos e licenças nos Detalhes; textos em pt/en (`check-i18n` limpo).
- **8.12.** Item caseiro (`custom:<nome>`): entra no inventário e no retrato, com aviso de que preço, volume e efeitos não contam.
- **8.13.** README com o Criador (funcionalidades, seção própria, `check-builder`, roadmap). O upload do Pathbuilder segue aceito, com "prefira o Criador".
- **Verificação.** Build, lint, `check-builder` (225), `check-rolls`, `check-economy` e `check-auth` passaram.
- **Pendente (M4, depende de pessoas).** Um personagem novo por mesa criado do zero no celular; subir de nível em menos de 5 minutos; CA-02 e CA-06 com usuários.

## Lacunas do elenco fechadas depois da F8

- **Doutrina do Cleric.** A progressão por degrau sai do texto da AON (Player Core pg. 112), em `doctrine.steps`, nas formas "trained in", "have expert proficiency in" e as das características. A doutrina escolhida aplica os degraus até o nível atual. Base `2026.11.9`.
- **Subclasses e chamado mítico na importação.** O export nomeia a subclasse nas características, às vezes com o tipo junto ("Thief Racket", "Giant Instinct", "Hunter's Edge: Precision", "Empiricism Methodology"). O importador casa com as opções do catálogo. O recorte de testes passou a trazer todas as opções de subclasse. O Woyd caiu de 5 para 3 diferenças de paridade.
- **Conjuradores de arquétipo** (Player Core pg. 215).
  - A dedicação, lida da AON (`feat.casting`, 13 dedicações), dá os truques: o Witch prepara um, os outros dois, e o psi cantrip não conta. Dá também a tradição e o atributo.
  - Basic, Expert e Master <Classe> Spellcasting dão os espaços da tabela e o rank perito/mestre. O nome do conjurador segue o do Pathbuilder ("Archetype Wizard").
  - A importação traz as magias deles. Na paridade, o Druid do Cero e o Psychic do Loki batem com o Pathbuilder; o Wizard do Nathaniel difere pelo Arcane Breadth (efeito de talento). Base `2026.11.10`.
  - Com duas fontes da mesma tradição (classe e arquétipo), o retrato leva o maior rank.
- **"Trocar talento" na Ficha.** O retrato leva `covil.slots` (nome → slot). O drawer do talento ganha "Trocar talento no Criador", que abre o seletor daquele slot.
- **Ainda aberto.** Conjuradores inatos e de talento (ancestralidade, Mythic Magic, Arcane Breadth); Ranger Expertise com magias de warden; dano extra de runas; aceite M3/M4 com usuários.

## F9 — itens feitos

- **9.1 Conteúdo da mesa.**
  - Tabela `mesa_homebrew` (migration `conteudo_da_mesa`, aplicada). Rotas `?homebrew=1` (lê quem é da mesa) e `homebrew-save`/`homebrew-delete` (só o GM real).
  - O sanitizador `sanitizeHomebrewEntry` deixa passar só o que o motor lê. O id é `mesa:<uuid>`, porque `custom:` já é o item de texto livre da 8.12.
  - O editor fica em `/mesa`: talento (slot pelo traço), item, runa de propriedade, background (boosts pela regra do Player Core pg. 84, perícias, talento), herança (ancestralidade ou versátil) e magia.
  - O conteúdo entra no catálogo do `useRules` com o selo "Da mesa" e vale mesmo fora dos livros liberados. O efeito que muda número vira `UNSUPPORTED_EFFECT`.
  - Na aba Talentos da Ficha, o drawer abre a descrição atual do GM pelo ID da mesa. Fichas antigas recuperam o ID pelo slot quando o nome identifica uma única linha. Fichas novas distinguem talentos homônimos por linha.
  - **Adiado:** migrar `customRunes.ts` e `homebrewGear.ts`, que carregam mecânica da Ficha casada pelo nome.
- **9.3 Arquétipos de classe.** Os quatro do Remaster na AON: Bloodrager (Barbarian), War Mage e Runelord (Wizard) e Palatine Detective (Investigator). O Elementalist da AON é legado. A Progressão mostra a subclasse concedida e permite escolher a dedicação no talento de classe do nível 2. Escolher outro talento gera aviso. Remover o arquétipo recupera a subclasse anterior.
  - **Bloodrager** troca os treinos iniciais da classe. A dedicação dá os dois truques e o treino da tradição. Rising, Surging e Exultant Blood Magic atualizam os espaços de magia e a proficiência do conjurador. Os efeitos situacionais de fúria e de Harvest Blood continuam manuais. [War of Immortals, pp. 60–61](https://2e.aonprd.com/Archetypes.aspx?ID=283)
  - **War Mage** concede Shield Block, War Magic, a School of Battle Magic e as proficiências de armas e armaduras. O retrato omite Arcane Bond, Arcane Thesis e Defensive Robes da classe base. A dedicação concede Additional Lore para Warfare Lore. [Battlecry!, pp. 68–69](https://2e.aonprd.com/Archetypes.aspx?ID=331)
  - **Runelord** fixa a School of Thassilonian Rune Magic, com o pecado pelo `ChoiceSet` da escola. Polearms e spears marciais sobem junto com as armas simples. O personagem ganha o idioma Thassilonian, a Personal Rune no lugar da Arcane Thesis e Advanced School Spell no 8º nível. O vínculo arcano e o cajado da runa ficam como aviso. [Rival Academies, pg. 114](https://2e.aonprd.com/Archetypes.aspx?ID=303)
  - **Palatine Detective** fixa a metodologia Esoterica, com escolha entre Occultism e Religion e Quick Identification. Os truques inatos e o treino em magia ficam como aviso. [Divine Mysteries, pg. 288](https://2e.aonprd.com/Archetypes.aspx?ID=306)
  - Escolher a subclasse de um arquétipo sem ele avisa (instinto Bloodrager, Esoterica, escola Thassilonian).
  - A escolha e a exportação dos quatro têm cobertura no `check-builder`. O fluxo de Bloodrager foi exercitado no Brave a 320 px, com personagem em memória.
- **9.6 Copiar para outra mesa** (`build-copy`). Exige ser membro da mesa de destino. A cópia nasce com slug livre, dono = quem copiou e sem histórico, e as regras de lá passam a valer. O caminho feliz é testado em memória no `check-builder`; as recusas, no `check-auth`.
- **9.7 Navegador do catálogo** ("Catálogo" na lista de personagens). Mostra ancestralidades, heranças, backgrounds, classes, arquétipos, talentos por tipo, magias por tradição, foco, rituais e itens por lista, no seletor de sempre, só para leitura.
- **9.8 Troféus.**
  - "Arquiteto" (bronze, criar um personagem no Criador) e "Obra entregue" (prata, aplicar na mesa um personagem do Criador). "Veterano" já existia (três níveis).
  - Só vale para quem criou e é o dono.
  - O `check-auth` confere o desbloqueio e apaga o aviso da mesa.
- **9.9 Página na Wiki.** "Criar página na Wiki" nos Detalhes abre `/wiki?nova=<nome>&tipo=npc&semente=1` com ficha rápida (ancestralidade, classe e nível), retrato, resumo e os detalhes. Se a página já existe, a Wiki só a abre.
- **9.10 Legado e Remaster.** Em `/mesa`, o GM escolhe os livros de cada edição. O seletor oferece o legado liberado que ainda não tem sucessor publicado. As exceções individuais valem no personagem correspondente.
  - Em **Detalhes → Converter para o Remaster**, o jogador revisa os destinos indicados pela AON. Havendo vários, escolhe um ou mantém a entrada atual. A conversão salva o rascunho. **Aplicar na mesa** atualiza a ficha publicada.
  - A publicação de uma nova versão do catálogo gera `core/remaster` com os vínculos entre entradas importadas. Nos pacotes anteriores, a conversão usa os vínculos disponíveis nas listas carregadas. A versão `2026.11.11` já está publicada com 131 entradas legadas e 134 destinos.

## F10 — Endurecimento

- **10.1 Compilar no servidor: adotado.** No "Aplicar na mesa", o servidor recompila o `BuildState` salvo e usa o próprio retrato.
  - **Medição.** Carregar no servidor as listas de um personagem típico (núcleo, talentos, magias e as 11 listas de item) leva cerca de 1 s e 5 MB. Para uma ação rara, é aceitável. As listas ficam em cache na função quente, uma versão por vez.
  - **Como.** O motor TS vira `api/_lib/builder-engine.gen.js` (esbuild, 109 KB, sem dependência externa) por `scripts/build-engine.mjs`. O `check-builder` confere que o pacote está em dia e que ele dá o mesmo retrato do motor TS nos dez personagens do elenco.
  - **Mesmas listas dos dois lados.** O editor e o servidor decidem as listas por `needsOf`/`featListPaths` (`engine/catalog.ts`), sem React.
  - **Salvo antes de aplicar.** O cliente grava o pendente (`saveNow`) e manda o `rev`. Outro `rev` devolve 409 `stale`.
  - **O que fica do cliente.** O retrato não tem texto traduzido; só os avisos ficam os do cliente, no idioma de quem aplicou. Divergência entre o retrato do cliente e o do servidor é registrada no log. Sem catálogo ou com erro no motor, segue o retrato do cliente.
  - **`core/locations`** (catálogo `2026.11.12`, 12.241 entradas). É o mapa id → lista das entradas fora do núcleo. Com ele, escolhas salvas que moram fora das listas habituais passam a resolver, no editor e no servidor: talento de outro arquétipo, magia de outra tradição e divindade. Antes, a divindade do Eldarion e cinco magias do Thalos saíam como id no retrato.
  - **Talento concedido (`GrantItem`).** O pacote resolve o nome do talento para o id (`grantId`, catálogo `2026.11.13`). O motor informa em `missingRefs` o que não está nas listas carregadas, e o editor e o servidor buscam pelo `core/locations` e compilam de novo. Exemplo: o racket Avenger concede a Avenger Dedication (War of Immortals pg. 58), cuja lista o Rogue não carrega.
  - **Correção.** Só o compêndio de talentos (`feats-srd`) concede talento. O Fighter concede a ação Reactive Strike, e o índice completo punha na ficha um talento homônimo de outras classes; a Pathbuilder lista a ação como característica.
- **10.3 Catálogos por nome da Ficha: avaliado.** O catálogo de regras só cobre os ataques desarmados, e isso já está feito: a Ficha do Criador lê `covil.unarmed`, com caso no `check-rolls`.
  - `magicWeapons.ts` (perfis situacionais, como a Gloom Blade no escuro), `itemActivities.ts` (custo e frequência de ativação) e as relíquias guardam o que o catálogo não tem: o `ItemData` não traz ação nem frequência.
  - Esses catálogos ficam na Ficha, que segue servindo também as fichas de upload do Pathbuilder.
- **10.4 Base local antes da AON (passo 1 de 3: os dados).**
  - O que mudou: coluna `rules_entries.aon_source` (migration `fonte_aon_no_catalogo`, aplicada) com o `_source` cru da AON, menos o `markdown` (que já tem coluna) e os campos só de busca e de renderização. As 17.613 entradas Remaster foram reimportadas.
  - Teste (`scripts/check-local-aon.mjs`): para os 503 nomes de descrição do elenco, acha a entrada na AON como o pipeline acha e compara com a mesma entrada no banco.
  - Resultado: 436 cobertas, todas com documento e parse idênticos. 53 ficam fora do banco: livros legados (Advanced Player's Guide, Character Guide, Secrets of Magic…), páginas de regra e de categoria. 14 não estão na AON.
- **10.4 passo 2: as descrições leem o catálogo primeiro** (`rules-local.js`).
  - `feat-core.js` (talentos, características, itens) e `spells-core.js` usam `bestAonHit`: por categoria, o nome exato no catálogo e, sem ele, a AON. O `gear-core.js` busca o lote no catálogo e só o que falta vai à AON. A busca sem categoria segue só na AON. `RULES_LOCAL=0` desliga.
  - `check-local-aon.mjs` roda a mesma escolha com e sem o catálogo. Nos 503 nomes do elenco: 488 com a mesma entrada e o mesmo texto, 0 diferentes, 365 vindos do catálogo e 15 sem entrada. Os 24 equipamentos são iguais.
  - O teste achou e corrigiu três desvios. Na busca sem categoria, o catálogo trazia homônimos de qualquer categoria ("Occult" traço × exemplar dracônico). Num empate de data entre variantes, a ordem decidia; agora ordena por `aon_id`. E faltava aparar o nome: a AON grava `"Fortitude Expertise "` (Psychic, Dark Archive Remastered), e nenhum caminho reconhecia o nome exato.
  - De ponta a ponta, um talento e uma magia saíram do catálogo em 162 ms e 56 ms, sem chamada à AON.
  - Antes da busca sem categoria entram, só por nome exato, armas, armaduras, escudos, relíquias e opções de classe (instinto, racket, chamado, ordem, estudo híbrido…). O catálogo passou a cobrir 411 nomes, contra 365 antes. Medi contra o comportamento antigo, com a lista velha e só a AON: a única mudança foi o Scroll Robes do Woyd (Treasure Vault Remastered), que antes ficava sem descrição. Se as categorias novas também aceitassem acerto aproximado, cinco escolhas piorariam ("Wish for Luck" viraria exemplar dracônico); por isso só nome exato.
- **10.4: onde parou.** 411 dos 503 nomes do elenco vêm do catálogo, e 78 ainda da AON:
  - livros legados (Core Rulebook, Advanced Player's Guide, Character Guide, World Guide, Ancestry Guide, Secrets of Magic, Rage of Elements…);
  - categorias que o catálogo não guarda (páginas de regra, perícias, páginas de categoria);
  - acertos aproximados, que por desenho seguem na AON.
  - Os livros legados ficam fora de propósito: pela BASE-DE-REGRAS §8, o livro legado só se importa quando uma mesa o libera, e hoje nenhuma das duas libera (`legacy: false`, sem `sources.legacy`). Quando uma liberar, o administrador importa o livro (`import-rules.mjs --source "<livro>"`) e o `check-local-aon` mostra o ganho.

## O que falta (consolidado)

A lista única do que segue aberto. Os "Pendente" de cada fase acima são o registro de quando surgiram; resolvidos
desde então: progressão da doutrina do Cleric, conjuradores de arquétipo e "Trocar talento" a partir da Ficha.

**Depende de pessoas**
- M1: criar um nível 1 de cada classe do elenco no Pathbuilder e comparar PV, CA, salvaguardas, Percepção e perícias.
- M3: aceite com o GM e um jogador de cada mesa.
- M4: um personagem novo por mesa criado do zero no celular; subir de nível em menos de 5 minutos; CA-02 e CA-06.

**Motor: hoje sai como aviso, não como número**
- 5.1: conjuradores inatos e de talento (ancestralidade, Mythic Magic, Arcane Breadth, Aeromancer, Caster Arcane Sense).
- 5.4: magias concedidas por escolha (escola, domínio, mistério, consciência); tamanho do repertório espontâneo; o truque a mais do Loki, que vem de talento.
- Ranger Expertise "if you have warden spells" (Player Core pg. 152).
- 4.2: `MartialProficiency` (armas de fogo do Gunslinger).
- 4.3: contagem de ikons, táticas, runas, aparições e lições.
- 4.7: qualificador de talento ("Assurance (X)") e talentos repetíveis pela regra do próprio talento.
- 4.8a: conferir o traço dos talentos de destino (o aviso do 12º nível não confere).
- ABP: o apex de atributo do nível 17.
- Equipamento: dano extra das runas de propriedade; preço do material e da transferência de runa; Comprado/Ganho por runa; materiais além do rótulo; capacidade de contêiner; penalidade de armadura nas perícias; Adventurer's Kit separado.
- Arquétipos de classe, efeitos situacionais: fúria e Harvest Blood do Bloodrager; vínculo em polearm/spear e cajado da personal rune do Runelord; truques inatos e treino em magia da Esoterica.
- Diferenças de paridade conhecidas, cada uma com o motivo: `scripts/rules-data/parity-known.json`.

**Ficha e plataforma**
- 9.1: migrar `customRunes.ts` e `homebrewGear.ts` para o conteúdo da mesa (a Ficha ainda não lê caseiro do banco além do talento).
- 10.4: livros legados e páginas de regra seguem vindo da AON. Pela BASE-DE-REGRAS §8, o livro legado só se importa quando uma mesa o libera (`import-rules.mjs --source "<livro>"`, conferido com `check-local-aon.mjs`).
- 10.2: aposentar consertos do `normalizeBuild` só quando nenhuma ficha vier mais de upload do Pathbuilder.
- 3.10: nomes de conteúdo traduzidos (ancestralidades, classes); dependem do pipeline de descrições.
- 1B.10 (opcional): pré-traduzir um livro pela fila de descrições.

**Sob pedido de uma mesa (D8) ou com impacto fora do Criador**
- 9.2 Dual Class; 9.11 Gradual Boosts e Stamina (Stamina mexe no dano da Ficha, da Iniciativa e do Mapa).
- 9.4 Proficiency Without Level e 9.5 Eidolon e construto do Inventor: a Ficha precisa saber da variante e do companheiro.
