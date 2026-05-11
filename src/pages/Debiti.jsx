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
  nome: '', importo_totale: '', importo_pagato: '', rata_mensile: '',
  giorno_addebito: '', data_prima_rata: '', data_fine: '',
  addebito_automatico: false, deducibile: false, igic_percentuale: '0',
  note: '', ha_piano: false, tipo_piano: 'fisse', piano_rate_var: [],
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
      const { data, error } = await supabase.from('debiti').select('*').order('posizione', { ascending: true })
      if (error) throw error
      setDebiti(data)
      data.forEach(d => loadRate(d.id))
    } catch (err) { console.error('Errore debiti:', err.message) }
  }

  async function loadRate(debitoId) {
    setLoadingRate(prev => ({ ...prev, [debitoId]: true }))
    try {
      const { data, error } = await supabase.from('rate_debito').select('*').eq('debito_id', debitoId).order('numero_rata')
      if (error) throw error
      setRate(prev => ({ ...prev, [debitoId]: data || [] }))
    } catch (err) { console.error('Errore caricamento rate:', err.message) }
    finally { setLoadingRate(prev => ({ ...prev, [debitoId]: false })) }
  }

  async function handleSave(e) {
    e.preventDefault()
    const isVarPlan = form.ha_piano && form.tipo_piano === 'variabili'
    if (!form.nome || !form.importo_totale || (!isVarPlan && !form.rata_mensile)) return
    setSaving(true)
    try {
      const { data: newDebito, error } = await supabase.from('debiti').insert({
        nome: form.nome.trim(),
        importo_totale: parseFloat(form.importo_totale || 0),
        importo_pagato: parseFloat(form.importo_pagato || 0),
        rata_mensile: isVarPlan ? 0 : parseFloat(form.rata_mensile),
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
          const { error: rateErr } = await supabase.from('rate_debito').insert(rateDaInserire.map(r => ({ ...r, debito_id: newDebito.id })))
          if (rateErr) throw rateErr
        }
      }

      setForm(EMPTY_FORM); setShowForm(false); loadDebiti()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSaving(false) }
  }

  function startEdit(debito) {
    setEditandoId(debito.id)
    setEditForm({
      nome: debito.nome || '', importo_totale: String(debito.importo_totale || ''),
      importo_pagato: String(debito.importo_pagato || '0'), rata_mensile: String(debito.rata_mensile || ''),
      giorno_addebito: debito.giorno_addebito ? String(debito.giorno_addebito) : '',
      data_prima_rata: debito.data_prima_rata || '', data_fine: debito.data_fine || '',
      addebito_automatico: debito.addebito_automatico || false,
      deducibile: debito.deducibile || false, igic_percentuale: String(debito.igic_percentuale ?? 0),
      note: debito.note || '', ha_piano: false, tipo_piano: 'fisse', piano_rate_var: [],
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
      setEditandoId(null); loadDebiti()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingEdit(false) }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('debiti').delete().eq('id', id)
      if (error) throw error
      loadDebiti()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  async function muoviDebito(id, direzione) {
    try {
      const idx = debiti.findIndex(d => d.id === id)
      if (idx === -1) return
      const targetIdx = direzione === 'su' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= debiti.length) return
      const d1 = debiti[idx]; const d2 = debiti[targetIdx]
      const [p1, p2] = [d1.posizione, d2.posizione]
      await supabase.from('debiti').update({ posizione: p2 }).eq('id', d1.id)
      await supabase.from('debiti').update({ posizione: p1 }).eq('id', d2.id)
      loadDebiti()
    } catch (err) { console.error('Errore movimento:', err.message) }
  }

  async function toggleRataPagata(rataId, debitoId, pagato) {
    try {
      const { error } = await supabase.from('rate_debito').update({ pagato: !pagato }).eq('id', rataId)
      if (error) throw error
      const { data: allRate } = await supabase.from('rate_debito').select('importo, pagato').eq('debito_id', debitoId)
      const importoPagato = (allRate || []).filter(r => r.id === rataId ? !pagato : r.pagato).reduce((s, r) => s + r.importo, 0)
      await supabase.from('debiti').update({ importo_pagato: importoPagato }).eq('id', debitoId)
      loadRate(debitoId); loadDebiti()
    } catch (err) { console.error('Errore aggiornamento rata:', err.message) }
  }

  function calcRatePagate(debito) {
    if (!debito.data_prima_rata || !debito.giorno_addebito) return debito.importo_pagato || 0
    const oggi = new Date()
    let ratePagate = 0
    let dataRata = new Date(debito.data_prima_rata + 'T00:00:00')
    dataRata.setDate(debito.giorno_addebito)
    while (dataRata <= oggi) { ratePagate++; dataRata.setMonth(dataRata.getMonth() + 1) }
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
  const meseCorrStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` })()
  const totaleRateMensili = debiti.reduce((s, d) => {
    const residuo = d.importo_totale - (d.importo_pagato || 0)
    if (residuo <= 0) return s
    const debitoRate = rate[d.id] || []
    if (debitoRate.length > 0) {
      return s + debitoRate.filter(r => r.data_scadenza?.startsWith(meseCorrStr)).reduce((ss, r) => ss + r.importo, 0)
    }
    return s + d.rata_mensile
  }, 0)

  const nRatePreview = form.importo_totale && form.rata_mensile
    ? Math.round(parseFloat(form.importo_totale) / parseFloat(form.rata_mensile)) : 0

  const cpCard = {background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'10px',position:'relative'}
  const cpLabel = {fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase',display:'block',marginBottom:'4px'}
  const cpInput = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
  const cpTopLine = {position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}

  function CampiBase({ f, setF }) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        <div><label style={cpLabel}>Nome debito</label><input type="text" value={f.nome} onChange={e=>setF(p=>({...p,nome:e.target.value}))} style={cpInput} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          <div><label style={cpLabel}>Importo totale €</label><input type="number" min="0" step="0.01" value={f.importo_totale} onChange={e=>setF(p=>({...p,importo_totale:e.target.value}))} style={cpInput} /></div>
          <div><label style={cpLabel}>Già pagato €</label><input type="number" min="0" step="0.01" value={f.importo_pagato} onChange={e=>setF(p=>({...p,importo_pagato:e.target.value}))} style={cpInput} /></div>
        </div>
        {!(f.ha_piano && f.tipo_piano === 'variabili') && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            <div><label style={cpLabel}>Rata mensile €</label><input type="number" min="0" step="0.01" value={f.rata_mensile} onChange={e=>setF(p=>({...p,rata_mensile:e.target.value}))} style={cpInput} /></div>
            <div><label style={cpLabel}>Giorno addebito</label><input type="number" min="1" max="31" value={f.giorno_addebito} onChange={e=>setF(p=>({...p,giorno_addebito:e.target.value}))} style={{...cpInput,textAlign:'center'}} /></div>
          </div>
        )}
        <div><label style={cpLabel}>Data prima rata</label><input type="date" value={f.data_prima_rata} onChange={e=>setF(p=>({...p,data_prima_rata:e.target.value}))} style={cpInput} />
          {f.data_prima_rata && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'3px'}}>{formatDate(f.data_prima_rata)}</div>}
        </div>
        <div><label style={cpLabel}>Data fine (opzionale)</label><input type="date" value={f.data_fine} onChange={e=>setF(p=>({...p,data_fine:e.target.value}))} style={cpInput} /></div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div onClick={()=>setF(p=>({...p,addebito_automatico:!p.addebito_automatico}))}
            style={{width:'32px',height:'18px',borderRadius:'9px',background:f.addebito_automatico?'rgba(0,255,255,0.2)':'rgba(255,255,255,0.08)',border:`1px solid ${f.addebito_automatico?'rgba(0,255,255,0.4)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
            <div style={{position:'absolute',top:'2px',left:f.addebito_automatico?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:f.addebito_automatico?'#00ffff':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
          </div>
          <span style={{fontSize:'10px',color:'rgba(255,255,255,0.75)'}}>Addebito automatico (domiciliato)</span>
        </div>
        <div style={{background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'10px',color:'#e8e8f0'}}>Deducibile per le tasse</div>
              <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)'}}>riduce il Mod 130 (IRPF)</div>
            </div>
            <div onClick={()=>setF(p=>({...p,deducibile:!p.deducibile}))}
              style={{width:'32px',height:'18px',borderRadius:'9px',background:f.deducibile?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',border:`1px solid ${f.deducibile?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
              <div style={{position:'absolute',top:'2px',left:f.deducibile?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:f.deducibile?'#4ade80':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
            </div>
          </div>
          {f.deducibile && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
              {[{val:'0',label:'IVA 0% IGIC',desc:'es. Adobe, renting auto'},{val:'7',label:'IGIC 7%',desc:'es. iPhone renting'}].map(opt=>(
                <button key={opt.val} type="button" onClick={()=>setF(p=>({...p,igic_percentuale:opt.val}))}
                  style={{background:'transparent',border:`1px solid ${f.igic_percentuale===opt.val?'rgba(0,255,255,0.5)':'rgba(0,255,255,0.15)'}`,borderRadius:'2px',color:f.igic_percentuale===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'8px 6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:700}}>{opt.label}</div>
                  <div style={{fontSize:'8px',opacity:.6}}>{opt.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div><label style={cpLabel}>Note</label><input type="text" value={f.note} onChange={e=>setF(p=>({...p,note:e.target.value}))} style={cpInput} /></div>
      </div>
    )
  }

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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'8px',marginBottom:'16px'}}>
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>DEBITI</span>
          <button onClick={()=>{setShowForm(s=>!s);setForm(EMPTY_FORM)}}
            style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'5px 10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
            {showForm ? '[CHIUDI]' : '[+ AGGIUNGI]'}
          </button>
        </div>

        {/* TOTALI */}
        {debiti.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px',animation:'fadeUp .4s ease both'}}>
            {[
              {label:'RESIDUO_TOTALE',val:totaleResiduo,color:'#ff0040',glow:'rgba(255,0,64,0.2)'},
              {label:'RATE_MENSILI',val:totaleRateMensili,color:'rgba(255,165,0,0.9)',glow:'rgba(255,165,0,0.15)'},
            ].map((r,i)=>(
              <div key={i} style={{...cpCard,marginBottom:0}}>
                <div style={cpTopLine} />
                <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(255,255,255,0.65)',marginBottom:'4px'}}>{r.label}</div>
                <div style={{fontSize:'18px',fontWeight:700,letterSpacing:'-1px',color:r.color,textShadow:`0 0 8px ${r.glow}`}}>{formatEur(r.val)}</div>
              </div>
            ))}
          </div>
        )}

        {/* FORM AGGIUNGI */}
        {showForm && (
          <form onSubmit={handleSave} style={{...cpCard,marginBottom:'14px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>NUOVO_DEBITO</div>
            <CampiBase f={form} setF={setForm} />

            <div style={{background:'rgba(0,100,255,0.04)',border:'1px solid rgba(0,100,255,0.15)',borderRadius:'2px',padding:'10px',marginTop:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'10px',color:'#e8e8f0'}}>Piano di pagamento</div>
                  <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)'}}>traccia ogni singola rata</div>
                </div>
                <div onClick={()=>setForm(p=>({...p,ha_piano:!p.ha_piano}))}
                  style={{width:'32px',height:'18px',borderRadius:'9px',background:form.ha_piano?'rgba(0,100,255,0.4)':'rgba(255,255,255,0.08)',border:`1px solid ${form.ha_piano?'rgba(0,100,255,0.6)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
                  <div style={{position:'absolute',top:'2px',left:form.ha_piano?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:form.ha_piano?'#6699ff':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
                </div>
              </div>

              {form.ha_piano && (
                <div style={{marginTop:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    {[{val:'fisse',label:'Rate fisse',desc:'stessa cifra ogni mese'},{val:'variabili',label:'Rate variabili',desc:'importi diversi (es. con interessi)'}].map(opt=>(
                      <button key={opt.val} type="button" onClick={()=>setForm(p=>({...p,tipo_piano:opt.val}))}
                        style={{background:'transparent',border:`1px solid ${form.tipo_piano===opt.val?'rgba(0,100,255,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:'2px',color:form.tipo_piano===opt.val?'#6699ff':'rgba(255,255,255,0.3)',padding:'8px 6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer',textAlign:'left'}}>
                        <div style={{fontWeight:700}}>{opt.label}</div>
                        <div style={{fontSize:'8px',opacity:.6}}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {form.tipo_piano === 'fisse' && (
                    <div style={{background:'rgba(0,100,255,0.04)',border:'1px solid rgba(0,100,255,0.1)',borderRadius:'2px',padding:'8px 10px',fontSize:'10px'}}>
                      {nRatePreview > 0 && form.data_prima_rata ? (
                        <span style={{color:'rgba(102,153,255,0.8)'}}>Genera <strong>{nRatePreview} rate</strong> da {formatDate(form.data_prima_rata)} · {formatEur(parseFloat(form.rata_mensile||0))}/mese</span>
                      ) : (
                        <span style={{color:'rgba(255,255,255,0.6)'}}>Inserisci importo totale, rata e data prima rata</span>
                      )}
                    </div>
                  )}

                  {form.tipo_piano === 'variabili' && (
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)',letterSpacing:'.05em'}}>Inserisci ogni rata con data e importo:</div>
                      {form.piano_rate_var.map((r,idx)=>(
                        <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 80px 24px',gap:'4px',alignItems:'center'}}>
                          <input type="date" value={r.data_scadenza}
                            onChange={e=>setForm(p=>({...p,piano_rate_var:p.piano_rate_var.map((x,i)=>i===idx?{...x,data_scadenza:e.target.value}:x)}))}
                            style={{...cpInput,padding:'6px 8px',fontSize:'11px'}} />
                          <input type="number" min="0" step="0.01" placeholder="EUR" value={r.importo}
                            onChange={e=>setForm(p=>({...p,piano_rate_var:p.piano_rate_var.map((x,i)=>i===idx?{...x,importo:e.target.value}:x)}))}
                            style={{...cpInput,padding:'6px 8px',fontSize:'11px',textAlign:'center'}} />
                          <button type="button"
                            onClick={()=>setForm(p=>({...p,piano_rate_var:p.piano_rate_var.filter((_,i)=>i!==idx)}))}
                            style={{background:'none',border:'none',color:'rgba(255,0,64,0.5)',fontSize:'14px',cursor:'pointer',lineHeight:1,fontFamily:'monospace'}}>×</button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={()=>setForm(p=>({...p,piano_rate_var:[...p.piano_rate_var,{data_scadenza:'',importo:''}]}))}
                        style={{background:'transparent',border:'1px dashed rgba(0,100,255,0.25)',borderRadius:'2px',color:'rgba(102,153,255,0.6)',padding:'7px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
                        [+ AGGIUNGI_RATA]
                      </button>
                      {form.piano_rate_var.length > 0 && (
                        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)'}}>{form.piano_rate_var.filter(r=>r.data_scadenza&&r.importo).length} rate inserite</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="submit" disabled={saving||!form.nome||!form.importo_totale||(!(form.ha_piano&&form.tipo_piano==='variabili')&&!form.rata_mensile)}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(255,0,64,0.3)',borderRadius:'2px',color:'#ff0040',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',marginTop:'10px',opacity:(saving||!form.nome||!form.importo_totale||(!(form.ha_piano&&form.tipo_piano==='variabili')&&!form.rata_mensile))?.4:1}}>
              {saving ? '[SALVO...]' : '[AGGIUNGI_DEBITO]'}
            </button>
          </form>
        )}

        {debiti.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'30px 0',fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.6)'}}>NESSUN_DEBITO_REGISTRATO</div>
        )}

        {/* LISTA DEBITI */}
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {debiti.map((debito,i)=>{
            const debitoRate = rate[debito.id] || []
            const importoPagato = debitoRate.length > 0 ? calcImportoPagatoRate(debitoRate) : calcRatePagate(debito)
            const residuo = Math.max(0, debito.importo_totale - importoPagato)
            const percentuale = debito.importo_totale > 0 ? Math.min(100, (importoPagato / debito.importo_totale) * 100) : 0
            const rateEseguite = debitoRate.length > 0 ? debitoRate.filter(r=>r.pagato).length : Math.floor(importoPagato / (debito.rata_mensile || 1))
            const rateTotali = debitoRate.length > 0 ? debitoRate.length : Math.ceil(debito.importo_totale / (debito.rata_mensile || 1))
            const estinto = residuo <= 0
            const extraSimula = parseFloat(simula[debito.id] || 0)
            const staModificando = editandoId === debito.id
            const hasPiano = debitoRate.length > 0
            const isExpanded = expandedDebito === debito.id
            const isLoading = loadingRate[debito.id]
            const ratePerMese = hasPiano ? groupRateByMonth(debitoRate) : []
            const prossimata = debitoRate.find(r=>!r.pagato)

            return (
              <div key={debito.id} style={{...cpCard,marginBottom:0,animation:`fadeUp .4s ease both ${i*0.2}s`,border:estinto?'1px solid rgba(74,222,128,0.2)':'1px solid rgba(0,255,255,0.15)',background:estinto?'rgba(74,222,128,0.03)':'#0e0e18'}}>
                <div style={cpTopLine} />

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#e8e8f0',letterSpacing:'.05em'}}>{debito.nome}</div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'3px'}}>
                      {debito.deducibile && !staModificando && (
                        <span style={{fontSize:'7px',letterSpacing:'.1em',color:'rgba(74,222,128,0.7)',border:'1px solid rgba(74,222,128,0.2)',padding:'1px 6px',borderRadius:'2px'}}>DED{debito.igic_percentuale>0?` IGIC${debito.igic_percentuale}%`:' IVA'}</span>
                      )}
                      {!debito.deducibile && !staModificando && (
                        <span style={{fontSize:'7px',letterSpacing:'.1em',color:'rgba(255,165,0,0.8)',border:'1px solid rgba(255,165,0,0.15)',padding:'1px 6px',borderRadius:'2px'}}>NON_DED</span>
                      )}
                    </div>
                    {debito.note && !staModificando && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'3px'}}>{debito.note}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'10px',flexShrink:0}}>
                    {estinto
                      ? <span style={{fontSize:'9px',letterSpacing:'.1em',color:'rgba(74,222,128,0.7)',border:'1px solid rgba(74,222,128,0.2)',padding:'3px 7px',borderRadius:'2px'}}>ESTINTO</span>
                      : <span style={{fontSize:'16px',fontWeight:700,color:'#ff0040',textShadow:'0 0 6px rgba(255,0,64,0.2)',letterSpacing:'-0.5px'}}>{formatEur(residuo)}</span>
                    }
                    <div style={{display:'flex',gap:'3px'}}>
                      <button onClick={()=>muoviDebito(debito.id,'su')} disabled={debiti.findIndex(d=>d.id===debito.id)===0}
                        style={{background:'none',border:'none',color:'rgba(0,255,255,0.65)',fontSize:'12px',cursor:'pointer',padding:'2px',opacity:debiti.findIndex(d=>d.id===debito.id)===0?.3:1}}>↑</button>
                      <button onClick={()=>muoviDebito(debito.id,'giu')} disabled={debiti.findIndex(d=>d.id===debito.id)===debiti.length-1}
                        style={{background:'none',border:'none',color:'rgba(0,255,255,0.65)',fontSize:'12px',cursor:'pointer',padding:'2px',opacity:debiti.findIndex(d=>d.id===debito.id)===debiti.length-1?.3:1}}>↓</button>
                      <button onClick={()=>staModificando?setEditandoId(null):startEdit(debito)}
                        style={{background:'transparent',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',color:'rgba(0,255,255,0.75)',fontSize:'8px',letterSpacing:'.08em',fontFamily:"'Courier New',monospace",padding:'3px 7px',cursor:'pointer'}}>
                        {staModificando ? 'ANNULLA' : 'MOD'}
                      </button>
                    </div>
                  </div>
                </div>

                {staModificando ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    <CampiBase f={editForm} setF={setEditForm} />
                    <button onClick={()=>handleSaveEdit(debito.id)} disabled={savingEdit}
                      style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:savingEdit?.4:1}}>
                      {savingEdit ? '[SALVO...]' : '[SALVA_MODIFICHE]'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* BARRA PROGRESSO */}
                    <div style={{marginBottom:'8px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'8px',color:'rgba(255,255,255,0.6)',marginBottom:'4px',letterSpacing:'.05em'}}>
                        <span>{rateEseguite} rate su {rateTotali}</span>
                        <span>{formatEur(importoPagato)} / {formatEur(debito.importo_totale)}</span>
                      </div>
                      <div style={{width:'100%',background:'rgba(255,255,255,0.05)',borderRadius:'1px',height:'4px'}}>
                        <div style={{height:'4px',borderRadius:'1px',background:estinto?'#4ade80':'#ff0040',width:`${percentuale}%`,transition:'width .5s',boxShadow:estinto?'0 0 6px rgba(74,222,128,0.4)':'0 0 6px rgba(255,0,64,0.3)'}} />
                      </div>
                      <div style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',textAlign:'right',marginTop:'2px',letterSpacing:'.05em'}}>{percentuale.toFixed(0)}% pagato</div>
                    </div>

                    {/* INFO RATA */}
                    {!estinto && (
                      <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:'2px',padding:'8px 10px',marginBottom:'8px',display:'flex',flexWrap:'wrap',gap:'10px',fontSize:'10px',color:'rgba(255,255,255,0.7)'}}>
                        {hasPiano && prossimata ? (
                          <>
                            <span>Prossima: <strong style={{color:'#e8e8f0'}}>{formatDate(prossimata.data_scadenza)}</strong></span>
                            <span style={{fontWeight:700,color:'rgba(255,165,0,0.8)'}}>{formatEur(prossimata.importo)}</span>
                          </>
                        ) : (
                          <>
                            <span>Rata: <strong style={{color:'#e8e8f0'}}>{formatEur(debito.rata_mensile)}/mese</strong></span>
                            {debito.giorno_addebito && <span>Giorno: <strong style={{color:'#e8e8f0'}}>{debito.giorno_addebito}</strong></span>}
                          </>
                        )}
                        {debito.addebito_automatico && <span style={{color:'rgba(0,255,255,0.75)',letterSpacing:'.05em'}}>DOM</span>}
                      </div>
                    )}

                    {/* PIANO RATE */}
                    {hasPiano && (
                      <button onClick={()=>setExpandedDebito(isExpanded?null:debito.id)}
                        style={{width:'100%',background:'rgba(0,100,255,0.04)',border:'1px solid rgba(0,100,255,0.1)',borderRadius:'2px',padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontFamily:"'Courier New',monospace",marginBottom:'6px'}}>
                        <span style={{fontSize:'9px',letterSpacing:'.1em',color:'rgba(102,153,255,0.7)'}}>{isExpanded?'▼':' ►'} PIANO_PAGAMENTO ({rateTotali} rate)</span>
                        <span style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>{rateEseguite}/{rateTotali}</span>
                      </button>
                    )}

                    {hasPiano && isExpanded && (
                      <div style={{background:'rgba(0,0,0,0.5)',border:'1px solid rgba(0,100,255,0.1)',borderRadius:'2px',padding:'8px',marginBottom:'8px',maxHeight:'300px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px'}}>
                        {isLoading ? (
                          <div style={{fontSize:'9px',color:'rgba(0,255,255,0.65)',textAlign:'center',padding:'10px',letterSpacing:'.1em'}}>CARICAMENTO...</div>
                        ) : ratePerMese.map(mese=>(
                          <div key={mese.displayKey}>
                            <button onClick={()=>setExpandedMesi(prev=>({...prev,[debito.id+mese.displayKey]:!prev[debito.id+mese.displayKey]}))}
                              style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 4px',cursor:'pointer',fontFamily:"'Courier New',monospace"}}>
                              <span style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'10px',color:'rgba(255,255,255,0.75)',fontWeight:700}}>
                                <span style={{color:'rgba(0,255,255,0.65)'}}>{expandedMesi[debito.id+mese.displayKey]?'▼':'►'}</span>
                                {mese.displayKey}
                              </span>
                              <span style={{fontSize:'9px',color:mese.rate.every(r=>r.pagato)?'rgba(74,222,128,0.6)':'rgba(255,255,255,0.3)'}}>
                                {formatEur(mese.rate.reduce((s,r)=>s+r.importo,0))}{mese.rate.every(r=>r.pagato)?' ✓':''}
                              </span>
                            </button>
                            <div style={{display:expandedMesi[debito.id+mese.displayKey]?'flex':'none',flexDirection:'column',gap:'5px',paddingLeft:'14px',paddingTop:'4px'}}>
                              {mese.rate.map(r=>(
                                <div key={r.id} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'10px'}}>
                                  <input type="checkbox" checked={r.pagato||false} onChange={()=>toggleRataPagata(r.id,debito.id,r.pagato)} style={{width:'14px',height:'14px',cursor:'pointer',accentColor:'#4ade80'}} />
                                  <span style={{flex:1,color:'rgba(255,255,255,0.7)'}}>{formatDate(r.data_scadenza)}</span>
                                  <span style={{fontWeight:700,color:r.pagato?'rgba(74,222,128,0.6)':'rgba(255,165,0,0.8)',textDecoration:r.pagato?'line-through':'none'}}>{formatEur(r.importo)}</span>
                                  <span style={{color:'rgba(255,255,255,0.55)',fontSize:'9px'}}>#{r.numero_rata}/{rateTotali}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SIMULATORE */}
                    {!hasPiano && !estinto && (
                      <div style={{border:'1px dashed rgba(0,255,255,0.1)',borderRadius:'2px',padding:'10px',marginBottom:'8px'}}>
                        <div style={{fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.65)',marginBottom:'8px'}}>SIMULATORE_ANTICIPO</div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span style={{fontSize:'10px',color:'rgba(255,255,255,0.65)',whiteSpace:'nowrap'}}>Se aggiungo EUR</span>
                          <input type="number" min="0" step="10" placeholder="0" value={simula[debito.id]||''}
                            onChange={e=>setSimula(s=>({...s,[debito.id]:e.target.value}))}
                            style={{width:'70px',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'5px 8px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',textAlign:'center'}} />
                          <span style={{fontSize:'10px',color:'rgba(255,255,255,0.65)',whiteSpace:'nowrap'}}>extra/mese</span>
                        </div>
                        {extraSimula > 0 && (
                          <div style={{fontSize:'10px',color:'rgba(74,222,128,0.7)',marginTop:'6px',fontWeight:700}}>
                            Finisci in {calcMesiRimanenti(debito,extraSimula)} mesi ({calcDataFine(debito,extraSimula)})
                            <span style={{color:'rgba(255,255,255,0.65)',fontWeight:400}}> invece di {calcMesiRimanenti(debito)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:'6px'}}>
                      <button onClick={()=>handleDelete(debito.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>ELIMINA</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
