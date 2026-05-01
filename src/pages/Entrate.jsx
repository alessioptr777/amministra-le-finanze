import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function formatData(d) {
  if (!d) return ''
  const [y, m, g] = d.split('-')
  return `${g}-${m}-${y}`
}

const EMPTY_FORM = {
  data: new Date().toISOString().slice(0, 10),
  attivita_id: '',
  importo_cash: '',
  importo_card: '',
  commissione_percentuale: '',
  metodo_pagamento_commissione: 'cash',
  note: '',
}

const EMPTY_NUOVA = { nome: '', commissione_percentuale_default: '0', epigrafe: 'actividades' }

const DEFAULT_ATTIVITA = [
  { nome: 'Tenerife Stars', tipo: 'collaborazione', epigrafe: 'fotografo', commissione_percentuale_default: 33, colore: '#f59e0b', attiva: true },
  { nome: 'Interstellar', tipo: 'propria', epigrafe: 'actividades', commissione_percentuale_default: 0, colore: '#3b82f6', attiva: true },
  { nome: 'Foodfather', tipo: 'propria', epigrafe: 'actividades', commissione_percentuale_default: 0, colore: '#10b981', attiva: true },
  { nome: 'Fotografia privata', tipo: 'privata', epigrafe: 'fotografo', commissione_percentuale_default: 0, colore: '#8b5cf6', attiva: true },
]

export default function Entrate() {
  const [attivita, setAttivita] = useState([])
  const [entrate, setEntrate] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingAttivita, setLoadingAttivita] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [nuova, setNuova] = useState(EMPTY_NUOVA)
  const [showNuova, setShowNuova] = useState(false)
  const [savingNuova, setSavingNuova] = useState(false)
  const [filtroAttivita, setFiltroAttivita] = useState('tutte')
  const [settimanaSelezionata, setSettimanaSelezionata] = useState('')
  const [commissioniPagate, setCommissioniPagate] = useState(() => {
    try { return JSON.parse(localStorage.getItem('commissioni_pagate') || '{}') } catch { return {} }
  })

  const lordo = (parseFloat(form.importo_cash) || 0) + (parseFloat(form.importo_card) || 0)
  const commPerc = parseFloat(form.commissione_percentuale) || 0
  const commissione = (lordo * commPerc) / 100
  const netto = lordo - commissione

  useEffect(() => { loadAttivita(); loadEntrate() }, [])

  async function loadAttivita() {
    setLoadingAttivita(true)
    try {
      const { data, error } = await supabase.from('attivita').select('*').order('created_at')
      if (error) throw error
      setAttivita(data)
    } catch (err) {
      console.error('Errore attività:', err.message)
    } finally {
      setLoadingAttivita(false)
    }
  }

  async function loadEntrate() {
    try {
      const { data, error } = await supabase.from('entrate').select('*').order('data', { ascending: false })
      if (error) throw error
      setEntrate(data)
    } catch (err) {
      console.error('Errore entrate:', err.message)
    }
  }

  function handleAttivitaChange(id) {
    const a = attivita.find(a => a.id === id)
    setForm(f => ({ ...f, attivita_id: id, commissione_percentuale: a ? String(a.commissione_percentuale_default) : '' }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.attivita_id || lordo === 0) return
    setSaving(true)
    try {
      const att = attivita.find(a => a.id === form.attivita_id)
      const { error } = await supabase.from('entrate').insert({
        data: form.data,
        attivita_id: form.attivita_id,
        attivita_nome: att?.nome || '',
        attivita_colore: att?.colore || '',
        importo_cash: parseFloat(form.importo_cash) || 0,
        importo_card: parseFloat(form.importo_card) || 0,
        importo_lordo: lordo,
        commissione_percentuale: commPerc,
        importo_commissione: commissione,
        metodo_pagamento_commissione: form.metodo_pagamento_commissione,
        importo_netto: netto,
        note: form.note,
      })
      if (error) throw error
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadEntrate()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('entrate').delete().eq('id', id)
      if (error) throw error
      loadEntrate()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  async function handleDeleteAttivita(id) {
    try {
      const { error } = await supabase.from('attivita').delete().eq('id', id)
      if (error) throw error
      loadAttivita()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  async function handleReset() {
    try {
      await supabase.from('attivita').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await supabase.from('attivita').insert(DEFAULT_ATTIVITA)
      if (error) throw error
      loadAttivita()
    } catch (err) {
      alert('Errore reset: ' + err.message)
    }
  }

  async function handleSaveNuova() {
    if (!nuova.nome.trim()) return
    setSavingNuova(true)
    try {
      const { error } = await supabase.from('attivita').insert({
        nome: nuova.nome.trim(),
        tipo: 'propria',
        epigrafe: nuova.epigrafe,
        commissione_percentuale_default: parseFloat(nuova.commissione_percentuale_default) || 0,
        colore: '#6366f1',
        attiva: true,
      })
      if (error) throw error
      setNuova(EMPTY_NUOVA)
      setShowNuova(false)
      loadAttivita()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingNuova(false)
    }
  }

  const entrateFiltrate = filtroAttivita === 'tutte'
    ? entrate
    : entrate.filter(e => e.attivita_id === filtroAttivita)

  const totaleNetto = entrateFiltrate.reduce((s, e) => s + (e.importo_netto || 0), 0)
  const totaleCommissioni = entrateFiltrate.reduce((s, e) => s + (e.importo_commissione || 0), 0)
  const totaleCash = entrateFiltrate.reduce((s, e) => s + (e.importo_cash || 0), 0)
  const totaleCard = entrateFiltrate.reduce((s, e) => s + (e.importo_card || 0), 0)

  const attivitaFiltrata = attivita.find(a => a.id === filtroAttivita)
  const mostraSettimane = attivitaFiltrata && attivitaFiltrata.commissione_percentuale_default > 0

  function getWeekKey(dateStr) {
    const date = new Date(dateStr)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(date.getDate() + diff)
    return monday.toISOString().slice(0, 10)
  }

  function getWeekLabel(mondayStr) {
    const monday = new Date(mondayStr + 'T00:00:00')
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    return `${fmt(monday)} – ${fmt(sunday)}`
  }

  function togglePagata(key) {
    const nuove = { ...commissioniPagate, [key]: !commissioniPagate[key] }
    setCommissioniPagate(nuove)
    localStorage.setItem('commissioni_pagate', JSON.stringify(nuove))
  }

  const settimane = mostraSettimane ? Object.values(
    entrateFiltrate.reduce((acc, e) => {
      const key = getWeekKey(e.data)
      if (!acc[key]) acc[key] = { key, lordo: 0, commissione: 0, netto: 0 }
      acc[key].lordo += e.importo_lordo || 0
      acc[key].commissione += e.importo_commissione || 0
      acc[key].netto += e.importo_netto || 0
      return acc
    }, {})
  ).sort((a, b) => b.key.localeCompare(a.key)) : []

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Entrate</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowPanel(s => !s); setShowForm(false) }} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-sm font-medium">Attività</button>
          <button onClick={() => { setShowForm(s => !s); setShowPanel(false) }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
            {showForm ? 'Chiudi' : '+ Aggiungi'}
          </button>
        </div>
      </div>

      {showPanel && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 text-sm">Le tue attività</h2>
            <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-600">Reset a default</button>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {loadingAttivita && <p className="text-xs text-slate-400">Caricamento...</p>}
            {attivita.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.colore }} />
                  <span className="text-sm text-slate-700">{a.nome}</span>
                  {a.commissione_percentuale_default > 0 && <span className="text-xs text-orange-500">{a.commissione_percentuale_default}%</span>}
                </div>
                <button onClick={() => handleDeleteAttivita(a.id)} className="text-slate-300 hover:text-red-500 text-xl leading-none px-1">×</button>
              </div>
            ))}
          </div>
          {showNuova ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
              <input type="text" placeholder="Nome attività" value={nuova.nome} onChange={e => setNuova(f => ({ ...f, nome: e.target.value }))} autoFocus className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-0.5 block">Commissione %</label>
                  <input type="number" min="0" max="100" step="0.5" value={nuova.commissione_percentuale_default} onChange={e => setNuova(f => ({ ...f, commissione_percentuale_default: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-0.5 block">Categoria</label>
                  <select value={nuova.epigrafe} onChange={e => setNuova(f => ({ ...f, epigrafe: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="actividades">Tour / Escursioni</option>
                    <option value="fotografo">Fotografia</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNuova(false)} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm">Annulla</button>
                <button type="button" onClick={handleSaveNuova} disabled={savingNuova || !nuova.nome.trim()} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40">
                  {savingNuova ? 'Salvo...' : 'Crea'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNuova(true)} className="w-full border border-dashed border-slate-300 text-slate-500 rounded-lg py-2 text-sm hover:border-blue-400 hover:text-blue-600">+ Nuova attività</button>
          )}
        </div>
      )}

      {attivita.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          <button onClick={() => setFiltroAttivita('tutte')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${filtroAttivita === 'tutte' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}>Tutte</button>
          {attivita.filter(a => a.attiva).map(a => (
            <button key={a.id} onClick={() => setFiltroAttivita(a.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${filtroAttivita === a.id ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-300'}`}
              style={filtroAttivita === a.id ? { background: a.colore, borderColor: a.colore } : {}}>
              {a.nome}
            </button>
          ))}
        </div>
      )}

      {!loadingAttivita && attivita.length === 0 && !showPanel && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
          <p className="text-amber-800 text-sm">Nessuna attività. Clicca "Attività" per crearle.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <p className="text-xs text-green-700 font-medium">Netto totale</p>
          <p className="text-xl font-bold text-green-800">{formatEur(totaleNetto)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
          <p className="text-xs text-orange-700 font-medium">Commissioni da pagare</p>
          <p className="text-xl font-bold text-orange-800">{formatEur(totaleCommissioni)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs text-slate-600 font-medium">Cash incassato</p>
          <p className="text-xl font-bold text-slate-800">{formatEur(totaleCash)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">Card incassato</p>
          <p className="text-xl font-bold text-blue-800">{formatEur(totaleCard)}</p>
        </div>
      </div>

      {mostraSettimane && settimane.length > 0 && (() => {
        const chiave = settimanaSelezionata || settimane[0].key
        const s = settimane.find(s => s.key === chiave) || settimane[0]
        const pagata = !!commissioniPagate[chiave]
        return (
          <div className={`rounded-2xl border p-4 mb-5 ${pagata ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Commissioni guida</h3>
              <span className="text-xs text-slate-400">{attivitaFiltrata.commissione_percentuale_default}%</span>
            </div>
            <select
              value={chiave}
              onChange={e => setSettimanaSelezionata(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white mb-3"
            >
              {settimane.map(s => (
                <option key={s.key} value={s.key}>{getWeekLabel(s.key)} {commissioniPagate[s.key] ? '✓ pagata' : ''}</option>
              ))}
            </select>
            <div className="flex justify-between items-center mb-3">
              <span className={`text-sm font-medium ${pagata ? 'text-green-700' : 'text-orange-600'}`}>
                {pagata ? 'Pagata alla guida' : 'Da pagare alla guida'}
              </span>
              <span className={`text-xl font-bold ${pagata ? 'text-green-700' : 'text-orange-600'}`}>{formatEur(s.commissione)}</span>
            </div>
            <button
              onClick={() => togglePagata(chiave)}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold ${pagata ? 'bg-slate-100 text-slate-600' : 'bg-orange-500 text-white'}`}
            >
              {pagata ? 'Segna come non pagata' : 'Segna come pagata'}
            </button>
          </div>
        )
      })()}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Attività</label>
            <select value={form.attivita_id} onChange={e => handleAttivitaChange(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Seleziona...</option>
              {attivita.filter(a => a.attiva).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cash €</label>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={form.importo_cash} onChange={e => setForm(f => ({ ...f, importo_cash: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Card €</label>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={form.importo_card} onChange={e => setForm(f => ({ ...f, importo_card: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {lordo > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Lordo</span>
                <span className="font-medium">{formatEur(lordo)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 flex-1">Commissione</span>
                <input type="number" min="0" max="100" step="0.5" value={form.commissione_percentuale} onChange={e => setForm(f => ({ ...f, commissione_percentuale: e.target.value }))} className="w-16 border border-slate-300 rounded px-2 py-0.5 text-sm text-right" />
                <span className="text-slate-500">%</span>
                <span className="font-medium text-orange-600 ml-1">{formatEur(commissione)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
                <span className="text-green-700">Netto</span>
                <span className="text-green-700">{formatEur(netto)}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note (opzionale)</label>
            <input type="text" placeholder="es. gruppo di 8 persone" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving || lordo === 0 || !form.attivita_id} className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva entrata'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {entrateFiltrate.length === 0 && <p className="text-center text-slate-400 py-10">Nessuna entrata ancora</p>}
        {entrateFiltrate.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-slate-800 text-sm">{e.attivita_nome}</p>
                <p className="text-xs text-slate-400">{formatData(e.data)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-700">{formatEur(e.importo_netto)}</p>
                {e.importo_commissione > 0 && <p className="text-xs text-orange-600">comm. {formatEur(e.importo_commissione)}</p>}
              </div>
            </div>
            {(e.importo_cash > 0 || e.importo_card > 0) && (
              <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                {e.importo_cash > 0 && <span>Cash {formatEur(e.importo_cash)}</span>}
                {e.importo_cash > 0 && e.importo_card > 0 && <span>·</span>}
                {e.importo_card > 0 && <span>Card {formatEur(e.importo_card)}</span>}
              </div>
            )}
            {e.note && <p className="text-xs text-slate-400 mt-1">{e.note}</p>}
            <button onClick={() => handleDelete(e.id)} className="text-xs text-red-400 mt-1.5 hover:text-red-600">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}
