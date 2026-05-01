import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function getMeseLabel(anno, mese) {
  return new Date(anno, mese - 1, 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
}

function getInfoTrimestre() {
  const now = new Date()
  const m = now.getMonth()
  const anno = now.getFullYear()
  const q = Math.floor(m / 3) + 1
  const startMese = (q - 1) * 3 + 1
  const endMese = q * 3
  const labels = ['gen-mar', 'apr-giu', 'lug-set', 'ott-dic']
  const deadlines = ['20 aprile', '20 luglio', '20 ottobre', '20 gennaio']
  const deadlineAnno = q === 4 ? anno + 1 : anno
  return {
    q, anno,
    label: `T${q} ${anno} · ${labels[q - 1]}`,
    deadline: `${deadlines[q - 1]} ${deadlineAnno}`,
    startAnno: `${anno}-01-01`,
    start: `${anno}-${String(startMese).padStart(2, '0')}-01`,
    end: new Date(anno, endMese, 0).toISOString().slice(0, 10),
  }
}

function getSettimanaCorrente() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => d.toISOString().slice(0, 10)
  const labelDay = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  return {
    start: fmt(monday),
    end: fmt(sunday),
    label: `${labelDay(monday)} – ${labelDay(sunday)}`,
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const now = new Date()
  const [anno, setAnno] = useState(now.getFullYear())
  const [mese, setMese] = useState(now.getMonth() + 1)
  const [entrate, setEntrate] = useState([])
  const [spese, setSpese] = useState([])
  const [attivita, setAttivita] = useState([])
  const [fattureEmesse, setFattureEmesse] = useState([])
  const [fattureRicevute, setFattureRicevute] = useState([])
  const [speseFisse, setSpeseFisse] = useState([])
  const [loading, setLoading] = useState(true)
  const [datiQ, setDatiQ] = useState(null)
  const [entrateSettimana, setEntrateSettimana] = useState([])
  const [resetting, setResetting] = useState(false)

  const meseStr = `${anno}-${String(mese).padStart(2, '0')}`
  const ultimoGiorno = new Date(anno, mese, 0).getDate()
  const dataFine = `${meseStr}-${ultimoGiorno}`
  const infoQ = getInfoTrimestre()
  const infoW = getSettimanaCorrente()

  useEffect(() => { loadDati() }, [anno, mese, location.key])
  useEffect(() => { loadTrimestre(); loadSettimana() }, [location.key])

  async function loadDati() {
    setLoading(true)
    try {
      const [eRes, sRes, aRes, feRes, frRes, sfRes] = await Promise.all([
        supabase.from('entrate').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('spese').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('attivita').select('*'),
        supabase.from('fatture_emesse').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('fatture_ricevute').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('spese_fisse').select('*'),
      ])
      setEntrate(eRes.data || [])
      setSpese(sRes.data || [])
      setAttivita(aRes.data || [])
      setFattureEmesse(feRes.data || [])
      setFattureRicevute(frRes.data || [])
      setSpeseFisse(sfRes.data || [])
    } catch (err) {
      console.error('Errore dashboard:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTrimestre() {
    try {
      const { startAnno, start, end } = infoQ
      // Mod 130 cumulative (Jan 1 → fine trimestre), Mod 420 solo trimestre corrente
      const [feYTD, frYTD, enYTD, feQ, frQ, enQ, debRes] = await Promise.all([
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('entrate').select('importo_netto').gte('data', startAnno).lte('data', end).neq('dichiara', false),
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('entrate').select('importo_netto,igic_percentuale,cash_dichiarato,importo_card').gte('data', start).lte('data', end).neq('dichiara', false),
        supabase.from('debiti').select('rata_mensile,importo_totale,importo_pagato,igic_percentuale,deducibile').eq('deducibile', true),
      ])
      setDatiQ({
        feYTD: feYTD.data || [],
        frYTD: frYTD.data || [],
        enYTD: enYTD.data || [],
        feQ: feQ.data || [],
        frQ: frQ.data || [],
        enQ: enQ.data || [],
        debitiDeducibili: (debRes.data || []).filter(d => (d.importo_totale - (d.importo_pagato || 0)) > 0),
      })
    } catch (err) {
      console.error('Errore trimestre:', err.message)
    }
  }

  async function loadSettimana() {
    try {
      const { data } = await supabase.from('entrate').select('*').gte('data', infoW.start).lte('data', infoW.end)
      setEntrateSettimana(data || [])
    } catch (err) {
      console.error('Errore settimana:', err.message)
    }
  }

  async function handleReset() {
    if (!window.confirm('Eliminare TUTTI i dati? Questa azione non si può annullare.')) return
    setResetting(true)
    try {
      await Promise.all([
        supabase.from('entrate').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('spese').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('fatture_emesse').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('fatture_ricevute').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('debiti').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('categorie_spese').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ])
      await Promise.all([loadDati(), loadTrimestre(), loadSettimana()])
    } catch (err) {
      console.error('Errore reset:', err.message)
    } finally {
      setResetting(false)
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

  const totaleNetto = entrate.reduce((s, e) => s + (e.importo_netto || 0), 0)
  const totaleCommissioni = entrate.reduce((s, e) => s + (e.importo_commissione || 0), 0)
  const totaleSpese = spese.reduce((s, e) => s + (e.importo || 0), 0)
  const totaleFattureEmesse = fattureEmesse.reduce((s, f) => s + (f.totale || 0), 0)
  const totaleFattureRicevute = fattureRicevute.reduce((s, f) => s + (f.totale || 0), 0)
  const totaleEntrate = totaleNetto + totaleFattureEmesse
  const totaleUscite = totaleSpese + totaleFattureRicevute
  const saldo = totaleEntrate - totaleUscite

  const perAttivita = attivita.map(a => {
    const righe = entrate.filter(e => e.attivita_id === a.id)
    return {
      ...a,
      netto: righe.reduce((s, e) => s + (e.importo_netto || 0), 0),
      commissioni: righe.reduce((s, e) => s + (e.importo_commissione || 0), 0),
      count: righe.length,
    }
  }).filter(a => a.count > 0)

  const commissioniSettimana = attivita.map(a => {
    const righe = entrateSettimana.filter(e => e.attivita_id === a.id)
    const lordo = righe.reduce((s, e) => s + (e.importo_lordo || 0), 0)
    const commissione = righe.reduce((s, e) => s + (e.importo_commissione || 0), 0)
    const netto = righe.reduce((s, e) => s + (e.importo_netto || 0), 0)
    return { ...a, lordo, commissione, netto, count: righe.length }
  }).filter(a => a.commissione > 0)

  const totCommissioneSettimana = commissioniSettimana.reduce((s, a) => s + a.commissione, 0)

  // Estrae imponibile (senza IGIC) da una fattura usando la % reale salvata
  function imponibileFattura(f) {
    const perc = f.igic_percentuale ?? 7
    return perc > 0 ? f.totale * 100 / (100 + perc) : f.totale
  }

  // Mod 130 — CUMULATIVO da Jan 1 a fine trimestre corrente
  const ricaviYTD = datiQ
    ? datiQ.feYTD.reduce((s, f) => s + imponibileFattura(f), 0)
      + datiQ.enYTD.reduce((s, e) => s + (e.importo_netto || 0), 0)
    : 0
  const costiYTD = datiQ
    ? datiQ.frYTD.reduce((s, f) => s + imponibileFattura(f), 0)
    : 0
  // Mod 420 — solo trimestre corrente (IGIC incassata - IGIC pagata da fatture)
  const igicRepercutido = datiQ
    ? datiQ.feQ.reduce((s, f) => {
        const perc = f.igic_percentuale ?? 7
        return s + (perc > 0 ? f.totale * perc / (100 + perc) : 0)
      }, 0)
      + datiQ.enQ.reduce((s, e) => {
        const lordoDich = (e.cash_dichiarato || 0) + (e.importo_card || 0)
        return s + (lordoDich - (e.importo_netto || 0))
      }, 0)
    : 0
  const igicSoportado = datiQ
    ? datiQ.frQ.reduce((s, f) => {
        const perc = f.igic_percentuale ?? 7
        return s + (perc > 0 ? f.totale * perc / (100 + perc) : 0)
      }, 0)
    : 0

  // Spese fisse mensili dal database
  const speseFisseVoci = speseFisse
  const totaleFisso = speseFisseVoci.reduce((s, v) => s + v.importo, 0)

  // Spese fisse deducibili → entrano nei calcoli tasse automaticamente
  const mesiYTD = infoQ.q * 3  // 3, 6, 9 o 12 in base al trimestre corrente
  const deducibili = speseFisseVoci.filter(v => v.deducibile)

  function imponibileFissa(v) {
    const perc = parseFloat(v.igic_percentuale) || 0
    return perc > 0 ? v.importo * 100 / (100 + perc) : v.importo
  }
  function igicFissa(v) {
    const perc = parseFloat(v.igic_percentuale) || 0
    return perc > 0 ? v.importo * perc / (100 + perc) : 0
  }

  const costiDedFisseYTD = deducibili.reduce((s, v) => s + imponibileFissa(v), 0) * mesiYTD
  const igicFisseQ = deducibili.reduce((s, v) => s + igicFissa(v), 0) * 3

  // Debiti deducibili attivi (es. renting)
  const debitiDed = datiQ?.debitiDeducibili || []
  const costiDedDebitiYTD = debitiDed.reduce((s, d) => {
    const perc = d.igic_percentuale || 0
    const imp = perc > 0 ? d.rata_mensile * 100 / (100 + perc) : d.rata_mensile
    return s + imp
  }, 0) * mesiYTD
  const igicDebitiQ = debitiDed.reduce((s, d) => {
    const perc = d.igic_percentuale || 0
    return s + (perc > 0 ? d.rata_mensile * perc / (100 + perc) : 0)
  }, 0) * 3

  const profittoYTD = ricaviYTD - costiYTD - costiDedFisseYTD - costiDedDebitiYTD
  const igicSoportadoTotale = igicSoportado + igicFisseQ + igicDebitiQ
  const irpfQ = Math.max(0, profittoYTD * 0.20)
  const igicQ = Math.max(0, igicRepercutido - igicSoportadoTotale)

  const saldoColore = saldo > 0 ? 'text-green-700' : saldo < 0 ? 'text-red-700' : 'text-slate-700'
  const saldoBg = saldo > 0 ? 'bg-green-50 border-green-100' : saldo < 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'

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
          <div className={`rounded-2xl border p-4 mb-4 ${saldoBg}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">Saldo disponibile</p>
            <p className={`text-3xl font-bold ${saldoColore}`}>{formatEur(saldo)}</p>
            <p className="text-xs text-slate-400 mt-1">entrate {formatEur(totaleEntrate)} · uscite {formatEur(totaleUscite)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Incassi</p>
              <p className="text-base font-bold text-green-800">{formatEur(totaleNetto)}</p>
              {totaleFattureEmesse > 0 && <p className="text-xs text-green-600">+ fatt. {formatEur(totaleFattureEmesse)}</p>}
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <p className="text-xs text-red-700 font-medium mb-1">Uscite</p>
              <p className="text-base font-bold text-red-800">{formatEur(totaleSpese)}</p>
              {totaleFattureRicevute > 0 && <p className="text-xs text-red-600">+ fatt. {formatEur(totaleFattureRicevute)}</p>}
            </div>
          </div>


          {totaleCommissioni > 0 && (
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 mb-3">
              <p className="text-xs text-orange-700 font-medium">Commissioni mese da pagare</p>
              <p className="text-base font-bold text-orange-800">{formatEur(totaleCommissioni)}</p>
            </div>
          )}

          <div
            onClick={() => navigate('/fisse')}
            className="bg-orange-50 rounded-xl p-3 border border-orange-100 mb-3 flex justify-between items-center cursor-pointer active:opacity-70"
          >
            <div>
              <p className="text-xs text-orange-700 font-medium">Spese fisse mensili</p>
              <p className="text-xs text-orange-500">{totaleFisso > 0 ? 'affitto, abbonamenti, SS...' : 'Tocca per configurare'}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-orange-800">{totaleFisso > 0 ? formatEur(totaleFisso) : '+'}</p>
            </div>
          </div>

          {datiQ && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Tasse trimestre</h3>
                <span className="text-xs text-slate-400">{infoQ.label}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">IRPF mod. 130</p>
                    <p className="text-xs text-slate-400">20% su utile YTD {formatEur(profittoYTD)} (cumulativo)</p>
                    {costiDedFisseYTD > 0 && (
                      <p className="text-xs text-green-600">spese fisse -{formatEur(costiDedFisseYTD)} incluse</p>
                    )}
                    {costiDedDebitiYTD > 0 && (
                      <p className="text-xs text-green-600">rate deducibili -{formatEur(costiDedDebitiYTD)} incluse</p>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">{formatEur(irpfQ)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">IGIC mod. 420</p>
                    <p className="text-xs text-slate-400">incassata {formatEur(igicRepercutido)} · pagata {formatEur(igicSoportadoTotale)}</p>
                    {igicFisseQ > 0 && (
                      <p className="text-xs text-green-600">di cui {formatEur(igicFisseQ)} da spese fisse</p>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">{formatEur(igicQ)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
                  <span className="text-sm font-bold text-slate-700">Totale stimato</span>
                  <span className="font-bold text-purple-700">{formatEur(irpfQ + igicQ)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Scadenza: {infoQ.deadline}</p>
            </div>
          )}

          {perAttivita.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Entrate per attività</h3>
              <div className="flex flex-col gap-2">
                {perAttivita.map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.colore }} />
                      <span className="text-sm text-slate-700">{a.nome}</span>
                      <span className="text-xs text-slate-400">{a.count} {a.count === 1 ? 'entrata' : 'entrate'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-700">{formatEur(a.netto)}</span>
                      {a.commissioni > 0 && <span className="text-xs text-orange-500 ml-2">comm. {formatEur(a.commissioni)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => navigate('/entrate')} className="bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm">+ Entrata</button>
            <button onClick={() => navigate('/spese')} className="bg-slate-700 text-white rounded-xl py-3 font-semibold text-sm">+ Spesa</button>
          </div>

          {entrate.length === 0 && spese.length === 0 && (
            <p className="text-center text-slate-400 text-sm mt-4 mb-6">Nessun dato per questo mese</p>
          )}

          <div className="border-t border-slate-200 pt-4 mt-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40"
            >
              {resetting ? 'Eliminazione in corso...' : 'Azzera tutti i dati (per test)'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
