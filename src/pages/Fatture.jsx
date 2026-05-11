import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

function formatData(d) {
  if (!d) return ''
  const [y, m, g] = d.split('-')
  return `${g}-${m}-${y}`
}

const EMPTY_EMESSA = {
  numero_fattura: '',
  data: new Date().toISOString().slice(0, 10),
  cliente_nome: '',
  totale: '',
  igic_percentuale: '7',
  note: '',
}

const EMPTY_RICEVUTA = {
  numero_fattura_fornitore: '',
  data: new Date().toISOString().slice(0, 10),
  fornitore_nome: '',
  totale: '',
  igic_percentuale: '7',
  note: '',
}

export default function Fatture() {
  const [tab, setTab] = useState('emesse')
  const [emesse, setEmesse] = useState([])
  const [ricevute, setRicevute] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formE, setFormE] = useState(EMPTY_EMESSA)
  const [formR, setFormR] = useState(EMPTY_RICEVUTA)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [docFile, setDocFile] = useState(null)
  const [docNome, setDocNome] = useState(null)
  const fileRef = useRef()
  const [fornitoriFissi, setFornitoriFissi] = useState([])
  const [showGestisci, setShowGestisci] = useState(false)
  const [nuovoFornitore, setNuovoFornitore] = useState({ nome: '', importo_atteso: '' })
  const [savingFornitore, setSavingFornitore] = useState(false)

  const now = new Date()
  const meseCorrente = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const meseLabelCorrente = now.toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  useEffect(() => { loadEmesse(); loadRicevute(); loadFornitoriFissi() }, [])

  async function loadEmesse() {
    try {
      const { data, error } = await supabase.from('fatture_emesse').select('*').order('data', { ascending: false })
      if (error) throw error
      setEmesse(data)
    } catch (err) { console.error('loadEmesse:', err.message) }
  }

  async function loadRicevute() {
    try {
      const { data, error } = await supabase.from('fatture_ricevute').select('*').order('data', { ascending: false })
      if (error) throw error
      setRicevute(data)
    } catch (err) { console.error('loadRicevute:', err.message) }
  }

  async function loadFornitoriFissi() {
    try {
      const { data, error } = await supabase.from('fornitori_fissi').select('*').order('created_at')
      if (error) throw error
      setFornitoriFissi(data)
    } catch (err) { console.error('loadFornitoriFissi:', err.message) }
  }

  async function handleAddFornitore() {
    if (!nuovoFornitore.nome.trim()) return
    setSavingFornitore(true)
    try {
      const { error } = await supabase.from('fornitori_fissi').insert({
        nome: nuovoFornitore.nome.trim(),
        importo_atteso: nuovoFornitore.importo_atteso ? parseFloat(nuovoFornitore.importo_atteso) : null,
      })
      if (error) throw error
      setNuovoFornitore({ nome: '', importo_atteso: '' })
      loadFornitoriFissi()
    } catch (err) { console.error('handleAddFornitore:', err.message) }
    finally { setSavingFornitore(false) }
  }

  async function handleDeleteFornitore(id) {
    try {
      const { error } = await supabase.from('fornitori_fissi').delete().eq('id', id)
      if (error) throw error
      loadFornitoriFissi()
    } catch (err) { console.error('handleDeleteFornitore:', err.message) }
  }

  function handleDoc(e) {
    const file = e.target.files[0]
    if (!file) return
    setDocFile(file)
    setDocNome(file.name)
  }

  function resetDoc() {
    setDocFile(null)
    setDocNome(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadDoc() {
    if (!docFile) return null
    try {
      const path = `${Date.now()}_${docFile.name}`
      const { error } = await supabase.storage.from('fatture').upload(path, docFile)
      if (error) throw error
      const { data } = supabase.storage.from('fatture').getPublicUrl(path)
      return data.publicUrl
    } catch (err) { console.error('Upload documento:', err.message); return null }
  }

  async function handleSaveEmessa(e) {
    e.preventDefault()
    if (!formE.cliente_nome || !formE.totale) return
    setSaving(true); setErrore(null)
    try {
      const doc_url = await uploadDoc()
      const { error } = await supabase.from('fatture_emesse').insert({
        numero_fattura: formE.numero_fattura, data: formE.data, cliente_nome: formE.cliente_nome,
        totale: parseFloat(String(formE.totale).replace(',', '.')),
        igic_percentuale: parseFloat(formE.igic_percentuale || 7), note: formE.note, doc_url,
      })
      if (error) throw error
      setFormE(EMPTY_EMESSA); resetDoc(); setShowForm(false); loadEmesse()
    } catch (err) { setErrore(err.message) }
    finally { setSaving(false) }
  }

  async function handleSaveRicevuta(e) {
    e.preventDefault()
    if (!formR.fornitore_nome || !formR.totale) return
    setSaving(true); setErrore(null)
    try {
      const doc_url = await uploadDoc()
      const { error } = await supabase.from('fatture_ricevute').insert({
        numero_fattura_fornitore: formR.numero_fattura_fornitore, data: formR.data, fornitore_nome: formR.fornitore_nome,
        totale: parseFloat(String(formR.totale).replace(',', '.')),
        igic_percentuale: parseFloat(formR.igic_percentuale || 7), note: formR.note, doc_url,
      })
      if (error) throw error
      setFormR(EMPTY_RICEVUTA); resetDoc(); setShowForm(false); loadRicevute()
    } catch (err) { setErrore(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(tabella, id) {
    try {
      const { error } = await supabase.from(tabella).delete().eq('id', id)
      if (error) throw error
      if (tabella === 'fatture_emesse') loadEmesse(); else loadRicevute()
    } catch (err) { setErrore(err.message) }
  }

  const lista = tab === 'emesse' ? emesse : ricevute
  const totale = lista.reduce((s, f) => s + (f.totale || 0), 0)

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
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>FATTURE</span>
          <button onClick={()=>setShowForm(s=>!s)}
            style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'5px 10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
            {showForm ? '[CHIUDI]' : '[+ AGGIUNGI]'}
          </button>
        </div>

        <div className="page-grid">
        <div className="page-col">

        {errore && (
          <div style={{background:'rgba(255,0,64,0.05)',border:'1px solid rgba(255,0,64,0.2)',borderRadius:'2px',padding:'10px 12px',marginBottom:'10px',fontSize:'10px',color:'rgba(255,0,64,0.8)',letterSpacing:'.05em'}}>
            ERRORE: {errore}
          </div>
        )}

        {/* TAB SWITCHER */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',background:'#0e0e18',border:'1px solid rgba(0,255,255,0.1)',borderRadius:'2px',padding:'3px',marginBottom:'12px'}}>
          {['emesse','ricevute'].map(t=>(
            <button key={t} onClick={()=>{setTab(t);setShowForm(false)}}
              style={{padding:'7px',borderRadius:'2px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',border:'none',background:tab===t?'rgba(0,255,255,0.08)':'transparent',color:tab===t?'#00ffff':'rgba(255,255,255,0.3)',fontWeight:tab===t?700:400}}>
              {t === 'emesse' ? 'EMESSE' : 'RICEVUTE'}
            </button>
          ))}
        </div>

        </div>{/* /page-col left */}
        <div className="page-col">

        {/* TOTALE */}
        {lista.length > 0 && (
          <div style={{...cpCard,marginBottom:'12px'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(255,255,255,0.65)',marginBottom:'4px'}}>{lista.length} {lista.length === 1 ? 'FATTURA' : 'FATTURE'}</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#e8e8f0',letterSpacing:'-1px'}}>{formatEur(totale)}</div>
          </div>
        )}

        {/* CONTROLLO MESE (solo ricevute) */}
        {tab === 'ricevute' && (() => {
          const ricevuteMese = ricevute.filter(f => f.data && f.data.startsWith(meseCorrente))
          const nomiInseriti = ricevuteMese.map(f => f.fornitore_nome.toLowerCase())
          const mancanti = fornitoriFissi.filter(f => !nomiInseriti.includes(f.nome.toLowerCase()))
          const inseriti = fornitoriFissi.filter(f => nomiInseriti.includes(f.nome.toLowerCase()))
          return (
            <div style={{...cpCard,marginBottom:'12px'}}>
              <div style={cpTopLine} />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span style={{fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)'}}>CONTROLLO_{meseLabelCorrente.toUpperCase().replace(' ','_')}</span>
                <button onClick={()=>setShowGestisci(s=>!s)} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',fontFamily:"'Courier New',monospace"}}>
                  {showGestisci ? '[CHIUDI]' : '[GESTISCI]'}
                </button>
              </div>

              {showGestisci && (
                <div style={{background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'10px',marginBottom:'10px'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'8px'}}>
                    {fornitoriFissi.map(f=>(
                      <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',paddingBottom:'4px'}}>
                        <span style={{fontSize:'11px',color:'#e8e8f0'}}>{f.nome}{f.importo_atteso ? ` · ~${formatEur(f.importo_atteso)}` : ''}</span>
                        <button onClick={()=>handleDeleteFornitore(f.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'14px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 80px 36px',gap:'6px'}}>
                    <input type="text" placeholder="Nome fornitore" value={nuovoFornitore.nome} onChange={e=>setNuovoFornitore(f=>({...f,nome:e.target.value}))} style={cpInput} />
                    <input type="number" placeholder="€ atteso" value={nuovoFornitore.importo_atteso} onChange={e=>setNuovoFornitore(f=>({...f,importo_atteso:e.target.value}))} style={{...cpInput,textAlign:'center'}} />
                    <button onClick={handleAddFornitore} disabled={savingFornitore||!nuovoFornitore.nome.trim()}
                      style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',fontSize:'14px',cursor:'pointer',opacity:(!nuovoFornitore.nome.trim()||savingFornitore)?.4:1}}>+</button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
                {mancanti.map(f=>(
                  <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{color:'rgba(255,165,0,0.8)',fontSize:'11px'}}>!</span>
                      <span style={{fontSize:'11px',color:'#e8e8f0'}}>{f.nome}</span>
                      {f.importo_atteso && <span style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>~{formatEur(f.importo_atteso)}</span>}
                    </div>
                    <button onClick={()=>{setFormR(r=>({...r,fornitore_nome:f.nome,totale:f.importo_atteso?String(f.importo_atteso):''}));setShowForm(true)}}
                      style={{background:'transparent',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',color:'rgba(0,255,255,0.6)',fontSize:'8px',letterSpacing:'.1em',fontFamily:"'Courier New',monospace",padding:'4px 8px',cursor:'pointer'}}>
                      [INSERISCI]
                    </button>
                  </div>
                ))}
                {inseriti.map(f=>(
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{color:'rgba(74,222,128,0.7)',fontSize:'11px'}}>✓</span>
                    <span style={{fontSize:'11px',color:'rgba(255,255,255,0.65)',textDecoration:'line-through'}}>{f.nome}</span>
                  </div>
                ))}
                {fornitoriFissi.length === 0 && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.55)',letterSpacing:'.1em'}}>Aggiungi fornitori fissi per il controllo</div>}
                {fornitoriFissi.length > 0 && mancanti.length === 0 && <div style={{fontSize:'9px',color:'rgba(74,222,128,0.6)',letterSpacing:'.1em'}}>TUTTE_LE_FATTURE_DEL_MESE_OK ✓</div>}
              </div>
            </div>
          )
        })()}

        {/* FORM EMESSA */}
        {showForm && tab === 'emesse' && (
          <form onSubmit={handleSaveEmessa} style={{...cpCard,marginBottom:'12px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>NUOVA_FATTURA_EMESSA</div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
              <div><label style={cpLabel}>N° fattura (opz.)</label><input type="text" placeholder="2026/001" value={formE.numero_fattura} onChange={e=>setFormE(f=>({...f,numero_fattura:e.target.value}))} style={cpInput} /></div>
              <div><label style={cpLabel}>Data</label><input type="date" value={formE.data} onChange={e=>setFormE(f=>({...f,data:e.target.value}))} style={cpInput} /></div>
            </div>

            <div style={{marginBottom:'8px'}}>
              <label style={cpLabel}>Cliente</label>
              {[...new Set(emesse.map(f=>f.cliente_nome).filter(Boolean))].length > 0 && (
                <select value={formE.cliente_nome} onChange={e=>setFormE(f=>({...f,cliente_nome:e.target.value}))} style={{...cpSelect,marginBottom:'6px'}}>
                  <option value="">— scegli cliente salvato —</option>
                  {[...new Set(emesse.map(f=>f.cliente_nome).filter(Boolean))].map(nome=><option key={nome} value={nome}>{nome}</option>)}
                </select>
              )}
              <input type="text" placeholder="oppure scrivi nuovo nome" value={formE.cliente_nome} onChange={e=>setFormE(f=>({...f,cliente_nome:e.target.value}))} required style={cpInput} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'8px',marginBottom:'8px'}}>
              <div><label style={cpLabel}>Totale €</label><input type="text" inputMode="decimal" placeholder="0,00" value={formE.totale} onChange={e=>setFormE(f=>({...f,totale:e.target.value}))} required style={cpInput} /></div>
              <div><label style={cpLabel}>IGIC %</label><input type="number" min="0" max="100" step="0.5" value={formE.igic_percentuale} onChange={e=>setFormE(f=>({...f,igic_percentuale:e.target.value}))} style={{...cpInput,textAlign:'center'}} /></div>
            </div>

            {formE.totale && (()=>{
              const tot = parseFloat(formE.totale) || 0
              const perc = parseFloat(formE.igic_percentuale) || 0
              const igic = perc > 0 ? tot * perc / (100 + perc) : 0
              return <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)',marginBottom:'8px',letterSpacing:'.05em'}}>Imponibile {formatEur(tot-igic)} · IGIC {perc}% {formatEur(igic)}</div>
            })()}

            <div style={{marginBottom:'8px'}}><label style={cpLabel}>Note (opzionale)</label><input type="text" value={formE.note} onChange={e=>setFormE(f=>({...f,note:e.target.value}))} style={cpInput} /></div>

            <div style={{marginBottom:'10px'}}>
              <label style={cpLabel}>Documento (opzionale)</label>
              {docNome ? (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.05)',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'8px 10px'}}>
                  <span style={{fontSize:'10px',color:'rgba(0,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{docNome}</span>
                  <button type="button" onClick={resetDoc} style={{background:'none',border:'none',color:'rgba(255,0,64,0.5)',fontSize:'16px',cursor:'pointer',marginLeft:'8px',lineHeight:1}}>×</button>
                </div>
              ) : (
                <button type="button" onClick={()=>fileRef.current?.click()}
                  style={{width:'100%',background:'transparent',border:'1px dashed rgba(0,255,255,0.15)',borderRadius:'2px',color:'rgba(0,255,255,0.65)',padding:'10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
                  [FOTO_O_PDF]
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleDoc} style={{display:'none'}} />
            </div>

            <button type="submit" disabled={saving||!formE.cliente_nome||!formE.totale}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(saving||!formE.cliente_nome||!formE.totale)?.4:1}}>
              {saving ? '[SALVO...]' : '[SALVA_FATTURA]'}
            </button>
          </form>
        )}

        {/* FORM RICEVUTA */}
        {showForm && tab === 'ricevute' && (
          <form onSubmit={handleSaveRicevuta} style={{...cpCard,marginBottom:'12px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>NUOVA_FATTURA_RICEVUTA</div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
              <div><label style={cpLabel}>N° fattura (opz.)</label><input type="text" placeholder="facoltativo" value={formR.numero_fattura_fornitore} onChange={e=>setFormR(f=>({...f,numero_fattura_fornitore:e.target.value}))} style={cpInput} /></div>
              <div><label style={cpLabel}>Data</label><input type="date" value={formR.data} onChange={e=>setFormR(f=>({...f,data:e.target.value}))} style={cpInput} /></div>
            </div>

            <div style={{marginBottom:'8px'}}>
              <label style={cpLabel}>Fornitore</label>
              {[...new Set(ricevute.map(f=>f.fornitore_nome).filter(Boolean))].length > 0 && (
                <select value={formR.fornitore_nome} onChange={e=>setFormR(f=>({...f,fornitore_nome:e.target.value}))} style={{...cpSelect,marginBottom:'6px'}}>
                  <option value="">— scegli fornitore salvato —</option>
                  {[...new Set(ricevute.map(f=>f.fornitore_nome).filter(Boolean))].map(nome=><option key={nome} value={nome}>{nome}</option>)}
                </select>
              )}
              <input type="text" placeholder="oppure scrivi nuovo nome" value={formR.fornitore_nome} onChange={e=>setFormR(f=>({...f,fornitore_nome:e.target.value}))} required style={cpInput} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'8px',marginBottom:'8px'}}>
              <div><label style={cpLabel}>Totale €</label><input type="text" inputMode="decimal" placeholder="0,00" value={formR.totale} onChange={e=>setFormR(f=>({...f,totale:e.target.value}))} required style={cpInput} /></div>
              <div><label style={cpLabel}>IGIC %</label><input type="number" min="0" max="100" step="0.5" value={formR.igic_percentuale} onChange={e=>setFormR(f=>({...f,igic_percentuale:e.target.value}))} style={{...cpInput,textAlign:'center'}} /></div>
            </div>

            {formR.totale && (()=>{
              const tot = parseFloat(formR.totale) || 0
              const perc = parseFloat(formR.igic_percentuale) || 0
              const igic = perc > 0 ? tot * perc / (100 + perc) : 0
              return <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)',marginBottom:'8px',letterSpacing:'.05em'}}>Imponibile {formatEur(tot-igic)} · IGIC {perc}% {formatEur(igic)}</div>
            })()}

            <div style={{marginBottom:'8px'}}><label style={cpLabel}>Note (opzionale)</label><input type="text" value={formR.note} onChange={e=>setFormR(f=>({...f,note:e.target.value}))} style={cpInput} /></div>

            <div style={{marginBottom:'10px'}}>
              <label style={cpLabel}>Documento (opzionale)</label>
              {docNome ? (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.05)',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'8px 10px'}}>
                  <span style={{fontSize:'10px',color:'rgba(0,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{docNome}</span>
                  <button type="button" onClick={resetDoc} style={{background:'none',border:'none',color:'rgba(255,0,64,0.5)',fontSize:'16px',cursor:'pointer',marginLeft:'8px',lineHeight:1}}>×</button>
                </div>
              ) : (
                <button type="button" onClick={()=>fileRef.current?.click()}
                  style={{width:'100%',background:'transparent',border:'1px dashed rgba(0,255,255,0.15)',borderRadius:'2px',color:'rgba(0,255,255,0.65)',padding:'10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
                  [FOTO_O_PDF]
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleDoc} style={{display:'none'}} />
            </div>

            <button type="submit" disabled={saving||!formR.fornitore_nome||!formR.totale}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(saving||!formR.fornitore_nome||!formR.totale)?.4:1}}>
              {saving ? '[SALVO...]' : '[SALVA_FATTURA]'}
            </button>
          </form>
        )}

        {/* LISTA */}
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {lista.length === 0 && <div style={{textAlign:'center',padding:'30px 0',fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.6)'}}>NESSUNA_FATTURA</div>}
          {lista.map((f,i)=>{
            const perc = f.igic_percentuale ?? 7
            const igic = perc > 0 ? f.totale * perc / (100 + perc) : 0
            const imponibile = f.totale - igic
            return (
              <div key={f.id} style={{...cpCard,marginBottom:0,animation:`fadeUp .4s ease both ${i*0.16}s`}}>
                <div style={cpTopLine} />
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#e8e8f0',letterSpacing:'.05em',marginBottom:'2px'}}>{tab==='emesse'?f.cliente_nome:f.fornitore_nome}</div>
                    <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>
                      {formatData(f.data)}
                      {f.numero_fattura && ` · n°${f.numero_fattura}`}
                      {f.numero_fattura_fornitore && ` · n°${f.numero_fattura_fornitore}`}
                    </div>
                    {f.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'2px'}}>{f.note}</div>}
                    {perc > 0 && <div style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',marginTop:'2px',letterSpacing:'.03em'}}>imponibile {formatEur(imponibile)} · IGIC {perc}% {formatEur(igic)}</div>}
                  </div>
                  <div style={{fontSize:'16px',fontWeight:700,color:'#e8e8f0',letterSpacing:'-1px',marginLeft:'12px',flexShrink:0}}>{formatEur(f.totale)}</div>
                </div>
                <div style={{display:'flex',gap:'12px',marginTop:'8px',borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:'6px'}}>
                  {f.doc_url && <a href={f.doc_url} target="_blank" rel="noreferrer" style={{color:'rgba(0,255,255,0.75)',fontSize:'9px',letterSpacing:'.1em',textDecoration:'none',fontFamily:"'Courier New',monospace"}}>DOCUMENTO</a>}
                  <button onClick={()=>handleDelete(tab==='emesse'?'fatture_emesse':'fatture_ricevute',f.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>ELIMINA</button>
                </div>
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
