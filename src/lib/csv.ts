/**
 * Parse teks CSV hasil baca file (delimiter ; atau ,). Kolom per baris;
 * baris pertama = header. Mendukung kutip ganda berisi delimiter/baris baru.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const delim = (text.split('\n')[0]?.match(/;/g)?.length || 0) >= (text.split('\n')[0]?.match(/,/g)?.length || 0) ? ';' : ','
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c === '\r') { /* abaikan (CRLF) */ }
    else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  // buang baris kosong di ujung
  while (rows.length && rows[rows.length - 1].every((f) => f.trim() === '')) rows.pop()
  return rows
}

export function downloadCSV(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = rows.map((r) => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
