-- Correção manual de mecânica pela tela da base de regras (F1B): quem corrigiu e por quê, com a referência da AON
-- (livro e página). A linha vira `origin = 'manual'` e a importação do Foundry não passa mais por cima dela.
-- (A migration `correcao_manual_de_mecanica` foi aplicada vazia; esta é a que vale.)
alter table public.rules_mechanics
    add column note text check (note is null or char_length(note) between 1 and 500),
    add column updated_by uuid references auth.users (id) on delete set null;
