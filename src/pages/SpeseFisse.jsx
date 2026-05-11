import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatEur(n) {
  return '€' + Number(n || 0).toFixed(2).replace('.', ',')
}

const EMPTY_FORM = {
  nome: '',
  importo: '',
  giorno_addebito: '',
  deducibile: false,
  igic_percentuale: '0',
  variabile: false,
  note: '',
}

export async function loadSpeseFisse() {
  try {
    const { data, error } = await supabase.from('spese_fisse').select('*').order('giorno_addebito')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Errore caricamento spese fisse:', err.message)
    return []
  }
}

export default function SpeseFisse() {
  const [voci, setVoci] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('spese_fisse').select('*').order('giorno_addebito')
      if (error) throw error
      setVoci(data || [])
    } catch (err) {
      console.error('Errore spese fisse:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome || !form.importo) return
    setSaving(true)
    try {
      const data = {
        nome: form.nome.trim(),
        importo: parseFloat(String(form.importo).replace(',', '.')),
        giorno_addebito: form.giorno_addebito ? parseInt(form.giorno_addebito) : null,
        deducibile: form.deducibile,
        igic_percentuale: form.deducibile ? (parseFloat(form.igic_percentuale) || 0) : 0,
        variabile: form.variabile,
        note: form.note.trim(),
      }
      if (editId) {
        const { error } = await supabase.from('spese_fisse').update(data).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('spese_fisse').insert([data])
        if (error) throw error
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditId(null)
      load()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(v) {
    setEditId(v.id)
    setForm({
      nome: v.nome,
      importo: String(v.importo),
      giorno_addebito: v.giorno_addebito ? String(v.giorno_addebito) : '',
      deducibile: v.deducibile || false,
      igic_percentuale: String(v.igic_percentuale ?? 0),
      variabile: v.variabile || false,
      note: v.note || '',
    })
    setShowForm(true)
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('spese_fisse').delete().eq('id', id)
      if (error) throw error
      load()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const totale = voci.reduce((s, v) => s + v.importo, 0)
  const totaleDeducibile = voci.filter(v => v.deducibile).reduce((s, v) => s + v.importo, 0)
  const vociOrdinate = [...voci].sort((a, b) => {
    if (!a.giorno_addebito && !b.giorno_addebito) return 0
    if (!a.giorno_addebito) return 1
    if (!b.giorno_addebito) return -1
    return a.giorno_addebito - b.giorno_addebito
  })

  const cpCard = {background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'10px 12px',marginBottom:'10px',position:'relative'}
  const cpLabel = {fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase',display:'block',marginBottom:'4px'}
  const cpInput = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
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
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>SPESE_FISSE</span>
          <button onClick={()=>{setShowForm(s=>!s);setEditId(null);setForm(EMPTY_FORM)}}
            style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'5px 10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
            {showForm && !editId ? '[CHIUDI]' : '[+ AGGIUNGI]'}
          </button>
        </div>

        {/* TOTALI */}
        {!loading && voci.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px',animation:'fadeUp .4s ease both'}}>
            {[
              {label:'TOTALE_MENSILE',val:totale,color:'#ff0040',glow:'rgba(255,0,64,0.2)'},
              {label:'DEDUCIBILI_MESE',val:totaleDeducibile,color:'#4ade80',glow:'rgba(74,222,128,0.2)'},
            ].map((r,i)=>(
              <div key={i} style={{...cpCard,marginBottom:0}}>
                <div style={cpTopLine} />
                <div style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(255,255,255,0.65)',marginBottom:'4px'}}>{r.label}</div>
                <div style={{fontSize:'18px',fontWeight:700,letterSpacing:'-1px',color:r.color,textShadow:`0 0 8px ${r.glow}`}}>{formatEur(r.val)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="page-grid">
        <div className="page-col">

        {/* FORM */}
        {showForm && (
          <form onSubmit={handleSave} style={{...cpCard,marginBottom:'14px',animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>{editId ? 'MODIFICA_VOCE' : 'NUOVA_SPESA_FISSA'}</div>

            <div style={{marginBottom:'10px'}}>
              <label style={cpLabel}>Nome</label>
              <input type="text" placeholder="es. Affitto, Starlink..." value={form.nome}
                onChange={e=>setForm(f=>({...f,nome:e.target.value}))} autoFocus style={cpInput} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'8px',marginBottom:'10px'}}>
              <div>
                <label style={cpLabel}>Importo €/mese</label>
                <input type="text" inputMode="decimal" placeholder="0,00" value={form.importo}
                  onChange={e=>setForm(f=>({...f,importo:e.target.value}))} style={cpInput} />
              </div>
              <div>
                <label style={cpLabel}>Giorno</label>
                <input type="number" min="1" max="31" placeholder="5" value={form.giorno_addebito}
                  onChange={e=>setForm(f=>({...f,giorno_addebito:e.target.value}))} style={{...cpInput,textAlign:'center'}} />
              </div>
            </div>

            {/* Deducibile toggle */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'8px 10px',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'10px',color:'#e8e8f0',letterSpacing:'.05em'}}>Deducibile</div>
                <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)',letterSpacing:'.05em'}}>riduce Mod 130</div>
              </div>
              <div onClick={()=>setForm(f=>({...f,deducibile:!f.deducibile}))}
                style={{width:'32px',height:'18px',borderRadius:'9px',background:form.deducibile?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',border:`1px solid ${form.deducibile?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',top:'2px',left:form.deducibile?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:form.deducibile?'#4ade80':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
              </div>
            </div>

            {form.deducibile && (
              <div style={{marginBottom:'10px'}}>
                <label style={cpLabel}>IGIC in fattura</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                  {[{val:'0',label:'IVA 0%'},{val:'7',label:'IGIC 7%'}].map(opt=>(
                    <button key={opt.val} type="button" onClick={()=>setForm(f=>({...f,igic_percentuale:opt.val}))}
                      style={{background:'transparent',border:`1px solid ${form.igic_percentuale===opt.val?'rgba(0,255,255,0.5)':'rgba(0,255,255,0.15)'}`,borderRadius:'2px',color:form.igic_percentuale===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'6px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{marginBottom:'10px'}}>
              <label style={cpLabel}>Note (opzionale)</label>
              <input type="text" placeholder="es. scade agosto 2027" value={form.note}
                onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={cpInput} />
            </div>

            <div style={{display:'flex',gap:'8px'}}>
              {editId && (
                <button type="button" onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY_FORM)}}
                  style={{flex:1,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer',letterSpacing:'.05em'}}>
                  [ANNULLA]
                </button>
              )}
              <button type="submit" disabled={!form.nome||!form.importo||saving}
                style={{flex:1,background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'9px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(!form.nome||!form.importo||saving)?.4:1}}>
                {saving?'[SALVO...]':editId?'[SALVA_MODIFICHE]':'[AGGIUNGI]'}
              </button>
            </div>
          </form>
        )}

        </div>{/* /page-col left */}
        <div className="page-col">

        {/* LISTA */}
        {loading && <div style={{textAlign:'center',padding:'20px 0',fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.65)'}}>CARICAMENTO...</div>}

        {!loading && voci.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'30px 0'}}>
            <div style={{fontSize:'9px',letterSpacing:'.15em',color:'rgba(0,255,255,0.6)'}}>NESSUNA_SPESA_FISSA</div>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {vociOrdinate.map((v,i)=>(
            <div key={v.id} style={{...cpCard,marginBottom:0,animation:`fadeUp .4s ease both ${i*0.2}s`}}>
              <div style={cpTopLine} />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:'#e8e8f0',letterSpacing:'.05em',marginBottom:'2px'}}>{v.nome}</div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {v.giorno_addebito && <span style={{fontSize:'8px',color:'rgba(255,255,255,0.65)',letterSpacing:'.05em'}}>ogni {v.giorno_addebito} del mese</span>}
                    {v.deducibile && <span style={{fontSize:'7px',letterSpacing:'.1em',color:'rgba(74,222,128,0.7)',border:'1px solid rgba(74,222,128,0.2)',padding:'1px 6px',borderRadius:'2px'}}>DED{v.igic_percentuale>0?` IGIC${v.igic_percentuale}%`:' IVA'}</span>}
                    {v.variabile && <span style={{fontSize:'7px',color:'rgba(255,215,0,0.75)',letterSpacing:'.05em'}}>variabile</span>}
                  </div>
                  {v.note && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.6)',marginTop:'2px'}}>{v.note}</div>}
                </div>
                <div style={{fontSize:'16px',fontWeight:700,color:'#ff0040',textShadow:'0 0 6px rgba(255,0,64,0.2)',letterSpacing:'-1px',marginLeft:'12px',flexShrink:0}}>{formatEur(v.importo)}</div>
              </div>
              <div style={{display:'flex',gap:'12px',marginTop:'8px',borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:'6px'}}>
                <button onClick={()=>startEdit(v)} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>MODIFICA</button>
                <button onClick={()=>handleDelete(v.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.1em',cursor:'pointer',padding:0,fontFamily:"'Courier New',monospace"}}>ELIMINA</button>
              </div>
            </div>
          ))}
        </div>

        </div>{/* /page-col right */}
        </div>{/* /page-grid */}

      </div>
    </div>
  )
}
