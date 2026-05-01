import { useState } from 'react'
import { useAuth } from '../lib/useAuth.jsx'

export default function Login() {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!login(password)) {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-xs">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Track Sheet</h1>
        <p className="text-slate-500 text-sm mb-8">Inserisci la password per accedere</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            autoFocus
            placeholder="Password"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p className="text-red-600 text-sm text-center">Password non corretta</p>
          )}

          <button
            type="submit"
            className="bg-blue-600 text-white rounded-lg py-3 font-semibold text-sm hover:bg-blue-700"
          >
            Entra
          </button>
        </form>
      </div>
    </div>
  )
}
