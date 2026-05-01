import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function getMeseLabel(anno, mese) {
  return new Date(anno, mese - 1, 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
}

export default function Budget() {
  const now = new Date()
  const [anno, setAnno] = useState(now.getFullYear())
  const [mese, setMese] = useState(now.getMonth() + 1)
  const [dati, setDati] = useState({ entrate: [], spese: [], fattureEmesse: [], fattureRicevute: [], debiti: [] })
  const [loading, setLoading] = useState(true)

  const meseStr = `${anno}-${String(mese).padStart(2, '0')}`
  const ultimoGiorno = new Date(anno, mese, 0).getDate()
  const dataFine = `${meseStr}-${ultimoGiorno}`

  useEffect(() => { loadDati() }, [anno, mese])

  async function loadDati() {
    setLoading(true)
    try {
      const [eRes, sRes, feRes, frRes, dRes] = await Promise.all([
        supabase.from('entrate').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('spese').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('fatture_emesse').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('fatture_ricevute').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('debiti').select('*'),
      ])
      setDati({
        entrate: eRes.data || [],
        spese: sRes.data || [],
        fattureEmesse: feRes.data || [],
        fattureRicevute: frRes.data || [],
        debiti: dRes.data || [],
      })
    } catch (err) {
      console.error('Errore budget:', err.message)
    } finally {
      setLoading(false)
    }
  }

  function mesePrecedente() {
    if (mese === 1) { setMese(12); setAnno(a => a - 1) }
    else setMese(m => m - 1)
  }
  function meseSuccessivo() {
    if (mese === 12) { setMese(1); setAnno(a => a + 1) }
    else setMese(m => m + 1)
  }

  const totaleEntrate = dati.entrate.reduce((s, e) => s + (e.importo_netto || 0), 0)
  const totaleFattureEmesse = dati.fattureEmesse.reduce((s, f) => s + (f.totale || 0), 0)
  const totaleSpese = dati.spese.reduce((s, e) => s + (e.importo || 0), 0)
  const totaleFattureRicevute = dati.fattureRicevute.reduce((s, f) => s + (f.totale || 0), 0)
  const totaleRate = dati.debiti.reduce((s, d) => {
    const residuo = d.importo_totale - (d.importo_pagato || 0)
    return residuo > 0 ? s + d.rata_mensile : s
  }, 0)

  const totaleEntrano = totaleEntrate + totaleFattureEmesse
  const totaleEscono = totaleSpese + totaleFattureRicevute + totaleRate
  const saldo = totaleEntrano - totaleEscono

  const saldoColore = saldo > 0 ? 'text-green-700' : saldo < 0 ? 'text-red-700' : 'text-slate-700'
  const saldoBg = saldo > 0 ? 'bg-green-50 border-green-200' : saldo < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-5">
        <button onClick={mesePrecedente} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg">‹</button>
        <h2 className="font-semibold text-slate-800 capitalize">{getMeseLabel(anno, mese)}</h2>
        <button onClick={meseSuccessivo} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg">›</button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-10">Caricamento...</p>
      ) : (
        <>
          <div className={`rounded-2xl border p-4 mb-5 ${saldoBg}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">Saldo del mese</p>
            <p className={`text-3xl font-bold ${saldoColore}`}>{formatEur(saldo)}</p>
            <p className="text-xs text-slate-400 mt-1">entrano {formatEur(totaleEntrano)} · escono {formatEur(totaleEscono)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Entrate</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">Incassi attività</span>
                <span className="font-semibold text-green-700">{formatEur(totaleEntrate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">Fatture emesse</span>
                <span className="font-semibold text-green-700">{formatEur(totaleFattureEmesse)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
                <span className="text-sm font-semibold text-slate-700">Totale entrate</span>
                <span className="font-bold text-green-800">{formatEur(totaleEntrano)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Uscite</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">Spese</span>
                <span className="font-semibold text-red-600">{formatEur(totaleSpese)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">Fatture ricevute</span>
                <span className="font-semibold text-red-600">{formatEur(totaleFattureRicevute)}</span>
              </div>
              {totaleRate > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">Rate debiti</span>
                  <span className="font-semibold text-red-600">{formatEur(totaleRate)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
                <span className="text-sm font-semibold text-slate-700">Totale uscite</span>
                <span className="font-bold text-red-800">{formatEur(totaleEscono)}</span>
              </div>
            </div>
          </div>

          {totaleEntrano === 0 && totaleEscono === 0 && (
            <p className="text-center text-slate-400 text-sm mt-6">Nessun dato per questo mese</p>
          )}
        </>
      )}
    </div>
  )
}
