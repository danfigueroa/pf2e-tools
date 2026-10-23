-- Mapa ao vivo: a régua, a área de efeito e o arrasto de um token aparecem para
-- todos que estão no mesmo mapa enquanto alguém mede ou arrasta.
--
-- É o segundo caso em que o CLIENTE manda algo pelo Realtime (o primeiro é a
-- presença): um gesto chega a ~10 mensagens por segundo e não é estado — nada disso
-- vai ao banco. A política libera SÓ a extensão `broadcast`, e só no tópico
-- `mesa:<mesa>:live:<mapa>` de uma mesa em que a sessão está registrada. Os
-- tópicos que o banco transmite (`state`, `rolls`, `map:<id>`…) continuam
-- fechados para o cliente: quem receber deles sabe que veio de um trigger.
-- Ouvir já estava liberado pela política de select (`mesa:<mesa>:%`).

create policy "membros transmitem os gestos do mapa" on realtime.messages
    for insert to authenticated
    with check (
        realtime.messages.extension = 'broadcast'
        and exists (
            select 1 from public.mesa_members mm
            where mm.user_id = (select auth.uid())
              and (select realtime.topic()) like 'mesa:' || mm.mesa || ':live:%'
        )
    );
