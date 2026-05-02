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

const EMPTY_FORM = {
  data: new Date().toISOString().slice(0, 10),
  categoria_id: '',
  importo: '',
  metodo_pagamento: 'card',
  descrizione: '',
  deducibile: false,
  igic_percentuale: '0',
}

export default function Spese() {
  const [spese, setSpese] = useState([])
  const [categorie, setCategorie] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [filtroCat, setFiltroCat] = useState('tutte')
  const [showNuovaCat, setShowNuovaCat] = useState(false)
  const [nuovaCat, setNuovaCat] = useState({ nome: '', emoji: '' })
  const [savingCat, setSavingCat] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadCategorie(); loadSpese() }, [])

  async function loadCategorie() {
    try {
      const { data, error } = await supabase.from('categorie_spese').select('*').order('created_at')
      if (error) throw error
      setCategorie(data)
    } catch (err) {
      console.error('Errore categorie:', err.message)
    }
  }

  async function loadSpese() {
    try {
      const { data, error } = await supabase.from('spese').select('*').order('data', { ascending: false })
      if (error) throw error
      setSpese(data)
    } catch (err) {
      console.error('Errore spese:', err.message)
    }
  }

  async function handleSaveCategoria() {
    if (!nuovaCat.nome.trim()) return
    setSavingCat(true)
    try {
      const { error } = await supabase.from('categorie_spese').insert({
        nome: nuovaCat.nome.trim(),
        emoji: nuovaCat.emoji.trim() || 'box',
      })
      if (error) throw error
      setNuovaCat({ nome: '', emoji: '' })
      setShowNuovaCat(false)
      loadCategorie()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingCat(false)
    }
  }

  async function handleDeleteCategoria(id) {
    try {
      const { error } = await supabase.from('categorie_spese').delete().eq('id', id)
      if (error) throw error
      loadCategorie()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
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
        } catch (upErr) {
          console.error('Upload foto:', upErr.message)
        }
      }
      const cat = categorie.find(c => c.id === form.categoria_id)
      const { error } = await supabase.from('spese').insert({
        data: form.data,
        categoria_id: form.categoria_id,
        categoria_nome: cat?.nome || '',
        categoria_emoji: cat?.emoji || 'box',
        importo: parseFloat(form.importo),
        metodo_pagamento: form.metodo_pagamento,
        descrizione: form.descrizione,
        foto_url,
        deducibile: form.deducibile,
        igic_percentuale: form.deducibile ? (parseFloat(form.igic_percentuale) || 0) : 0,
      })
      if (error) throw error
      setForm(f => ({ ...EMPTY_FORM, data: f.data }))
      setFotoFile(null)
      setFotoPreview(null)
      loadSpese()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('spese').delete().eq('id', id)
      if (error) throw error
      loadSpese()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const speseFiltrate = filtroCat === 'tutte' ? spese : spese.filter(s => s.categoria_id === filtroCat)
  const totale = speseFiltrate.reduce((s, e) => s + (e.importo || 0), 0)

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">Spese</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
          {showForm ? 'Chiudi' : '+ Aggiungi'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Spese variabili · attiva "Deducibile" per includerle nel Mod 130</p>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Categoria</label>
              <button type="button" onClick={() => setShowNuovaCat(s => !s)} className="text-xs text-blue-600 font-medium">
                {showNuovaCat ? 'Annulla' : '+ Nuova categoria'}
              </button>
            </div>
            {showNuovaCat && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2 flex flex-col gap-2">
                <input type="text" placeholder="Nome categoria" value={nuovaCat.nome} onChange={e => setNuovaCat(f => ({ ...f, nome: e.target.value }))} autoFocus className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Scegli emoji</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['🍽️','🍕','🍺','☕','🥐','🛒','⛽','🚗','🚌','✈️','🏨','💊','🏥','🧴','💈','👕','👟','🛍️','🎬','🎮','🎵','📚','🏋️','🐾','🏠','💡','🔧','🧹','📱','🎁','💰','🍦','🍰','🥂','🎰','🌿','🚬','💵'].map(e => (
                      <button key={e} type="button" onClick={() => setNuovaCat(f => ({ ...f, emoji: e }))}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border ${nuovaCat.emoji === e ? 'border-blue-500 bg-blue-100' : 'border-slate-200 bg-white'}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={handleSaveCategoria} disabled={savingCat || !nuovaCat.nome.trim() || !nuovaCat.emoji} className="bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40">
                  {savingCat ? 'Salvo...' : 'Crea categoria'}
                </button>
              </div>
            )}
            {categorie.length === 0 && !showNuovaCat ? (
              <p className="text-xs text-slate-400 text-center py-3">Nessuna categoria. Clicca "+ Nuova categoria"</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categorie.map(c => (
                  <div key={c.id} className={`flex items-center gap-1 rounded-full border text-sm ${form.categoria_id === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'}`}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, categoria_id: c.id }))} className="flex items-center gap-1.5 pl-3 pr-1 py-1.5">
                      <span>{c.emoji}</span>
                      <span>{c.nome}</span>
                    </button>
                    <button type="button" onClick={() => handleDeleteCategoria(c.id)}
                      className={`pr-2 pl-0.5 py-1.5 text-xs leading-none opacity-60 hover:opacity-100 ${form.categoria_id === c.id ? 'text-white' : 'text-red-400'}`}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Importo €</label>
            <input type="number" min="0" step="0.01" placeholder="0,00" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Descrizione (opzionale)</label>
            <input type="text" placeholder="es. cena con cliente" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700">Deducibile</p>
              <p className="text-xs text-slate-400">entra nel Mod 130 come costo</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, deducibile: !f.deducibile }))}
              className={`w-12 h-6 rounded-full transition-colors ${form.deducibile ? 'bg-green-500' : 'bg-slate-300'}`}>
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.deducibile ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {form.deducibile && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">IGIC inclusa</label>
              <div className="flex gap-2">
                {[{ val: '0', label: '0% (esente)' }, { val: '7', label: '7% (standard)' }].map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setForm(f => ({ ...f, igic_percentuale: opt.val }))}
                    className={`flex-1 py-2 rounded-lg text-sm border font-medium ${form.igic_percentuale === opt.val ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Foto scontrino (opzionale)</label>
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="scontrino" className="w-full h-32 object-cover rounded-lg" />
                <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-lg py-4 text-slate-400 text-sm hover:border-blue-400">
                Scatta o carica foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
          </div>

          <button type="submit" disabled={saving || !form.categoria_id || !form.importo} className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva spesa'}
          </button>
        </form>
      )}

      <div className="bg-red-50 rounded-xl p-3 border border-red-100 mb-4">
        <p className="text-xs text-red-700 font-medium">
          Totale spese {filtroCat !== 'tutte' && categorie.find(c => c.id === filtroCat) ? `· ${categorie.find(c => c.id === filtroCat).emoji} ${categorie.find(c => c.id === filtroCat).nome}` : ''}
        </p>
        <p className="text-xl font-bold text-red-800">{formatEur(totale)}</p>
      </div>

      {categorie.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          <button onClick={() => setFiltroCat('tutte')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${filtroCat === 'tutte' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}>Tutte</button>
          {categorie.map(c => (
            <button key={c.id} onClick={() => setFiltroCat(c.id)} className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${filtroCat === c.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}>
              {c.emoji} {c.nome}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {speseFiltrate.length === 0 && <p className="text-center text-slate-400 py-10">Nessuna spesa ancora</p>}
        {speseFiltrate.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.categoria_emoji || 'box'}</span>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{s.categoria_nome}</p>
                  <p className="text-xs text-slate-400">{formatData(s.data)}</p>
                  {s.descrizione && <p className="text-xs text-slate-500">{s.descrizione}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600">{formatEur(s.importo)}</p>
                {s.deducibile && <span className="text-xs text-green-600 font-medium">deducibile</span>}
                {s.foto_url && <a href={s.foto_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 block">foto</a>}
              </div>
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 mt-1.5 hover:text-red-600">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}
