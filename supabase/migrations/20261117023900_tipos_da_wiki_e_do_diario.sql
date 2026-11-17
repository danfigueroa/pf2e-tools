-- A Wiki e o catálogo do Diário passam a ter os mesmos tipos, com Perigo (`hazard`) e Povo (`culture`) novos.
-- Espelha `PAGE_KINDS` (wiki-store.js), `DOC_KINDS` (journal-store.js) e `WIKI_KINDS` (services/wiki.ts).

alter table public.wiki_pages drop constraint wiki_pages_kind_check;
alter table public.wiki_pages add constraint wiki_pages_kind_check check (kind in
    ('npc', 'location', 'item', 'creature', 'faction', 'deity', 'event', 'lore', 'hazard', 'culture', 'other'));

alter table public.journal_docs drop constraint journal_docs_kind_check;
alter table public.journal_docs add constraint journal_docs_kind_check check (kind in
    ('session', 'npc', 'location', 'item', 'creature', 'faction', 'deity', 'event', 'lore', 'hazard', 'culture', 'other', 'thread'));
