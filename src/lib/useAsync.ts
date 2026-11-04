import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './supabase'

/** Charge des données de façon asynchrone et permet de les recharger. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const callId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const reload = useCallback(async () => {
    const id = ++callId.current
    setLoading(true)
    setError(null)
    try {
      const result = await run()
      if (id === callId.current) setData(result)
    } catch (e) {
      if (id === callId.current) setError(errorMessage(e))
    } finally {
      if (id === callId.current) setLoading(false)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload, setData }
}
