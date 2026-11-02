import { gold, green, ink } from '../../theme'
import type { ThreadStatus } from './doc'
import { tr } from '../../i18n'

export const THREAD_STATUS_LABEL: Record<ThreadStatus, string> = { open: tr('Em aberto', 'Open'), revealed: tr('Revelado', 'Revealed'), resolved: tr('Resolvido', 'Resolved') }

export const THREAD_COLOR: Record<ThreadStatus, string> = { open: gold.deep, revealed: green.mid, resolved: ink.disabled }
