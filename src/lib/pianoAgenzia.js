export const PIANO_AGENZIA_TRIBUTARIA = [
  { numero_rata: 1,  data_scadenza: '2026-06-22', importo: 412.63 },
  { numero_rata: 2,  data_scadenza: '2026-07-20', importo: 414.00 },
  { numero_rata: 3,  data_scadenza: '2026-08-20', importo: 415.42 },
  { numero_rata: 4,  data_scadenza: '2026-09-21', importo: 416.84 },
  { numero_rata: 5,  data_scadenza: '2026-10-20', importo: 418.21 },
  { numero_rata: 6,  data_scadenza: '2026-11-20', importo: 419.63 },
  { numero_rata: 7,  data_scadenza: '2026-12-21', importo: 421.00 },
  { numero_rata: 8,  data_scadenza: '2027-01-20', importo: 422.42 },
  { numero_rata: 9,  data_scadenza: '2027-02-22', importo: 423.84 },
  { numero_rata: 10, data_scadenza: '2027-03-22', importo: 425.12 },
  { numero_rata: 11, data_scadenza: '2027-04-20', importo: 426.54 },
  { numero_rata: 12, data_scadenza: '2027-05-20', importo: 427.92 },
  { numero_rata: 13, data_scadenza: '2027-06-21', importo: 429.33 },
  { numero_rata: 14, data_scadenza: '2027-07-20', importo: 430.71 },
  { numero_rata: 15, data_scadenza: '2027-08-20', importo: 432.13 },
  { numero_rata: 16, data_scadenza: '2027-09-20', importo: 433.54 },
  { numero_rata: 17, data_scadenza: '2027-10-20', importo: 434.92 },
  { numero_rata: 18, data_scadenza: '2027-11-22', importo: 436.34 },
  { numero_rata: 19, data_scadenza: '2027-12-20', importo: 169.65 },
  { numero_rata: 20, data_scadenza: '2027-12-20', importo: 268.06 },
  { numero_rata: 21, data_scadenza: '2028-01-20', importo: 439.12 },
  { numero_rata: 22, data_scadenza: '2028-02-21', importo: 440.54 },
  { numero_rata: 23, data_scadenza: '2028-03-20', importo: 441.86 },
  { numero_rata: 24, data_scadenza: '2028-04-20', importo: 443.28 },
  { numero_rata: 25, data_scadenza: '2028-05-22', importo: 444.83 },
]

export function groupRateByMonth(rate) {
  const grouped = {}
  rate.forEach(r => {
    const [year, month] = r.data_scadenza.split('-')
    const key = `${year}-${month}`
    const months = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE']
    const displayKey = `${months[parseInt(month) - 1]} ${year}`
    if (!grouped[key]) grouped[key] = { displayKey, rate: [] }
    grouped[key].rate.push(r)
  })
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}
