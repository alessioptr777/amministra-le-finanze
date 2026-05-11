import { useState } from 'react'
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
import Test from './pages/Test'

const navItems = [
  { to: '/',             full: 'HOME',     },
  { to: '/entrate',      full: 'ENTRATE',  },
  { to: '/spese',        full: 'SPESE',    },
  { to: '/fatture',      full: 'FATTURE',  },
  { to: '/debiti',       full: 'DEBITI',   },
  { to: '/fisse',        full: 'FISSE',    },
  { to: '/budget',       full: 'TASSE',    },
  { to: '/impostazioni', full: 'SETTINGS', },
]

const navStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '12px 18px',
  textDecoration: 'none',
  fontSize: '10px',
  letterSpacing: '.18em',
  fontFamily: "'Courier New',monospace",
  color: isActive ? '#00ffff' : 'rgba(255,255,255,0.75)',
  textShadow: isActive ? '0 0 8px rgba(0,255,255,0.5)' : 'none',
  borderLeft: isActive ? '2px solid #00ffff' : '2px solid transparent',
  background: isActive ? 'rgba(0,255,255,0.04)' : 'transparent',
})

function SideNav() {
  return (
    <aside
      className="hidden md:flex flex-col md:w-36"
      style={{
        minHeight: '100vh',
        background: '#000',
        borderRight: '1px solid rgba(0,255,255,0.1)',
        padding: '16px 0',
        fontFamily: "'Courier New',monospace",
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.65)',padding:'0 18px',marginBottom:'22px'}}>
        METAPROOS_OS
      </div>
      {navItems.map(({to,full})=>(
        <NavLink key={to} to={to} end={to==='/'} style={({isActive})=>navStyle(isActive)}>
          {full}
        </NavLink>
      ))}
    </aside>
  )
}

function MobileDrawer({ open, onClose }) {
  return (
    <div className="md:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 55,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '230px',
        background: '#000',
        borderRight: '1px solid rgba(0,255,255,0.15)',
        zIndex: 56,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '16px',
        fontFamily: "'Courier New',monospace",
      }}>
        {/* Header drawer */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 18px',marginBottom:'24px',borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'14px'}}>
          <span style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>METAPROOS_OS v2.6</span>
          <button
            onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'14px',cursor:'pointer',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',padding:'2px 6px'}}
          >
            [×]
          </button>
        </div>
        {/* Nav items */}
        {navItems.map(({to,full})=>(
          <NavLink
            key={to} to={to} end={to==='/'}
            onClick={onClose}
            style={({isActive})=>({...navStyle(isActive),fontSize:'11px',padding:'14px 18px'})}
          >
            {full}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function AppShell() {
  const { loggedIn } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const missingEnv = []
  if (!import.meta.env.VITE_SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL')
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missingEnv.push('VITE_SUPABASE_ANON_KEY')
  if (!import.meta.env.VITE_APP_PASSWORD) missingEnv.push('VITE_APP_PASSWORD')

  if (missingEnv.length > 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="bg-white rounded-lg border-2 border-red-200 p-6 max-w-md">
          <h1 className="text-2xl font-bold text-red-700 mb-3">⚠️ Configuration Error</h1>
          <p className="text-red-600 mb-4">Missing environment variables:</p>
          <ul className="list-disc list-inside text-sm text-red-600 mb-4">
            {missingEnv.map(v => <li key={v}>{v}</li>)}
          </ul>
          <p className="text-sm text-slate-600">
            For Vercel deployment, add these variables in Project Settings → Environment Variables
          </p>
        </div>
      </div>
    )
  }

  if (!loggedIn) return <Login />

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#000'}}>
      <SideNav />

      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        {/* Mobile top bar */}
        <div
          className="flex items-center md:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 50,
            background: '#000',
            borderBottom: '1px solid rgba(0,255,255,0.08)',
            height: '40px',
            padding: '0 14px',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: 'none', border: '1px solid rgba(0,255,255,0.2)',
              borderRadius: '2px',
              color: 'rgba(0,255,255,0.7)', fontSize: '14px',
              cursor: 'pointer', fontFamily: "'Courier New',monospace",
              padding: '2px 8px', letterSpacing: '.05em',
              lineHeight: 1,
            }}
          >
            ≡
          </button>
          <span style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.65)',fontFamily:"'Courier New',monospace"}}>
            METAPROOS_OS v2.6
          </span>
        </div>

        <main style={{flex:1}}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entrate" element={<Entrate />} />
            <Route path="/spese" element={<Spese />} />
            <Route path="/fatture" element={<Fatture />} />
            <Route path="/debiti" element={<Debiti />} />
            <Route path="/fisse" element={<SpeseFisse />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/impostazioni" element={<Impostazioni />} />
            <Route path="/test" element={<Test />} />
          </Routes>
        </main>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
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
