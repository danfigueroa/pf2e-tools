import React, { useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    Stack,
    Alert,
} from '@mui/material'
import { parseCharacterJson } from './types'
import type { BuildInfo } from './types'
import { downloadCharacterPdf } from './pdf'

export const CharacterSheetPage: React.FC = () => {
    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [error, setError] = useState<string | null>(null)

    const enrichFeatDescriptions = async (b: BuildInfo) => {
        const names = (b.feats || []).map((f: any) =>
            Array.isArray(f) ? String(f[0]) : String(f?.name ?? f)
        )
        const unique = Array.from(new Set(names))
        const missing = unique.filter(
            (n) => !b.featDescriptions || !b.featDescriptions[n]
        )
        if (!missing.length) return b
        const copy: BuildInfo = {
            ...b,
            featDescriptions: { ...(b.featDescriptions || {}) },
        }
        await Promise.all(
            missing.map(async (n) => {
                try {
                    const r = await fetch(
                        `/api/feat?name=${encodeURIComponent(n)}`
                    )
                    if (!r.ok) return
                    const data = await r.json()
                    if (data && data.description)
                        copy.featDescriptions![n] = String(data.description)
                } catch {}
            })
        )
        return copy
    }

    const enrichSpecialDescriptions = async (b: BuildInfo) => {
        const names = (b.specials || []).map((s) => String(s))
        const unique = Array.from(new Set(names))
        const missing = unique.filter(
            (n) => !b.specialDescriptions || !b.specialDescriptions[n]
        )
        if (!missing.length) return b
        const copy: BuildInfo = {
            ...b,
            specialDescriptions: { ...(b.specialDescriptions || {}) },
        }
        await Promise.all(
            missing.map(async (n) => {
                try {
                    const r = await fetch(
                        `/api/search?name=${encodeURIComponent(n)}`
                    )
                    if (!r.ok) return
                    const data = await r.json()
                    if (data && data.description)
                        copy.specialDescriptions![n] = String(data.description)
                } catch {}
            })
        )
        return copy
    }

    const enrichDescriptions = async (b: BuildInfo) => {
        let enriched = await enrichFeatDescriptions(b)
        enriched = await enrichSpecialDescriptions(enriched)
        return enriched
    }

    const handleFileUpload: React.ChangeEventHandler<HTMLInputElement> = async (
        e
    ) => {
        setError(null)
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            let parsed = parseCharacterJson(json)
            parsed = await enrichDescriptions(parsed)
            setBuild(parsed)
        } catch (err: unknown) {
            console.error(err)
            const message =
                err instanceof Error
                    ? err.message
                    : 'Falha ao ler o arquivo JSON.'
            setError(message)
            setBuild(null)
        }
    }

    const handleUseExample = async () => {
        setError(null)
        try {
            // Permite o usuário selecionar o arquivo exemplo manualmente
            // ou tentamos buscar via caminho relativo. Se falhar, exibimos instruções.
            const res = await fetch('/character-example.json')
            if (!res.ok)
                throw new Error(
                    'Exemplo não encontrado no servidor. Faça upload manual.'
                )
            const json = await res.json()
            let parsed = parseCharacterJson(json)
            parsed = await enrichDescriptions(parsed)
            setBuild(parsed)
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : 'Não foi possível carregar o exemplo. Use o upload.'
            setError(message)
        }
    }

    const handleGenerate = async () => {
        if (!build) return
        await downloadCharacterPdf(build)
    }

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
                Gerador de Ficha de Personagem (PDF)
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Importe um arquivo JSON no formato do exemplo para gerar uma
                ficha em PDF com atributos, perícias, equipamentos, armas,
                armaduras, feats, habilidades especiais e magias. Quando a
                descrição não estiver no JSON, o PDF inclui links de busca na
                AON (Archives of Nethys).
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems="center"
                    >
                        <Button component="label" variant="contained">
                            Importar JSON
                            <input
                                hidden
                                type="file"
                                accept="application/json"
                                onChange={handleFileUpload}
                            />
                        </Button>
                        <Button variant="outlined" onClick={handleUseExample}>
                            Usar exemplo
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            disabled={!build}
                            onClick={handleGenerate}
                        >
                            Gerar PDF
                        </Button>
                    </Stack>

                    {build && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {build.name}
                            </Typography>
                            <Typography color="text.secondary">
                                {build.class} (Nível {build.level}) ·{' '}
                                {build.ancestry} · {build.background}
                            </Typography>
                            <Typography sx={{ mt: 1 }}>
                                Atributos: STR {build.abilities.str}, DEX{' '}
                                {build.abilities.dex}, CON {build.abilities.con}
                                , INT {build.abilities.int}, WIS{' '}
                                {build.abilities.wis}, CHA {build.abilities.cha}
                            </Typography>
                            <Typography sx={{ mt: 1 }}>
                                Magias:{' '}
                                {build.spellCasters
                                    ?.map((c) => c.name)
                                    .join(', ') || '—'}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Typography variant="body2" color="text.secondary">
                Dica: para incluir o arquivo exemplo na aplicação durante o
                desenvolvimento, mova o arquivo{' '}
                <code>character-example.json</code> para a pasta{' '}
                <code>public/</code>.
            </Typography>
        </Box>
    )
}
