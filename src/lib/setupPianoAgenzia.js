import { supabase } from './supabase'
import { PIANO_AGENZIA_TRIBUTARIA } from './pianoAgenzia'

export async function setupPianoAgenzia() {
  try {
    // 1. Verifica se il debito Agenzia Tributaria esiste già
    const { data: existing } = await supabase
      .from('debiti')
      .select('id')
      .eq('nome', 'Agenzia Tributaria')
      .single()

    let debitoId
    if (existing) {
      debitoId = existing.id
      console.log('✓ Debito Agenzia Tributaria già esiste, ID:', debitoId)
    } else {
      // 2. Crea il debito Agenzia Tributaria
      const totalePiano = PIANO_AGENZIA_TRIBUTARIA.reduce((s, r) => s + r.importo, 0)
      const { data: newDebito, error: debitoError } = await supabase
        .from('debiti')
        .insert([{
          nome: 'Agenzia Tributaria',
          importo_totale: totalePiano,
          importo_pagato: 0,
          deducibile: false,
          rata_mensile: 0,
          posizione: 999,
          ha_piano: true,
          tipo_piano: 'variabili',
        }])
        .select('id')
        .single()

      if (debitoError) throw new Error('Errore creazione debito: ' + debitoError.message)
      debitoId = newDebito.id
      console.log('✓ Debito Agenzia Tributaria creato, ID:', debitoId)
    }

    // 3. Verifica se le rate esistono già
    const { count: rateCount } = await supabase
      .from('rate_debito')
      .select('id', { count: 'exact' })
      .eq('debito_id', debitoId)

    if (rateCount === 25) {
      console.log('✓ Tutte le 25 rate sono già nel database')
      return { success: true, debitoId, rateCount }
    }

    // 4. Elimina rate vecchie se parziali
    if (rateCount > 0) {
      await supabase.from('rate_debito').delete().eq('debito_id', debitoId)
      console.log('🔄 Rate vecchie eliminate, ricaricamento...')
    }

    // 5. Carica tutte le 25 rate
    const rateDaInserire = PIANO_AGENZIA_TRIBUTARIA.map(r => ({
      debito_id: debitoId,
      numero_rata: r.numero_rata,
      data_scadenza: r.data_scadenza,
      importo: r.importo,
      pagato: false,
    }))

    const { error: rateError } = await supabase
      .from('rate_debito')
      .insert(rateDaInserire)

    if (rateError) throw new Error('Errore caricamento rate: ' + rateError.message)

    console.log('✓ 25 rate caricate nel database')

    return {
      success: true,
      debitoId,
      rateCount: 25,
      totalePiano: PIANO_AGENZIA_TRIBUTARIA.reduce((s, r) => s + r.importo, 0),
    }
  } catch (err) {
    console.error('❌ Errore setup piano:', err.message)
    return { success: false, error: err.message }
  }
}
