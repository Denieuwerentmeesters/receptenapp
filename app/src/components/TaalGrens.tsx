import type { ReactNode } from 'react'
import { useTaal } from '../lib/taal'

/** Monteert alles opnieuw als de taal wisselt, zodat elke t() opnieuw loopt. */
export function TaalGrens({ children }: { children: ReactNode }) {
  const taal = useTaal()
  return <div key={taal} style={{ display: 'contents' }}>{children}</div>
}
