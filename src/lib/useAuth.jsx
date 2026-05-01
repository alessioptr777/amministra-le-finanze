import { useState, createContext, useContext } from 'react'

const KEY = 'ts_logged_in'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem(KEY) === '1')

  function login(password) {
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      localStorage.setItem(KEY, '1')
      setLoggedIn(true)
      return true
    }
    return false
  }

  function logout() {
    localStorage.removeItem(KEY)
    setLoggedIn(false)
  }

  return (
    <AuthContext.Provider value={{ loggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
