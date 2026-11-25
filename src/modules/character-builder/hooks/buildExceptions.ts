import { createContext } from 'react'

/** Só o editor do personagem fornece as exceções dele. A consulta ao catálogo usa as regras da mesa. */
export const BuildExceptions = createContext<ReadonlySet<string>>(new Set())
