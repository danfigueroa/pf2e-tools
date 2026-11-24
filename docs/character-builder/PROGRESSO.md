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
- **Divergência a resolver antes de 1.3.** A AON retorna nomes repetidos dentro de `feat`, `equipment` e `class-feature`. A normalização por nome prevista colide com `rules_entries.id` único. Proposta: derivar a identidade de `tipo` e `aon_id` estável, guardando nome e slug legível para exibição e busca. A proposta aguarda aceite antes da edição dos contratos de IDs.
- **Próximo passo.** Após definir o identificador, atualizar os contratos e implementar 1.3–1.4 com as categorias e os campos verificados na AON. A migration em produção e a carga inicial continuam pendentes.
