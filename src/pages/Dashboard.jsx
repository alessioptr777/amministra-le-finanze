import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function fmtBig(n) {
  const v = Number(n || 0)
  return (v < 0 ? '-€' : '€') + Math.abs(v).toFixed(0)
}

function DonutRing({ value, max, size = 220, strokeWidth = 18, color = '#60a5fa' }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const dash = circ * pct
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function fmtDataBreve(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  const mesi = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
  return `${parseInt(d)} ${mesi[parseInt(m)-1]}`
}

function getMeseLabel(anno, mese) {
  return new Date(anno, mese - 1, 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
}

function getInfoTrimestre(anno, mese) {
  const q = Math.floor((mese - 1) / 3) + 1
  const startMese = (q - 1) * 3 + 1
  const endMese = q * 3
  const labels = ['gen-mar', 'apr-giu', 'lug-set', 'ott-dic']
  const deadlines = ['20 aprile', '20 luglio', '20 ottobre', '20 gennaio']
  const deadlineAnno = q === 4 ? anno + 1 : anno
  return {
    q, anno,
    label: `T${q} ${anno} · ${labels[q - 1]}`,
    deadline: `${deadlines[q - 1]} ${deadlineAnno}`,
    startAnno: '2026-04-01',
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
  const [debitiAttivi, setDebitiAttivi] = useState([])
  const [rateMese, setRateMese] = useState([])
  const [showDettaglioSaldo, setShowDettaglioSaldo] = useState(false)
  const [debitiMap, setDebitiMap] = useState({})
  const [saldoConto, setSaldoConto] = useState(null)
  const [saldoBanca, setSaldoBanca] = useState(null)
  const [saldoContanti, setSaldoContanti] = useState(null)
  const [versamentiMese, setVersamentiMese] = useState([])
  const [prossimaRata, setProssimaRata] = useState(null)
  const [entrateTS, setEntrateTS] = useState([])
  const [commissioneRecord, setCommissioneRecord] = useState(null)
  const [showAzzera, setShowAzzera] = useState(false)
  const [azzeraInput, setAzzeraInput] = useState('')
  const [savingAzzera, setSavingAzzera] = useState(false)
  const [accontoInput, setAccontoInput] = useState('')
  const [savingAcconto, setSavingAcconto] = useState(false)

  const meseStr = `${anno}-${String(mese).padStart(2, '0')}`
  const ultimoGiorno = new Date(anno, mese, 0).getDate()
  const dataFine = `${meseStr}-${ultimoGiorno}`
  const infoQ = getInfoTrimestre(anno, mese)
  const infoW = getSettimanaCorrente()

  useEffect(() => { loadDati() }, [anno, mese, location.key])
  useEffect(() => { loadTrimestre(); loadSettimana() }, [anno, mese, location.key])
  useEffect(() => { loadSaldoConto() }, [location.key])

  async function loadDati() {
    setLoading(true)
    try {
      const [eRes, sRes, aRes, feRes, frRes, sfRes, vRes] = await Promise.all([
        supabase.from('entrate').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('spese').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('attivita').select('*'),
        supabase.from('fatture_emesse').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('fatture_ricevute').select('*').gte('data', `${meseStr}-01`).lte('data', dataFine),
        supabase.from('spese_fisse').select('*'),
        supabase.from('versamenti').select('importo').gte('data', `${meseStr}-01`).lte('data', dataFine),
      ])
      setEntrate(eRes.data || [])
      setSpese(sRes.data || [])
      setAttivita(aRes.data || [])
      setFattureEmesse(feRes.data || [])
      setFattureRicevute(frRes.data || [])
      setSpeseFisse(sfRes.data || [])
      setVersamentiMese(vRes.data || [])
    } catch (err) {
      console.error('Errore dashboard:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSaldoConto() {
    const INIZIO = '2026-04-01'
    const oggi = new Date().toISOString().slice(0, 10)
    try {
      const [eRes, sRes, feRes, frRes, sfRes, debRes, rateRes, versRes] = await Promise.all([
        supabase.from('entrate').select('importo_cash,cash_dichiarato,importo_card,importo_lordo').gte('data', INIZIO).lte('data', oggi),
        supabase.from('spese').select('importo,metodo_pagamento').gte('data', INIZIO).lte('data', oggi),
        supabase.from('fatture_emesse').select('totale').gte('data', INIZIO).lte('data', oggi),
        supabase.from('fatture_ricevute').select('totale').gte('data', INIZIO).lte('data', oggi),
        supabase.from('spese_fisse').select('importo'),
        supabase.from('debiti').select('id,rata_mensile'),
        supabase.from('rate_debito').select('importo,debito_id').gte('data_scadenza', INIZIO).lte('data_scadenza', oggi),
        supabase.from('versamenti').select('importo').gte('data', INIZIO).lte('data', oggi),
      ])
      const entrate = eRes.data || []
      // Tutto quello che è entrato fisicamente (cash lordo + card)
      const entrateTotale = entrate.reduce((s, e) => s + (e.importo_lordo || (e.importo_cash || 0) + (e.importo_card || 0)), 0)
      // Solo quello che passa per il conto (cash dichiarato + card)
      const entrateBanca = entrate.reduce((s, e) => s + (e.cash_dichiarato || 0) + (e.importo_card || 0), 0)
      // Contanti non versati (cash totale - cash dichiarato)
      const contanti = entrate.reduce((s, e) => s + Math.max(0, (e.importo_cash || 0) - (e.cash_dichiarato || 0)), 0)

      const feCum = (feRes.data || []).reduce((s, f) => s + (f.totale || 0), 0)
      const spese = sRes.data || []
      const speseCashCum = spese.filter(e => e.metodo_pagamento === 'cash').reduce((s, e) => s + (e.importo || 0), 0)
      const speseCardCum = spese.filter(e => e.metodo_pagamento !== 'cash').reduce((s, e) => s + (e.importo || 0), 0)
      const speseCum = speseCashCum + speseCardCum
      const frCum = (frRes.data || []).reduce((s, f) => s + (f.totale || 0), 0)
      const nowDate = new Date()
      const mesiTrascorsi = (nowDate.getFullYear() - 2026) * 12 + (nowDate.getMonth() - 3) + 1
      const speseFisseCum = (sfRes.data || []).reduce((s, v) => s + v.importo, 0) * mesiTrascorsi
      const debiti = debRes.data || []
      const idsFissi = new Set(debiti.filter(d => d.rata_mensile > 0).map(d => d.id))
      const rateFisseCum = debiti.filter(d => d.rata_mensile > 0).reduce((s, d) => s + d.rata_mensile, 0) * mesiTrascorsi
      const rateVarCum = (rateRes.data || []).filter(r => !idsFissi.has(r.debito_id)).reduce((s, r) => s + r.importo, 0)
      const versamentiCum = (versRes.data || []).reduce((s, v) => s + v.importo, 0)
      const usciteBanca = speseCardCum + frCum + speseFisseCum + rateFisseCum + rateVarCum
      const usciteTotali = speseCum + frCum + speseFisseCum + rateFisseCum + rateVarCum
      setSaldoConto(entrateTotale + feCum - usciteTotali)
      setSaldoBanca(entrateBanca + feCum - usciteBanca + versamentiCum)
      setSaldoContanti(contanti - speseCashCum - versamentiCum)
    } catch (err) {
      console.error('Errore saldo conto:', err.message)
    }
  }

  async function loadTrimestre() {
    try {
      const { startAnno, start, end } = infoQ
      // Mod 130 cumulative (Jan 1 → fine trimestre), Mod 420 solo trimestre corrente
      const meseStr = `${anno}-${String(mese).padStart(2, '0')}`
      const ultimoGiornoMese = new Date(anno, mese, 0).getDate()
      const oggi = new Date().toISOString().slice(0, 10)
      const [feYTD, frYTD, enYTD, feQ, frQ, enQ, debRes, rateMeseRes, spDedYTD, spDedQ, versYTD, versQ, prossRataRes, entrateTSRes, commissioneRes] = await Promise.all([
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('entrate').select('importo_netto').gte('data', startAnno).lte('data', end).neq('dichiara', false),
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('entrate').select('importo_netto,igic_percentuale,cash_dichiarato,importo_card').gte('data', start).lte('data', end).neq('dichiara', false),
        supabase.from('debiti').select('id,nome,rata_mensile,importo_totale,importo_pagato,igic_percentuale,deducibile,data_fine'),
        supabase.from('rate_debito').select('id,importo,debito_id,data_scadenza,pagato,numero_rata').gte('data_scadenza', `${meseStr}-01`).lte('data_scadenza', `${meseStr}-${ultimoGiornoMese}`).eq('pagato', false),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', startAnno).lte('data', end),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', start).lte('data', end),
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', start).lte('data', end),
        supabase.from('rate_debito').select('importo,debito_id,data_scadenza').eq('pagato', false).gte('data_scadenza', oggi).order('data_scadenza', { ascending: true }).limit(1),
        supabase.from('entrate').select('importo_lordo').gte('data', start).lte('data', end).eq('attivita_nome', 'Tenerife Stars'),
        supabase.from('commissioni_guida').select('*').eq('anno', infoQ.anno).eq('trimestre', infoQ.q).maybeSingle(),
      ])
      const tuttiDebiti = debRes.data || []
      const attivi = tuttiDebiti.filter(d => (d.importo_totale - (d.importo_pagato || 0)) > 0)
      const idsFissi = new Set(attivi.filter(d => d.rata_mensile > 0).map(d => d.id))
      const mapDebiti = {}
      tuttiDebiti.forEach(d => { mapDebiti[d.id] = d.nome })
      setDatiQ({
        feYTD: feYTD.data || [],
        frYTD: frYTD.data || [],
        enYTD: enYTD.data || [],
        feQ: feQ.data || [],
        frQ: frQ.data || [],
        enQ: enQ.data || [],
        debitiDeducibili: attivi.filter(d => d.deducibile),
        speseDedYTD: spDedYTD.data || [],
        speseDedQ: spDedQ.data || [],
        versYTD: versYTD.data || [],
        versQ: versQ.data || [],
      })
      setDebitiAttivi(attivi)
      setRateMese((rateMeseRes.data || []).filter(r => !idsFissi.has(r.debito_id)))
      setDebitiMap(mapDebiti)
      const pr = prossRataRes.data?.[0] || null
      setProssimaRata(pr ? { ...pr, nomeDebito: mapDebiti[pr.debito_id] || 'Debito' } : null)
      setEntrateTS(entrateTSRes.data || [])
      const rec = commissioneRes.data
      setCommissioneRecord(rec)
      setAccontoInput(rec?.acconto > 0 ? String(rec.acconto) : '')
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

  async function handleSalvaAcconto() {
    const importo = parseFloat(String(accontoInput).replace(',', '.')) || 0
    setSavingAcconto(true)
    try {
      await supabase.from('commissioni_guida').upsert(
        { anno: infoQ.anno, trimestre: infoQ.q, acconto: importo, saldata: false },
        { onConflict: 'anno,trimestre' }
      )
      setCommissioneRecord(prev => ({
        ...(prev || { anno: infoQ.anno, trimestre: infoQ.q, saldata: false, fattura_importo: null }),
        acconto: importo,
      }))
    } catch (err) {
      console.error('Errore salva acconto:', err.message)
    } finally {
      setSavingAcconto(false)
    }
  }

  async function handleAzzera() {
    const importo = parseFloat(String(azzeraInput).replace(',', '.'))
    if (!importo || importo <= 0) return
    setSavingAzzera(true)
    try {
      const oggi = new Date().toISOString().slice(0, 10)
      await Promise.all([
        supabase.from('fatture_ricevute').insert({
          data: oggi,
          fornitore_nome: 'Tenerife Stars',
          totale: importo,
          igic_percentuale: 7,
          note: `Commissione guida T${infoQ.q} ${infoQ.anno}`,
        }),
        supabase.from('commissioni_guida').upsert(
          { anno: infoQ.anno, trimestre: infoQ.q, saldata: true, fattura_importo: importo },
          { onConflict: 'anno,trimestre' }
        ),
      ])
      setShowAzzera(false)
      setAzzeraInput('')
      await Promise.all([loadDati(), loadTrimestre(), loadSettimana()])
    } catch (err) {
      console.error('Errore azzera commissione:', err.message)
    } finally {
      setSavingAzzera(false)
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

  const totaleNetto = entrate.reduce((s, e) => {
    const cashNonDichiarato = Math.max(0, (e.importo_cash || 0) - (e.cash_dichiarato || 0))
    return s + (e.importo_netto || 0) + cashNonDichiarato
  }, 0)
  const totaleCommissioni = entrate.reduce((s, e) => s + (e.importo_commissione || 0), 0)
  const totaleSpese = spese.reduce((s, e) => s + (e.importo || 0), 0)
  const totaleFattureEmesse = fattureEmesse.reduce((s, f) => {
    const perc = f.igic_percentuale ?? 7
    return s + (perc > 0 ? f.totale * 100 / (100 + perc) : f.totale)
  }, 0)
  const totaleFattureRicevute = fattureRicevute.reduce((s, f) => s + (f.totale || 0), 0)
  const totaleEntrate = totaleNetto + totaleFattureEmesse
  const totaleUscite = totaleSpese + totaleFattureRicevute
  const saldo = totaleEntrate - totaleUscite
  const totaleFisso = speseFisse.reduce((s, v) => s + v.importo, 0)

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
      + datiQ.versYTD.reduce((s, v) => {
          const perc = v.igic_percentuale || 0
          return s + (perc > 0 ? v.importo / (1 + perc / 100) : v.importo)
        }, 0)
    : 0
  function imponibileSpesa(s) {
    const perc = parseFloat(s.igic_percentuale) || 0
    return perc > 0 ? s.importo * 100 / (100 + perc) : s.importo
  }

  const costiYTD = datiQ
    ? datiQ.frYTD.reduce((s, f) => s + imponibileFattura(f), 0)
      + datiQ.speseDedYTD.reduce((s, sp) => s + imponibileSpesa(sp), 0)
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
      + datiQ.versQ.reduce((s, v) => {
          const perc = v.igic_percentuale || 0
          return s + (perc > 0 ? v.importo * perc / (100 + perc) : 0)
        }, 0)
    : 0
  const igicSoportado = datiQ
    ? datiQ.frQ.reduce((s, f) => {
        const perc = f.igic_percentuale ?? 7
        return s + (perc > 0 ? f.totale * perc / (100 + perc) : 0)
      }, 0)
      + datiQ.speseDedQ.reduce((s, sp) => {
        const perc = parseFloat(sp.igic_percentuale) || 0
        return s + (perc > 0 ? sp.importo * perc / (100 + perc) : 0)
      }, 0)
    : 0

  // Spese fisse deducibili → entrano nei calcoli tasse automaticamente
  // Mesi effettivi dall'inizio attività (apr 2026), non trimestre × 3
  const mesiYTD = Math.max(1, (anno - 2026) * 12 + mese - 3)
  const deducibili = speseFisse.filter(v => v.deducibile)

  const meseSel = `${anno}-${String(mese).padStart(2, '0')}-01`
  const totaleRateFisse = debitiAttivi
    .filter(d => d.rata_mensile > 0)
    .filter(d => !d.data_fine || d.data_fine >= meseSel)
    .reduce((s, d) => s + d.rata_mensile, 0)
  const totaleRateVariabiliMese = rateMese.reduce((s, r) => s + r.importo, 0)
  const totaleRateMensili = totaleRateFisse + totaleRateVariabiliMese
  const saldoReale = saldo - totaleFisso - totaleRateMensili
  const saldoRealeColore = saldoReale > 0 ? 'text-green-700' : saldoReale < 0 ? 'text-red-700' : 'text-slate-600'
  const saldoRealeBg = saldoReale > 0 ? 'bg-green-50 border-green-200' : saldoReale < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'

  function imponibileFissa(v) {
    const perc = parseFloat(v.igic_percentuale) || 0
    return perc > 0 ? v.importo * 100 / (100 + perc) : v.importo
  }
  function igicFissa(v) {
    const perc = parseFloat(v.igic_percentuale) || 0
    return perc > 0 ? v.importo * perc / (100 + perc) : 0
  }

  const costiDedFisseYTD = deducibili.reduce((s, v) => s + imponibileFissa(v), 0) * mesiYTD
  const mesiTrimestre = Math.min(3, Math.max(1, mese - (infoQ.q - 1) * 3))
  const igicFisseQ = deducibili.reduce((s, v) => s + igicFissa(v), 0) * mesiTrimestre

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
  }, 0) * mesiTrimestre

  const profittoYTD = ricaviYTD - costiYTD - costiDedFisseYTD - costiDedDebitiYTD
  const igicSoportadoTotale = igicSoportado + igicFisseQ + igicDebitiQ
  const irpfQ = Math.max(0, profittoYTD * 0.20)
  const igicQ = Math.max(0, igicRepercutido - igicSoportadoTotale)

  // Salva stima tasse mensili per la pagina Risparmi
  const tasseMensili = (irpfQ + igicQ) / 3
  if (tasseMensili > 0) localStorage.setItem('tasse_mensili_stima', tasseMensili.toFixed(2))

  // Flusso mensile banca vs contanti
  const entrateBancaMese = entrate.reduce((s, e) => s + (e.cash_dichiarato || 0) + (e.importo_card || 0), 0)
  const entrateContantiMese = entrate.reduce((s, e) => s + Math.max(0, (e.importo_cash || 0) - (e.cash_dichiarato || 0)), 0)
  const speseCardMese = spese.filter(e => e.metodo_pagamento !== 'cash').reduce((s, e) => s + (e.importo || 0), 0)
  const speseCashMese = spese.filter(e => e.metodo_pagamento === 'cash').reduce((s, e) => s + (e.importo || 0), 0)
  const totaleVersamentiMese = versamentiMese.reduce((s, v) => s + v.importo, 0)
  const usciteBancaMese = speseCardMese + totaleFattureRicevute + totaleFisso + totaleRateMensili
  const saldoBancaMese = entrateBancaMese + totaleFattureEmesse - usciteBancaMese + totaleVersamentiMese
  const saldoContantiMese = entrateContantiMese - speseCashMese - totaleVersamentiMese

  const puntoPareggioMese = totaleFisso + totaleRateMensili + tasseMensili
  const beneficio = totaleEntrate - totaleSpese - totaleFattureRicevute - puntoPareggioMese
  const totaleResiduo = debitiAttivi.reduce((s, d) => s + (d.importo_totale - (d.importo_pagato || 0)), 0)

  // Commissione guida Tenerife Stars
  const commissioneStimata = Math.max(0,
    entrateTS.reduce((s, e) => s + (e.importo_lordo || 0) * 0.33, 0) - entrateTS.length * 10
  )
  const acconto = commissioneRecord?.acconto || 0
  const ancoraRa = Math.max(0, commissioneStimata - acconto)
  const beneficioReale = beneficio - ancoraRa
  const targetReale = totaleSpese + totaleFattureRicevute + puntoPareggioMese + ancoraRa
  const progPctReale = targetReale > 0 ? Math.min(100, totaleEntrate / targetReale * 100) : 100
  const giorniTotaliMese = new Date(anno, mese, 0).getDate()
  const isCurrentMonth = anno === now.getFullYear() && mese === now.getMonth() + 1
  const giorniRimasti = isCurrentMonth ? Math.max(0, giorniTotaliMese - now.getDate()) : 0
  const mancaReale = Math.max(0, targetReale - totaleEntrate)
  const targetGiornalieroReale = giorniRimasti > 0 ? mancaReale / giorniRimasti : 0

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* NUMERO PRINCIPALE */}
        <div className="flex items-center justify-between mb-1">
          <button onClick={mesePrecedente} className="text-2xl text-slate-300 active:text-slate-500 px-1">‹</button>
          <p className="text-xs text-slate-400 uppercase tracking-widest">{getMeseLabel(anno, mese)} — quello che è tuo</p>
          <button onClick={meseSuccessivo} className="text-2xl text-slate-300 active:text-slate-500 px-1">›</button>
        </div>
        <p className={`text-6xl font-bold mb-1 ${beneficio >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {beneficio >= 0 ? '+' : ''}{fmtBig(beneficio)}
        </p>
        <p className="text-sm text-slate-400 mb-6">dopo spese, rate e tasse</p>

        {/* STATO OBIETTIVO */}
        <p className="text-xs text-slate-400 mb-6">
          {beneficio >= 0
            ? `✓ Mese positivo — surplus ${fmtBig(beneficio)}`
            : `⚠️ Mese in rosso di ${fmtBig(Math.abs(beneficio))} — tasse incluse`}
        </p>

        {/* PATRIMONIO */}
        {saldoBanca !== null && (
          <div className="bg-slate-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Patrimonio netto</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Banca</p>
                <p className={`text-xl font-bold ${saldoBanca >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                  {formatEur(saldoBanca)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Contanti</p>
                <p className={`text-xl font-bold ${saldoContanti >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                  {formatEur(saldoContanti)}
                </p>
              </div>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-xs text-slate-500">Totale</span>
              <span className={`text-sm font-bold ${saldoConto >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                {formatEur(saldoConto)}
              </span>
            </div>
          </div>
        )}

        {/* COMMISSIONE GUIDA */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap">Commissione guida</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {commissioneRecord?.saldata ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
            <p className="text-xs text-indigo-500 uppercase tracking-wide mb-2">T{infoQ.q} {infoQ.anno}</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-bold text-indigo-700">{fmtBig(commissioneRecord.fattura_importo)}</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">✓ fattura inserita</span>
            </div>
            <p className="text-xs text-indigo-400">registrata come fattura ricevuta · trimestre chiuso</p>
          </div>
        ) : (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
            <p className="text-xs text-indigo-500 uppercase tracking-wide mb-3">Scenario reale con commissione guida</p>

            <div className="bg-white rounded-xl px-3 py-2.5 flex flex-col gap-1.5 text-xs text-slate-500 mb-3">
              <div className="flex justify-between">
                <span>Commissione stimata ({entrateTS.length} gg)</span>
                <span className="font-medium text-slate-700">−{fmtBig(commissioneStimata)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Già pagato</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">−€</span>
                  <input
                    type="number" inputMode="decimal"
                    value={accontoInput}
                    onChange={e => setAccontoInput(e.target.value)}
                    placeholder="0"
                    className="w-20 border border-slate-300 rounded-lg px-2 py-0.5 text-right text-xs bg-white"
                  />
                  <button
                    onClick={handleSalvaAcconto}
                    disabled={savingAcconto}
                    className="bg-indigo-600 text-white rounded-lg px-2 py-0.5 text-xs font-bold disabled:opacity-40">
                    {savingAcconto ? '…' : '✓'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5 font-semibold text-slate-700">
                <span>Ancora da pagare</span>
                <span className="text-indigo-700">−{fmtBig(ancoraRa)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-slate-500">Beneficio reale stimato</p>
              <p className={`text-2xl font-bold ${beneficioReale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {beneficioReale >= 0 ? '+' : ''}{fmtBig(beneficioReale)}
              </p>
            </div>

            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden mb-1.5">
              <div className={`h-full rounded-full transition-all ${progPctReale >= 100 ? 'bg-green-500' : 'bg-indigo-400'}`}
                style={{ width: `${progPctReale}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mb-3">
              <span>Guadagnato: <strong className="text-slate-600">{fmtBig(totaleEntrate)}</strong></span>
              <span>Serve: <strong className="text-slate-600">{fmtBig(targetReale)}</strong></span>
            </div>

            {giorniRimasti > 0 && targetGiornalieroReale > 0 && (
              <p className="text-xs text-slate-500 bg-white rounded-xl px-3 py-2 mb-3">
                Devi guadagnare <strong className="text-indigo-600">{fmtBig(targetGiornalieroReale)}/giorno</strong> nei prossimi {giorniRimasti} giorni
              </p>
            )}

            <button onClick={() => setShowAzzera(true)}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold active:bg-indigo-700">
              Azzera — inserisci fattura trimestrale
            </button>
          </div>
        )}

        {/* BREAKDOWN */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-4">
          <div className="flex justify-between py-2 text-sm border-b border-slate-200">
            <span className="text-slate-500">Entrate nette</span>
            <span className="font-medium text-green-600">+{fmtBig(totaleEntrate)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-slate-200">
            <span className="text-slate-500">Spese variabili</span>
            <span className="font-medium text-red-500">−{fmtBig(totaleSpese)}</span>
          </div>
          {totaleFattureRicevute > 0 && (
            <div className="flex justify-between py-2 text-sm border-b border-slate-200">
              <span className="text-slate-500">Fatture ricevute</span>
              <span className="font-medium text-red-500">−{fmtBig(totaleFattureRicevute)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 text-sm border-b border-slate-200">
            <span className="text-slate-500">Spese fisse</span>
            <span className="font-medium text-red-500">−{fmtBig(totaleFisso)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-slate-200">
            <span className="text-slate-500">Rate debiti</span>
            <span className="font-medium text-red-500">−{fmtBig(totaleRateMensili)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-slate-200">
            <span className="text-slate-500">Tasse da parte</span>
            <span className="font-medium text-amber-500">−{fmtBig(tasseMensili)}</span>
          </div>
          <div className="flex justify-between pt-3 text-base font-semibold">
            <span>Rimane a te</span>
            <span className={beneficio >= 0 ? 'text-green-500' : 'text-red-500'}>
              {beneficio >= 0 ? '+' : ''}{fmtBig(beneficio)}
            </span>
          </div>
        </div>

        {/* SALDO REALE */}
        <div className={`rounded-2xl border p-4 mb-4 cursor-pointer ${saldoRealeBg}`}
             onClick={() => setShowDettaglioSaldo(s => !s)}>
          <p className="text-xs font-medium text-slate-500 mb-1">Saldo reale mensile</p>
          <p className={`text-3xl font-bold ${saldoRealeColore}`}>{formatEur(saldoReale)}</p>
          <p className="text-xs text-slate-400 mt-1">dopo spese fisse e rate debiti · tap per dettaglio</p>

          {showDettaglioSaldo && (
            <div className="mt-3 border-t border-slate-200 pt-3 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Entrate nette</span>
                <span className="text-green-600 font-medium">+{formatEur(totaleEntrate)}</span>
              </div>
              {totaleSpese > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Spese variabili</span>
                  <span className="text-red-500">−{formatEur(totaleSpese)}</span>
                </div>
              )}
              {totaleFattureRicevute > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Fatture ricevute</span>
                  <span className="text-red-500">−{formatEur(totaleFattureRicevute)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>Spese fisse</span>
                <span className="text-red-500">−{formatEur(totaleFisso)}</span>
              </div>
              {totaleRateMensili > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Rate debiti</span>
                  <span className="text-red-500">−{formatEur(totaleRateMensili)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 mt-0.5">
                <span>Saldo reale</span>
                <span className={saldoRealeColore}>{formatEur(saldoReale)}</span>
              </div>
            </div>
          )}
        </div>

        {/* CARDS SECONDARIE */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => navigate('/budget')} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left active:opacity-70">
            <p className="text-xs text-amber-600 mb-1">Tasse stimate trimestre</p>
            <p className="text-xl font-bold text-amber-600">{fmtBig(irpfQ + igicQ)}</p>
            <p className="text-xs text-amber-400 mt-1">scad. {infoQ.deadline}</p>
          </button>
          <button onClick={() => navigate('/debiti')} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left active:opacity-70">
            <p className="text-xs text-slate-500 mb-1">Debito residuo</p>
            <p className="text-xl font-bold text-slate-700">{fmtBig(totaleResiduo)}</p>
            <p className="text-xs text-slate-400 mt-1">totale da pagare</p>
          </button>
        </div>

        {/* PROSSIME USCITE STRAORDINARIE */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
          <p className="text-xs text-orange-500 uppercase tracking-wide mb-2">Prossime uscite straordinarie</p>
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-orange-700">Giugno — debiti fiscali</p>
            <p className="text-base font-bold text-orange-600">€466</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-orange-700">20 luglio — Mod 130 + 420</p>
            <p className="text-base font-bold text-orange-600">{fmtBig(irpfQ + igicQ)}</p>
          </div>
          <p className="text-xs text-orange-400 mt-2">I €466 di giugno non sono nelle rate mensili — mettili da parte</p>
        </div>

        {/* BOTTONI */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/entrate')}
            className="bg-green-500 text-white rounded-2xl py-4 font-bold text-base active:bg-green-600">
            + Entrata
          </button>
          <button onClick={() => navigate('/spese')}
            className="bg-slate-800 text-white rounded-2xl py-4 font-bold text-base active:bg-slate-700">
            + Spesa
          </button>
        </div>

      </div>

      {/* MODAL AZZERA COMMISSIONE */}
      {showAzzera && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={() => setShowAzzera(false)}>
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-800 mb-1">Fattura commissione guida</p>
            <p className="text-sm text-slate-500 mb-1">T{infoQ.q} {infoQ.anno} · Tenerife Stars</p>
            <p className="text-xs text-slate-400 mb-4">Stima: {fmtBig(commissioneStimata)} — inserisci il reale (totale con IGIC 7%)</p>
            <input
              type="number" inputMode="decimal" placeholder="es. 450"
              value={azzeraInput} onChange={e => setAzzeraInput(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg mb-4" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setShowAzzera(false); setAzzeraInput('') }}
                className="flex-1 border border-slate-300 rounded-xl py-3 text-sm font-medium text-slate-600">
                Annulla
              </button>
              <button onClick={handleAzzera} disabled={savingAzzera || !azzeraInput}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40">
                {savingAzzera ? 'Salvo...' : 'Inserisci e azzera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
