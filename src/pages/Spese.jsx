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

const EMPTY_FORM = {
  data: new Date().toISOString().slice(0, 10),
  categoria_id: '',
  importo: '',
  metodo_pagamento: 'card',
  descrizione: '',
  deducibile: false,
  igic_percentuale: '0',
}

const CAT_COLORS = ['#ff0040','#00ffff','#4ade80','#ffd700','#f97316','#a855f7','#06b6d4','#fb7185','#84cc16','#e879f9']

function DonutChart({ segments, total, size = 108 }) {
  const R = 38, cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * R
  let cumulative = 0
  if (!total) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
    </svg>
  )
  return (
    <svg width={size} height={size} style={{display:'block',overflow:'visible'}}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
      {segments.map((seg, i) => {
        const fraction = seg.value / total
        const dashLen = fraction * C
        const dashOffset = C / 4 - cumulative * C
        cumulative += fraction
        return (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={seg.color} strokeWidth="11" strokeLinecap="butt"
            strokeDasharray={`${dashLen} ${C}`}
            strokeDashoffset={dashOffset}
            style={{filter:`drop-shadow(0 0 3px ${seg.color}90)`}}
          />
        )
      })}
    </svg>
  )
}

const cpInput = {width:'100%',background:'#000',border:'1px solid rgba(0,255,255,0.2)',borderRadius:'2px',padding:'8px 10px',color:'#e8e8f0',fontSize:'12px',fontFamily:"'Courier New',monospace",outline:'none',boxSizing:'border-box'}
const cpLabel = {fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase',display:'block',marginBottom:'4px'}

function FormContent({ f, setF, categorie }) {
  return (
    <>
      <div style={{marginBottom:'10px'}}>
        <label style={cpLabel}>Data</label>
        <input type="date" value={f.data} onChange={e=>setF(p=>({...p,data:e.target.value}))} style={{...cpInput,colorScheme:'dark'}} />
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={cpLabel}>Categoria</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
          {categorie.map(c=>(
            <button key={c.id} type="button" onClick={()=>setF(p=>({...p,categoria_id:c.id}))}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'5px 10px',borderRadius:'2px',fontSize:'11px',fontFamily:"'Courier New',monospace",cursor:'pointer',background:f.categoria_id===c.id?'rgba(0,255,255,0.12)':'transparent',border:`1px solid ${f.categoria_id===c.id?'rgba(0,255,255,0.4)':'rgba(0,255,255,0.12)'}`,color:f.categoria_id===c.id?'#00ffff':'rgba(255,255,255,0.4)'}}>
              <span style={{fontSize:'14px'}}>{c.emoji}</span><span>{c.nome}</span>
            </button>
          ))}
          {categorie.length === 0 && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.55)',letterSpacing:'.1em'}}>Aggiungi categorie dal pannello Gestisci</div>}
        </div>
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={cpLabel}>Importo €</label>
        <input type="text" inputMode="decimal" placeholder="0,00" value={f.importo} onChange={e=>setF(p=>({...p,importo:e.target.value}))} style={cpInput} />
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={cpLabel}>Pagato con</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
          {[{val:'card',label:'💳 Card'},{val:'cash',label:'💵 Cash'}].map(opt=>(
            <button key={opt.val} type="button" onClick={e=>{e.preventDefault();setF(p=>({...p,metodo_pagamento:opt.val}))}}
              style={{background:'transparent',border:`1px solid ${f.metodo_pagamento===opt.val?'rgba(0,255,255,0.4)':'rgba(0,255,255,0.12)'}`,borderRadius:'2px',color:f.metodo_pagamento===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'7px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={cpLabel}>Descrizione (opzionale)</label>
        <input type="text" placeholder="es. cena con cliente" value={f.descrizione} onChange={e=>setF(p=>({...p,descrizione:e.target.value}))} style={cpInput} />
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.08)',borderRadius:'2px',padding:'8px 10px',marginBottom:'10px'}}>
        <div>
          <div style={{fontSize:'10px',color:'#e8e8f0'}}>Deducibile</div>
          <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)'}}>entra nel Mod 130</div>
        </div>
        <div onClick={e=>{e.preventDefault();setF(p=>({...p,deducibile:!p.deducibile}))}}
          style={{width:'32px',height:'18px',borderRadius:'9px',background:f.deducibile?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',border:`1px solid ${f.deducibile?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.15)'}`,cursor:'pointer',position:'relative',flexShrink:0}}>
          <div style={{position:'absolute',top:'2px',left:f.deducibile?'13px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:f.deducibile?'#4ade80':'rgba(255,255,255,0.3)',transition:'left .2s'}} />
        </div>
      </div>
      {f.deducibile && (
        <div style={{marginBottom:'10px'}}>
          <label style={cpLabel}>IGIC inclusa</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
            {[{val:'0',label:'0% IVA'},{val:'7',label:'IGIC 7%'}].map(opt=>(
              <button key={opt.val} type="button" onClick={e=>{e.preventDefault();setF(p=>({...p,igic_percentuale:opt.val}))}}
                style={{background:'transparent',border:`1px solid ${f.igic_percentuale===opt.val?'rgba(0,255,255,0.4)':'rgba(0,255,255,0.12)'}`,borderRadius:'2px',color:f.igic_percentuale===opt.val?'#00ffff':'rgba(255,255,255,0.3)',padding:'7px',fontSize:'10px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Spese() {
  const [spese, setSpese] = useState([])
  const [categorie, setCategorie] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [filtroMese, setFiltroMese] = useState(meseCorrente())
  const [filtroCat, setFiltroCat] = useState('tutte')
  const [showNuovaCat, setShowNuovaCat] = useState(false)
  const [nuovaCat, setNuovaCat] = useState({ nome: '', emoji: '' })
  const [savingCat, setSavingCat] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const fileRef = useRef()
  const [expandedCat, setExpandedCat] = useState(null)
  const [showListaAll, setShowListaAll] = useState(false)
  const [showGestisci, setShowGestisci] = useState(false)

  useEffect(() => { loadCategorie(); loadSpese() }, [])

  async function loadCategorie() {
    try {
      const { data, error } = await supabase.from('categorie_spese').select('*').order('created_at')
      if (error) throw error
      setCategorie(data)
    } catch (err) { console.error('Errore categorie:', err.message) }
  }

  async function loadSpese() {
    try {
      const { data, error } = await supabase.from('spese').select('*').order('data', { ascending: false })
      if (error) throw error
      setSpese(data)
    } catch (err) { console.error('Errore spese:', err.message) }
  }

  async function handleSaveCategoria() {
    if (!nuovaCat.nome.trim()) return
    setSavingCat(true)
    try {
      const { error } = await supabase.from('categorie_spese').insert({ nome: nuovaCat.nome.trim(), emoji: nuovaCat.emoji.trim() || 'box' })
      if (error) throw error
      setNuovaCat({ nome: '', emoji: '' })
      setShowNuovaCat(false)
      loadCategorie()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingCat(false) }
  }

  async function handleDeleteCategoria(id) {
    try {
      const { error } = await supabase.from('categorie_spese').delete().eq('id', id)
      if (error) throw error
      loadCategorie()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.categoria_id || !form.importo) return
    setSaving(true)
    try {
      let foto_url = null
      if (fotoFile) {
        try {
          const path = `${Date.now()}_${fotoFile.name}`
          const { error: upErr } = await supabase.storage.from('fatture').upload(path, fotoFile)
          if (upErr) throw upErr
          const { data } = supabase.storage.from('fatture').getPublicUrl(path)
          foto_url = data.publicUrl
        } catch (upErr) { console.error('Upload foto:', upErr.message) }
      }
      const cat = categorie.find(c => c.id === form.categoria_id)
      const { error } = await supabase.from('spese').insert({
        data: form.data,
        categoria_id: form.categoria_id,
        categoria_nome: cat?.nome || '',
        categoria_emoji: cat?.emoji || 'box',
        importo: parseFloat(String(form.importo).replace(',', '.')),
        metodo_pagamento: form.metodo_pagamento,
        descrizione: form.descrizione,
        foto_url,
        deducibile: form.deducibile,
        igic_percentuale: form.deducibile ? (parseFloat(form.igic_percentuale) || 0) : 0,
      })
      if (error) throw error
      setForm(f => ({ ...EMPTY_FORM, data: f.data }))
      setFotoFile(null); setFotoPreview(null)
      loadSpese()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSaving(false) }
  }

  function startEdit(s) {
    setEditandoId(s.id)
    setEditForm({
      data: s.data || new Date().toISOString().slice(0, 10),
      categoria_id: s.categoria_id || '',
      importo: String(s.importo || ''),
      metodo_pagamento: s.metodo_pagamento || 'card',
      descrizione: s.descrizione || '',
      deducibile: s.deducibile || false,
      igic_percentuale: String(s.igic_percentuale ?? '0'),
    })
  }

  async function handleSaveEdit(id) {
    if (!editForm.categoria_id || !editForm.importo) return
    setSavingEdit(true)
    try {
      const cat = categorie.find(c => c.id === editForm.categoria_id)
      const { error } = await supabase.from('spese').update({
        data: editForm.data,
        categoria_id: editForm.categoria_id,
        categoria_nome: cat?.nome || '',
        categoria_emoji: cat?.emoji || 'box',
        importo: parseFloat(String(editForm.importo).replace(',', '.')),
        metodo_pagamento: editForm.metodo_pagamento,
        descrizione: editForm.descrizione,
        deducibile: editForm.deducibile,
        igic_percentuale: editForm.deducibile ? (parseFloat(editForm.igic_percentuale) || 0) : 0,
      }).eq('id', id)
      if (error) throw error
      setEditandoId(null); loadSpese()
    } catch (err) { alert('Errore: ' + err.message) }
    finally { setSavingEdit(false) }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('spese').delete().eq('id', id)
      if (error) throw error
      loadSpese()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  // ─── DERIVED DATA ─────────────────────────────────────────────────────────
  const totaleComplessivo = spese.reduce((s, e) => s + (e.importo || 0), 0)
  const speseMese = spese.filter(s => s.data && s.data.startsWith(filtroMese))
  const speseFiltrate = filtroCat === 'tutte' ? speseMese : speseMese.filter(s => s.categoria_id === filtroCat)
  const totale = speseFiltrate.reduce((s, e) => s + (e.importo || 0), 0)
  const totaleMese = speseMese.reduce((s, e) => s + (e.importo || 0), 0)

  const catWithColors = categorie.map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] }))
  const catData = catWithColors
    .map(c => ({
      ...c,
      total: speseMese.filter(s => s.categoria_id === c.id).reduce((sum, s) => sum + s.importo, 0),
      count: speseMese.filter(s => s.categoria_id === c.id).length,
      speseCat: speseMese.filter(s => s.categoria_id === c.id).sort((a, b) => b.data.localeCompare(a.data)),
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)

  const donutSegments = catData.map(c => ({ name: c.nome, value: c.total, color: c.color, emoji: c.emoji }))

  const today = new Date()
  const [yearN, monthN] = filtroMese.split('-').map(Number)
  const daysInMonth = new Date(yearN, monthN, 0).getDate()
  const isThisMonth = today.getFullYear() === yearN && today.getMonth() + 1 === monthN
  const byDay = {}
  speseMese.forEach(s => {
    if (!s.data) return
    const day = parseInt(s.data.split('-')[2])
    byDay[day] = (byDay[day] || 0) + s.importo
  })
  const maxDaySpend = Object.keys(byDay).length > 0 ? Math.max(...Object.values(byDay)) : 1
  const BAR_MAX_H = 44

  // ─── STYLES ───────────────────────────────────────────────────────────────
  const cpCard = {background:'#0a0a0f',border:'1px solid rgba(0,255,255,0.13)',borderRadius:'4px',padding:'12px 14px',marginBottom:'10px',position:'relative'}
  const cpTopLine = {position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#0ff,transparent)',backgroundSize:'200% 100%',animation:'borderFlow 10s linear infinite'}

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{background:'#000',minHeight:'100vh',fontFamily:"'Courier New',monospace",paddingBottom:'80px',position:'relative'}}>
      <style>{`
        @keyframes scanline2{0%{top:-5%}100%{top:105%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes borderFlow{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes growBar{0%{transform:scaleY(0)}100%{transform:scaleY(1)}}
        @keyframes heroIn{0%{opacity:0;transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}}
        @media(min-width:768px){.page-wrap{max-width:800px!important;padding:24px 32px 40px!important}}
      `}</style>
      <div style={{position:'fixed',left:0,right:0,height:'3px',background:'rgba(0,255,255,0.03)',zIndex:10,pointerEvents:'none',animation:'scanline2 24s linear infinite'}} />

      <div className="page-wrap" style={{maxWidth:'390px',margin:'0 auto',padding:'16px 14px 24px',position:'relative',zIndex:2}}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'8px',marginBottom:'14px'}}>
          <div>
            <div style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>SPESE</div>
            <div style={{fontSize:'7px',letterSpacing:'.1em',color:'rgba(255,255,255,0.55)'}}>VARIABILI</div>
          </div>
          <button onClick={()=>setShowForm(s=>!s)}
            style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'5px 10px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
            {showForm?'[CHIUDI]':'[+ AGGIUNGI]'}
          </button>
        </div>

        {/* ── FORM ── */}
        {showForm && (
          <form onSubmit={handleSave} style={{...cpCard,animation:'fadeUp .3s ease both'}}>
            <div style={cpTopLine} />
            <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'12px'}}>NUOVA_SPESA</div>
            <FormContent f={form} setF={setForm} categorie={categorie} />
            {fotoPreview ? (
              <div style={{position:'relative',marginBottom:'10px'}}>
                <img src={fotoPreview} alt="" style={{width:'100%',height:'100px',objectFit:'cover',borderRadius:'2px',opacity:.7}} />
                <button type="button" onClick={()=>{setFotoFile(null);setFotoPreview(null)}}
                  style={{position:'absolute',top:'4px',right:'4px',background:'rgba(255,0,64,0.8)',border:'none',borderRadius:'50%',width:'20px',height:'20px',color:'#fff',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
              </div>
            ) : (
              <button type="button" onClick={()=>fileRef.current?.click()}
                style={{width:'100%',background:'transparent',border:'1px dashed rgba(0,255,255,0.15)',borderRadius:'2px',color:'rgba(0,255,255,0.65)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',marginBottom:'10px'}}>
                [FOTO_SCONTRINO]
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} style={{display:'none'}} />
            <button type="submit" disabled={saving||!form.categoria_id||!form.importo}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'2px',color:'#4ade80',padding:'10px',fontSize:'10px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer',opacity:(saving||!form.categoria_id||!form.importo)?.4:1}}>
              {saving?'[SALVO...]':'[SALVA_SPESA]'}
            </button>
          </form>
        )}

        {/* ── MONTH NAV ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0a0a0f',border:'1px solid rgba(0,255,255,0.1)',borderRadius:'4px',padding:'8px 12px',marginBottom:'12px'}}>
          <button onClick={()=>setFiltroMese(prevMese(filtroMese))} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'20px',cursor:'pointer',padding:'2px 8px',lineHeight:1}}>‹</button>
          <span style={{fontSize:'10px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',textTransform:'uppercase'}}>{labelMese(filtroMese)}</span>
          <button onClick={()=>setFiltroMese(nextMese(filtroMese))} style={{background:'none',border:'none',color:'rgba(0,255,255,0.75)',fontSize:'20px',cursor:'pointer',padding:'2px 8px',lineHeight:1}}>›</button>
        </div>

        {/* ── HERO TOTAL ── */}
        <div style={{...cpCard,textAlign:'center',padding:'22px 14px 18px',animation:'heroIn .5s ease both',marginBottom:'10px'}}>
          <div style={cpTopLine} />
          <div style={{fontSize:'8px',letterSpacing:'.2em',color:'rgba(255,0,64,0.5)',marginBottom:'8px',textTransform:'uppercase'}}>
            TOTALE · {labelMese(filtroMese)}
          </div>
          <div style={{fontSize:'44px',fontWeight:700,letterSpacing:'-3px',color:'#ff0040',textShadow:'0 0 24px rgba(255,0,64,0.5)',lineHeight:1,animation:'heroIn .5s ease both .1s'}}>
            {formatEur(totaleMese)}
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:'16px',marginTop:'10px'}}>
            <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',letterSpacing:'.1em'}}>{speseMese.length} TX</span>
            <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',letterSpacing:'.1em'}}>·</span>
            <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',letterSpacing:'.1em'}}>{catData.length} CAT</span>
            {speseMese.some(s=>s.deducibile) && (
              <>
                <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)'}}>·</span>
                <span style={{fontSize:'8px',color:'rgba(74,222,128,0.5)',letterSpacing:'.1em'}}>
                  DED {formatEur(speseMese.filter(s=>s.deducibile).reduce((sum,s)=>sum+s.importo,0))}
                </span>
              </>
            )}
          </div>
        </div>



        {/* ── CATEGORY CIRCLES GRID ── */}
        {catData.length > 0 && (
          <div style={{...cpCard,animation:'fadeUp .5s ease both .25s'}}>
            <div style={cpTopLine} />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <span style={{fontSize:'7px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)'}}>CATEGORIE_MESE</span>
              <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'2px',padding:'1px 7px'}}>{catData.length}</span>
            </div>

            {/* 3-column icon grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px 4px'}}>
              {catData.map((cat, i) => {
                const isActive = expandedCat === cat.id
                const pct = totaleMese > 0 ? (cat.total / totaleMese) * 100 : 0
                const R = 33, CX = 36, CY = 36
                const circ = 2 * Math.PI * R
                const arcLen = (pct / 100) * circ
                return (
                  <button key={cat.id}
                    onClick={()=>setExpandedCat(isActive ? null : cat.id)}
                    style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',padding:'4px 2px',fontFamily:"'Courier New',monospace",animation:`fadeUp .4s ease both ${i*.07}s`}}>
                    {/* CIRCLE + ARC */}
                    <div style={{position:'relative',width:'72px',height:'72px',flexShrink:0}}>
                      {/* SVG circular progress */}
                      <svg width="72" height="72" style={{position:'absolute',inset:0,transform:'rotate(-90deg)'}}>
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,215,0,0.08)" strokeWidth="3" />
                        <circle cx={CX} cy={CY} r={R} fill="none"
                          stroke="#ffd700" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${arcLen} ${circ}`}
                          style={{filter:'drop-shadow(0 0 4px rgba(255,215,0,0.7))',transition:'stroke-dasharray 2s ease'}}
                        />
                      </svg>
                      {/* Inner circle with all text */}
                      <div style={{
                        position:'absolute',inset:'5px',borderRadius:'50%',
                        border:`1px solid ${isActive ? 'rgba(255,215,0,0.85)' : 'rgba(255,215,0,0.25)'}`,
                        background: isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,215,0,0.04)',
                        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                        gap:'1px',padding:'0 5px',
                        boxShadow: isActive
                          ? '0 0 18px rgba(255,215,0,0.5), 0 0 36px rgba(255,215,0,0.18), inset 0 0 14px rgba(255,215,0,0.08)'
                          : '0 0 6px rgba(255,215,0,0.1)',
                        transition:'all .28s ease',
                        overflow:'hidden',
                      }}>
                        {isActive && <div style={{position:'absolute',inset:'4px',borderRadius:'50%',border:'1px solid rgba(255,215,0,0.25)',pointerEvents:'none'}} />}
                        {/* Symbol */}
                        <span style={{
                          fontSize:'11px',lineHeight:1,letterSpacing:'-.5px',
                          color: isActive ? 'rgba(255,215,0,0.7)' : 'rgba(255,215,0,0.25)',
                          transition:'color .2s',position:'relative',zIndex:1,
                          textShadow: isActive ? '0 0 6px rgba(255,215,0,0.5)' : 'none',
                        }}>€</span>
                        {/* Name */}
                        <div style={{
                          fontSize:'7px',fontWeight:700,letterSpacing:'.04em',textAlign:'center',
                          color: isActive ? '#ffd700' : 'rgba(255,255,255,0.5)',
                          maxWidth:'52px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                          lineHeight:1.2,position:'relative',zIndex:1,
                          transition:'color .2s',
                          textShadow: isActive ? '0 0 6px rgba(255,215,0,0.5)' : 'none',
                        }}>{cat.nome.toUpperCase()}</div>
                        {/* Amount */}
                        <div style={{
                          fontSize:'9px',fontWeight:700,letterSpacing:'-.3px',lineHeight:1.2,
                          color: isActive ? '#ffd700' : 'rgba(255,255,255,0.75)',
                          textShadow: isActive ? '0 0 8px rgba(255,215,0,0.65)' : 'none',
                          transition:'all .2s',position:'relative',zIndex:1,
                        }}>{formatEur(cat.total)}</div>
                      </div>
                    </div>
                    {/* tx count */}
                    <div style={{fontSize:'7px',color:'rgba(255,255,255,0.75)',letterSpacing:'.05em'}}>{cat.count} tx</div>
                  </button>
                )
              })}
            </div>

            {/* EXPANDED PANEL — full width below the grid */}
            {expandedCat && (() => {
              const cat = catData.find(c => c.id === expandedCat)
              if (!cat) return null
              const GOLD = '#ffd700'
              return (
                <div style={{marginTop:'16px',borderTop:'1px solid rgba(255,215,0,0.2)',paddingTop:'14px',animation:'fadeUp .25s ease both'}}>
                  {/* panel header */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                      <div style={{width:'28px',height:'28px',borderRadius:'50%',border:'1px solid rgba(255,215,0,0.5)',background:'rgba(255,215,0,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',lineHeight:1}}>
                        {cat.emoji}
                      </div>
                      <span style={{fontSize:'10px',fontWeight:700,color:GOLD,letterSpacing:'.1em',textShadow:'0 0 8px rgba(255,215,0,0.5)'}}>{cat.nome.toUpperCase()}</span>
                      <span style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',letterSpacing:'.05em'}}>{cat.count} spese</span>
                    </div>
                    <span style={{fontSize:'15px',fontWeight:700,color:GOLD,letterSpacing:'-0.5px',textShadow:'0 0 8px rgba(255,215,0,0.6)'}}>{formatEur(cat.total)}</span>
                  </div>
                  {/* transactions */}
                  <div style={{display:'flex',flexDirection:'column',gap:'1px'}}>
                    {cat.speseCat.map((s, j) => {
                      const staModificando = editandoId === s.id
                      return (
                        <div key={s.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',padding:'8px 2px',animation:`fadeUp .2s ease both ${j*.04}s`}}>
                          {staModificando ? (
                            <div>
                              <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'10px'}}>MODIFICA_SPESA</div>
                              <FormContent f={editForm} setF={setEditForm} />
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginTop:'8px'}}>
                                <button type="button" onClick={()=>setEditandoId(null)}
                                  style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>[ANNULLA]</button>
                                <button type="button" onClick={()=>handleSaveEdit(s.id)} disabled={savingEdit}
                                  style={{background:'transparent',border:'1px solid rgba(255,215,0,0.5)',borderRadius:'2px',color:GOLD,padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer',opacity:savingEdit?.4:1}}>
                                  {savingEdit?'[SALVO...]':'[SALVA]'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:'10px',color:'#e8e8f0',letterSpacing:'.02em'}}>{s.descrizione || '—'}</div>
                                <div style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',marginTop:'2px',letterSpacing:'.03em'}}>
                                  {formatData(s.data)}
                                  <span style={{marginLeft:'6px',color:'rgba(255,255,255,0.75)'}}>{s.metodo_pagamento==='cash'?'CASH':'CARD'}</span>
                                  {s.deducibile && <span style={{color:'rgba(74,222,128,0.55)',marginLeft:'6px',fontSize:'7px'}}>DED</span>}
                                </div>
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
                                <span style={{fontSize:'14px',fontWeight:700,color:GOLD,letterSpacing:'-0.5px'}}>{formatEur(s.importo)}</span>
                                <div style={{display:'flex',gap:'8px'}}>
                                  <button onClick={()=>startEdit(s)} style={{background:'none',border:'none',color:'rgba(0,255,255,0.7)',fontSize:'9px',letterSpacing:'.08em',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>MOD</button>
                                  <button onClick={()=>handleDelete(s.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.6)',fontSize:'9px',letterSpacing:'.08em',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>DEL</button>
                                  {s.foto_url && <a href={s.foto_url} target="_blank" rel="noreferrer" style={{color:'rgba(0,255,255,0.65)',fontSize:'9px',letterSpacing:'.08em',fontFamily:"'Courier New',monospace"}}>FOTO</a>}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── TUTTE LE TRANSAZIONI (collassabile) ── */}
        {speseMese.length > 0 && (
          <div style={{...cpCard,animation:'fadeUp .6s ease both .3s'}}>
            <div style={cpTopLine} />
            <button onClick={()=>setShowListaAll(s=>!s)}
              style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>
              <span style={{fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.7)'}}>LISTA_COMPLETA</span>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'9px',color:'rgba(255,255,255,0.55)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'2px',padding:'1px 6px'}}>{speseMese.length}</span>
                <span style={{fontSize:'10px',color:'rgba(0,255,255,0.7)'}}>{showListaAll?'▲':'▼'}</span>
              </div>
            </button>
            {showListaAll && (
              <div style={{marginTop:'10px',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'8px',display:'flex',flexDirection:'column',gap:'1px'}}>
                {speseMese.map((s, i) => {
                  const staModificando = editandoId === s.id
                  return (
                    <div key={s.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)',padding:'8px 0',animation:`fadeUp .3s ease both ${i*.025}s`}}>
                      {staModificando ? (
                        <div style={{background:'rgba(0,255,255,0.03)',border:'1px solid rgba(0,255,255,0.1)',borderRadius:'2px',padding:'10px',marginBottom:'2px'}}>
                          <div style={{fontSize:'7px',letterSpacing:'.2em',color:'rgba(0,255,255,0.7)',marginBottom:'10px'}}>MODIFICA_SPESA</div>
                          <FormContent f={editForm} setF={setEditForm} />
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginTop:'8px'}}>
                            <button type="button" onClick={()=>setEditandoId(null)}
                              style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>[ANNULLA]</button>
                            <button type="button" onClick={()=>handleSaveEdit(s.id)} disabled={savingEdit}
                              style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer',opacity:savingEdit?.4:1}}>
                              {savingEdit?'[SALVO...]':'[SALVA]'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:'10px',color:'#e8e8f0',letterSpacing:'.02em'}}>{s.categoria_nome}</div>
                            <div style={{fontSize:'8px',color:'rgba(255,255,255,0.55)',marginTop:'1px'}}>
                              {formatData(s.data)}{s.descrizione && <span style={{color:'rgba(255,255,255,0.75)'}}> · {s.descrizione}</span>}
                            </div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
                            <div style={{textAlign:'right'}}>
                              <div style={{fontSize:'14px',fontWeight:700,color:'#ff0040',letterSpacing:'-0.5px'}}>{formatEur(s.importo)}</div>
                              <div style={{fontSize:'7px',color:'rgba(255,255,255,0.75)',marginTop:'1px'}}>{s.metodo_pagamento==='cash'?'CASH':'CARD'}</div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                              <button onClick={()=>startEdit(s)} style={{background:'none',border:'none',color:'rgba(0,255,255,0.45)',fontSize:'9px',letterSpacing:'.08em',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>MOD</button>
                              <button onClick={()=>handleDelete(s.id)} style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'9px',letterSpacing:'.08em',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>DEL</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:'8px',marginTop:'4px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  <span style={{fontSize:'8px',letterSpacing:'.1em',color:'rgba(255,255,255,0.55)'}}>TOTALE</span>
                  <span style={{fontSize:'13px',fontWeight:700,color:'#ff0040',letterSpacing:'-0.5px'}}>{formatEur(totaleMese)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GESTISCI CATEGORIE ── */}
        <div style={{...cpCard}}>
          <div style={cpTopLine} />
          <button onClick={()=>setShowGestisci(s=>!s)}
            style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontFamily:"'Courier New',monospace",padding:0}}>
            <span style={{fontSize:'8px',letterSpacing:'.15em',color:'rgba(0,255,255,0.65)'}}>GESTISCI_CATEGORIE</span>
            <span style={{fontSize:'10px',color:'rgba(0,255,255,0.65)'}}>{showGestisci?'▲':'▼'}</span>
          </button>
          {showGestisci && (
            <div style={{marginTop:'12px',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'10px'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'10px'}}>
                {categorie.map((c, i) => (
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)',paddingBottom:'6px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <span style={{fontSize:'20px',lineHeight:1}}>{c.emoji||'📦'}</span>
                      <span style={{fontSize:'11px',color:'#e8e8f0',letterSpacing:'.04em'}}>{c.nome}</span>
                      <span style={{width:'8px',height:'8px',borderRadius:'1px',background:CAT_COLORS[i%CAT_COLORS.length],display:'inline-block',boxShadow:`0 0 4px ${CAT_COLORS[i%CAT_COLORS.length]}`}} />
                    </div>
                    <button onClick={()=>handleDeleteCategoria(c.id)}
                      style={{background:'none',border:'none',color:'rgba(255,0,64,0.65)',fontSize:'16px',cursor:'pointer',lineHeight:1,padding:'0 4px',fontFamily:'monospace'}}>×</button>
                  </div>
                ))}
              </div>
              {showNuovaCat ? (
                <div style={{background:'rgba(0,0,0,0.5)',border:'1px solid rgba(0,255,255,0.12)',borderRadius:'2px',padding:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
                  <input type="text" placeholder="Nome categoria" value={nuovaCat.nome}
                    onChange={e=>setNuovaCat(p=>({...p,nome:e.target.value}))} autoFocus style={cpInput} />
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                    {['🍽️','🍕','🍺','☕','🛒','⛽','🚗','✈️','🏨','💊','🧴','👕','🎬','🎮','🏠','💡','🔧','📱','🎁','🍦','🌿','💈','🐕','🏋️'].map(e=>(
                      <button key={e} type="button" onClick={()=>setNuovaCat(p=>({...p,emoji:e}))}
                        style={{width:'34px',height:'34px',borderRadius:'2px',fontSize:'17px',background:nuovaCat.emoji===e?'rgba(0,255,255,0.15)':'transparent',border:`1px solid ${nuovaCat.emoji===e?'rgba(0,255,255,0.4)':'rgba(0,255,255,0.07)'}`,cursor:'pointer'}}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    <button type="button" onClick={()=>{setShowNuovaCat(false);setNuovaCat({nome:'',emoji:''})}}
                      style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',color:'rgba(255,255,255,0.65)',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer'}}>[ANNULLA]</button>
                    <button type="button" onClick={handleSaveCategoria} disabled={savingCat||!nuovaCat.nome.trim()||!nuovaCat.emoji}
                      style={{background:'transparent',border:'1px solid rgba(0,255,255,0.3)',borderRadius:'2px',color:'#00ffff',padding:'8px',fontSize:'9px',fontFamily:"'Courier New',monospace",cursor:'pointer',opacity:(savingCat||!nuovaCat.nome.trim()||!nuovaCat.emoji)?.4:1}}>
                      {savingCat?'[CREO...]':'[CREA]'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={()=>setShowNuovaCat(true)}
                  style={{width:'100%',background:'transparent',border:'1px dashed rgba(0,255,255,0.2)',borderRadius:'2px',color:'rgba(0,255,255,0.7)',padding:'9px',fontSize:'9px',fontFamily:"'Courier New',monospace",letterSpacing:'.1em',cursor:'pointer'}}>
                  [+ NUOVA_CATEGORIA]
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
