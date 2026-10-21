-- Aviso de ficha publicada: quem está com a ficha aberta numa versão mais velha
-- fica sabendo na hora ("Nova versão publicada — abrir"), em vez de jogar o
-- nível 10 enquanto a mesa já publicou o 11.
--
-- Canal privado `mesa:<mesa>:sheets`:
--   published  a versão mudou (publicar ou restaurar: `published_at` diferente)
--   guide      o guia "Como Jogar" da MESMA versão ficou pronto (5–30 s depois)
-- Só a referência viaja — quem quer a ficha a relê pela API, como sempre.

create function public.broadcast_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' or new.published_at is distinct from old.published_at then
        perform realtime.send(
            jsonb_build_object('slug', new.slug, 'name', new.name, 'level', new.level,
                'publishedAt', new.published_at, 'by', new.published_by),
            'published', 'mesa:' || new.mesa || ':sheets', true);
    elsif new.guide is distinct from old.guide then
        perform realtime.send(
            jsonb_build_object('slug', new.slug, 'publishedAt', new.published_at),
            'guide', 'mesa:' || new.mesa || ':sheets', true);
    end if;
    return null;
end
$$;

revoke all on function public.broadcast_sheet() from public, anon, authenticated;

create trigger sheets_broadcast after insert or update on public.sheets
    for each row execute function public.broadcast_sheet();
