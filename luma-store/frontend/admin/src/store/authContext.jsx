import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Fetch "me" on mount if token exists ──────────────────
  useEffect(() => {
    const token = localStorage.getItem('luma_access')
    if (!token) { setLoading(false); return }

    api.get('/auth/me/')
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem('luma_access')
        localStorage.removeItem('luma_refresh')
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('luma_access',  data.access)
    localStorage.setItem('luma_refresh', data.refresh)

    const me = await api.get('/auth/me/')
    setUser(me.data)
    return me.data
  }, [])

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('luma_access')
    localStorage.removeItem('luma_refresh')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const isAuthenticated = Boolean(user)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
