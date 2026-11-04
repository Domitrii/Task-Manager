import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Back to wherever someone came from, or to `fallback` if they landed here directly. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => {
    if (key === 'default') navigate(fallback)
    else navigate(-1)
  }, [key, navigate, fallback])
}
