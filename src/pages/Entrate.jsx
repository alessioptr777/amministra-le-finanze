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
  cash_dichiarato: '',
  importo_card: '',
  igic_percentuale: '7',
  note: '',
  dichiara: true,
}

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function meseCorrente() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMese(ym) {
  const [y, m] = ym.split('-')
  return `${MESI[parseInt(m) - 1]} ${y}`
}

function prevMese(ym) {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextMese(ym) {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
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
  const [filtroMese, setFiltroMese] = useState(meseCorrente())
  const [filtroAttivita, setFiltroAttivita] = useState('tutte')
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [versamenti, setVersamenti] = useState([])
  const [showVersamenti, setShowVersamenti] = useState(false)
  const [versForm, setVersForm] = useState({ data: new Date().toISOString().slice(0, 10), importo: '', igic_percentuale: '7', note: '' })
  const [savingVers, setSavingVers] = useState(false)

  function p(v) { return parseFloat(String(v || '').replace(',', '.')) || 0 }
  const lordo = p(form.importo_cash) + p(form.importo_card)
  const lordoDichiarato = p(form.cash_dichiarato) + p(form.importo_card)
  const igicPerc = parseFloat(form.igic_percentuale) || 0
  const imponibile = igicPerc > 0 ? lordoDichiarato / (1 + igicPerc / 100) : lordoDichiarato
  const igicImporto = lordoDichiarato - imponibile

  useEffect(() => {
    loadAttivita().then(att => { if (!att || att.length === 0) initializeDefaultAttivita() })
    loadEntrate()
    loadVersamenti()
  }, [])

  async function initializeDefaultAttivita() {
    try {
      const { error } = await supabase.from('attivita').insert(DEFAULT_ATTIVITA)
      if (!error) loadAttivita()
    } catch (err) { console.error('Errore init attività:', err.message) }
  }

  async function loadAttivita() {
    setLoadingAttivita(true)
    try {
      const { data, error } = await supabase.from('attivita').select('*').order('created_at')
      if (error) throw error
      setAttivita(data)
      return data
    } catch (err) { console.error('Errore attività:', err.message); return null }
    finally { setLoadingAttivita(false) }
  }

  async function loadEntrate() {
    try {
      const { data, error } = await supabase.from('entrate').select('*').order('data', { ascending: false })
      if (error) throw error
      setEntrate(data)
    } catch (err) { console.error('Errore entrate:', err.message) }
  }

  async function loadVersamenti() {
    try {
      const { data, error } = await supabase.from('versamenti').select('*').order('data', { ascending: false })
      if (error) throw error
      setVersamenti(data || [])
    } catch (err) { console.error('Errore versamenti:', err.message) }
  }

  async function handleSaveVersamento(e) {
    e.preventDefault()
    if (!versForm.importo) return
    setSavingVers(true)
    try {
      const { error } = await supabase.from('versamenti').insert({
        data: versForm.data,
        importo: parseFloat(String(versForm.importo).replace(',', '.')),
        igic_percentuale: parseFloat(versForm.igic_percentuale) || 0,
        note: versForm.note,
      })
      if (error) throw error
      setVersForm({ data: new Date().toISOString().slice(0, 10), importo: '', igic_percentuale: '7', note: '' })
      loadVersamenti()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingVers(false) }
  }

  async function handleDeleteVersamento(id) {
    try {
      const { error } = await supabase.from('versamenti').delete().eq('id', id)
      if (error) throw error
      loadVersamenti()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.attivita_id || lordo === 0) return
    setSaving(true)
    try {
      const att = attivita.find(a => a.id === form.attivita_id)
      const { error } = await supabase.from('entrate').insert([{
        data: form.data,
        attivita_id: form.attivita_id,
        attivita_nome: att?.nome || '',
        attivita_colore: att?.colore || '',
        importo_cash: p(form.importo_cash),
        importo_card: p(form.importo_card),
        importo_lordo: lordo,
        cash_dichiarato: p(form.cash_dichiarato),
        importo_netto: imponibile,
        igic_percentuale: igicPerc,
        note: form.note,
        dichiara: form.dichiara,
      }])
      if (error) throw error
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadEntrate()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSaving(false) }
  }

  function startEdit(e) {
    setEditandoId(e.id)
    setEditForm({
      data: e.data || new Date().toISOString().slice(0, 10),
      attivita_id: e.attivita_id || '',
      importo_cash: String(e.importo_cash || ''),
      cash_dichiarato: String(e.cash_dichiarato || ''),
      importo_card: String(e.importo_card || ''),
      igic_percentuale: String(e.igic_percentuale ?? 7),
      note: e.note || '',
      dichiara: e.dichiara !== false,
    })
  }

  async function handleSaveEdit(id) {
    function pe(v) { return parseFloat(String(v || '').replace(',', '.')) || 0 }
    const cash = pe(editForm.importo_cash)
    const cashDich = pe(editForm.cash_dichiarato)
    const card = pe(editForm.importo_card)
    const totale = cash + card
    const igicP = parseFloat(editForm.igic_percentuale) || 0
    const lordoDich = cashDich + card
    const imp = igicP > 0 ? lordoDich / (1 + igicP / 100) : lordoDich
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
        cash_dichiarato: cashDich,
        importo_netto: imp,
        igic_percentuale: igicP,
        note: editForm.note,
        dichiara: editForm.dichiara,
      }).eq('id', id)
      if (error) throw error
      setEditandoId(null)
      loadEntrate()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingEdit(false) }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('entrate').delete().eq('id', id)
      if (error) throw error
      loadEntrate()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  async function handleDeleteAttivita(id) {
    try {
      const { error } = await supabase.from('attivita').delete().eq('id', id)
      if (error) throw error
      loadAttivita()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  async function handleReset() {
    try {
      await supabase.from('attivita').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await supabase.from('attivita').insert(DEFAULT_ATTIVITA)
      if (error) throw error
      loadAttivita()
    } catch (err) { alert('Errore reset: ' + err.message) }
  }

  async function handleSaveNuova() {
    if (!nuova.nome.trim()) return
    setSavingNuova(true)
    try {
      const { error } = await supabase.from('attivita').insert({
        nome: nuova.nome.trim(), tipo: 'propria', epigrafe: nuova.epigrafe,
        commissione_percentuale_default: 0, colore: '#6366f1', attiva: true,
      })
      if (error) throw error
      setNuova(EMPTY_NUOVA)
      setShowNuova(false)
      loadAttivita()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingNuova(false) }
  }

  const entrateMese = entrate.filter(e => e.data && e.data.startsWith(filtroMese))
  const entrateFiltrate = filtroAttivita === 'tutte' ? entrateMese : entrateMese.filter(e => e.attivita_id === filtroAttivita)
  const totaleCash = entrateFiltrate.reduce((s, e) => s + (e.importo_cash || 0), 0)
  const totaleCard = entrateFiltrate.reduce((s, e) => s + (e.importo_card || 0), 0)
  const totale = totaleCash + totaleCard
  const totaleComplessivo = entrate.reduce((s, e) => s + (e.importo_cash || 0) + (e.importo_card || 0), 0)

  const cpCard = {background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'10px',position:'relative'}
  const cpLabel = {fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase',display:'block',marginBottom:'4px'}
  const cpInput = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
  const cpSelect = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
  const cpTopLine = {position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}

  return (
    <div style={{background:'#000',minHeight:'100vh',fontFamily:"'Courier New',monospace",paddingBottom:'80px',position:'relative'}}>
      <style>{`
        @keyframes scanline2{0%{top:-5%}100%{top:105%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes borderFlow{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @media(min-width:768px){.page-wrap{max-width:1100px!important;padding:24px 40px 40px!important}.page-grid{display:grid;grid-template-columns:400px 1fr;gap:28px;align-items:start}}
      `}</style>
      <div style={{position:'fixed',left:0,right:0,height:'3px',background:'rgba(0,255,255,0.03)',zIndex:10,pointerEvents:'none',animation:'scanline2 24s linear infinite'}} />

      <div className="page-wrap" style={{maxWidth:'390px',margin:'0 auto',padding:'16px 14px 24px',position:'relative',zIndex:2}}>

        {/* TOP BAR */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'8px',marginBottom:'16px'}}>
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>ENTRATE</span>
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={()=>{setShowPanel(s=>!s);setShowForm(false)}}
              style={{background:'transparent',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',color:'rgba(0,255,255,0.75)',padding:'5px 8px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
              [ATTIVITÀ]
            </button>
            <button onClick={()=>{setShowForm(s=>!s);setShowPanel(false)}}
              style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'5px 10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
              {showForm ? '[CHIUDI]' : '[+ AGGIUNGI]'}
            </button>
          </div>
        </div>

        <div className="page-grid">
        <div className="page-col">

        {/* TOTALE COMPLESSIVO */}
        <div style={{...cpCard,marginBottom:'10px'}}>
          <div style={cpTopLine} />
          <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(255,255,255,0.65)',marginBottom:'4px'}}>TOTALE_DAL_01/04/2026</div>
          <div style={{fontSize:'20px',fontWeight:700,color:'#4ade80',textShadow:'0 0 8px rgba(74,222,128,0.2)',letterSpacing:'-1px'}}>{formatEur(totaleComplessivo)}</div>
        </div>

        {/* VERSAMENTI COLLASSABILE */}
        <div style={{...cpCard,marginBottom:'10px',border:'1px solid rgba(255,215,0,0.4)',boxShadow:'0 0 12px rgba(255,215,0,0.06)'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#ffd700,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}} />
          <button onClick={()=>setShowVersamenti(s=>!s)} style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'9px',letterSpacing:'.15em',color:'rgba(255,215,0,0.7)',fontFamily:"'Courier New',monospace"}}>VERSAMENTI_BANCA</span>
              {versamenti.length > 0 && <span style={{fontSize:'8px',color:'rgba(255,215,0,0.75)',border:'1px solid rgba(255,215,0,0.2)',borderRadius:'2px',padding:'1px 5px'}}>{versamenti.length}</span>}
            </div>
            <span style={{fontSize:'9px',color:'rgba(0,255,255,0.7)'}}>{showVersamenti ? '▲' : '▼'}</span>
          </button>

          {showVersamenti && (
            <div style={{marginTop:'12px',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'12px'}}>
              <form onSubmit={handleSaveVersamento} style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <div><label style={cpLabel}>Data</label><input type="date" value={versForm.data} onChange={e=>setVersForm(f=>({...f,data:e.target.value}))} style={cpInput} /></div>
                  <div><label style={cpLabel}>Importo lordo €</label><input type="text" inputMode="decimal" placeholder="0,00" value={versForm.importo} onChange={e=>setVersForm(f=>({...f,importo:e.target.value}))} style={cpInput} /></div>
                </div>
                <div>
                  <label style={cpLabel}>IGIC inclusa</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    {[{val:'7',label:'7% standard'},{val:'0',label:'0% esente'}].map(opt=>(
                      <button key={opt.val} type="button" onClick={()=>setVersForm(f=>({...f,igic_percentuale:opt.val}))}
                        style={{background:'transparent',border:`1px solid ${versForm.igic_percentuale===opt.val?'rgba(255,215,0,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:'2px',color:versForm.igic_percentuale===opt.val?'#ffd700':'rgba(255,255,255,0.3)',padding:'6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {versForm.importo && parseFloat(String(versForm.importo).replace(',','.')) > 0 && (()=>{
                  const imp = parseFloat(String(versForm.importo).replace(',','.'))
                  const perc = parseFloat(versForm.igic_percentuale) || 0
                  const imponibileV = perc > 0 ? imp / (1 + perc/100) : imp
                  const igicV = imp - imponibileV
                  return (
                    <div style={{background:'rgba(255,215,0,0.04)',border:'1px solid rgba(255,215,0,0.1)',borderRadius:'2px',padding:'8px 10px',fontSize:'10px',display:'flex',flexDirection:'column',gap:'4px'}}>
                      {perc > 0 && <div style={{display:'flex',justifyContent:'space-between',color:'rgba(255,255,255,0.65)'}}><span>IGIC {perc}%</span><span>−{formatEur(igicV)}</span></div>}
                      <div style={{display:'flex',justifyContent:'space-between',color:'#ffd700',fontWeight:700}}><span>Imponibile Mod 130</span><span>{formatEur(imponibileV)}</span></div>
                    </div>
                  )
                })()}
                <input type="text" placeholder="Note (opzionale)" value={versForm.note} onChange={e=>setVersForm(f=>({...f,note:e.target.value}))} style={cpInput} />
                <button type="submit" disabled={savingVers||!versForm.importo}
                  style={{background:'transparent',border:'1px solid rgba(255,215,0,0.3)',borderRadius:'2px',color:'#ffd700',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(!versForm.importo||savingVers)?.4:1}}>
                  {savingVers ? '[SALVO...]' : '[+ VERSA_IN_BANCA]'}
                </button>
              </form>

              {versamenti.length > 0 && (
                <div style={{marginTop:'10px',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'10px',display:'flex',flexDirection:'column',gap:'6px'}}>
                  {versamenti.map(v=>(
                    <div key={v.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.03)',paddingBottom:'5px'}}>
                      <div>
                        <div style={{fontSize:'10px',color:'#e8e8f0'}}>{formatData(v.data)}</div>
                        {v.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)'}}>{v.note}</div>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontSize:'13px',fontWeight:700,color:'#ffd700'}}>{formatEur(v.importo)}</span>
                        <button onClick={()=>handleDeleteVersamento(v.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',fontFamily:"'Courier New',monospace"}}>ELIMINA</button>
                      </div>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',fontWeight:700,color:'rgba(255,215,0,0.7)',paddingTop:'4px'}}>
                    <span>TOTALE_VERSATO</span>
                    <span>{formatEur(versamenti.reduce((s,v)=>s+v.importo,0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANNELLO ATTIVITÀ */}
        {showPanel && (
          <div style={{...cpCard,marginBottom:'10px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <span style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>LE_TUE_ATTIVITÀ</span>
              <button onClick={handleReset} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',fontFamily:"'Courier New',monospace"}}>RESET</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'10px'}}>
              {loadingAttivita && <div style={{fontSize:'9px',color:'rgba(0,255,255,0.65)',letterSpacing:'.1em'}}>CARICAMENTO...</div>}
              {attivita.map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',paddingBottom:'5px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:a.colore,flexShrink:0,display:'block'}} />
                    <span style={{fontSize:'11px',color:'#e8e8f0'}}>{a.nome}</span>
                  </div>
                  <button onClick={()=>handleDeleteAttivita(a.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'14px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>×</button>
                </div>
              ))}
            </div>
            {showNuova ? (
              <div style={{display:'flex',flexDirection:'column',gap:'8px',background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.1)',borderRadius:'2px',padding:'10px'}}>
                <input type="text" placeholder="Nome attività" value={nuova.nome} onChange={e=>setNuova(f=>({...f,nome:e.target.value}))} autoFocus style={cpInput} />
                <select value={nuova.epigrafe} onChange={e=>setNuova(f=>({...f,epigrafe:e.target.value}))} style={cpSelect}>
                  <option value="actividades">Tour / Escursioni</option>
                  <option value="fotografo">Fotografia</option>
                  <option value="altro">Altro</option>
                </select>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                  <button type="button" onClick={()=>setShowNuova(false)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>[ANNULLA]</button>
                  <button type="button" onClick={handleSaveNuova} disabled={savingNuova||!nuova.nome.trim()} style={{background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'8px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer',opacity:(!nuova.nome.trim()||savingNuova)?.4:1}}>{savingNuova?'[SALVO...]':'[CREA]'}</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowNuova(true)} style={{width:'100%',background:'transparent',border:'1px dashed rgba(0,255,255,0.2)',borderRadius:'2px',color:'rgba(0,255,255,0.7)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
                [+ NUOVA_ATTIVITÀ]
              </button>
            )}
          </div>
        )}

        </div>{/* /page-col left */}
        <div className="page-col">

        {/* NAV MESE */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0e0e18',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'8px 12px',marginBottom:'10px'}}>
          <button onClick={()=>setFiltroMese(prevMese(filtroMese))} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'16px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>‹</button>
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.1em',color:'rgba(0,255,255,0.7)'}}>{labelMese(filtroMese).toUpperCase()}</span>
          <button onClick={()=>setFiltroMese(nextMese(filtroMese))} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'16px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>›</button>
        </div>

        {/* FILTRO ATTIVITÀ */}
        {attivita.length > 0 && (
          <div style={{display:'flex',gap:'5px',overflowX:'auto',paddingBottom:'4px',marginBottom:'10px'}}>
            <button onClick={()=>setFiltroAttivita('tutte')}
              style={{flexShrink:0,padding:'4px 10px',borderRadius:'2px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',border:`1px solid ${filtroAttivita==='tutte'?'rgba(0,255,255,0.5)':'rgba(255,255,255,0.1)'}`,background:filtroAttivita==='tutte'?'rgba(0,255,255,0.08)':'transparent',color:filtroAttivita==='tutte'?'#00ffff':'rgba(255,255,255,0.3)'}}>
              TUTTE
            </button>
            {attivita.filter(a=>a.attiva).map(a=>(
              <button key={a.id} onClick={()=>setFiltroAttivita(a.id)}
                style={{flexShrink:0,padding:'4px 10px',borderRadius:'2px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.05em',cursor:'pointer',border:`1px solid ${filtroAttivita===a.id?a.colore:'rgba(255,255,255,0.1)'}`,background:filtroAttivita===a.id?a.colore+'22':'transparent',color:filtroAttivita===a.id?a.colore:'rgba(255,255,255,0.3)'}}>
                {a.nome}
              </button>
            ))}
          </div>
        )}

        {/* STAT MESE */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px',marginBottom:'10px'}}>
          {[
            {label:labelMese(filtroMese).toUpperCase(),val:totale,color:'#4ade80',glow:'rgba(74,222,128,0.2)'},
            {label:'CASH',val:totaleCash,color:'#e8e8f0',glow:''},
            {label:'CARD',val:totaleCard,color:'rgba(0,255,255,0.8)',glow:''},
          ].map((r,i)=>(
            <div key={i} style={{...cpCard,marginBottom:0}}>
              <div style={cpTopLine} />
              <div style={{fontSize:'7px',letterSpacing:'.1em',color:'rgba(255,255,255,0.65)',marginBottom:'3px'}}>{r.label}</div>
              <div style={{fontSize:'14px',fontWeight:700,color:r.color,textShadow:r.glow?`0 0 6px ${r.glow}`:'none',letterSpacing:'-0.5px'}}>{formatEur(r.val)}</div>
            </div>
          ))}
        </div>

        {/* FORM AGGIUNGI */}
        {showForm && (
          <form onSubmit={handleSave} style={{...cpCard,marginBottom:'12px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>NUOVA_ENTRATA</div>

            <div style={{marginBottom:'8px'}}><label style={cpLabel}>Data</label><input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={cpInput} /></div>

            <div style={{marginBottom:'8px'}}>
              <label style={cpLabel}>Attività</label>
              <select value={form.attivita_id} onChange={e=>setForm(f=>({...f,attivita_id:e.target.value}))} required style={cpSelect}>
                <option value="">Seleziona...</option>
                {attivita.filter(a=>a.attiva).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
              <div><label style={cpLabel}>Cash totale €</label><input type="text" inputMode="decimal" placeholder="0,00" value={form.importo_cash} onChange={e=>setForm(f=>({...f,importo_cash:e.target.value}))} style={cpInput} /></div>
              <div><label style={cpLabel}>Card €</label><input type="text" inputMode="decimal" placeholder="0,00" value={form.importo_card} onChange={e=>setForm(f=>({...f,importo_card:e.target.value}))} style={cpInput} /></div>
            </div>

            <div style={{marginBottom:'8px'}}><label style={cpLabel}>Cash dichiarato € (quello che versi in banca)</label><input type="text" inputMode="decimal" placeholder="0,00" value={form.cash_dichiarato} onChange={e=>setForm(f=>({...f,cash_dichiarato:e.target.value}))} style={cpInput} /></div>

            <div style={{marginBottom:'8px'}}>
              <label style={cpLabel}>IGIC inclusa</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                {[{val:'0',label:'0% esente'},{val:'7',label:'7% standard'}].map(opt=>(
                  <button key={opt.val} type="button" onClick={()=>setForm(f=>({...f,igic_percentuale:opt.val}))}
                    style={{background:'transparent',border:`1px solid ${form.igic_percentuale===opt.val?'rgba(0,255,255,0.5)':'rgba(0,255,255,0.15)'}`,borderRadius:'2px',color:form.igic_percentuale===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {lordo > 0 && (
              <div style={{background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.1)',borderRadius:'2px',padding:'8px 10px',marginBottom:'8px',fontSize:'10px',display:'flex',flexDirection:'column',gap:'4px'}}>
                <div style={{display:'flex',justifyContent:'space-between',color:'rgba(255,255,255,0.65)'}}><span>Lordo</span><span>{formatEur(lordo)}</span></div>
                {igicPerc > 0 && <div style={{display:'flex',justifyContent:'space-between',color:'rgba(255,255,255,0.65)'}}><span>IGIC {igicPerc}%</span><span>−{formatEur(igicImporto)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',color:'#4ade80',fontWeight:700,borderTop:'1px solid rgba(74,222,128,0.1)',paddingTop:'4px'}}><span>Imponibile Mod 130</span><span>{formatEur(imponibile)}</span></div>
              </div>
            )}

            <div style={{marginBottom:'8px'}}><label style={cpLabel}>Note (opzionale)</label><input type="text" placeholder="es. gruppo di 8 persone" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={cpInput} /></div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'8px 10px',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'10px',color:'#e8e8f0'}}>Dichiara al fisco</div>
                <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)'}}>se off, non entra nel Mod 130</div>
              </div>
              <div onClick={()=>setForm(f=>({...f,dichiara:!f.dichiara}))}
                style={{width:'32px',height:'18px',borderRadius:'9px',background:form.dichiara?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',border:`1px solid ${form.dichiara?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',top:'2px',left:form.dichiara?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:form.dichiara?'#4ade80':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
              </div>
            </div>

            <button type="submit" disabled={saving||lordo===0||!form.attivita_id}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(saving||lordo===0||!form.attivita_id)?.4:1}}>
              {saving ? '[SALVO...]' : '[SALVA_ENTRATA]'}
            </button>
          </form>
        )}

        {/* LISTA ENTRATE */}
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {entrateFiltrate.length === 0 && (
            <div style={{textAlign:'center',padding:'30px 0',fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.6)'}}>NESSUNA_ENTRATA</div>
          )}
          {entrateFiltrate.map((e,i)=>{
            const staModificando = editandoId === e.id
            return (
              <div key={e.id} style={{...cpCard,marginBottom:0,animation:`fadeUp .4s ease both ${i*0.16}s`,...(e.cash_dichiarato>0?{border:'1px solid rgba(255,215,0,0.35)',boxShadow:'0 0 8px rgba(255,215,0,0.06)'}:{})}}>
                <div style={cpTopLine} />
                {staModificando ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'4px'}}>MODIFICA_ENTRATA</div>
                    <div><label style={cpLabel}>Data</label><input type="date" value={editForm.data} onChange={ev=>setEditForm(f=>({...f,data:ev.target.value}))} style={cpInput} /></div>
                    <div>
                      <label style={cpLabel}>Attività</label>
                      <select value={editForm.attivita_id} onChange={ev=>setEditForm(f=>({...f,attivita_id:ev.target.value}))} style={cpSelect}>
                        <option value="">Seleziona...</option>
                        {attivita.filter(a=>a.attiva).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div><label style={cpLabel}>Cash €</label><input type="text" inputMode="decimal" value={editForm.importo_cash} onChange={ev=>setEditForm(f=>({...f,importo_cash:ev.target.value}))} style={cpInput} /></div>
                      <div><label style={cpLabel}>Card €</label><input type="text" inputMode="decimal" value={editForm.importo_card} onChange={ev=>setEditForm(f=>({...f,importo_card:ev.target.value}))} style={cpInput} /></div>
                    </div>
                    <div><label style={cpLabel}>Cash dichiarato €</label><input type="text" inputMode="decimal" value={editForm.cash_dichiarato} onChange={ev=>setEditForm(f=>({...f,cash_dichiarato:ev.target.value}))} style={cpInput} /></div>
                    <div><label style={cpLabel}>Note</label><input type="text" value={editForm.note} onChange={ev=>setEditForm(f=>({...f,note:ev.target.value}))} style={cpInput} /></div>
                    <div>
                      <label style={cpLabel}>IGIC</label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                        {[{val:'0',label:'0% esente'},{val:'7',label:'7% standard'}].map(opt=>(
                          <button key={opt.val} type="button" onClick={()=>setEditForm(f=>({...f,igic_percentuale:opt.val}))}
                            style={{background:'transparent',border:`1px solid ${editForm.igic_percentuale===opt.val?'rgba(0,255,255,0.5)':'rgba(0,255,255,0.15)'}`,borderRadius:'2px',color:editForm.igic_percentuale===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'8px 10px'}}>
                      <div style={{fontSize:'10px',color:'#e8e8f0'}}>Dichiara al fisco</div>
                      <div onClick={()=>setEditForm(f=>({...f,dichiara:!f.dichiara}))}
                        style={{width:'32px',height:'18px',borderRadius:'9px',background:editForm.dichiara?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',border:`1px solid ${editForm.dichiara?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
                        <div style={{position:'absolute',top:'2px',left:editForm.dichiara?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:editForm.dichiara?'#4ade80':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                      <button onClick={()=>setEditandoId(null)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>[ANNULLA]</button>
                      <button onClick={()=>handleSaveEdit(e.id)} disabled={savingEdit} style={{background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'8px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer',opacity:savingEdit?.4:1}}>{savingEdit?'[SALVO...]':'[SALVA]'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'11px',fontWeight:700,color:'#e8e8f0',letterSpacing:'.05em',marginBottom:'2px'}}>{e.attivita_nome}</div>
                        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>{formatData(e.data)}</div>
                        {e.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'2px'}}>{e.note}</div>}
                        {(e.importo_cash > 0 || e.importo_card > 0) && (
                          <div style={{display:'flex',gap:'8px',marginTop:'3px'}}>
                            {e.importo_cash > 0 && <span style={{fontSize:'8px',color:'rgba(255,255,255,0.6)'}}>Cash {formatEur(e.importo_cash)}</span>}
                            {e.importo_card > 0 && <span style={{fontSize:'8px',color:'rgba(255,255,255,0.6)'}}>Card {formatEur(e.importo_card)}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{fontSize:'16px',fontWeight:700,color:'#4ade80',textShadow:'0 0 6px rgba(74,222,128,0.2)',letterSpacing:'-1px',marginLeft:'12px',flexShrink:0}}>{formatEur(e.importo_lordo||e.importo_netto)}</div>
                    </div>
                    <div style={{display:'flex',gap:'12px',marginTop:'8px',borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:'6px',alignItems:'center'}}>
                      <button onClick={()=>startEdit(e)} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>MODIFICA</button>
                      <button onClick={()=>handleDelete(e.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>ELIMINA</button>
                      {e.dichiara === false && <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',marginLeft:'auto'}}>non dichiarata</span>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        </div>{/* /page-col right */}
        </div>{/* /page-grid */}

      </div>
    </div>
  )
}
