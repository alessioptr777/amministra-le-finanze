import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from './firebase'

const defaultAttivita = [
  { nome: 'Tenerife Stars', tipo: 'collaborazione', epigrafe: 'fotografo', commissione_percentuale_default: 33, colore: '#f59e0b', attiva: true },
  { nome: 'Interstellar', tipo: 'propria', epigrafe: 'actividades', commissione_percentuale_default: 0, colore: '#3b82f6', attiva: true },
  { nome: 'Foodfather', tipo: 'propria', epigrafe: 'actividades', commissione_percentuale_default: 0, colore: '#10b981', attiva: true },
  { nome: 'Fotografia privata', tipo: 'privata', epigrafe: 'fotografo', commissione_percentuale_default: 0, colore: '#8b5cf6', attiva: true },
]

export async function seedInitialData() {
  try {
    const snap = await getDocs(collection(db, 'attivita'))
    if (!snap.empty) return
    for (const a of defaultAttivita) {
      await addDoc(collection(db, 'attivita'), a)
    }
    console.log('Attività create con successo')
  } catch (err) {
    console.error('Errore seed attività:', err.message)
  }
}
