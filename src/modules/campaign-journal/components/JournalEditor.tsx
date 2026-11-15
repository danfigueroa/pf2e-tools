import type { ComponentProps } from 'react'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'

/**
 * O editor do Diário: a barra inteira, com "Só o mestre" (o Resumo vira crônica da Wiki com o texto todo, e
 * lá o servidor corta o trecho para os jogadores) e alinhamento. O texto sem marca segue à esquerda.
 */
export function JournalEditor(props: ComponentProps<typeof MarkdownEditor>) {
    return <MarkdownEditor gmBlock alignTools {...props} />
}
