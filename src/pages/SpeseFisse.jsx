import { useState } from 'react'

const STORAGE_KEY = 'spese_fisse_v1'

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

export function loadSpeseFisse() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export default function SpeseFisse() {
  const [voci, setVoci] = useState(loadSpeseFisse)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)

  function persist(nuove) {
    setVoci(nuove)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuove))
  }

  function handleSave(e) {
    e.preventDefault()
    if (!form.nome || !form.importo) return
    const voce = {
      id: editId || Date.now().toString(),
      nome: form.nome.trim(),
      importo: parseFloat(form.importo),
      giorno_addebito: form.giorno_addebito ? parseInt(form.giorno_addebito) : null,
      deducibile: form.deducibile,
      igic_percentuale: form.deducibile ? (parseFloat(form.igic_percentuale) || 0) : 0,
      variabile: form.variabile,
      note: form.note.trim(),
    }
    persist(editId ? voci.map(v => v.id === editId ? voce : v) : [...voci, voce])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setEditId(null)
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

  function handleDelete(id) {
    persist(voci.filter(v => v.id !== id))
  }

  const totale = voci.reduce((s, v) => s + v.importo, 0)
  const totaleDeducibile = voci.filter(v => v.deducibile).reduce((s, v) => s + v.importo, 0)

  const vociOrdinate = [...voci].sort((a, b) => {
    if (!a.giorno_addebito && !b.giorno_addebito) return 0
    if (!a.giorno_addebito) return 1
    if (!b.giorno_addebito) return -1
    return a.giorno_addebito - b.giorno_addebito
  })

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">Spese Fisse</h1>
        <button
          onClick={() => { setShowForm(s => !s); setEditId(null); setForm(EMPTY_FORM) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm"
        >
          {showForm && !editId ? 'Chiudi' : '+ Aggiungi'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Abbonamenti e costi mensili ricorrenti (senza data di fine)</p>

      {voci.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-xs text-red-700 font-medium mb-1">Totale mensile</p>
            <p className="text-lg font-bold text-red-800">{formatEur(totale)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100">
            <p className="text-xs text-green-700 font-medium mb-1">Deducibili/mese</p>
            <p className="text-lg font-bold text-green-800">{formatEur(totaleDeducibile)}</p>
            <p className="text-xs text-green-600">riducono le tasse</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nome</label>
            <input
              type="text"
              placeholder="es. Affitto, Starlink, Lightroom..."
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Totale pagato €/mese</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.importo}
                onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Giorno</label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="5"
                value={form.giorno_addebito}
                onChange={e => setForm(f => ({ ...f, giorno_addebito: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-center"
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Deducibile per le tasse</p>
                <p className="text-xs text-slate-400">riduce il Mod 130 (IRPF)</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, deducibile: !f.deducibile }))}
                className={`w-12 h-6 rounded-full transition-colors ${form.deducibile ? 'bg-green-500' : 'bg-slate-300'}`}
              >
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.deducibile ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {form.deducibile && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Tassa in fattura
                </label>
                <div className="flex gap-2">
                  {[
                    { val: '0', label: 'IVA (0% IGIC)', desc: 'es. Adobe, Google' },
                    { val: '7', label: 'IGIC 7%', desc: 'es. Apple, locali' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, igic_percentuale: opt.val }))}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs border text-left ${
                        form.igic_percentuale === opt.val
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      <p className="font-medium">{opt.label}</p>
                      <p className="opacity-60">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {form.igic_percentuale === '0' && form.importo && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Deduce €{parseFloat(form.importo || 0).toFixed(2)} dal Mod 130 · nessun credito IGIC
                  </p>
                )}
                {form.igic_percentuale === '7' && form.importo && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Deduce €{(parseFloat(form.importo || 0) * 100 / 107).toFixed(2)} dal Mod 130 ·
                    credito IGIC €{(parseFloat(form.importo || 0) * 7 / 107).toFixed(2)} nel Mod 420
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="variabile"
              checked={form.variabile}
              onChange={e => setForm(f => ({ ...f, variabile: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="variabile" className="text-sm text-slate-700">Importo variabile (inserisci la media)</label>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note (opzionale)</label>
            <input
              type="text"
              placeholder="es. scade agosto 2027"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!form.nome || !form.importo}
            className="bg-red-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
          >
            {editId ? 'Salva modifiche' : 'Aggiungi spesa fissa'}
          </button>
        </form>
      )}

      {voci.length === 0 && !showForm && (
        <div className="text-center py-10">
          <p className="text-slate-400 text-sm mb-2">Nessuna spesa fissa ancora</p>
          <p className="text-slate-300 text-xs">Aggiungi affitto, abbonamenti, SS...</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {vociOrdinate.map(v => (
          <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="font-medium text-slate-800 text-sm">{v.nome}</p>
                  {v.deducibile && (
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-100">
                      deducibile{v.igic_percentuale > 0 ? ` · IGIC ${v.igic_percentuale}%` : ' · IVA'}
                    </span>
                  )}
                  {v.variabile && <span className="text-xs text-slate-400 italic">variabile</span>}
                </div>
                {v.giorno_addebito && (
                  <p className="text-xs text-slate-400">ogni {v.giorno_addebito} del mese</p>
                )}
                {v.note && <p className="text-xs text-slate-500">{v.note}</p>}
              </div>
              <p className="font-bold text-red-600 ml-3 flex-shrink-0">{formatEur(v.importo)}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => startEdit(v)} className="text-xs text-blue-500 hover:text-blue-700">Modifica</button>
              <button onClick={() => handleDelete(v.id)} className="text-xs text-red-400 hover:text-red-600">Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
