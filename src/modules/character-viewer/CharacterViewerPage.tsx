import { useEffect, useState } from 'react'
import { Snackbar } from '@mui/material'

import { normalizeBuild, parseCharacterJson, type BuildInfo } from '../character-sheet/types'
import { UploadCard, type JsonOrigin } from './components/UploadCard'
import { PublishDialog, type PublishBase } from './components/PublishDialog'
import { usePublication } from './components/usePublication'
import { fetchPublished, type PublishedSheet } from '../../services/sheets'
import { CAMPAIGN_PRESETS } from './campaignPresets'
import { charSlugFromName } from './charId'
import { CharacterSheetView } from './CharacterSheetView'
import { curatedBase } from './combatGuides'
import { characterDescriptionNames } from './descriptionNames'
import { loadSheetDescriptions } from '../../services/descriptions'

const SESSION_KEY = 'pf2e:viewer:lastBuild'
/** Slug da ficha publicada aberta — ao recarregar, relê a versão da mesa. */
const SESSION_PUBLISHED_KEY = 'pf2e:viewer:lastPublished'

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
    // Cada ficha aberta começa na Visão Geral: a chave remonta o corpo.
    const [viewKey, setViewKey] = useState(0)

    // Restaurar ficha da sessão ao recarregar. Se era a ficha da mesa, relê a
    // versão publicada — alguém pode ter publicado outra enquanto isso.
    useEffect(() => {
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

    const handleJson = async (json: unknown, origin: JsonOrigin) => {
        let b: BuildInfo
        try {
            b = parseCharacterJson(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'JSON inválido.')
            return
        }
        if (origin.kind === 'preset') {
            show(b, origin.published)
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

    const handlePublish = async () => {
        if (!pending) return
        setPublishBusy(true)
        setPublishError(null)
        // O guia que o app mostrava para ESTE personagem vira a base do novo.
        const base = curatedBase(pending.build)
        try {
            const sheet = await publication.publish(pending.json)
            const published = parseCharacterJson(sheet.json)
            show(published, sheet)
            setPending(null)
            setPublishedNotice(`${sheet.name} publicada para a mesa.`)
            void publication.generateGuide(sheet, base)
            // Já, antes de qualquer jogador abrir: a mesa encontra todas as descrições
            // traduzidas. Num level-up quase tudo vem do pacote estático e só o novo é traduzido.
            void loadSheetDescriptions(sheet.slug, characterDescriptionNames(published))
        } catch (e) {
            setPublishError(e instanceof Error ? e.message : 'Falha ao publicar')
        } finally {
            setPublishBusy(false)
        }
    }

    const handleRestore = async () => {
        const slug = publication.published?.slug
        if (!slug) return
        try {
            const sheet = await publication.restore(slug)
            const restored = parseCharacterJson(sheet.json)
            show(restored, sheet)
            void loadSheetDescriptions(sheet.slug, characterDescriptionNames(restored))
            setPublishedNotice('Versão anterior restaurada.')
        } catch (e) {
            setPublishedNotice(e instanceof Error ? e.message : 'Falha ao restaurar')
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
            onViewOnly={() => { show(pending.build, null); setPending(null) }}
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
                />
            ) : (
                <UploadCard onJson={handleJson} error={error} />
            )}
            {publishDialog}
            {publishSnackbar}
        </>
    )
}
