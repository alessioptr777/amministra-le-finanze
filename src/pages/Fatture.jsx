import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function formatData(d) {
  if (!d) return ''
  const [y, m, g] = d.split('-')
  return `${g}-${m}-${y}`
}

const EMPTY_EMESSA = {
  numero_fattura: '',
  data: new Date().toISOString().slice(0, 10),
  cliente_nome: '',
  totale: '',
  igic_percentuale: '7',
  note: '',
}

const EMPTY_RICEVUTA = {
  numero_fattura_fornitore: '',
  data: new Date().toISOString().slice(0, 10),
  fornitore_nome: '',
  totale: '',
  igic_percentuale: '7',
  note: '',
}

export default function Fatture() {
  const [tab, setTab] = useState('emesse')
  const [emesse, setEmesse] = useState([])
  const [ricevute, setRicevute] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formE, setFormE] = useState(EMPTY_EMESSA)
  const [formR, setFormR] = useState(EMPTY_RICEVUTA)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [docFile, setDocFile] = useState(null)
  const [docNome, setDocNome] = useState(null)
  const fileRef = useRef()
  const [fornitoriFissi, setFornitoriFissi] = useState([])
  const [showGestisci, setShowGestisci] = useState(false)
  const [nuovoFornitore, setNuovoFornitore] = useState({ nome: '', importo_atteso: '' })
  const [savingFornitore, setSavingFornitore] = useState(false)

  const now = new Date()
  const meseCorrente = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const meseLabelCorrente = now.toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  useEffect(() => { loadEmesse(); loadRicevute(); loadFornitoriFissi() }, [])

  async function loadEmesse() {
    try {
      const { data, error } = await supabase.from('fatture_emesse').select('*').order('data', { ascending: false })
      if (error) throw error
      setEmesse(data)
    } catch (err) { console.error('loadEmesse:', err.message) }
  }

  async function loadRicevute() {
    try {
      const { data, error } = await supabase.from('fatture_ricevute').select('*').order('data', { ascending: false })
      if (error) throw error
      setRicevute(data)
    } catch (err) { console.error('loadRicevute:', err.message) }
  }

  async function loadFornitoriFissi() {
    try {
      const { data, error } = await supabase.from('fornitori_fissi').select('*').order('created_at')
      if (error) throw error
      setFornitoriFissi(data)
    } catch (err) { console.error('loadFornitoriFissi:', err.message) }
  }

  async function handleAddFornitore() {
    if (!nuovoFornitore.nome.trim()) return
    setSavingFornitore(true)
    try {
      const { error } = await supabase.from('fornitori_fissi').insert({
        nome: nuovoFornitore.nome.trim(),
        importo_atteso: nuovoFornitore.importo_atteso ? parseFloat(nuovoFornitore.importo_atteso) : null,
      })
      if (error) throw error
      setNuovoFornitore({ nome: '', importo_atteso: '' })
      loadFornitoriFissi()
    } catch (err) { console.error('handleAddFornitore:', err.message) }
    finally { setSavingFornitore(false) }
  }

  async function handleDeleteFornitore(id) {
    try {
      const { error } = await supabase.from('fornitori_fissi').delete().eq('id', id)
      if (error) throw error
      loadFornitoriFissi()
    } catch (err) { console.error('handleDeleteFornitore:', err.message) }
  }

  function handleDoc(e) {
    const file = e.target.files[0]
    if (!file) return
    setDocFile(file)
    setDocNome(file.name)
  }

  function resetDoc() {
    setDocFile(null)
    setDocNome(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadDoc() {
    if (!docFile) return null
    try {
      const path = `${Date.now()}_${docFile.name}`
      const { error } = await supabase.storage.from('fatture').upload(path, docFile)
      if (error) throw error
      const { data } = supabase.storage.from('fatture').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      console.error('Upload documento:', err.message)
      return null
    }
  }

  async function handleSaveEmessa(e) {
    e.preventDefault()
    if (!formE.cliente_nome || !formE.totale) return
    setSaving(true)
    setErrore(null)
    try {
      const doc_url = await uploadDoc()
      const { error } = await supabase.from('fatture_emesse').insert({
        numero_fattura: formE.numero_fattura,
        data: formE.data,
        cliente_nome: formE.cliente_nome,
        totale: parseFloat(formE.totale),
        igic_percentuale: parseFloat(formE.igic_percentuale || 7),
        note: formE.note,
        doc_url,
      })
      if (error) throw error
      setFormE(EMPTY_EMESSA)
      resetDoc()
      setShowForm(false)
      loadEmesse()
    } catch (err) {
      console.error('handleSaveEmessa:', err.message)
      setErrore(err.message)
    } finally { setSaving(false) }
  }

  async function handleSaveRicevuta(e) {
    e.preventDefault()
    if (!formR.fornitore_nome || !formR.totale) return
    setSaving(true)
    setErrore(null)
    try {
      const doc_url = await uploadDoc()
      const { error } = await supabase.from('fatture_ricevute').insert({
        numero_fattura_fornitore: formR.numero_fattura_fornitore,
        data: formR.data,
        fornitore_nome: formR.fornitore_nome,
        totale: parseFloat(formR.totale),
        igic_percentuale: parseFloat(formR.igic_percentuale || 7),
        note: formR.note,
        doc_url,
      })
      if (error) throw error
      setFormR(EMPTY_RICEVUTA)
      resetDoc()
      setShowForm(false)
      loadRicevute()
    } catch (err) {
      console.error('handleSaveRicevuta:', err.message)
      setErrore(err.message)
    } finally { setSaving(false) }
  }

  async function handleDelete(tabella, id) {
    try {
      const { error } = await supabase.from(tabella).delete().eq('id', id)
      if (error) throw error
      if (tabella === 'fatture_emesse') loadEmesse()
      else loadRicevute()
    } catch (err) { setErrore(err.message) }
  }

  const lista = tab === 'emesse' ? emesse : ricevute
  const totale = lista.reduce((s, f) => s + (f.totale || 0), 0)

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Fatture</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
          {showForm ? 'Chiudi' : '+ Aggiungi'}
        </button>
      </div>

      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          <strong>Errore:</strong> {errore}
        </div>
      )}

      <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
        {['emesse', 'ricevute'].map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false) }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            {t === 'emesse' ? 'Emesse' : 'Ricevute'}
          </button>
        ))}
      </div>

      {lista.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-500 font-medium">{lista.length} {lista.length === 1 ? 'fattura' : 'fatture'}</p>
          <p className="text-xl font-bold text-slate-800">{formatEur(totale)}</p>
        </div>
      )}

      {tab === 'ricevute' && (() => {
        const ricevuteMese = ricevute.filter(f => f.data && f.data.startsWith(meseCorrente))
        const nomiInseriti = ricevuteMese.map(f => f.fornitore_nome.toLowerCase())
        const mancanti = fornitoriFissi.filter(f => !nomiInseriti.includes(f.nome.toLowerCase()))
        const inseriti = fornitoriFissi.filter(f => nomiInseriti.includes(f.nome.toLowerCase()))
        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 capitalize">Controllo {meseLabelCorrente}</h3>
              <button onClick={() => setShowGestisci(s => !s)} className="text-xs text-blue-500 font-medium">
                {showGestisci ? 'Chiudi' : 'Gestisci lista'}
              </button>
            </div>

            {showGestisci && (
              <div className="bg-slate-50 rounded-xl p-3 mb-3 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  {fornitoriFissi.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-slate-700">{f.nome}{f.importo_atteso ? ` · ~${formatEur(f.importo_atteso)}` : ''}</span>
                      <button onClick={() => handleDeleteFornitore(f.id)} className="text-red-400 text-lg leading-none px-1 hover:text-red-600">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input type="text" placeholder="Nome fornitore" value={nuovoFornitore.nome} onChange={e => setNuovoFornitore(f => ({ ...f, nome: e.target.value }))} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <input type="number" placeholder="€ atteso" value={nuovoFornitore.importo_atteso} onChange={e => setNuovoFornitore(f => ({ ...f, importo_atteso: e.target.value }))} className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <button onClick={handleAddFornitore} disabled={savingFornitore || !nuovoFornitore.nome.trim()} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40">+</button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {mancanti.map(f => (
                <div key={f.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">⚠</span>
                    <span className="text-sm text-slate-700">{f.nome}</span>
                    {f.importo_atteso && <span className="text-xs text-slate-400">~{formatEur(f.importo_atteso)}</span>}
                  </div>
                  <button onClick={() => { setFormR(r => ({ ...r, fornitore_nome: f.nome, totale: f.importo_atteso ? String(f.importo_atteso) : '' })); setShowForm(true) }}
                    className="text-xs text-blue-600 font-medium border border-blue-200 rounded-lg px-2 py-1">
                    Inserisci
                  </button>
                </div>
              ))}
              {inseriti.map(f => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-slate-500 line-through">{f.nome}</span>
                </div>
              ))}
            </div>

            {fornitoriFissi.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-1">Aggiungi i tuoi fornitori fissi per controllare il mese</p>
            )}
            {fornitoriFissi.length > 0 && mancanti.length === 0 && (
              <p className="text-xs text-green-600 font-medium text-center mt-1">Tutte le fatture del mese inserite ✓</p>
            )}
          </div>
        )
      })()}

      {showForm && tab === 'emesse' && (
        <form onSubmit={handleSaveEmessa} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">N° fattura (opz.)</label>
              <input type="text" placeholder="2026/001" value={formE.numero_fattura} onChange={e => setFormE(f => ({ ...f, numero_fattura: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
              <input type="date" value={formE.data} onChange={e => setFormE(f => ({ ...f, data: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Cliente</label>
            {[...new Set(emesse.map(f => f.cliente_nome).filter(Boolean))].length > 0 && (
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-1.5 bg-white"
                value={formE.cliente_nome}
                onChange={e => setFormE(f => ({ ...f, cliente_nome: e.target.value }))}
              >
                <option value="">— scegli cliente salvato —</option>
                {[...new Set(emesse.map(f => f.cliente_nome).filter(Boolean))].map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            )}
            <input type="text" placeholder="oppure scrivi nuovo nome" value={formE.cliente_nome} onChange={e => setFormE(f => ({ ...f, cliente_nome: e.target.value }))} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Totale €</label>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={formE.totale} onChange={e => setFormE(f => ({ ...f, totale: e.target.value }))} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-24">
              <label className="text-xs font-medium text-slate-600 mb-1 block">IGIC %</label>
              <input type="number" min="0" max="100" step="0.5" value={formE.igic_percentuale} onChange={e => setFormE(f => ({ ...f, igic_percentuale: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-center" />
            </div>
          </div>
          {formE.totale && (() => {
            const tot = parseFloat(formE.totale) || 0
            const perc = parseFloat(formE.igic_percentuale) || 0
            const igic = perc > 0 ? tot * perc / (100 + perc) : 0
            const imp = tot - igic
            return <p className="text-xs text-slate-400">Imponibile {formatEur(imp)} · IGIC {perc}% {formatEur(igic)}</p>
          })()}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note (opzionale)</label>
            <input type="text" value={formE.note} onChange={e => setFormE(f => ({ ...f, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Documento (opzionale)</label>
            {docNome ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-sm text-blue-700 truncate">{docNome}</span>
                <button type="button" onClick={resetDoc} className="text-red-400 text-lg ml-2 leading-none">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-slate-400 text-sm hover:border-blue-400">
                Foto o PDF fattura
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleDoc} className="hidden" />
          </div>
          <button type="submit" disabled={saving || !formE.cliente_nome || !formE.totale} className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva fattura'}
          </button>
        </form>
      )}

      {showForm && tab === 'ricevute' && (
        <form onSubmit={handleSaveRicevuta} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">N° fattura (opz.)</label>
              <input type="text" placeholder="facoltativo" value={formR.numero_fattura_fornitore} onChange={e => setFormR(f => ({ ...f, numero_fattura_fornitore: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
              <input type="date" value={formR.data} onChange={e => setFormR(f => ({ ...f, data: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Fornitore</label>
            {[...new Set(ricevute.map(f => f.fornitore_nome).filter(Boolean))].length > 0 && (
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-1.5 bg-white"
                value={formR.fornitore_nome}
                onChange={e => setFormR(f => ({ ...f, fornitore_nome: e.target.value }))}
              >
                <option value="">— scegli fornitore salvato —</option>
                {[...new Set(ricevute.map(f => f.fornitore_nome).filter(Boolean))].map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            )}
            <input type="text" placeholder="oppure scrivi nuovo nome" value={formR.fornitore_nome} onChange={e => setFormR(f => ({ ...f, fornitore_nome: e.target.value }))} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Totale €</label>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={formR.totale} onChange={e => setFormR(f => ({ ...f, totale: e.target.value }))} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-24">
              <label className="text-xs font-medium text-slate-600 mb-1 block">IGIC %</label>
              <input type="number" min="0" max="100" step="0.5" value={formR.igic_percentuale} onChange={e => setFormR(f => ({ ...f, igic_percentuale: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-center" />
            </div>
          </div>
          {formR.totale && (() => {
            const tot = parseFloat(formR.totale) || 0
            const perc = parseFloat(formR.igic_percentuale) || 0
            const igic = perc > 0 ? tot * perc / (100 + perc) : 0
            const imp = tot - igic
            return <p className="text-xs text-slate-400">Imponibile {formatEur(imp)} · IGIC {perc}% {formatEur(igic)}</p>
          })()}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note (opzionale)</label>
            <input type="text" value={formR.note} onChange={e => setFormR(f => ({ ...f, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Documento (opzionale)</label>
            {docNome ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-sm text-blue-700 truncate">{docNome}</span>
                <button type="button" onClick={resetDoc} className="text-red-400 text-lg ml-2 leading-none">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-slate-400 text-sm hover:border-blue-400">
                Foto o PDF fattura
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleDoc} className="hidden" />
          </div>
          <button type="submit" disabled={saving || !formR.fornitore_nome || !formR.totale} className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva fattura'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {lista.length === 0 && <p className="text-center text-slate-400 py-10">Nessuna fattura ancora</p>}
        {lista.map(f => {
          const perc = f.igic_percentuale ?? 7
          const igic = perc > 0 ? f.totale * perc / (100 + perc) : 0
          const imponibile = f.totale - igic
          return (
          <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-slate-800 text-sm">{tab === 'emesse' ? f.cliente_nome : f.fornitore_nome}</p>
                <p className="text-xs text-slate-400">
                  {formatData(f.data)}
                  {f.numero_fattura && ` · n° ${f.numero_fattura}`}
                  {f.numero_fattura_fornitore && ` · n° ${f.numero_fattura_fornitore}`}
                </p>
                {f.note && <p className="text-xs text-slate-400">{f.note}</p>}
                {perc > 0 && <p className="text-xs text-slate-400 mt-0.5">imponibile {formatEur(imponibile)} · IGIC {perc}% {formatEur(igic)}</p>}
              </div>
              <p className="font-bold text-slate-800">{formatEur(f.totale)}</p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {f.doc_url && <a href={f.doc_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500">documento</a>}
              <button onClick={() => handleDelete(tab === 'emesse' ? 'fatture_emesse' : 'fatture_ricevute', f.id)} className="text-xs text-red-400 hover:text-red-600">Elimina</button>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
