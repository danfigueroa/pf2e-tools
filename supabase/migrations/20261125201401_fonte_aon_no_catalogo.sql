-- Catálogo como fonte local da AON (F10.4): o documento cru que a busca da AON devolve (`_source`), menos o `markdown`
-- (coluna própria) e os campos só de busca e de renderização (`search_markdown`, `*_markdown`). Os parsers de descrição
-- (`aon-parse.js`, `feat-core.js`, `spell-parse.js`, `gear-core.js`) leem `text`, ações, gatilho, frequência e traços
-- crus daqui, como leriam da AON.
alter table public.rules_entries add column aon_source jsonb
    check (aon_source is null or octet_length(aon_source::text) <= 131072);
