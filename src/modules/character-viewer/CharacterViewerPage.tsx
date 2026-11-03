import { useEffect, useState } from 'react'
import { Snackbar } from '@mui/material'
import { useSearchParams } from 'react-router-dom'

import { normalizeBuild, parseCharacterJson, type BuildInfo } from '../../pathbuilder/types'
import { UploadCard, type JsonOrigin } from './components/UploadCard'
import { PublishDialog, type PublishBase } from './components/PublishDialog'
import { PreparingDialog } from './components/PreparingDialog'
import { usePublication } from './components/usePublication'
import { createDraft, fetchPublished, type PublishedSheet, type SheetDraft } from '../../services/sheets'
import { startPreparation } from '../../services/sheetPreparation'
import { CAMPAIGN_PRESETS } from './campaignPresets'
import { charSlugFromName } from './charId'
import { CharacterSheetView } from './CharacterSheetView'
import { curatedBase } from './combatGuides'
import { characterDescriptionNames, companionAnimalNames } from './descriptionNames'
import { CACHE_VERSION, loadSheetDescriptionsBoth } from '../../services/descriptions'
import { mesaKey } from '../../services/mesa'
import { tr } from '../../i18n'

// Da mesa: trocar de mesa recarrega a página, e a ficha aberta da outra não pode voltar.
const SESSION_KEY = mesaKey('pf2e:viewer:lastBuild')
/** Slug da ficha publicada aberta — ao recarregar, relê a versão da mesa. */
const SESSION_PUBLISHED_KEY = mesaKey('pf2e:viewer:lastPublished')

export const CharacterViewerPage = () => {
    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [error, setError] = useState<string | null>(null)

    const publication = usePublication()
    const { attach } = publication
    // Arquivo enviado aguardando a escolha entre publicar e só ver.
    const [pending, setPending] = useState<{ json: unknown; build: BuildInfo; base: PublishBase | null } | null>(null)
    const [publishBusy, setPublishBusy] = useState(false)
    const [publishError, setPublishError] = useState<string | null>(null)
    const [publishedNotice, setPublishedNotice] = useState<string | null>(null)
    // A publicação em preparo que o diálogo mostra (o preparo segue mesmo com ele fechado).
    const [preparing, setPreparing] = useState<{ slug: string; name: string; draft: SheetDraft | null } | null>(null)
    // Cada ficha aberta começa na Visão Geral: a chave remonta o corpo.
    const [viewKey, setViewKey] = useState(0)

    // `?ficha=<slug>`: abrir uma ficha publicada vindo de outro lugar (o grupo na Início, uma
    // notificação). Vale uma vez e sai da URL, como o `?mesa=`.
    const [params, setParams] = useSearchParams()
    const linked = params.get('ficha') // i18n-ok: chave

    // Restaurar ficha da sessão ao recarregar. Se era a ficha da mesa, relê a
    // versão publicada — alguém pode ter publicado outra enquanto isso.
    useEffect(() => {
        if (linked) return
        try {
            const raw = sessionStorage.getItem(SESSION_KEY)
            // Normaliza de novo: a ficha salva antes da correção do `prepared` ainda vem sem ele.
            if (raw) setBuild(normalizeBuild(JSON.parse(raw) as BuildInfo))
            const slug = sessionStorage.getItem(SESSION_PUBLISHED_KEY)
            if (slug) {
                fetchPublished(slug).then((sheet) => {
                    if (!sheet) return
                    try { setBuild(parseCharacterJson(sheet.json)) } catch { return }
                    attach(sheet)
                })
            }
        } catch { /* noop */ }
        // Só na montagem: o `linked` que some da URL depois não deve reabrir a da sessão.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attach])

    /** Abre a ficha. `published` = é a versão da mesa (tem guia gerado). */
    const show = (b: BuildInfo, published: PublishedSheet | null) => {
        setBuild(b)
        attach(published)
        setError(null)
        setViewKey((k) => k + 1)
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(b))
            if (published) sessionStorage.setItem(SESSION_PUBLISHED_KEY, published.slug)
            else sessionStorage.removeItem(SESSION_PUBLISHED_KEY)
        } catch { /* noop */ }
    }

    useEffect(() => {
        if (!linked) return
        // Sem cancelar na limpeza: tirar o `?ficha=` da URL muda o `linked` e cancelaria a leitura.
        void fetchPublished(linked).then((sheet) => {
            if (sheet) {
                try { show(parseCharacterJson(sheet.json), sheet) } catch { /* JSON da mesa inválido: fica onde está */ }
            }
            setParams((p) => { p.delete('ficha'); return p }, { replace: true }) // i18n-ok: chave
        })
        // `show` muda a cada render; o pedido é pelo slug do link.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linked])

    const handleJson = async (json: unknown, origin: JsonOrigin) => {
        let b: BuildInfo
        try {
            b = parseCharacterJson(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : tr('JSON inválido.', 'Invalid JSON.'))
            return
        }
        if (origin.kind === 'preset') {
            show(b, origin.published)
            // Toda ficha fica no banco: o preset que ainda só existe como arquivo é publicado ao ser aberto
            // (guia e descrições seguem em segundo plano, como numa publicação normal).
            if (!origin.published) void publishPreset(json, b)
            return
        }
        // Arquivo enviado: compara com a versão que a mesa usa hoje (a
        // publicada, senão o arquivo fixo da campanha) antes de oferecer publicar.
        setPublishError(null)
        const current = await fetchPublished(charSlugFromName(b.name))
        let base: PublishBase | null = null
        try {
            if (current) {
                base = { build: parseCharacterJson(current.json), from: 'published', publishedAt: current.publishedAt }
            } else {
                const preset = CAMPAIGN_PRESETS.find((p) => p.sheetName === b.name)
                const res = preset ? await fetch(`/characters/${preset.filename}`) : null
                if (res?.ok) base = { build: parseCharacterJson(await res.json()), from: 'static' }
            }
        } catch { /* sem base: o diálogo trata como personagem novo */ }
        setPending({ json, build: b, base })
    }

    /**
     * O JSON vira um rascunho no servidor, que prepara tudo (descrições nas duas línguas, guia nas duas,
     * consultas da AON) antes de a ficha valer para a mesa. O guia que o app mostrava para ESTE
     * personagem (o curado) vai como base da primeira geração.
     */
    const draftOf = (json: unknown, b: BuildInfo) => createDraft({
        json,
        names: characterDescriptionNames(b),
        version: CACHE_VERSION,
        companions: companionAnimalNames(b),
        base: curatedBase(b),
    })

    // O preset que ainda só existe como arquivo é publicado ao ser aberto, em segundo plano: ele já
    // abre do arquivo (com o pacote estático), e o preparo, rápido, coloca-o na mesa.
    const publishPreset = async (json: unknown, b: BuildInfo) => {
        try {
            const draft = await draftOf(json, b)
            startPreparation(draft.slug, draft)
        } catch { /* sem rede: a ficha segue aberta e tenta de novo na próxima abertura */ }
    }

    const handlePublish = async () => {
        if (!pending) return
        setPublishBusy(true)
        setPublishError(null)
        try {
            const draft = await draftOf(pending.json, pending.build)
            setPending(null)
            startPreparation(draft.slug, draft)
            setPreparing({ slug: draft.slug, name: draft.name, draft })
        } catch (e) {
            setPublishError(e instanceof Error ? e.message : tr('Falha ao publicar', 'Failed to publish'))
        } finally {
            setPublishBusy(false)
        }
    }

    /** O preparo terminou: a ficha está na mesa, completa — agora abre. */
    const handlePrepared = (sheet: PublishedSheet) => {
        setPreparing(null)
        try { show(parseCharacterJson(sheet.json), sheet) } catch { return }
        setPublishedNotice(tr(`${sheet.name} publicada para a mesa.`, `${sheet.name} published to the table.`))
    }

    const handleRestore = async () => {
        const slug = publication.published?.slug
        if (!slug) return
        try {
            const sheet = await publication.restore(slug)
            const restored = parseCharacterJson(sheet.json)
            show(restored, sheet)
            void loadSheetDescriptionsBoth(sheet.slug, characterDescriptionNames(restored))
            setPublishedNotice(tr('Versão anterior restaurada.', 'Previous version restored.'))
        } catch (e) {
            setPublishedNotice(e instanceof Error ? e.message : tr('Falha ao restaurar', 'Failed to restore'))
        }
    }

    const handleReset = () => {
        setBuild(null)
        setError(null)
        attach(null)
        try {
            sessionStorage.removeItem(SESSION_KEY)
            sessionStorage.removeItem(SESSION_PUBLISHED_KEY)
        } catch { /* noop */ }
    }

    const publishDialog = pending && (
        <PublishDialog
            open
            incoming={pending.build}
            base={pending.base}
            busy={publishBusy}
            error={publishError}
            onPublish={handlePublish}
            onCancel={() => setPending(null)}
        />
    )

    const publishSnackbar = (
        <Snackbar
            open={!!publishedNotice}
            autoHideDuration={6000}
            onClose={(_, reason) => { if (reason !== 'clickaway') setPublishedNotice(null) }}
            message={publishedNotice}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
    )

    return (
        <>
            {build ? (
                <CharacterSheetView
                    key={viewKey}
                    build={build}
                    publication={publication}
                    onReset={handleReset}
                    onRestore={handleRestore}
                    onOpenPublished={(sheet) => show(parseCharacterJson(sheet.json), sheet)}
                />
            ) : (
                <UploadCard onJson={handleJson} error={error} onResume={(draft) => setPreparing({ slug: draft.slug, name: draft.name, draft })} />
            )}
            {publishDialog}
            {preparing && (
                <PreparingDialog
                    slug={preparing.slug}
                    name={preparing.name}
                    initial={preparing.draft}
                    onClose={() => setPreparing(null)}
                    onReady={handlePrepared}
                    onDiscarded={() => {
                        setPreparing(null)
                        setPublishedNotice(tr('Preparo descartado.', 'Preparation discarded.'))
                    }}
                />
            )}
            {publishSnackbar}
        </>
    )
}
