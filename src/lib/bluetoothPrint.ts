// Cetak struk via printer thermal Bluetooth (ESC/POS) memakai Web Bluetooth API.
// Mendukung karakteristik standar printer: Nordic UART, Serial Port Service, dan
// profil printer klasik (0xFF02 / 0xFFE1 / 18F0).

export const BT_SUPPORT = typeof navigator !== 'undefined' && 'bluetooth' in navigator

const PRINTER_SERVICES: Array<{ service: number | string; chars: Array<number | string> }> = [
  // Nordic UART Service (umum di printer murah)
  { service: 0x0000ff00, chars: [0x0000ff01, 0x0000ff02, 0x0000ff03] },
  // Serial Port Service
  { service: 0x0000ffe0, chars: [0x0000ffe1, 0x0000ffe2, 0x0000ffe3] },
  // Printer service klasik
  { service: 0x000018f0, chars: [0x00002af1] },
  // Skelton printer profile
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chars: ['bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'] },
]



let device: BluetoothDevice | null = null
let characteristic: BluetoothRemoteGATTCharacteristic | null = null

export type BtState = { connected: boolean; name: string | null }

const listeners = new Set<(s: BtState) => void>()
let state: BtState = { connected: false, name: null }

function setState(s: BtState) {
  state = s
  listeners.forEach((l) => l(state))
}

export function subscribeBt(cb: (s: BtState) => void) {
  listeners.add(cb)
  cb(state)
  return () => listeners.delete(cb)
}

export function getBtState() {
  return state
}

/** Tampilkan dialog pairing/permintaan perangkat Bluetooth dan hubungkan */
export async function connectPrinter(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!BT_SUPPORT) {
    return { ok: false, error: 'Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge di Android, Windows, macOS, Linux, atau ChromeOS.' }
  }
  try {
    const optionalServices = PRINTER_SERVICES.map((s) => s.service)
    const dev = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [0x0000ff00] },
        { services: [0x0000ffe0] },
        { services: [0x000018f0] },
        { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
        // printer generik: nama mengandung kata umum
        { namePrefix: 'Print' },
        { namePrefix: 'print' },
        { namePrefix: 'POS' },
        { namePrefix: 'BT-' },
        { namePrefix: 'MTP' },
        { namePrefix: 'ESC' },
        { namePrefix: 'HM' },
        { namePrefix: 'Goojprt' },
        { namePrefix: 'Xprinter' },
        { namePrefix: 'Rongta' },
        { namePrefix: 'Zjiang' },
      ],
      optionalServices,
    })

    device = dev
    device.addEventListener?.('gattserverdisconnected', () => {
      characteristic = null
      setState({ connected: false, name: null })
    })

    const server = await dev.gatt!.connect()
    const found = await findWritableCharacteristic(server)

    if (!found) {
      await server.disconnect?.()
      device = null
      return { ok: false, error: 'Printer terhubung tapi karakteristik cetak tidak ditemukan. Coba pairing ulang atau gunakan printer yang mendukung mode BLE.' }
    }

    characteristic = found
    setState({ connected: true, name: dev.name || 'Printer Bluetooth' })
    return { ok: true, name: dev.name || 'Printer Bluetooth' }
  } catch (e) {
    const msg = (e as Error).message || String(e)
    if (msg.includes('User cancelled') || msg.includes('choose an item')) {
      return { ok: false, error: 'Pemilihan perangkat dibatalkan.' }
    }
    return { ok: false, error: msg }
  }
}

/** Cari karakteristik writable pertama yang cocok dengan profil printer umum */
async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  let found: BluetoothRemoteGATTCharacteristic | null = null
  for (const svc of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(svc.service as number | string)
      for (const chId of svc.chars) {
        try {
          const ch = await service.getCharacteristic(chId as number | string)
          if (ch.properties.write || ch.properties.writeWithoutResponse) {
            found = ch
            break
          }
        } catch { /* karakteristik tidak ada, lanjut */ }
      }
    } catch { /* service tidak ada, lanjut */ }
    if (found) break
  }

  // fallback: sapu semua service & karakteristik
  if (!found) {
    try {
      const services = await server.getPrimaryServices()
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics()
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              found = ch
              break
            }
          }
        } catch { /* lanjut */ }
        if (found) break
      }
    } catch { /* lanjut */ }
  }

  return found
}

export type ReconnectResult = 'connected' | 'none' | 'failed'

/**
 * Coba sambung ulang TANPA dialog pairing (memakai perangkat yang pernah dipilih
 * pada sesi ini). Return 'none' bila belum pernah pairing → pemanggil membuka dialog.
 */
export async function autoReconnect(): Promise<ReconnectResult> {
  if (characteristic && device?.gatt?.connected) {
    setState({ connected: true, name: device.name || 'Printer Bluetooth' })
    return 'connected'
  }
  if (!device) return 'none'
  try {
    const server = device.gatt?.connected ? device.gatt : await device.gatt!.connect()
    const found = await findWritableCharacteristic(server)
    if (!found) return 'failed'
    characteristic = found
    setState({ connected: true, name: device.name || 'Printer Bluetooth' })
    return 'connected'
  } catch {
    return 'failed'
  }
}

export async function disconnectPrinter() {
  try {
    await device?.gatt?.disconnect()
  } catch { /* abaikan */ }
  device = null
  characteristic = null
  setState({ connected: false, name: null })
}

/** Kirim byte ESC/POS dalam potongan kecil (BLE MTU terbatas) */
async function writeBytes(data: Uint8Array) {
  if (!characteristic) throw new Error('Printer belum terhubung')
  const CHUNK = 180
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK)
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(slice)
    } else {
      await characteristic.writeValue(slice)
    }
    // jeda kecil antar chunk untuk printer lambat
    await new Promise((r) => setTimeout(r, 12))
  }
}

// ---------- ESC/POS helpers ----------
const ESC = 0x1b
const GS = 0x1d

function cmd(...bytes: number[]) {
  return new Uint8Array(bytes)
}

export interface PrintOptions {
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  doubleHeight?: boolean
  doubleWidth?: boolean
}

function setStyle({ align = 'left', bold = false, doubleHeight = false, doubleWidth = false }: PrintOptions) {
  const alignment = align === 'center' ? 1 : align === 'right' ? 2 : 0
  const emphasis = bold ? 1 : 0
  const size = (doubleHeight ? 1 : 0) | (doubleWidth ? 2 : 0)
  return [
    ...cmd(ESC, 0x61, alignment),
    ...cmd(ESC, 0x45, emphasis),
    ...cmd(GS, 0x21, size),
  ]
}

function textLine(t: string) {
  const enc = new TextEncoder()
  return enc.encode(t + '\n')
}

/** Encode string ke CP437-ish bytes (ASCII aman; karakter lokal difallback) */
function safeAscii(t: string) {
  return t
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\n]/g, '.')
}

function encodeText(t: string) {
  const enc = new TextEncoder()
  return enc.encode(safeAscii(t))
}

export interface BtReceiptData {
  businessName: string
  address?: string | null
  phone?: string | null
  orderNo: string
  datetime: string
  channel: string
  lines: Array<{ name: string; qty: number; price: number; total: number }>
  subtotal: number
  discount?: number
  service?: number
  tax?: number
  total: number
  paymentLabel?: string
  paid?: number
  change?: number
  promoText?: string | null
  footer?: string | null
  width?: number
}

function fmt(n: number) {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function pad2(a: string, b: string, w: number) {
  const aa = a.length > w - 1 ? a.slice(0, w - 1) : a
  return aa + ' '.repeat(Math.max(1, w - aa.length - b.length)) + b
}

/** Bangun payload byte struk ESC/POS */
export function buildReceiptBytes(d: BtReceiptData): Uint8Array {
  const W = d.width === 58 ? 32 : 48
  const parts: number[] = []
  const push = (...b: number[]) => parts.push(...b)
  const pushBytes = (arr: Uint8Array) => arr.forEach((x) => parts.push(x))

  // init printer + set codepage
  push(...cmd(ESC, 0x40)) // ESC @ init
  push(...cmd(ESC, 0x74, 0x00)) // codepage CP437

  // header
  pushBytes(new Uint8Array(setStyle({ align: 'center', bold: true, doubleHeight: true })))
  pushBytes(encodeText(d.businessName + '\n'))
  pushBytes(new Uint8Array(setStyle({ align: 'center' })))
  if (d.address) pushBytes(encodeText(d.address.slice(0, W) + '\n'))
  if (d.phone) pushBytes(encodeText('Telp ' + d.phone + '\n'))
  pushBytes(encodeText('\n'))

  // meta
  pushBytes(new Uint8Array(setStyle({})))
  pushBytes(encodeText(pad2('No', d.orderNo, W) + '\n'))
  pushBytes(encodeText(pad2('Tanggal', d.datetime, W) + '\n'))
  pushBytes(encodeText(pad2('Tipe', d.channel, W) + '\n'))
  pushBytes(encodeText('-'.repeat(W) + '\n'))

  // items
  for (const it of d.lines) {
    pushBytes(new Uint8Array(setStyle({})))
    pushBytes(encodeText(it.name.slice(0, W) + '\n'))
    pushBytes(encodeText(pad2(`  ${fmt(it.qty)} x ${fmt(it.price)}`, fmt(it.total), W) + '\n'))
  }
  pushBytes(encodeText('-'.repeat(W) + '\n'))

  // totals
  pushBytes(encodeText(pad2('Subtotal', fmt(d.subtotal), W) + '\n'))
  if (d.discount) pushBytes(encodeText(pad2('Diskon', '-' + fmt(d.discount), W) + '\n'))
  if (d.service) pushBytes(encodeText(pad2('Service', fmt(d.service), W) + '\n'))
  if (d.tax) pushBytes(encodeText(pad2('Pajak', fmt(d.tax), W) + '\n'))
  pushBytes(new Uint8Array(setStyle({ bold: true, doubleHeight: true })))
  pushBytes(encodeText(pad2('TOTAL', fmt(d.total), W) + '\n'))
  pushBytes(new Uint8Array(setStyle({})))
  if (d.paymentLabel) pushBytes(encodeText(pad2('Bayar', d.paymentLabel, W) + '\n'))
  if (d.paid !== undefined) pushBytes(encodeText(pad2('Dibayar', fmt(d.paid), W) + '\n'))
  if (d.change && d.change > 0) pushBytes(encodeText(pad2('Kembali', fmt(d.change), W) + '\n'))

  // footer
  pushBytes(encodeText('\n'))
  if (d.promoText) {
    pushBytes(new Uint8Array(setStyle({ align: 'center', bold: true })))
    pushBytes(encodeText(d.promoText.slice(0, W) + '\n'))
  }
  pushBytes(new Uint8Array(setStyle({ align: 'center' })))
  pushBytes(encodeText((d.footer || 'Terima kasih!') + '\n\n\n'))

  // feed & cut
  push(...cmd(0x0a, 0x0a))
  push(...cmd(GS, 0x56, 0x42, 0x00)) // partial cut

  return new Uint8Array(parts)
}

/** Test print via Bluetooth — struk mini hemat kertas */
export async function printTestPage(info: { businessName: string; width: number }) {
  const bytes = buildReceiptBytes({
    businessName: info.businessName,
    orderNo: 'TEST-PRINT',
    datetime: new Date().toLocaleString('id-ID'),
    channel: 'Uji Cetak',
    lines: [
      { name: 'ABCDEfigh1234567890', qty: 1, price: 12345, total: 12345 },
      { name: 'Kolom uji ketebalan', qty: 2, price: 67890, total: 135780 },
    ],
    subtotal: 148125,
    total: 148125,
    paymentLabel: 'Uji',
    footer: 'Test print berhasil :)',
    width: info.width,
  })
  await writeBytes(bytes)
}

/** Cetak struk transaksi penuh via Bluetooth */
export async function printReceipt(d: BtReceiptData) {
  const bytes = buildReceiptBytes(d)
  await writeBytes(bytes)
}
