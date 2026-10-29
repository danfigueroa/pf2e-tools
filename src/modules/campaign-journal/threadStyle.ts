import { gold, green, ink } from '../../theme'
import type { ThreadStatus } from './doc'

export const THREAD_STATUS_LABEL: Record<ThreadStatus, string> = { open: 'Em aberto', revealed: 'Revelado', resolved: 'Resolvido' }

export const THREAD_COLOR: Record<ThreadStatus, string> = { open: gold.deep, revealed: green.mid, resolved: ink.disabled }
