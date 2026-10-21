-- Presença: quem está com o app aberto na mesa, e onde (ficha de quem, mapa,
-- Iniciativa). Usa o Presence do Realtime no canal privado `mesa:<mesa>:presence`.
--
-- Até aqui nenhum cliente mandava nada pelo Realtime — só o banco, por trigger —, e
-- não havia política de insert em `realtime.messages`. O Presence precisa que o
-- aparelho anuncie a si mesmo, então esta política libera SÓ a extensão `presence`,
-- e só no tópico de presença de uma mesa em que a sessão está registrada. Transmitir
-- (`broadcast`) pelo cliente continua proibido: o estado, o feed e o mapa seguem
-- saindo só do banco.

create policy "membros anunciam presença na mesa" on realtime.messages
    for insert to authenticated
    with check (
        realtime.messages.extension = 'presence'
        and exists (
            select 1 from public.mesa_members mm
            where mm.user_id = (select auth.uid())
              and (select realtime.topic()) = 'mesa:' || mm.mesa || ':presence'
        )
    );
