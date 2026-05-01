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
  igic_percentuale: '7',
  note: '',
  dichiara: true,
}

const EMPTY_NUOVA = { nome: '', epigrafe: 'actividades' }

const DEFAULT_ATTIVITA = [
  { nome: 'Tenerife Stars', tipo: 'collaborazione', epigrafe: 'fotografo', commissione_percentuale_default: 0, colore: '#f59e0b', attiva: true },
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
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  const lordo = (parseFloat(form.importo_cash) || 0) + (parseFloat(form.importo_card) || 0)
  const igicPerc = parseFloat(form.igic_percentuale) || 0
  const imponibile = igicPerc > 0 ? lordo / (1 + igicPerc / 100) : lordo
  const igicImporto = lordo - imponibile

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
        importo_netto: imponibile,
        igic_percentuale: igicPerc,
        note: form.note,
        dichiara: form.dichiara,
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

  function startEdit(e) {
    setEditandoId(e.id)
    setEditForm({
      data: e.data || new Date().toISOString().slice(0, 10),
      attivita_id: e.attivita_id || '',
      importo_cash: String(e.importo_cash || ''),
      importo_card: String(e.importo_card || ''),
      igic_percentuale: String(e.igic_percentuale ?? 7),
      note: e.note || '',
      dichiara: e.dichiara !== false,
    })
  }

  async function handleSaveEdit(id) {
    const cash = parseFloat(editForm.importo_cash) || 0
    const card = parseFloat(editForm.importo_card) || 0
    const totale = cash + card
    const igicP = parseFloat(editForm.igic_percentuale) || 0
    const imp = igicP > 0 ? totale / (1 + igicP / 100) : totale
    if (!editForm.attivita_id || totale === 0) return
    setSavingEdit(true)
    try {
      const att = attivita.find(a => a.id === editForm.attivita_id)
      const { error } = await supabase.from('entrate').update({
        data: editForm.data,
        attivita_id: editForm.attivita_id,
        attivita_nome: att?.nome || '',
        attivita_colore: att?.colore || '',
        importo_cash: cash,
        importo_card: card,
        importo_lordo: totale,
        importo_netto: imp,
        igic_percentuale: igicP,
        note: editForm.note,
        dichiara: editForm.dichiara,
      }).eq('id', id)
      if (error) throw error
      setEditandoId(null)
      loadEntrate()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingEdit(false)
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
        commissione_percentuale_default: 0,
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

  const totaleCash = entrateFiltrate.reduce((s, e) => s + (e.importo_cash || 0), 0)
  const totaleCard = entrateFiltrate.reduce((s, e) => s + (e.importo_card || 0), 0)
  const totale = totaleCash + totaleCard

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
                </div>
                <button onClick={() => handleDeleteAttivita(a.id)} className="text-slate-300 hover:text-red-500 text-xl leading-none px-1">×</button>
              </div>
            ))}
          </div>
          {showNuova ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
              <input type="text" placeholder="Nome attività" value={nuova.nome} onChange={e => setNuova(f => ({ ...f, nome: e.target.value }))} autoFocus className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Categoria</label>
                <select value={nuova.epigrafe} onChange={e => setNuova(f => ({ ...f, epigrafe: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="actividades">Tour / Escursioni</option>
                  <option value="fotografo">Fotografia</option>
                  <option value="altro">Altro</option>
                </select>
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

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-green-50 rounded-xl p-3 border border-green-100 col-span-1">
          <p className="text-xs text-green-700 font-medium">Totale</p>
          <p className="text-lg font-bold text-green-800">{formatEur(totale)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs text-slate-600 font-medium">Cash</p>
          <p className="text-lg font-bold text-slate-800">{formatEur(totaleCash)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">Card</p>
          <p className="text-lg font-bold text-blue-800">{formatEur(totaleCard)}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Attività</label>
            <select value={form.attivita_id} onChange={e => setForm(f => ({ ...f, attivita_id: e.target.value }))} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
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
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">IGIC inclusa</label>
            <div className="flex gap-2">
              {[{ val: '0', label: '0% (esente)' }, { val: '7', label: '7% (standard)' }].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setForm(f => ({ ...f, igic_percentuale: opt.val }))}
                  className={`flex-1 py-2 rounded-lg text-sm border font-medium ${form.igic_percentuale === opt.val ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {lordo > 0 && (
            <div className="bg-green-50 rounded-xl p-3 text-sm flex flex-col gap-1">
              <div className="flex justify-between text-slate-500">
                <span>Lordo</span>
                <span>{formatEur(lordo)}</span>
              </div>
              {igicPerc > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>IGIC {igicPerc}%</span>
                  <span>-{formatEur(igicImporto)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-green-700 border-t border-green-200 pt-1">
                <span>Imponibile (Mod 130)</span>
                <span>{formatEur(imponibile)}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note (opzionale)</label>
            <input type="text" placeholder="es. gruppo di 8 persone" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700">Dichiara al fisco</p>
              <p className="text-xs text-slate-400">se off, non entra nel Mod 130</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, dichiara: !f.dichiara }))}
              className={`w-12 h-6 rounded-full transition-colors ${form.dichiara ? 'bg-green-500' : 'bg-slate-300'}`}>
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.dichiara ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <button type="submit" disabled={saving || lordo === 0 || !form.attivita_id} className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva entrata'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {entrateFiltrate.length === 0 && <p className="text-center text-slate-400 py-10">Nessuna entrata ancora</p>}
        {entrateFiltrate.map(e => {
          const staModificando = editandoId === e.id
          return (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-3">
              {staModificando ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
                    <input type="date" value={editForm.data} onChange={ev => setEditForm(f => ({ ...f, data: ev.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Attività</label>
                    <select value={editForm.attivita_id} onChange={ev => setEditForm(f => ({ ...f, attivita_id: ev.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Seleziona...</option>
                      {attivita.filter(a => a.attiva).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Cash €</label>
                      <input type="number" min="0" step="0.01" value={editForm.importo_cash} onChange={ev => setEditForm(f => ({ ...f, importo_cash: ev.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Card €</label>
                      <input type="number" min="0" step="0.01" value={editForm.importo_card} onChange={ev => setEditForm(f => ({ ...f, importo_card: ev.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
                    <input type="text" value={editForm.note} onChange={ev => setEditForm(f => ({ ...f, note: ev.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">IGIC inclusa</label>
                    <div className="flex gap-2">
                      {[{ val: '0', label: '0% (esente)' }, { val: '7', label: '7% (standard)' }].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setEditForm(f => ({ ...f, igic_percentuale: opt.val }))}
                          className={`flex-1 py-2 rounded-lg text-sm border font-medium ${editForm.igic_percentuale === opt.val ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Dichiara al fisco</p>
                      <p className="text-xs text-slate-400">se off, non entra nel Mod 130</p>
                    </div>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, dichiara: !f.dichiara }))}
                      className={`w-12 h-6 rounded-full transition-colors ${editForm.dichiara ? 'bg-green-500' : 'bg-slate-300'}`}>
                      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.dichiara ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditandoId(null)} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm">Annulla</button>
                    <button onClick={() => handleSaveEdit(e.id)} disabled={savingEdit} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40">
                      {savingEdit ? 'Salvo...' : 'Salva'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{e.attivita_nome}</p>
                      <p className="text-xs text-slate-400">{formatData(e.data)}</p>
                      {e.note && <p className="text-xs text-slate-400 mt-0.5">{e.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{formatEur(e.importo_lordo || e.importo_netto)}</p>
                      {(e.importo_cash > 0 || e.importo_card > 0) && (
                        <div className="flex gap-2 mt-0.5 text-xs text-slate-500 justify-end">
                          {e.importo_cash > 0 && <span>Cash {formatEur(e.importo_cash)}</span>}
                          {e.importo_cash > 0 && e.importo_card > 0 && <span>·</span>}
                          {e.importo_card > 0 && <span>Card {formatEur(e.importo_card)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(e)} className="text-xs text-blue-500 hover:text-blue-700">Modifica</button>
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-red-400 hover:text-red-600">Elimina</button>
                    </div>
                    {e.dichiara === false && (
                      <span className="text-xs text-slate-400 italic">non dichiarata</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
