import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

/** Nilai sel: angka → sel numerik, teks → inline string */
export type XCell = string | number | null | undefined

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 0 → A, 1 → B, … 26 → AA */
const colName = (i: number) => {
  let n = i + 1
  let s = ''
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** 'C5' → 2 (indeks kolom 0-based) */
const colIndex = (ref: string) => {
  let n = 0
  for (const ch of ref) {
    if (ch >= 'A' && ch <= 'Z') n = n * 26 + (ch.charCodeAt(0) - 64)
    else if (ch >= 'a' && ch <= 'z') n = n * 26 + (ch.charCodeAt(0) - 96)
    else break
  }
  return n - 1
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const cellXml = (v: XCell, ri: number, ci: number): string => {
  if (v === null || v === undefined || v === '') return ''
  const ref = `${colName(ci)}${ri + 1}`
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
  const s = String(v)
  // angka polos (tanpa nol depan) → sel numerik agar rapi & bisa dihitung
  if (/^(0|[1-9]\d*)(\.\d+)?$/.test(s)) return `<c r="${ref}"><v>${s}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`
}

const sheetXml = (rows: XCell[][]) =>
  `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
    .map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cellXml(v, ri, ci)).join('')}</row>`)
    .join('')}</sheetData></worksheet>`

const workbookXml = (count: number) =>
  `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${Array.from(
    { length: count },
    (_, i) => `<sheet name="${i === 0 ? 'Data' : `Data${i + 1}`}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join('')}</sheets></workbook>`

const workbookRelsXml = (count: number) =>
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from(
    { length: count },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join(
    '',
  )}<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

const contentTypesXml = (count: number) =>
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

const stylesXml = `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`

/** Bangun file .xlsx (Uint8Array) dari baris-baris — murni, tanpa unduh */
export function buildXLSX(rows: XCell[][]): Uint8Array {
  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypesXml(1)),
      '_rels/.rels': strToU8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
      'xl/workbook.xml': strToU8(workbookXml(1)),
      'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml(1)),
      'xl/styles.xml': strToU8(stylesXml),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml(rows)),
    },
    { level: 6 },
  )
}

/** Unduh baris-baris sebagai file .xlsx — kolom rapi di Excel/Sheets/WPS apa pun locale */
export function downloadXLSX(filename: string, rows: XCell[][]) {
  const blob = new Blob([buildXLSX(rows) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parse .xlsx (buffer) menjadi baris-baris string — sheet pertama */
export function parseXLSX(data: ArrayBuffer): string[][] {
  const files = unzipSync(new Uint8Array(data))
  if (!files['xl/workbook.xml'] || !files['xl/_rels/workbook.xml.rels']) {
    throw new Error('File bukan .xlsx yang valid')
  }

  const parser = new DOMParser()
  const wb = parser.parseFromString(strFromU8(files['xl/workbook.xml']), 'application/xml')
  const sheetEl = wb.getElementsByTagName('sheet')[0]
  if (!sheetEl) throw new Error('Sheet tidak ditemukan')
  const rid =
    sheetEl.getAttribute('r:id') ||
    sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
    'rId1'

  const rels = parser.parseFromString(strFromU8(files['xl/_rels/workbook.xml.rels']), 'application/xml')
  let target = ''
  for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
    if (rel.getAttribute('Id') === rid) { target = rel.getAttribute('Target') || ''; break }
  }
  const sheetPath = 'xl/' + target.replace(/^\/+/, '').replace(/^xl\//, '')
  const sheetBytes = files[sheetPath]
  if (!sheetBytes) throw new Error('Isi sheet tidak ditemukan')

  // sharedStrings (dipakai Excel saat menyimpan)
  const shared: string[] = []
  if (files['xl/sharedStrings.xml']) {
    const ss = parser.parseFromString(strFromU8(files['xl/sharedStrings.xml']), 'application/xml')
    for (const si of Array.from(ss.getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join(''))
    }
  }

  const sheet = parser.parseFromString(strFromU8(sheetBytes), 'application/xml')
  const rows: string[][] = []
  for (const rowEl of Array.from(sheet.getElementsByTagName('row'))) {
    const cells: (string | undefined)[] = []
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') || ''
      const idx = ref ? Math.max(0, colIndex(ref)) : cells.length
      const t = c.getAttribute('t')
      let val = ''
      if (t === 'inlineStr') {
        val = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent || '').join('')
      } else if (t === 's') {
        const i = parseInt(c.getElementsByTagName('v')[0]?.textContent || '0', 10)
        val = shared[i] ?? ''
      } else {
        val = c.getElementsByTagName('v')[0]?.textContent ?? ''
      }
      cells[idx] = val
    }
    rows.push(Array.from(cells, (v) => v ?? ''))
  }
  // buang baris kosong di ujung
  while (rows.length && rows[rows.length - 1].every((f) => f.trim() === '')) rows.pop()
  return rows
}
