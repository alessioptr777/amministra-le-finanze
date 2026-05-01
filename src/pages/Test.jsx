import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Test() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  function addLog(msg, type = 'info') {
    setResults(r => [...r, { msg, type, time: new Date().toLocaleTimeString() }])
  }

  async function testConnection() {
    setLoading(true)
    setResults([])
    try {
      addLog('Testing Supabase connection...')

      // Test 0: Check environment
      addLog('Test 0: Checking environment...')
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        addLog(`✓ Supabase URL and key are configured`, 'success')
      } else {
        addLog(`✗ Missing Supabase environment variables`, 'error')
      }

      // Test 1: Read from attivita table
      addLog('Test 1: Reading attivita table...')
      const { data: attivitaData, error: err1, count: count1 } = await supabase.from('attivita').select('*', { count: 'exact' })
      if (err1) {
        addLog(`Error reading attivita: ${err1.message}`, 'error')
      } else {
        addLog(`✓ attivita table readable, ${count1 || attivitaData?.length || 0} rows`, 'success')
      }

      // Test 2: Read from entrate table
      addLog('Test 2: Reading entrate table...')
      const { data: entrateData, error: err2, count: count2 } = await supabase.from('entrate').select('*', { count: 'exact' })
      if (err2) {
        addLog(`Error reading entrate: ${err2.message}`, 'error')
      } else {
        addLog(`✓ entrate table readable, ${count2 || entrateData?.length || 0} rows`, 'success')
      }

      // Test 3: Insert test record
      addLog('Test 3: Inserting test entrata...')
      const testData = {
        data: new Date().toISOString().slice(0, 10),
        attivita_id: 'test-' + Date.now(),
        attivita_nome: 'TEST',
        attivita_colore: '#ff0000',
        importo_cash: 100,
        importo_card: 50,
        importo_lordo: 150,
        cash_dichiarato: 100,
        importo_netto: 140,
        igic_percentuale: 7,
        note: 'Test entry - auto-delete',
        dichiara: true,
      }

      const { data: inserted, error: err3 } = await supabase.from('entrate').insert([testData]).select()
      if (err3) {
        addLog(`✗ Insert failed: ${err3.message}`, 'error')
        addLog(`Details: ${JSON.stringify(err3)}`, 'error')
      } else if (!inserted || inserted.length === 0) {
        addLog(`✗ Insert returned no data`, 'error')
      } else {
        addLog(`✓ Insert successful, ID: ${inserted[0]?.id}`, 'success')

        // Test 4: Read it back
        if (inserted?.[0]?.id) {
          addLog('Test 4: Reading back inserted record...')
          const { data: readBack, error: err4 } = await supabase.from('entrate').select('*').eq('id', inserted[0].id)
          if (err4) {
            addLog(`Error reading back: ${err4.message}`, 'error')
          } else if (!readBack || readBack.length === 0) {
            addLog(`✗ Record not found after insert!`, 'error')
          } else {
            addLog(`✓ Read back successful`, 'success')
            addLog(`  Data: ${JSON.stringify(readBack[0]).substring(0, 100)}...`, 'info')

            // Test 5: Delete
            addLog('Test 5: Deleting test record...')
            const { error: err5 } = await supabase.from('entrate').delete().eq('id', inserted[0].id)
            if (err5) {
              addLog(`Error deleting: ${err5.message}`, 'error')
            } else {
              addLog(`✓ Delete successful`, 'success')
            }
          }
        }
      }

      addLog('==== Tests completed! ====', 'info')
    } catch (err) {
      addLog(`Unexpected error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Database Test</h1>

      <button
        onClick={testConnection}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold mb-4 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Run Tests'}
      </button>

      <div className="bg-white rounded-lg border border-slate-200 p-4 font-mono text-sm">
        {results.length === 0 ? (
          <p className="text-slate-400">Click "Run Tests" to start diagnostics</p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  r.type === 'error'
                    ? 'text-red-600'
                    : r.type === 'success'
                    ? 'text-green-600'
                    : 'text-slate-600'
                }`}
              >
                <span className="text-slate-400">{r.time}</span>
                <span>{r.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
