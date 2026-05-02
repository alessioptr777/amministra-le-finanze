import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function getInfoTrimestre(anno, q) {
  const startMese = (q - 1) * 3 + 1
  const endMese = q * 3
  const labels = ['gen–mar', 'apr–giu', 'lug–set', 'ott–dic']
  const deadlines = ['20 aprile', '20 luglio', '20 ottobre', '20 gennaio']
  const deadlineAnno = q === 4 ? anno + 1 : anno
  return {
    label: `T${q} ${anno} · ${labels[q - 1]}`,
    deadline: `${deadlines[q - 1]} ${deadlineAnno}`,
    startAnno: `${anno}-01-01`,
    start: `${anno}-${String(startMese).padStart(2, '0')}-01`,
    end: new Date(anno, endMese, 0).toISOString().slice(0, 10),
  }
}

function getCurrentQ() {
  const now = new Date()
  return { anno: now.getFullYear(), q: Math.floor(now.getMonth() / 3) + 1 }
}

export default function Budget() {
  const { anno: annoCorrente, q: qCorrente } = getCurrentQ()
  const [stima, setStima] = useState(null)
  const [storico, setStorico] = useState([])
  const [loadingStima, setLoadingStima] = useState(true)
  const [formReale, setFormReale] = useState({ irpf: '', igic: '', note: '' })
  const [salvatoCorrente, setSalvatoCorrente] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(false)

  useEffect(() => { loadStima(); loadStorico() }, [])

  async function loadStima() {
    setLoadingStima(true)
    try {
      const { startAnno, start, end } = getInfoTrimestre(annoCorrente, qCorrente)
      const [feYTD, frYTD, enYTD, feQ, frQ, enQ, sfRes, debRes, spDedYTD, spDedQ] = await Promise.all([
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('entrate').select('importo_netto').gte('data', startAnno).lte('data', end).neq('dichiara', false),
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('entrate').select('importo_netto,igic_percentuale,cash_dichiarato,importo_card').gte('data', start).lte('data', end).neq('dichiara', false),
        supabase.from('spese_fisse').select('importo,igic_percentuale,deducibile'),
        supabase.from('debiti').select('rata_mensile,igic_percentuale,deducibile,importo_totale,importo_pagato'),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', startAnno).lte('data', end),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', start).lte('data', end),
      ])

      function imp(f) {
        const p = f.igic_percentuale ?? 7
        return p > 0 ? f.totale * 100 / (100 + p) : f.totale
      }
      function impSpesa(s) {
        const p = parseFloat(s.igic_percentuale) || 0
        return p > 0 ? s.importo * 100 / (100 + p) : s.importo
      }

      const ricaviYTD = (feYTD.data || []).reduce((s, f) => s + imp(f), 0)
        + (enYTD.data || []).reduce((s, e) => s + (e.importo_netto || 0), 0)

      const mesiYTD = qCorrente * 3
      const sfDed = (sfRes.data || []).filter(v => v.deducibile)
      const costiDedFisseYTD = sfDed.reduce((s, v) => {
        const p = parseFloat(v.igic_percentuale) || 0
        return s + (p > 0 ? v.importo * 100 / (100 + p) : v.importo)
      }, 0) * mesiYTD

      const debDed = (debRes.data || []).filter(d => d.deducibile && (d.importo_totale - (d.importo_pagato || 0)) > 0)
      const costiDedDebitiYTD = debDed.reduce((s, d) => {
        const p = d.igic_percentuale || 0
        return s + (p > 0 ? d.rata_mensile * 100 / (100 + p) : d.rata_mensile)
      }, 0) * mesiYTD

      const costiDedSpeseYTD = (spDedYTD.data || []).reduce((s, sp) => s + impSpesa(sp), 0)

      const costiYTD = (frYTD.data || []).reduce((s, f) => s + imp(f), 0)
        + costiDedFisseYTD + costiDedDebitiYTD + costiDedSpeseYTD

      const profitto = ricaviYTD - costiYTD
      const irpfStima = Math.max(0, profitto * 0.20)

      const igicEntrante = (feQ.data || []).reduce((s, f) => {
        const p = f.igic_percentuale ?? 7
        return s + (p > 0 ? f.totale * p / (100 + p) : 0)
      }, 0) + (enQ.data || []).reduce((s, e) => {
        const lordoDich = (e.cash_dichiarato || 0) + (e.importo_card || 0)
        return s + (lordoDich - (e.importo_netto || 0))
      }, 0)

      const igicUscente = (frQ.data || []).reduce((s, f) => {
        const p = f.igic_percentuale ?? 7
        return s + (p > 0 ? f.totale * p / (100 + p) : 0)
      }, 0)
        + sfDed.reduce((s, v) => {
          const p = parseFloat(v.igic_percentuale) || 0
          return s + (p > 0 ? v.importo * p / (100 + p) : 0)
        }, 0) * 3
        + debDed.reduce((s, d) => {
          const p = d.igic_percentuale || 0
          return s + (p > 0 ? d.rata_mensile * p / (100 + p) : 0)
        }, 0) * 3
        + (spDedQ.data || []).reduce((s, sp) => {
          const p = parseFloat(sp.igic_percentuale) || 0
          return s + (p > 0 ? sp.importo * p / (100 + p) : 0)
        }, 0)

      const igicStima = Math.max(0, igicEntrante - igicUscente)

      setStima({ irpf: irpfStima, igic: igicStima, profitto, ricavi: ricaviYTD, costi: costiYTD })

      // Carica il reale già salvato per questo trimestre
      const { data: saved } = await supabase
        .from('tasse_trimestrali')
        .select('*')
        .eq('anno', annoCorrente)
        .eq('trimestre', qCorrente)
        .single()
      if (saved) setSalvatoCorrente(saved)
    } catch (err) {
      console.error('Errore stima:', err.message)
    } finally {
      setLoadingStima(false)
    }
  }

  async function loadStorico() {
    try {
      const { data } = await supabase
        .from('tasse_trimestrali')
        .select('*')
        .order('anno', { ascending: false })
        .order('trimestre', { ascending: false })
      setStorico(data || [])
    } catch (err) {
      console.error('Errore storico:', err.message)
    }
  }

  async function handleSalvaReale() {
    const irpf = parseFloat(formReale.irpf) || 0
    const igic = parseFloat(formReale.igic) || 0
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tasse_trimestrali')
        .upsert({
          anno: annoCorrente,
          trimestre: qCorrente,
          irpf_reale: irpf,
          igic_reale: igic,
          note: formReale.note,
        }, { onConflict: 'anno,trimestre' })
      if (error) throw error
      await loadStima()
      await loadStorico()
      setEditando(false)
      setFormReale({ irpf: '', igic: '', note: '' })
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(record) {
    setFormReale({
      irpf: String(record.irpf_reale ?? ''),
      igic: String(record.igic_reale ?? ''),
      note: record.note || '',
    })
    setEditando(true)
  }

  const infoQ = getInfoTrimestre(annoCorrente, qCorrente)
  const totaleStima = stima ? stima.irpf + stima.igic : 0
  const totaleReale = salvatoCorrente ? (salvatoCorrente.irpf_reale || 0) + (salvatoCorrente.igic_reale || 0) : null
  const differenza = totaleReale !== null ? totaleReale - totaleStima : null

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Tasse</h1>
      <p className="text-xs text-slate-400 mb-5">Stima vs reale del commercialista</p>

      {loadingStima ? (
        <p className="text-center text-slate-400 py-10">Caricamento...</p>
      ) : (
        <>
          {/* Trimestre corrente */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">{infoQ.label}</h2>
              <span className="text-xs text-slate-400">scadenza {infoQ.deadline}</span>
            </div>

            {/* Stima app */}
            <div className="bg-slate-50 rounded-xl p-3 mb-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Stima app</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Ricavi YTD</span>
                  <span>{formatEur(stima?.ricavi)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Costi deducibili YTD</span>
                  <span>-{formatEur(stima?.costi)}</span>
                </div>
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                  <span>Utile imponibile</span>
                  <span className="font-medium">{formatEur(stima?.profitto)}</span>
                </div>
                <div className="flex justify-between text-slate-700 mt-1">
                  <span>IRPF mod. 130 (20%)</span>
                  <span className="font-semibold">{formatEur(stima?.irpf)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>IGIC mod. 420</span>
                  <span className="font-semibold">{formatEur(stima?.igic)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1.5 mt-0.5">
                  <span>Totale stimato</span>
                  <span className="text-purple-700">{formatEur(totaleStima)}</span>
                </div>
              </div>
            </div>

            {/* Reale commercialista */}
            {salvatoCorrente && !editando ? (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-blue-700">Reale commercialista</p>
                  <button onClick={() => startEdit(salvatoCorrente)} className="text-xs text-blue-500">Modifica</button>
                </div>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between text-slate-700">
                    <span>IRPF mod. 130</span>
                    <span className="font-semibold">{formatEur(salvatoCorrente.irpf_reale)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>IGIC mod. 420</span>
                    <span className="font-semibold">{formatEur(salvatoCorrente.igic_reale)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-blue-200 pt-1.5 mt-0.5">
                    <span>Totale reale</span>
                    <span className="text-blue-700">{formatEur(totaleReale)}</span>
                  </div>
                  {differenza !== null && (
                    <div className={`flex justify-between text-xs mt-1 ${differenza > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      <span>{differenza > 0 ? 'Sottostimato di' : 'Sovrastimato di'}</span>
                      <span className="font-medium">{formatEur(Math.abs(differenza))}</span>
                    </div>
                  )}
                  {salvatoCorrente.note && <p className="text-xs text-slate-400 mt-1">{salvatoCorrente.note}</p>}
                </div>
              </div>
            ) : (
              <div className={`${editando ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-dashed border-slate-300'} rounded-xl p-3`}>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  {editando ? 'Modifica reale commercialista' : 'Inserisci il reale del commercialista'}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">IRPF mod. 130 €</label>
                      <input type="number" min="0" step="0.01" placeholder="0,00"
                        value={formReale.irpf} onChange={e => setFormReale(f => ({ ...f, irpf: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">IGIC mod. 420 €</label>
                      <input type="number" min="0" step="0.01" placeholder="0,00"
                        value={formReale.igic} onChange={e => setFormReale(f => ({ ...f, igic: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <input type="text" placeholder="Note (es. sanzione, interessi...)"
                    value={formReale.note} onChange={e => setFormReale(f => ({ ...f, note: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    {editando && (
                      <button onClick={() => { setEditando(false); setFormReale({ irpf: '', igic: '', note: '' }) }}
                        className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm">
                        Annulla
                      </button>
                    )}
                    <button onClick={handleSalvaReale} disabled={saving}
                      className="flex-1 bg-blue-600 text-white rounded-xl py-2 font-semibold text-sm disabled:opacity-40">
                      {saving ? 'Salvo...' : 'Salva'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Storico */}
          {storico.filter(r => !(r.anno === annoCorrente && r.trimestre === qCorrente)).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Storico</p>
              <div className="flex flex-col gap-2">
                {storico
                  .filter(r => !(r.anno === annoCorrente && r.trimestre === qCorrente))
                  .map(r => {
                    const tot = (r.irpf_reale || 0) + (r.igic_reale || 0)
                    return (
                      <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-700">T{r.trimestre} {r.anno}</span>
                          <span className="font-bold text-slate-800">{formatEur(tot)}</span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                          <span>IRPF {formatEur(r.irpf_reale)}</span>
                          <span>IGIC {formatEur(r.igic_reale)}</span>
                        </div>
                        {r.note && <p className="text-xs text-slate-400 mt-1">{r.note}</p>}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
