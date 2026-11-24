// Leitura do sistema PF2e do Foundry para a mecânica da base de regras (FONTES-DE-DADOS §2 e §4).
// O tarball é dado não confiável: baixa no commit fixado, extrai numa pasta própria do diretório temporário só os
// pacotes de jogador, e só lê JSON. Nada de dentro dele é executado ou importado.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Release PF2e 8.7.1. Trocar = atualizar FONTES-DE-DADOS §2 e conferir o relatório da ingestão. */
export const FOUNDRY_REF = '397f125aea87e6d6fa36e878c9c07d0e672826cf'
export const FOUNDRY_PACKS = ['ancestries', 'heritages', 'backgrounds', 'classes', 'class-features', 'feats', 'spells',
    'equipment', 'deities', 'familiar-abilities', 'actions']

/** Campos visuais e de interface do Foundry, descartados na leitura (o texto descritivo vem da AON). */
const DROP_SYSTEM = ['description', 'gmNote', 'schema']

function slim(doc, pack) {
    const { _id, name, type, system = {} } = doc
    const kept = Object.fromEntries(Object.entries(system).filter(([key]) => !DROP_SYSTEM.includes(key)))
    return { _id, name, type, pack, system: kept }
}

function readPack(dir, pack, docs) {
    for (const file of readdirSync(dir)) {
        const path = join(dir, file)
        if (statSync(path, { throwIfNoEntry: false })?.isDirectory()) readPack(path, pack, docs)
        else if (file.endsWith('.json') && file !== '_folders.json') docs.push(slim(JSON.parse(readFileSync(path, 'utf8')), pack))
    }
}

/**
 * Baixa o repositório no commit fixado e devolve os documentos dos pacotes de jogador, enxutos, com o pacote de origem.
 * `sha256` do tarball vai para o manifesto, para a ingestão ser reproduzível.
 */
export async function loadFoundryPacks({ ref = FOUNDRY_REF, packs = FOUNDRY_PACKS } = {}) {
    if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('Foundry: use o SHA completo do commit, não branch nem tag')
    const dir = mkdtempSync(join(tmpdir(), 'pf2e-foundry-'))
    try {
        const response = await fetch(`https://codeload.github.com/foundryvtt/pf2e/tar.gz/${ref}`, {
            headers: { 'User-Agent': 'PF2e rules catalog' },
            signal: AbortSignal.timeout(300_000),
        })
        if (!response.ok) throw new Error(`Foundry: falha no download (${response.status})`)
        const tarball = Buffer.from(await response.arrayBuffer())
        const archive = join(dir, 'pf2e.tar.gz')
        writeFileSync(archive, tarball)
        const root = `pf2e-${ref}/packs/pf2e`
        // Só os caminhos pedidos; `--no-same-owner`/`--no-same-permissions` não herdam nada do arquivo.
        execFileSync('tar', ['-xzf', archive, '-C', dir, '--no-same-owner', '--no-same-permissions',
            ...packs.map((pack) => `${root}/${pack}`)])
        const docs = []
        for (const pack of packs) readPack(join(dir, root, pack), pack, docs)
        return { docs, ref, sha256: createHash('sha256').update(tarball).digest('hex') }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}
