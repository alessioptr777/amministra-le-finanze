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
      // Cap al mese visualizzato: i mesi chiusi usano solo i propri dati, non quelli futuri
      const capData = `${meseStr}-${ultimoGiornoMese}`
      const [feYTD, frYTD, enYTD, feQ, frQ, enQ, debRes, rateMeseRes, spDedYTD, spDedQ, versYTD, versQ, prossRataRes] = await Promise.all([
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', startAnno).lte('data', capData),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', startAnno).lte('data', capData),
        supabase.from('entrate').select('importo_netto').gte('data', startAnno).lte('data', capData).neq('dichiara', false),
        supabase.from('fatture_emesse').select('totale,igic_percentuale').gte('data', start).lte('data', capData),
        supabase.from('fatture_ricevute').select('totale,igic_percentuale').gte('data', start).lte('data', capData),
        supabase.from('entrate').select('importo_netto,igic_percentuale,cash_dichiarato,importo_card').gte('data', start).lte('data', capData).neq('dichiara', false),
        supabase.from('debiti').select('id,nome,rata_mensile,importo_totale,importo_pagato,igic_percentuale,deducibile,data_fine'),
        supabase.from('rate_debito').select('id,importo,debito_id,data_scadenza,pagato,numero_rata').gte('data_scadenza', `${meseStr}-01`).lte('data_scadenza', `${meseStr}-${ultimoGiornoMese}`).eq('pagato', false),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', startAnno).lte('data', capData),
        supabase.from('spese').select('importo,igic_percentuale').eq('deducibile', true).gte('data', start).lte('data', capData),
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', startAnno).lte('data', capData),
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', start).lte('data', capData),
        supabase.from('rate_debito').select('importo,debito_id,data_scadenza').eq('pagato', false).gte('data_scadenza', oggi).order('data_scadenza', { ascending: true }).limit(1),
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
  const tasseMensili = (irpfQ + igicQ) / mesiTrimestre
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

  // Commissione guida Tenerife Stars — stima mensile dal mese selezionato
  const entrateTSMese = entrate.filter(e => e.attivita_nome === 'Tenerife Stars')
  const commissioneMese = Math.max(0,
    entrateTSMese.reduce((s, e) => s + (e.importo_lordo || 0) * 0.33, 0) - entrateTSMese.length * 10
  )

  const puntoPareggioMese = totaleFisso + totaleRateMensili + tasseMensili + commissioneMese
  const beneficio = totaleEntrate - totaleSpese - totaleFattureRicevute - puntoPareggioMese
  const totaleResiduo = debitiAttivi.reduce((s, d) => s + (d.importo_totale - (d.importo_pagato || 0)), 0)

  const giorniTotaliMese = new Date(anno, mese, 0).getDate()
  const isCurrentMonth = anno === now.getFullYear() && mese === now.getMonth() + 1
  const giorniRimasti = isCurrentMonth ? Math.max(0, giorniTotaliMese - now.getDate()) : 0
  const targetReale = totaleSpese + totaleFattureRicevute + puntoPareggioMese
  const progPctReale = targetReale > 0 ? Math.min(100, totaleEntrate / targetReale * 100) : 100
  const mancaReale = Math.max(0, targetReale - totaleEntrate)
  const targetGiornalieroReale = giorniRimasti > 0 ? mancaReale / giorniRimasti : 0

  const C = beneficio >= 0 ? '#4ade80' : '#ff0040'
  const CG = beneficio >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(255,0,64,0.3)'

  return (
    <div style={{background:'#000',minHeight:'100vh',paddingBottom:'80px',fontFamily:"'Courier New',monospace",overflowX:'hidden',position:'relative'}}>

      <style>{`
        @keyframes scanline{0%{top:-5%}100%{top:105%}}
        @keyframes rainDrop{0%{transform:translateY(-30px);opacity:0}10%{opacity:1}90%{opacity:.6}100%{transform:translateY(300px);opacity:0}}
        @keyframes npGreen{0%,100%{text-shadow:0 0 6px #4ade80,0 0 18px #4ade80}50%{text-shadow:0 0 2px #4ade80,0 0 8px #4ade80}}
        @keyframes npRed{0%,100%{text-shadow:0 0 6px #ff0040,0 0 18px #ff0040}50%{text-shadow:0 0 2px #ff0040,0 0 8px #ff0040}}
        @keyframes npCyan{0%,100%{text-shadow:0 0 6px #0ff,0 0 18px #0ff}50%{text-shadow:0 0 2px #0ff,0 0 8px #0ff}}
        @keyframes glitch{0%,88%,100%{transform:none}89%{transform:translate(2px,0)}91%{transform:translate(-2px,0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin16{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes spinRev12{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
        @keyframes orbitA{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes orbitB{from{transform:rotate(120deg)}to{transform:rotate(480deg)}}
        @keyframes orbitC{from{transform:rotate(240deg)}to{transform:rotate(600deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes borderFlow{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideIn{from{width:0}to{width:var(--w,0%)}}
        @media(min-width:768px){.dash-wrap{max-width:1100px!important;padding:24px 48px 48px!important}.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}}
      `}</style>

      {/* SCANLINE */}
      <div style={{position:'fixed',left:0,right:0,height:'3px',background:'rgba(0,255,255,0.04)',zIndex:10,pointerEvents:'none',animation:'scanline 24s linear infinite'}} />

      {/* BINARY RAIN */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:'380px',zIndex:1,overflow:'hidden',pointerEvents:'none'}}>
        {['8%','25%','45%','65%','85%'].map((l,i)=>(
          <div key={i} style={{position:'absolute',left:l,top:0,color:'rgba(0,255,255,0.05)',fontSize:'10px',animation:`rainDrop ${[14,13,18,15,20][i]}s ease-in infinite`,animationDelay:`${i*0.5}s`}}>
            {['01101','10010','11001','01010','10110'][i]}
          </div>
        ))}
      </div>

      <div className="dash-wrap" style={{maxWidth:'390px',margin:'0 auto',padding:'18px 16px 28px',position:'relative',zIndex:2}}>

        {/* TOP BAR */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(0,255,255,0.12)',paddingBottom:'8px',marginBottom:'20px'}}>
          <span style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.75)'}}>METAPROOS_OS v2.6</span>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <div style={{width:'5px',height:'5px',borderRadius:'50%',background:C,boxShadow:`0 0 6px ${C}`,animation:'blink 6s ease infinite'}} />
            <span style={{fontSize:'8px',letterSpacing:'.2em',color:C}}>{beneficio>=0?'SURPLUS':'DEFICIT'}</span>
          </div>
        </div>

        {/* MONTH NAV */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <button onClick={mesePrecedente} style={{background:'transparent',border:'none',color:'rgba(0,255,255,0.7)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',fontFamily:"'Courier New',monospace"}}>‹</button>
          <span style={{fontSize:'9px',letterSpacing:'.2em',color:'rgba(0,255,255,0.75)',textTransform:'uppercase'}}>{getMeseLabel(anno,mese)}</span>
          <button onClick={meseSuccessivo} style={{background:'transparent',border:'none',color:'rgba(0,255,255,0.7)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',fontFamily:"'Courier New',monospace"}}>›</button>
        </div>

        <div className="dash-grid">
        <div className="dash-col">

        {/* SFERA + CERCHIO AFFIANCATI */}
        <div style={{display:'flex',gap:'12px',justifyContent:'center',alignItems:'center',marginBottom:'8px'}}>

          {/* SFERA ESAGONALE */}
          <div style={{position:'relative',width:'150px',height:'150px',flexShrink:0}}>
            <div style={{position:'absolute',inset:0,animation:'spin16 64s linear infinite'}}>
              <div style={{width:'100%',height:'100%',clipPath:'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',background:beneficio>=0?'rgba(74,222,128,0.15)':'rgba(255,0,64,0.15)'}}>
                <div style={{position:'absolute',inset:'2px',clipPath:'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',background:'#000'}} />
              </div>
            </div>
            <div style={{position:'absolute',inset:'16px',animation:'spinRev12 48s linear infinite'}}>
              <div style={{width:'100%',height:'100%',clipPath:'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',background:'rgba(0,255,255,0.1)'}}>
                <div style={{position:'absolute',inset:'2px',clipPath:'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',background:'#000'}} />
              </div>
            </div>
            {[
              {anim:'orbitA',dur:'28s',color:'#0ff',glow:'rgba(0,255,255,0.8)'},
              {anim:'orbitB',dur:'36s',color:'#f0f',glow:'rgba(255,0,255,0.8)'},
              {anim:'orbitC',dur:'44s',color:'#ff0',glow:'rgba(255,255,0,0.8)'},
            ].map((d,i)=>(
              <div key={i} style={{position:'absolute',top:'50%',left:'50%',width:'105px',height:'105px',marginTop:'-52px',marginLeft:'-52px',animation:`${d.anim} ${d.dur} linear infinite`}}>
                <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'4px',height:'4px',borderRadius:'50%',background:d.color,boxShadow:`0 0 5px ${d.glow}`}} />
              </div>
            ))}
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'82px',height:'82px',borderRadius:'50%',background:`radial-gradient(circle, ${CG.replace('0.3','0.08')} 0%, #000 70%)`,border:`1px solid ${CG}`,boxShadow:`0 0 16px ${CG},inset 0 0 16px ${CG.replace('0.3','0.05')}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:'18px',fontWeight:700,letterSpacing:'-1px',color:C,animation:beneficio>=0?'npGreen 12s ease infinite':'npRed 12s ease infinite,glitch 30s ease infinite',fontFamily:"'Courier New',monospace"}}>
                {beneficio>=0?'+':''}{fmtBig(beneficio)}
              </span>
              <span style={{fontSize:'6px',letterSpacing:'.12em',color:'rgba(255,255,255,0.65)',marginTop:'2px'}}>
                {beneficio>=0?'SURPLUS':'DEFICIT'}
              </span>
            </div>
          </div>

          {/* CERCHIO TARGET */}
          {isCurrentMonth?(
            <div style={{width:'150px',height:'150px',borderRadius:'50%',background:'#0e0e18',border:`1px solid ${mancaReale>0?'rgba(0,255,255,0.25)':'rgba(74,222,128,0.3)'}`,boxShadow:mancaReale>0?'0 0 20px rgba(0,255,255,0.06)':'0 0 20px rgba(74,222,128,0.06)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',flexShrink:0}}>
              <div style={{position:'absolute',inset:'6px',borderRadius:'50%',border:`1px solid ${mancaReale>0?'rgba(0,255,255,0.07)':'rgba(74,222,128,0.1)'}`}} />
              {mancaReale>0?(
                <>
                  <span style={{fontSize:'30px',fontWeight:700,letterSpacing:'-2px',color:'#00ffff',textShadow:'0 0 14px rgba(0,255,255,0.5)',animation:'npCyan 12s ease infinite',fontFamily:"'Courier New',monospace",lineHeight:1}}>
                    {fmtBig(targetGiornalieroReale)}
                  </span>
                  <span style={{fontSize:'7px',letterSpacing:'.18em',color:'rgba(0,255,255,0.7)',marginTop:'5px',fontFamily:"'Courier New',monospace"}}>AL GIORNO</span>
                </>
              ):(
                <>
                  <span style={{fontSize:'10px',fontWeight:700,letterSpacing:'.08em',color:'#4ade80',textShadow:'0 0 10px rgba(74,222,128,0.5)',animation:'npGreen 12s ease infinite',fontFamily:"'Courier New',monospace",textAlign:'center',lineHeight:1.4}}>TARGET{'\n'}RAGGIUNTO</span>
                  <span style={{fontSize:'16px',fontWeight:700,color:'#4ade80',marginTop:'4px',fontFamily:"'Courier New',monospace"}}>{Math.round(progPctReale)}%</span>
                </>
              )}
            </div>
          ):(
            <div style={{width:'150px',height:'150px',borderRadius:'50%',background:'#0a0a0f',border:'1px solid rgba(0,255,255,0.08)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(0,255,255,0.6)',fontFamily:"'Courier New',monospace",textAlign:'center'}}>TARGET{'\n'}N/D</span>
            </div>
          )}
        </div>

        {/* INFO SOTTO I DUE CERCHI */}
        {isCurrentMonth&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px',paddingLeft:'4px',paddingRight:'4px'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(74,222,128,0.5)',marginBottom:'2px'}}>EARNED</div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#4ade80',letterSpacing:'-1px'}}>{fmtBig(totaleEntrate)}</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(255,255,255,0.65)',marginBottom:'2px'}}>TARGET · {giorniRimasti}gg</div>
              <div style={{fontSize:'13px',fontWeight:700,color:'rgba(255,255,255,0.75)',letterSpacing:'-1px'}}>{fmtBig(targetReale)}</div>
            </div>
          </div>
        )}

        {/* COMMISSIONE */}
        <div style={{background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'12px',position:'relative',animation:'fadeUp .4s ease both .4s'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}} />
          <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'10px'}}>COMMISSIONE // T{infoQ.q}_{infoQ.anno}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'10px'}}>
            <span style={{color:'rgba(255,255,255,0.7)',letterSpacing:'.05em'}}>STIMA_COMM ({entrateTSMese.length} GG)</span>
            <span style={{color:'#e8e8f0',fontWeight:700}}>−{fmtBig(commissioneMese)}</span>
          </div>
        </div>

        </div>{/* /dash-col left */}
        <div className="dash-col">

        {/* FLUSSO MENSILE */}
        <div style={{background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'12px',position:'relative',animation:'fadeUp .4s ease both .8s'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}} />
          <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'8px'}}>FLUSSO_MENSILE</div>
          {[
            {dot:'#4ade80',label:'ENTRATE_NETTE',val:`+${fmtBig(totaleEntrate)}`,color:'#4ade80'},
            ...(totaleSpese>0?[{dot:'#ff0040',label:'SPESE_VARIABILI',val:`−${fmtBig(totaleSpese)}`,color:'#ff0040'}]:[]),
            ...(totaleFattureRicevute>0?[{dot:'#ff0040',label:'FATTURE_RICEVUTE',val:`−${fmtBig(totaleFattureRicevute)}`,color:'#ff0040'}]:[]),
            {dot:'#ff0040',label:'SPESE_FISSE',val:`−${fmtBig(totaleFisso)}`,color:'#ff0040'},
            {dot:'#ff0040',label:'RATE_DEBITI',val:`−${fmtBig(totaleRateMensili)}`,color:'#ff0040'},
            {dot:'#f0f',label:'TASSE_DA_PARTE',val:`−${fmtBig(tasseMensili)}`,color:'#f0f'},
            ...(commissioneMese>0?[{dot:'rgba(255,165,0,0.8)',label:'COMM_GUIDA',val:`−${fmtBig(commissioneMese)}`,color:'rgba(255,165,0,0.8)'}]:[]),
          ].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',padding:'5px 0',fontSize:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <div style={{width:'4px',height:'4px',borderRadius:'50%',background:r.dot,boxShadow:`0 0 4px ${r.dot}`,flexShrink:0}} />
                <span style={{color:'rgba(255,255,255,0.65)',letterSpacing:'.05em'}}>{r.label}</span>
              </div>
              <span style={{color:r.color,fontWeight:700}}>{r.val}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px'}}>
            <span style={{fontSize:'9px',letterSpacing:'.15em',color:'rgba(255,255,255,0.75)'}}>RIMANE_A_TE</span>
            <span style={{fontSize:'20px',fontWeight:700,letterSpacing:'-1px',color:C,textShadow:`0 0 8px ${CG}`}}>
              {beneficio>=0?'+':''}{fmtBig(beneficio)}
            </span>
          </div>
        </div>

        {/* BOTTONI */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',animation:'fadeUp .4s ease both 1s'}}>
          <button onClick={()=>navigate('/entrate')} style={{background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',padding:'14px',color:'#4ade80',fontSize:'11px',fontWeight:700,letterSpacing:'.1em',fontFamily:"'Courier New',monospace",cursor:'pointer',textShadow:'0 0 8px rgba(74,222,128,0.3)'}}>
            + ENTRATA
          </button>
          <button onClick={()=>navigate('/spese')} style={{background:'transparent',border:'1px solid rgba(255,0,255,0.2)',borderRadius:'2px',padding:'14px',color:'rgba(255,0,255,0.5)',fontSize:'11px',fontWeight:700,letterSpacing:'.1em',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
            + SPESA
          </button>
        </div>

        </div>{/* /dash-col right */}
        </div>{/* /dash-grid */}

      </div>

    </div>
  )
}

