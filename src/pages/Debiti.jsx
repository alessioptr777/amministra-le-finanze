import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

const EMPTY_FORM = {
  nome: '',
  importo_totale: '',
  importo_pagato: '',
  rata_mensile: '',
  giorno_addebito: '',
  data_prima_rata: '',
  data_fine: '',
  addebito_automatico: false,
  deducibile: false,
  igic_percentuale: '0',
  note: '',
}

export default function Debiti() {
  const [debiti, setDebiti] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [simula, setSimula] = useState({})
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { loadDebiti() }, [])

  async function loadDebiti() {
    try {
      const { data, error } = await supabase.from('debiti').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setDebiti(data)
    } catch (err) {
      console.error('Errore debiti:', err.message)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome || !form.importo_totale || !form.rata_mensile) return
    setSaving(true)
    try {
      const { error } = await supabase.from('debiti').insert({
        nome: form.nome.trim(),
        importo_totale: parseFloat(form.importo_totale || 0),
        importo_pagato: parseFloat(form.importo_pagato || 0),
        rata_mensile: parseFloat(form.rata_mensile),
        giorno_addebito: form.giorno_addebito ? parseInt(form.giorno_addebito) : null,
        data_prima_rata: form.data_prima_rata || null,
        data_fine: form.data_fine || null,
        addebito_automatico: form.addebito_automatico,
        deducibile: form.deducibile,
        igic_percentuale: form.deducibile ? (parseFloat(form.igic_percentuale) || 0) : 0,
        note: form.note.trim(),
      })
      if (error) throw error
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadDebiti()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(debito) {
    setEditandoId(debito.id)
    setEditForm({
      nome: debito.nome || '',
      importo_totale: String(debito.importo_totale || ''),
      importo_pagato: String(debito.importo_pagato || '0'),
      rata_mensile: String(debito.rata_mensile || ''),
      giorno_addebito: debito.giorno_addebito ? String(debito.giorno_addebito) : '',
      data_prima_rata: debito.data_prima_rata || '',
      data_fine: debito.data_fine || '',
      addebito_automatico: debito.addebito_automatico || false,
      deducibile: debito.deducibile || false,
      igic_percentuale: String(debito.igic_percentuale ?? 0),
      note: debito.note || '',
    })
  }

  async function handleSaveEdit(id) {
    if (!editForm.nome || !editForm.importo_totale || !editForm.rata_mensile) return
    setSavingEdit(true)
    try {
      const { error } = await supabase.from('debiti').update({
        nome: editForm.nome.trim(),
        importo_totale: parseFloat(editForm.importo_totale || 0),
        importo_pagato: parseFloat(editForm.importo_pagato || 0),
        rata_mensile: parseFloat(editForm.rata_mensile),
        giorno_addebito: editForm.giorno_addebito ? parseInt(editForm.giorno_addebito) : null,
        data_prima_rata: editForm.data_prima_rata || null,
        data_fine: editForm.data_fine || null,
        addebito_automatico: editForm.addebito_automatico,
        deducibile: editForm.deducibile,
        igic_percentuale: editForm.deducibile ? (parseFloat(editForm.igic_percentuale) || 0) : 0,
        note: editForm.note.trim(),
      }).eq('id', id)
      if (error) throw error
      setEditandoId(null)
      loadDebiti()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handlePagaRata(debito) {
    const nuovoPagato = Math.min((debito.importo_pagato || 0) + debito.rata_mensile, debito.importo_totale)
    try {
      const { error } = await supabase.from('debiti').update({ importo_pagato: nuovoPagato }).eq('id', debito.id)
      if (error) throw error
      loadDebiti()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('debiti').delete().eq('id', id)
      if (error) throw error
      loadDebiti()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  function calcMesiRimanenti(debito, extraMensile = 0) {
    const residuo = debito.importo_totale - (debito.importo_pagato || 0)
    const rata = debito.rata_mensile + extraMensile
    if (rata <= 0 || residuo <= 0) return 0
    return Math.ceil(residuo / rata)
  }

  function calcDataFine(debito, extraMensile = 0) {
    const mesi = calcMesiRimanenti(debito, extraMensile)
    if (mesi === 0) return 'Estinto'
    const base = debito.data_prima_rata ? new Date(debito.data_prima_rata) : new Date()
    const d = new Date(base)
    d.setMonth(d.getMonth() + mesi)
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  const totaleResiduo = debiti.reduce((s, d) => s + Math.max(0, d.importo_totale - (d.importo_pagato || 0)), 0)
  const totaleRate = debiti.reduce((s, d) => {
    const residuo = d.importo_totale - (d.importo_pagato || 0)
    return residuo > 0 ? s + d.rata_mensile : s
  }, 0)

  const campiEdit = (form, setForm) => (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Nome debito</label>
        <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Importo totale €</label>
          <input type="number" min="0" step="0.01" value={form.importo_totale} onChange={e => setForm(f => ({ ...f, importo_totale: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Già pagato €</label>
          <input type="number" min="0" step="0.01" value={form.importo_pagato} onChange={e => setForm(f => ({ ...f, importo_pagato: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Rata mensile €</label>
          <input type="number" min="0" step="0.01" value={form.rata_mensile} onChange={e => setForm(f => ({ ...f, rata_mensile: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Giorno addebito</label>
          <input type="number" min="1" max="31" value={form.giorno_addebito} onChange={e => setForm(f => ({ ...f, giorno_addebito: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Data prima rata</label>
        <input type="date" value={form.data_prima_rata} onChange={e => setForm(f => ({ ...f, data_prima_rata: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Data fine (opzionale)</label>
        <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id={`auto_${form.nome}`} checked={form.addebito_automatico} onChange={e => setForm(f => ({ ...f, addebito_automatico: e.target.checked }))} className="w-4 h-4 rounded" />
        <label htmlFor={`auto_${form.nome}`} className="text-sm text-slate-700">Addebito automatico (domiciliato)</label>
      </div>
      <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Deducibile per le tasse</p>
            <p className="text-xs text-slate-400">riduce il Mod 130 (IRPF)</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, deducibile: !f.deducibile }))}
            className={`w-12 h-6 rounded-full transition-colors ${form.deducibile ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.deducibile ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        {form.deducibile && (
          <div className="flex gap-2">
            {[
              { val: '0', label: 'IVA (0% IGIC)', desc: 'es. renting auto' },
              { val: '7', label: 'IGIC 7%', desc: 'es. fornitori locali' },
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setForm(f => ({ ...f, igic_percentuale: opt.val }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs border text-left ${
                  form.igic_percentuale === opt.val
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                <p className="font-medium">{opt.label}</p>
                <p className="opacity-60">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
        <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
    </div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Debiti</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
          {showForm ? 'Chiudi' : '+ Aggiungi'}
        </button>
      </div>

      {debiti.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-xs text-red-700 font-medium mb-1">Residuo totale</p>
            <p className="text-lg font-bold text-red-800">{formatEur(totaleResiduo)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
            <p className="text-xs text-orange-700 font-medium mb-1">Rate mensili</p>
            <p className="text-lg font-bold text-orange-800">{formatEur(totaleRate)}</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          {campiEdit(form, setForm)}
          <button type="submit" disabled={saving || !form.nome || !form.importo_totale || !form.rata_mensile} className="bg-red-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Aggiungi debito'}
          </button>
        </form>
      )}

      {debiti.length === 0 && !showForm && <p className="text-center text-slate-400 py-10 text-sm">Nessun debito registrato</p>}

      <div className="flex flex-col gap-4">
        {debiti.map(debito => {
          const residuo = Math.max(0, debito.importo_totale - (debito.importo_pagato || 0))
          const percentuale = debito.importo_totale > 0 ? Math.min(100, ((debito.importo_pagato || 0) / debito.importo_totale) * 100) : 0
          const rateEseguite = debito.rata_mensile > 0 ? Math.floor((debito.importo_pagato || 0) / debito.rata_mensile) : 0
          const rateTotali = debito.rata_mensile > 0 ? Math.ceil(debito.importo_totale / debito.rata_mensile) : 0
          const estinto = residuo <= 0
          const extraSimula = parseFloat(simula[debito.id] || 0)
          const staModificando = editandoId === debito.id

          return (
            <div key={debito.id} className={`bg-white rounded-2xl border p-4 ${estinto ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{debito.nome}</p>
                  {debito.deducibile && !staModificando && (
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-100">
                      deducibile{debito.igic_percentuale > 0 ? ` · IGIC ${debito.igic_percentuale}%` : ' · IVA'}
                    </span>
                  )}
                  {debito.note && !staModificando && <p className="text-xs text-slate-500 mt-0.5">{debito.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {estinto
                    ? <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Estinto</span>
                    : <span className="text-sm font-bold text-red-700">{formatEur(residuo)}</span>
                  }
                  <button onClick={() => staModificando ? setEditandoId(null) : startEdit(debito)}
                    className="text-xs text-blue-500 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50">
                    {staModificando ? 'Annulla' : 'Modifica'}
                  </button>
                </div>
              </div>

              {staModificando ? (
                <div className="flex flex-col gap-3">
                  {campiEdit(editForm, setEditForm)}
                  <button onClick={() => handleSaveEdit(debito.id)} disabled={savingEdit} className="bg-blue-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-40">
                    {savingEdit ? 'Salvo...' : 'Salva modifiche'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{rateEseguite} rate su {rateTotali} pagate</span>
                      <span>{formatEur(debito.importo_pagato || 0)} su {formatEur(debito.importo_totale)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${estinto ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${percentuale}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-right">{percentuale.toFixed(0)}% pagato</p>
                  </div>

                  {!estinto && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Rata: <strong className="text-slate-800">{formatEur(debito.rata_mensile)}/mese</strong></span>
                      {debito.giorno_addebito && <span>Giorno: <strong className="text-slate-800">{debito.giorno_addebito}</strong></span>}
                      {debito.addebito_automatico && <span className="text-blue-600 font-medium">Domiciliato</span>}
                      {debito.data_fine
                        ? <span>Fine: <strong className="text-slate-800">{new Date(debito.data_fine + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong></span>
                        : <span>Fine stimata: <strong className="text-slate-800">{calcDataFine(debito)}</strong></span>
                      }
                    </div>
                  )}

                  {!estinto && (
                    <div className="border border-dashed border-slate-300 rounded-xl p-3 mb-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">Simulatore anticipo</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Se aggiungo €</span>
                        <input type="number" min="0" step="10" placeholder="0" value={simula[debito.id] || ''} onChange={e => setSimula(s => ({ ...s, [debito.id]: e.target.value }))} className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center" />
                        <span className="text-xs text-slate-500">extra/mese</span>
                      </div>
                      {extraSimula > 0 && (
                        <p className="text-xs text-green-700 mt-2 font-medium">
                          Finisci in {calcMesiRimanenti(debito, extraSimula)} mesi ({calcDataFine(debito, extraSimula)})
                          <span className="text-slate-500 font-normal"> invece di {calcMesiRimanenti(debito)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!estinto && (
                      <button onClick={() => handlePagaRata(debito)} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold">
                        Segna rata pagata ({formatEur(debito.rata_mensile)})
                      </button>
                    )}
                    <button onClick={() => handleDelete(debito.id)} className="px-3 py-2 text-red-400 text-sm hover:text-red-600 border border-red-100 rounded-xl">Elimina</button>
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
