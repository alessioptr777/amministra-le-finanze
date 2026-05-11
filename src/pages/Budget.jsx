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
    startAnno: '2026-04-01',
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
      const [feYTD, frYTD, enYTD, feQ, frQ, enQ, sfRes, debRes, spDedYTD, spDedQ, versYTD, versQ] = await Promise.all([
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
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', startAnno).lte('data', end),
        supabase.from('versamenti').select('importo,igic_percentuale').gte('data', start).lte('data', end),
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
        + (versYTD.data || []).reduce((s, v) => {
            const p = v.igic_percentuale || 0
            return s + (p > 0 ? v.importo / (1 + p / 100) : v.importo)
          }, 0)

      const _now = new Date()
      const mesiYTD = Math.max(1, (_now.getFullYear() - 2026) * 12 + (_now.getMonth() + 1) - 3)
      const mesiTrimestre = Math.min(3, Math.max(1, _now.getMonth() + 1 - (qCorrente - 1) * 3))
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
      }, 0) + (versQ.data || []).reduce((s, v) => {
        const p = v.igic_percentuale || 0
        return s + (p > 0 ? v.importo * p / (100 + p) : 0)
      }, 0)

      const igicUscente = (frQ.data || []).reduce((s, f) => {
        const p = f.igic_percentuale ?? 7
        return s + (p > 0 ? f.totale * p / (100 + p) : 0)
      }, 0)
        + sfDed.reduce((s, v) => {
          const p = parseFloat(v.igic_percentuale) || 0
          return s + (p > 0 ? v.importo * p / (100 + p) : 0)
        }, 0) * mesiTrimestre
        + debDed.reduce((s, d) => {
          const p = d.igic_percentuale || 0
          return s + (p > 0 ? d.rata_mensile * p / (100 + p) : 0)
        }, 0) * mesiTrimestre
        + (spDedQ.data || []).reduce((s, sp) => {
          const p = parseFloat(sp.igic_percentuale) || 0
          return s + (p > 0 ? sp.importo * p / (100 + p) : 0)
        }, 0)

      const igicStima = Math.max(0, igicEntrante - igicUscente)
      setStima({ irpf: irpfStima, igic: igicStima, profitto, ricavi: ricaviYTD, costi: costiYTD })

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

  const cpCard = {background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'10px',position:'relative'}
  const cpTopLine = {position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}
  const cpInput = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
  const cpLabel = {fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase',display:'block',marginBottom:'4px'}
  const cpRow = {display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',padding:'5px 0',fontSize:'11px'}

  return (
    <div style={{background:'#000',minHeight:'100vh',fontFamily:"'Courier New',monospace",paddingBottom:'80px',position:'relative'}}>
      <style>{`
        @keyframes scanline2{0%{top:-5%}100%{top:105%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes borderFlow{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @media(min-width:768px){.page-wrap{max-width:800px!important;padding:24px 32px 40px!important}}
      `}</style>
      <div style={{position:'fixed',left:0,right:0,height:'3px',background:'rgba(0,255,255,0.03)',zIndex:10,pointerEvents:'none',animation:'scanline2 24s linear infinite'}} />

      <div className="page-wrap" style={{maxWidth:'390px',margin:'0 auto',padding:'16px 14px 24px',position:'relative',zIndex:2}}>

        {/* TOP BAR */}
        <div style={{borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'8px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>TASSE</div>
          <div style={{fontSize:'8px',letterSpacing:'.1em',color:'rgba(255,255,255,0.6)',marginTop:'2px'}}>STIMA VS REALE COMMERCIALISTA</div>
        </div>

        {loadingStima ? (
          <div style={{textAlign:'center',padding:'30px 0',fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.65)'}}>CARICAMENTO...</div>
        ) : (
          <>
            {/* TRIMESTRE CORRENTE */}
            <div style={{...cpCard,animation:'fadeUp .4s ease both'}}>
              <div style={cpTopLine} />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <span style={{fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.75)'}}>{infoQ.label.toUpperCase()}</span>
                <span style={{fontSize:'7px',letterSpacing:'.08em',color:'rgba(255,0,64,0.6)'}}>SCAD: {infoQ.deadline.toUpperCase()}</span>
              </div>

              {/* STIMA */}
              <div style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'10px',marginBottom:'10px'}}>
                <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.65)',marginBottom:'8px'}}>STIMA_APP</div>
                {[
                  {label:'RICAVI_YTD',val:formatEur(stima?.ricavi),color:'#4ade80'},
                  {label:'COSTI_DED_YTD',val:`-${formatEur(stima?.costi)}`,color:'#ff0040'},
                ].map((r,i)=>(
                  <div key={i} style={cpRow}>
                    <span style={{color:'rgba(255,255,255,0.65)',fontSize:'10px',letterSpacing:'.05em'}}>{r.label}</span>
                    <span style={{color:r.color,fontWeight:700,fontSize:'11px'}}>{r.val}</span>
                  </div>
                ))}
                <div style={{...cpRow,borderTop:'1px solid rgba(255,255,255,0.08)',borderBottom:'none',paddingTop:'6px',marginTop:'2px'}}>
                  <span style={{color:'rgba(255,255,255,0.75)',fontSize:'10px',letterSpacing:'.05em'}}>UTILE_IMPONIBILE</span>
                  <span style={{color:'#e8e8f0',fontWeight:700}}>{formatEur(stima?.profitto)}</span>
                </div>
                <div style={{...cpRow,borderBottom:'none'}}>
                  <span style={{color:'rgba(255,255,255,0.65)',fontSize:'10px',letterSpacing:'.05em'}}>IRPF_MOD130 (20%)</span>
                  <span style={{color:'#ffd700',fontWeight:700}}>{formatEur(stima?.irpf)}</span>
                </div>
                <div style={{...cpRow,borderBottom:'none'}}>
                  <span style={{color:'rgba(255,255,255,0.65)',fontSize:'10px',letterSpacing:'.05em'}}>IGIC_MOD420</span>
                  <span style={{color:'#ffd700',fontWeight:700}}>{formatEur(stima?.igic)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid rgba(255,215,0,0.2)',paddingTop:'6px',marginTop:'4px'}}>
                  <span style={{fontSize:'9px',letterSpacing:'.12em',color:'rgba(255,255,255,0.75)'}}>TOTALE_STIMATO</span>
                  <span style={{fontSize:'18px',fontWeight:700,letterSpacing:'-1px',color:'#ffd700',textShadow:'0 0 8px rgba(255,215,0,0.3)'}}>{formatEur(totaleStima)}</span>
                </div>
              </div>

              {/* REALE */}
              {salvatoCorrente && !editando ? (
                <div style={{background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.12)',borderRadius:'2px',padding:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <span style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>REALE_COMMERCIALISTA</span>
                    <button onClick={()=>startEdit(salvatoCorrente)}
                      style={{background:'none',border:'none',color:'rgba(0,255,255,0.7)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',fontFamily:"'Courier New',monospace"}}>MODIFICA</button>
                  </div>
                  {[
                    {label:'IRPF_MOD130',val:formatEur(salvatoCorrente.irpf_reale)},
                    {label:'IGIC_MOD420',val:formatEur(salvatoCorrente.igic_reale)},
                  ].map((r,i)=>(
                    <div key={i} style={cpRow}>
                      <span style={{color:'rgba(255,255,255,0.65)',fontSize:'10px',letterSpacing:'.05em'}}>{r.label}</span>
                      <span style={{color:'#00ffff',fontWeight:700}}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid rgba(0,255,255,0.1)',paddingTop:'6px',marginTop:'4px'}}>
                    <span style={{fontSize:'9px',letterSpacing:'.12em',color:'rgba(255,255,255,0.75)'}}>TOTALE_REALE</span>
                    <span style={{fontSize:'16px',fontWeight:700,color:'#00ffff',textShadow:'0 0 6px rgba(0,255,255,0.2)'}}>{formatEur(totaleReale)}</span>
                  </div>
                  {differenza !== null && (
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px',fontSize:'9px',letterSpacing:'.08em',color:differenza>0?'#ff0040':'#4ade80'}}>
                      <span>{differenza>0?'SOTTOSTIMATO DI':'SOVRASTIMATO DI'}</span>
                      <span style={{fontWeight:700}}>{formatEur(Math.abs(differenza))}</span>
                    </div>
                  )}
                  {salvatoCorrente.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'4px'}}>{salvatoCorrente.note}</div>}
                </div>
              ) : (
                <div style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${editando?'rgba(0,255,255,0.2)':'rgba(0,255,255,0.08)'}`,borderRadius:'2px',padding:'10px'}}>
                  <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.65)',marginBottom:'10px'}}>
                    {editando?'MODIFICA_REALE_COMMERCIALISTA':'INSERISCI_REALE_COMMERCIALISTA'}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                    <div>
                      <label style={cpLabel}>IRPF mod.130 €</label>
                      <input type="number" min="0" step="0.01" placeholder="0,00" value={formReale.irpf}
                        onChange={e=>setFormReale(f=>({...f,irpf:e.target.value}))} style={cpInput} />
                    </div>
                    <div>
                      <label style={cpLabel}>IGIC mod.420 €</label>
                      <input type="number" min="0" step="0.01" placeholder="0,00" value={formReale.igic}
                        onChange={e=>setFormReale(f=>({...f,igic:e.target.value}))} style={cpInput} />
                    </div>
                  </div>
                  <input type="text" placeholder="Note (es. sanzione, interessi...)" value={formReale.note}
                    onChange={e=>setFormReale(f=>({...f,note:e.target.value}))} style={{...cpInput,marginBottom:'8px'}} />
                  <div style={{display:'flex',gap:'6px'}}>
                    {editando && (
                      <button onClick={()=>{setEditando(false);setFormReale({irpf:'',igic:'',note:''})}}
                        style={{flex:1,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer',letterSpacing:'.05em'}}>
                        [ANNULLA]
                      </button>
                    )}
                    <button onClick={handleSalvaReale} disabled={saving}
                      style={{flex:1,background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:saving?.4:1}}>
                      {saving?'[SALVO...]':'[SALVA]'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STORICO */}
            {storico.filter(r=>!(r.anno===annoCorrente&&r.trimestre===qCorrente)).length>0 && (
              <>
                <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.62)',marginBottom:'8px',marginTop:'4px'}}>STORICO</div>
                {storico.filter(r=>!(r.anno===annoCorrente&&r.trimestre===qCorrente)).map((r,i)=>{
                  const tot = (r.irpf_reale||0)+(r.igic_reale||0)
                  return (
                    <div key={r.id} style={{...cpCard,marginBottom:'6px',animation:`fadeUp .4s ease both ${i*0.05+0.2}s`}}>
                      <div style={cpTopLine} />
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                        <span style={{fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.75)'}}>T{r.trimestre}_{r.anno}</span>
                        <span style={{fontSize:'14px',fontWeight:700,color:'#e8e8f0',letterSpacing:'-1px'}}>{formatEur(tot)}</span>
                      </div>
                      <div style={{display:'flex',gap:'12px',fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>
                        <span>IRPF {formatEur(r.irpf_reale)}</span>
                        <span>IGIC {formatEur(r.igic_reale)}</span>
                      </div>
                      {r.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.55)',marginTop:'3px'}}>{r.note}</div>}
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
