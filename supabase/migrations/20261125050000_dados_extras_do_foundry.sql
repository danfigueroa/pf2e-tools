-- Campos estruturados do sistema PF2e do Foundry que a AON não tem (FONTES-DE-DADOS §4). Hoje: a ancestralidade de cada
-- herança (`{ "ancestry": "Elf" }`; nulo = herança versátil), que o Criador usa para filtrar e avisar.
alter table public.rules_mechanics add column extra jsonb;
