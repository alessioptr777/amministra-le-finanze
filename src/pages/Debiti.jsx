import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { groupRateByMonth } from '../lib/pianoAgenzia'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function generaRateFisse(dataPrimaRata, giorno, nRate, importoRata) {
  const rate = []
  let [anno, mese] = dataPrimaRata.split('-').map(Number)
  for (let i = 1; i <= nRate; i++) {
    const maxG = new Date(anno, mese, 0).getDate()
    const g = Math.min(giorno, maxG)
    const d = `${anno}-${String(mese).padStart(2, '0')}-${String(g).padStart(2, '0')}`
    rate.push({ numero_rata: i, data_scadenza: d, importo: parseFloat(importoRata.toFixed(2)), pagato: false })
    mese++
    if (mese > 12) { mese = 1; anno++ }
  }
  return rate
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
  ha_piano: false,
  tipo_piano: 'fisse',
  piano_rate_var: [],
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
  const [rate, setRate] = useState({})
  const [expandedDebito, setExpandedDebito] = useState(null)
  const [loadingRate, setLoadingRate] = useState({})
  const [expandedMesi, setExpandedMesi] = useState({})

  useEffect(() => { loadDebiti() }, [])

  async function loadDebiti() {
    try {
      const { data, error } = await supabase.from('debiti').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setDebiti(data)
      data.forEach(d => loadRate(d.id))
    } catch (err) {
      console.error('Errore debiti:', err.message)
    }
  }

  async function loadRate(debitoId) {
    setLoadingRate(prev => ({ ...prev, [debitoId]: true }))
    try {
      const { data, error } = await supabase.from('rate_debito').select('*').eq('debito_id', debitoId).order('numero_rata')
      if (error) throw error
      setRate(prev => ({ ...prev, [debitoId]: data || [] }))
    } catch (err) {
      console.error('Errore caricamento rate:', err.message)
    } finally {
      setLoadingRate(prev => ({ ...prev, [debitoId]: false }))
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome || !form.importo_totale || !form.rata_mensile) return
    setSaving(true)
    try {
      const { data: newDebito, error } = await supabase.from('debiti').insert({
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
      }).select('id').single()
      if (error) throw error

      if (form.ha_piano && newDebito) {
        let rateDaInserire = []
        if (form.tipo_piano === 'fisse') {
          const nRate = Math.round(parseFloat(form.importo_totale) / parseFloat(form.rata_mensile))
          const giorno = form.giorno_addebito ? parseInt(form.giorno_addebito) : 1
          rateDaInserire = generaRateFisse(form.data_prima_rata, giorno, nRate, parseFloat(form.rata_mensile))
        } else {
          rateDaInserire = form.piano_rate_var
            .filter(r => r.data_scadenza && r.importo)
            .map((r, i) => ({ numero_rata: i + 1, data_scadenza: r.data_scadenza, importo: parseFloat(r.importo), pagato: false }))
        }
        if (rateDaInserire.length > 0) {
          const { error: rateErr } = await supabase.from('rate_debito').insert(
            rateDaInserire.map(r => ({ ...r, debito_id: newDebito.id }))
          )
          if (rateErr) throw rateErr
        }
      }

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
      ha_piano: false,
      tipo_piano: 'fisse',
      piano_rate_var: [],
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

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('debiti').delete().eq('id', id)
      if (error) throw error
      loadDebiti()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  async function toggleRataPagata(rataId, debitoId, pagato) {
    try {
      const { error } = await supabase.from('rate_debito').update({ pagato: !pagato }).eq('id', rataId)
      if (error) throw error
      const { data: allRate } = await supabase.from('rate_debito').select('importo, pagato').eq('debito_id', debitoId)
      const importoPagato = (allRate || []).filter(r => r.id === rataId ? !pagato : r.pagato).reduce((s, r) => s + r.importo, 0)
      await supabase.from('debiti').update({ importo_pagato: importoPagato }).eq('id', debitoId)
      loadRate(debitoId)
      loadDebiti()
    } catch (err) {
      console.error('Errore aggiornamento rata:', err.message)
    }
  }

  function calcRatePagate(debito) {
    if (!debito.data_prima_rata || !debito.giorno_addebito) return debito.importo_pagato || 0
    const oggi = new Date()
    let ratePagate = 0
    let dataRata = new Date(debito.data_prima_rata + 'T00:00:00')
    dataRata.setDate(debito.giorno_addebito)
    while (dataRata <= oggi) {
      ratePagate++
      dataRata.setMonth(dataRata.getMonth() + 1)
    }
    return Math.min(ratePagate * debito.rata_mensile, debito.importo_totale)
  }

  function calcMesiRimanenti(debito, extraMensile = 0) {
    const residuo = debito.importo_totale - calcRatePagate(debito)
    const rata = debito.rata_mensile + extraMensile
    if (rata <= 0 || residuo <= 0) return 0
    return Math.ceil(residuo / rata)
  }

  function calcDataFine(debito, extraMensile = 0) {
    const mesi = calcMesiRimanenti(debito, extraMensile)
    if (mesi === 0) return 'Estinto'
    const d = debito.data_prima_rata ? new Date(debito.data_prima_rata) : new Date()
    d.setMonth(d.getMonth() + mesi)
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  function calcImportoPagatoRate(list) {
    return list.filter(r => r.pagato).reduce((s, r) => s + r.importo, 0)
  }

  const totaleResiduo = debiti.reduce((s, d) => s + Math.max(0, d.importo_totale - (d.importo_pagato || 0)), 0)
  const totaleRateMensili = debiti.reduce((s, d) => {
    const residuo = d.importo_totale - (d.importo_pagato || 0)
    return residuo > 0 ? s + d.rata_mensile : s
  }, 0)

  const nRatePreview = form.importo_totale && form.rata_mensile
    ? Math.round(parseFloat(form.importo_totale) / parseFloat(form.rata_mensile))
    : 0

  const campiBase = (f, setF) => (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Nome debito</label>
        <input type="text" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Importo totale €</label>
          <input type="number" min="0" step="0.01" value={f.importo_totale} onChange={e => setF(p => ({ ...p, importo_totale: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Gia pagato €</label>
          <input type="number" min="0" step="0.01" value={f.importo_pagato} onChange={e => setF(p => ({ ...p, importo_pagato: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Rata mensile €</label>
          <input type="number" min="0" step="0.01" value={f.rata_mensile} onChange={e => setF(p => ({ ...p, rata_mensile: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Giorno addebito</label>
          <input type="number" min="1" max="31" value={f.giorno_addebito} onChange={e => setF(p => ({ ...p, giorno_addebito: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Data prima rata (gg/mm/aaaa)</label>
        <input type="date" value={f.data_prima_rata} onChange={e => setF(p => ({ ...p, data_prima_rata: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        {f.data_prima_rata && <p className="text-xs text-slate-400 mt-1">{formatDate(f.data_prima_rata)}</p>}
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Data fine (opzionale)</label>
        <input type="date" value={f.data_fine} onChange={e => setF(p => ({ ...p, data_fine: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        {f.data_fine && <p className="text-xs text-slate-400 mt-1">{formatDate(f.data_fine)}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="auto_chk" checked={f.addebito_automatico} onChange={e => setF(p => ({ ...p, addebito_automatico: e.target.checked }))} className="w-4 h-4 rounded" />
        <label htmlFor="auto_chk" className="text-sm text-slate-700">Addebito automatico (domiciliato)</label>
      </div>
      <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Deducibile per le tasse</p>
            <p className="text-xs text-slate-400">riduce il Mod 130 (IRPF)</p>
          </div>
          <button type="button" onClick={() => setF(p => ({ ...p, deducibile: !p.deducibile }))}
            className={`w-12 h-6 rounded-full transition-colors ${f.deducibile ? 'bg-green-500' : 'bg-slate-300'}`}>
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${f.deducibile ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        {f.deducibile && (
          <div className="flex gap-2">
            {[
              { val: '0', label: 'IVA (0% IGIC)', desc: 'es. Adobe, renting auto' },
              { val: '7', label: 'IGIC 7%', desc: 'es. iPhone renting' },
            ].map(opt => (
              <button key={opt.val} type="button" onClick={() => setF(p => ({ ...p, igic_percentuale: opt.val }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs border text-left ${f.igic_percentuale === opt.val ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}>
                <p className="font-medium">{opt.label}</p>
                <p className="opacity-60">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
        <input type="text" value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
    </div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Debiti</h1>
        <button onClick={() => { setShowForm(s => !s); setForm(EMPTY_FORM) }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
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
            <p className="text-lg font-bold text-orange-800">{formatEur(totaleRateMensili)}</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          {campiBase(form, setForm)}

          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Piano di pagamento</p>
                <p className="text-xs text-slate-400">traccia ogni singola rata</p>
              </div>
              <button type="button" onClick={() => setForm(p => ({ ...p, ha_piano: !p.ha_piano }))}
                className={`w-12 h-6 rounded-full transition-colors ${form.ha_piano ? 'bg-blue-500' : 'bg-slate-300'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.ha_piano ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {form.ha_piano && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex gap-2">
                  {[
                    { val: 'fisse', label: 'Rate fisse', desc: 'stessa cifra ogni mese' },
                    { val: 'variabili', label: 'Rate variabili', desc: 'importi diversi (es. con interessi)' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setForm(p => ({ ...p, tipo_piano: opt.val }))}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs border text-left ${form.tipo_piano === opt.val ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-slate-300 text-slate-600'}`}>
                      <p className="font-medium">{opt.label}</p>
                      <p className="opacity-60">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {form.tipo_piano === 'fisse' && (
                  <div className="bg-white rounded-lg p-2.5 border border-blue-200 text-xs">
                    {nRatePreview > 0 && form.data_prima_rata ? (
                      <p className="text-blue-700">
                        Genera <strong>{nRatePreview} rate</strong> da <strong>{formatDate(form.data_prima_rata)}</strong> · {formatEur(parseFloat(form.rata_mensile || 0))}/mese
                      </p>
                    ) : (
                      <p className="text-slate-400">Inserisci importo totale, rata e data prima rata</p>
                    )}
                  </div>
                )}

                {form.tipo_piano === 'variabili' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500">Inserisci ogni rata con data e importo:</p>
                    {form.piano_rate_var.map((r, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="date" value={r.data_scadenza}
                          onChange={e => setForm(p => ({ ...p, piano_rate_var: p.piano_rate_var.map((x, i) => i === idx ? { ...x, data_scadenza: e.target.value } : x) }))}
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                        <input type="number" min="0" step="0.01" placeholder="EUR"
                          value={r.importo}
                          onChange={e => setForm(p => ({ ...p, piano_rate_var: p.piano_rate_var.map((x, i) => i === idx ? { ...x, importo: e.target.value } : x) }))}
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                        <button type="button"
                          onClick={() => setForm(p => ({ ...p, piano_rate_var: p.piano_rate_var.filter((_, i) => i !== idx) }))}
                          className="text-red-400 text-sm px-1 hover:text-red-600">x</button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, piano_rate_var: [...p.piano_rate_var, { data_scadenza: '', importo: '' }] }))}
                      className="text-xs text-blue-600 font-medium py-1.5 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50">
                      + Aggiungi rata
                    </button>
                    {form.piano_rate_var.length > 0 && (
                      <p className="text-xs text-slate-400">{form.piano_rate_var.filter(r => r.data_scadenza && r.importo).length} rate inserite</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="submit" disabled={saving || !form.nome || !form.importo_totale || !form.rata_mensile}
            className="bg-red-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Aggiungi debito'}
          </button>
        </form>
      )}

      {debiti.length === 0 && !showForm && <p className="text-center text-slate-400 py-10 text-sm">Nessun debito registrato</p>}

      <div className="flex flex-col gap-4">
        {debiti.map(debito => {
          const debitoRate = rate[debito.id] || []
          const importoPagato = debitoRate.length > 0 ? calcImportoPagatoRate(debitoRate) : calcRatePagate(debito)
          const residuo = Math.max(0, debito.importo_totale - importoPagato)
          const percentuale = debito.importo_totale > 0 ? Math.min(100, (importoPagato / debito.importo_totale) * 100) : 0
          const rateEseguite = debitoRate.length > 0 ? debitoRate.filter(r => r.pagato).length : Math.floor(importoPagato / (debito.rata_mensile || 1))
          const rateTotali = debitoRate.length > 0 ? debitoRate.length : Math.ceil(debito.importo_totale / (debito.rata_mensile || 1))
          const estinto = residuo <= 0
          const extraSimula = parseFloat(simula[debito.id] || 0)
          const staModificando = editandoId === debito.id
          const hasPiano = debitoRate.length > 0
          const isExpanded = expandedDebito === debito.id
          const isLoading = loadingRate[debito.id]
          const ratePerMese = hasPiano ? groupRateByMonth(debitoRate) : []
          const prossimata = debitoRate.find(r => !r.pagato)

          return (
            <div key={debito.id} className={`bg-white rounded-2xl border p-4 ${estinto ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{debito.nome}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {debito.deducibile && !staModificando && (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-100">
                        deducibile{debito.igic_percentuale > 0 ? ` · IGIC ${debito.igic_percentuale}%` : ' · IVA'}
                      </span>
                    )}
                    {!debito.deducibile && !staModificando && (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-100">Non deducibile</span>
                    )}
                  </div>
                  {debito.note && !staModificando && <p className="text-xs text-slate-500 mt-0.5">{debito.note}</p>}
                </div>
                <div className="flex items-center gap-2 ml-2">
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
                  {campiBase(editForm, setEditForm)}
                  <button onClick={() => handleSaveEdit(debito.id)} disabled={savingEdit}
                    className="bg-blue-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-40">
                    {savingEdit ? 'Salvo...' : 'Salva modifiche'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{rateEseguite} rate su {rateTotali} pagate</span>
                      <span>{formatEur(importoPagato)} su {formatEur(debito.importo_totale)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${estinto ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${percentuale}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-right">{percentuale.toFixed(0)}% pagato</p>
                  </div>

                  {!estinto && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      {hasPiano && prossimata ? (
                        <>
                          <span>Prossima: <strong className="text-slate-800">{formatDate(prossimata.data_scadenza)}</strong></span>
                          <span className="font-bold text-red-600">{formatEur(prossimata.importo)}</span>
                        </>
                      ) : (
                        <>
                          <span>Rata: <strong className="text-slate-800">{formatEur(debito.rata_mensile)}/mese</strong></span>
                          {debito.giorno_addebito && <span>Giorno: <strong className="text-slate-800">{debito.giorno_addebito}</strong></span>}
                        </>
                      )}
                      {debito.addebito_automatico && <span className="text-blue-600 font-medium">Domiciliato</span>}
                    </div>
                  )}

                  {hasPiano && (
                    <button onClick={() => setExpandedDebito(isExpanded ? null : debito.id)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 mb-3 flex items-center justify-between">
                      <span>{isExpanded ? '▼' : '►'} Piano pagamento ({rateTotali} rate)</span>
                      <span className="text-xs font-bold text-slate-500">{rateEseguite}/{rateTotali}</span>
                    </button>
                  )}

                  {hasPiano && isExpanded && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 flex flex-col gap-2 max-h-96 overflow-y-auto">
                      {isLoading ? (
                        <p className="text-xs text-slate-400 text-center py-4">Caricamento...</p>
                      ) : ratePerMese.map(mese => (
                        <div key={mese.displayKey}>
                          <button onClick={() => setExpandedMesi(prev => ({ ...prev, [debito.id + mese.displayKey]: !prev[debito.id + mese.displayKey] }))}
                            className="w-full text-left py-2 px-2 font-medium text-slate-700 text-sm hover:bg-slate-100 rounded flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span className="text-slate-400">{expandedMesi[debito.id + mese.displayKey] ? '▼' : '►'}</span>
                              {mese.displayKey}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatEur(mese.rate.reduce((s, r) => s + r.importo, 0))}
                              {mese.rate.every(r => r.pagato) ? ' ✓' : ''}
                            </span>
                          </button>
                          <div className={expandedMesi[debito.id + mese.displayKey] ? 'flex flex-col gap-1.5 pl-4 pt-1' : 'hidden'}>
                            {mese.rate.map(r => (
                              <div key={r.id} className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={r.pagato || false}
                                  onChange={() => toggleRataPagata(r.id, debito.id, r.pagato)}
                                  className="w-4 h-4 rounded" />
                                <span className="flex-1 text-slate-500">{formatDate(r.data_scadenza)}</span>
                                <span className={`font-bold ${r.pagato ? 'text-green-600 line-through' : 'text-red-600'}`}>
                                  {formatEur(r.importo)}
                                </span>
                                <span className="text-slate-400">#{r.numero_rata}/{rateTotali}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasPiano && !estinto && (
                    <div className="border border-dashed border-slate-300 rounded-xl p-3 mb-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">Simulatore anticipo</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Se aggiungo EUR</span>
                        <input type="number" min="0" step="10" placeholder="0" value={simula[debito.id] || ''}
                          onChange={e => setSimula(s => ({ ...s, [debito.id]: e.target.value }))}
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center" />
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
