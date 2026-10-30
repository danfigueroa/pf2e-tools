import { memo, useMemo, useState } from 'react'
import {
    Alert, Box, Button, Card, CardContent, Chip, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, PushPin as PinIcon, Search as SearchIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../../pathbuilder/types'
import { Markdown } from '../../../components/markdown/Markdown'
import { MarkdownEditor } from '../../campaign-journal/components/MarkdownEditor'
import { green, rule } from '../../../theme'
import { charSlug } from '../charId'
import { useSheetReadOnly, VIEW_OK } from '../sheetAccess'
import { useCharacterNotes, type NotesStatus } from '../components/useCharacterNotes'
import { MAX_NOTES, NOTE_TAGS, TAG_LABELS, newNoteId, type Note, type NoteTag } from '../notes'

// Aba Anotações: o background do personagem e as notas do jogador (NPCs, itens,
// locais, acontecimentos). Markdown com prévia; salva sozinho (ver
// `useCharacterNotes`). Ficha de outra pessoa abre só para LER, sem editor.
//
// Chunk próprio: o `react-markdown` não entra no da ficha (ver `CharacterSheetView`).

interface Props { build: BuildInfo }

const STATUS_TEXT: Record<NotesStatus, string> = {
    loading: 'Carregando…',
    saved: 'Salvo',
    pending: 'Alterações a salvar…',
    saving: 'Salvando…',
    offline: 'Sem conexão — guardado neste aparelho',
    conflict: 'Editado em outro aparelho',
}

const sortNotes = (a: Note, b: Note) =>
    Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt

function NoteCard({ note, readOnly, version, onChange, onDelete }: {
    note: Note
    readOnly: boolean
    version: number
    onChange: (patch: Partial<Note>) => void
    onDelete: () => void
}) {
    const [open, setOpen] = useState(!note.body && !note.title)
    return (
        <Card variant="outlined" sx={{ borderColor: rule }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {open && !readOnly
                        ? (
                            <TextField
                                size="small"
                                label="Título"
                                defaultValue={note.title}
                                key={`${note.id}-t-${version}`}
                                onChange={(e) => onChange({ title: e.target.value.slice(0, 200) })}
                                sx={{ flex: '1 1 180px' }}
                            />
                        )
                        : (
                            <Typography variant="subtitle1" sx={{ flex: '1 1 140px', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                                {note.title || 'Sem título'}
                            </Typography>
                        )}
                    {open && !readOnly
                        ? (
                            <TextField
                                select
                                size="small"
                                label="Etiqueta"
                                value={note.tag}
                                onChange={(e) => onChange({ tag: e.target.value as NoteTag })}
                                sx={{ minWidth: 120 }}
                            >
                                {NOTE_TAGS.map((t) => <MenuItem key={t} value={t}>{TAG_LABELS[t]}</MenuItem>)}
                            </TextField>
                        )
                        : <Chip size="small" label={TAG_LABELS[note.tag]} />}
                    {!readOnly && (
                        <>
                            <IconButton
                                size="small"
                                aria-label={note.pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
                                onClick={() => onChange({ pinned: !note.pinned })}
                                sx={{ color: note.pinned ? green.main : 'text.disabled' }}
                            >
                                <PinIcon fontSize="small" />
                            </IconButton>
                            <Button size="small" onClick={() => setOpen((v) => !v)}>{open ? 'Pronto' : 'Editar'}</Button>
                            <IconButton size="small" aria-label="Apagar nota" onClick={onDelete}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </>
                    )}
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                    {open && !readOnly
                        ? (
                            <MarkdownEditor
                                key={`${note.id}-${version}`}
                                plain
                                preferView={false}
                                value={note.body}
                                onChange={(body) => onChange({ body: body.slice(0, 20000) })}
                                imageName={note.id}
                                minRows={6}
                                aria-label={`Texto da nota ${note.title}`}
                                placeholder="Escreva o que aconteceu, o que descobriu, o que quer lembrar…"
                            />
                        )
                        : note.body.trim()
                            ? <Markdown source={note.body} />
                            : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>Nota vazia.</Typography>}
                </Box>
            </CardContent>
        </Card>
    )
}

const NotesSectionView = ({ build }: Props) => {
    const slug = charSlug(build)
    const readOnly = useSheetReadOnly()
    const { notes, status, version, theirs, update, keepTheirs, keepMine, retry } = useCharacterNotes(slug, readOnly)
    const [query, setQuery] = useState('')
    const [tag, setTag] = useState<NoteTag | 'all'>('all')

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase()
        return notes.notes
            .filter((n) => (tag === 'all' || n.tag === tag)
                && (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)))
            .sort(sortNotes)
    }, [notes.notes, query, tag])

    const patchNote = (id: string, patch: Partial<Note>) => update((n) => ({
        ...n,
        notes: n.notes.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)),
    }))

    const addNote = () => {
        const now = Date.now()
        update((n) => (n.notes.length >= MAX_NOTES ? n : {
            ...n,
            notes: [{ id: newNoteId(), title: '', tag: 'outro', body: '', createdAt: now, updatedAt: now }, ...n.notes],
        }))
        setQuery('')
        setTag('all')
    }

    const removeNote = (note: Note) => {
        if (!window.confirm(`Apagar a nota "${note.title || 'Sem título'}"? Isso vale para a mesa inteira.`)) return
        update((n) => ({ ...n, notes: n.notes.filter((x) => x.id !== note.id) }))
    }

    return (
        <Stack spacing={2}>
            {status === 'conflict' && (
                <Alert
                    severity="warning"
                    action={(
                        <Stack direction="row" spacing={1}>
                            <Button color="inherit" size="small" onClick={keepTheirs} disabled={!theirs}>Usar a do outro aparelho</Button>
                            <Button color="inherit" size="small" onClick={keepMine}>Manter a minha</Button>
                        </Stack>
                    )}
                >
                    Estas anotações foram editadas em outro aparelho.
                </Alert>
            )}
            {status === 'offline' && (
                <Alert severity="info" action={<Button color="inherit" size="small" onClick={retry}>Tentar de novo</Button>}>
                    {STATUS_TEXT.offline}
                </Alert>
            )}
            {readOnly && (
                <Alert severity="info" icon={false}>Anotações de outro jogador: só leitura.</Alert>
            )}

            <Card>
                <CardContent>
                    <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6">Background</Typography>
                        <Typography variant="caption" color="text.secondary" aria-live="polite">{STATUS_TEXT[status]}</Typography>
                    </Stack>
                    {readOnly
                        ? notes.background.trim()
                            ? <Markdown source={notes.background} />
                            : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>Sem background escrito.</Typography>
                        : (
                            <MarkdownEditor
                                key={`bg-${version}`}
                                plain
                                value={notes.background}
                                onChange={(background) => update((n) => ({ ...n, background: background.slice(0, 20000) }))}
                                imageName={`${slug}-background`}
                                minRows={8}
                                aria-label="Background do personagem"
                                placeholder="Quem é o seu personagem? De onde veio, o que quer, o que teme…"
                            />
                        )}
                </CardContent>
            </Card>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" sx={{ mr: 'auto' }}>Anotações</Typography>
                <TextField
                    size="small"
                    placeholder="Buscar"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    slotProps={{
                        input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
                        htmlInput: { 'aria-label': 'Buscar nas anotações' },
                    }}
                    sx={{ flex: '1 1 160px', maxWidth: 260 }}
                />
                {!readOnly && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={addNote} disabled={notes.notes.length >= MAX_NOTES}>
                        Nova nota
                    </Button>
                )}
            </Stack>

            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {(['all', ...NOTE_TAGS] as const).map((t) => (
                    <Chip
                        key={t}
                        {...VIEW_OK}
                        size="small"
                        label={t === 'all' ? 'Todas' : TAG_LABELS[t]}
                        color={tag === t ? 'primary' : 'default'}
                        variant={tag === t ? 'filled' : 'outlined'}
                        onClick={() => setTag(t)}
                    />
                ))}
            </Stack>

            {shown.length === 0
                ? (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {notes.notes.length === 0
                            ? (readOnly ? 'Nenhuma nota ainda.' : 'Nenhuma nota ainda. Anote NPCs, itens, locais e o que aconteceu em cada sessão.')
                            : 'Nenhuma nota com esse filtro.'}
                    </Typography>
                )
                : shown.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        readOnly={readOnly}
                        version={version}
                        onChange={(patch) => patchNote(note.id, patch)}
                        onDelete={() => removeNote(note)}
                    />
                ))}
        </Stack>
    )
}

const NotesSection = memo(NotesSectionView)
export default NotesSection
