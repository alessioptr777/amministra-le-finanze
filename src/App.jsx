import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/useAuth.jsx'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Entrate from './pages/Entrate'
import Spese from './pages/Spese'
import Fatture from './pages/Fatture'
import Debiti from './pages/Debiti'
import SpeseFisse from './pages/SpeseFisse'
import Budget from './pages/Budget'
import Impostazioni from './pages/Impostazioni'

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/entrate', label: 'Entrate', icon: '💰' },
  { to: '/spese', label: 'Spese', icon: '🛒' },
  { to: '/fatture', label: 'Fatture', icon: '🧾' },
  { to: '/debiti', label: 'Debiti', icon: '📉' },
  { to: '/fisse', label: 'Fisse', icon: '📌' },
  { to: '/budget', label: 'Budget', icon: '📊' },
  { to: '/impostazioni', label: 'Settings', icon: '⚙️' },
]

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.slice(0, 5).map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                isActive ? 'text-blue-600 font-semibold' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 p-4 gap-1">
      <div className="text-lg font-bold text-slate-800 mb-6 px-2">Track Sheet</div>
      {navItems.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`
          }
        >
          <span className="text-lg">{icon}</span>
          {label}
        </NavLink>
      ))}
    </aside>
  )
}

function AppShell() {
  const { loggedIn } = useAuth()


  if (!loggedIn) return <Login />

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />
      <main className="flex-1 pb-20 md:pb-0 max-w-2xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entrate" element={<Entrate />} />
          <Route path="/spese" element={<Spese />} />
          <Route path="/fatture" element={<Fatture />} />
          <Route path="/debiti" element={<Debiti />} />
          <Route path="/fisse" element={<SpeseFisse />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}
