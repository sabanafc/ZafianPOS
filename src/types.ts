export type Channel = 'dine_in' | 'takeaway' | 'gofood' | 'grabfood' | 'shopeefood'
export type PaymentMethod = 'cash' | 'qris' | 'transfer'

export interface Category { id: string; name: string; sort_order: number; is_active: boolean }
export interface Product { id: string; category_id: string | null; name: string; price: number; image_url: string | null; is_active: boolean }
export interface Ingredient {
  id: string; name: string; unit: string; stock: number; min_stock: number; cost_per_unit: number
  purchase_unit: string | null; purchase_qty: number | null; purchase_price: number | null
  low_stock_alert: boolean; is_active: boolean
}
export interface RecipeItem { id: string; product_id: string; ingredient_id: string; qty: number; ingredient?: Ingredient }
export interface Shift {
  id: string; opening_float: number; opened_at: string; closed_at: string | null
  expected_cash: number | null; counted_cash: number | null; cash_diff: number | null; status: 'open' | 'closed'
}
export interface CashMovement { id: string; shift_id: string; type: 'in' | 'out'; amount: number; note: string | null; created_at: string }
export interface Order {
  id: string; order_no: string; shift_id: string | null; channel: Channel
  subtotal: number; discount: number; tax: number; service: number; total: number; cost_total: number
  payment_method: PaymentMethod | null; paid_amount: number | null; change_amount: number | null
  status: 'paid' | 'void'; note: string | null; created_at: string
  items?: OrderItem[]
}
export interface OrderItem { id?: string; order_id?: string; product_id: string | null; name: string; price: number; qty: number; cost_of_goods: number; line_total: number }
export interface StockMovement { id: string; ingredient_id: string; order_id: string | null; type: 'purchase' | 'usage' | 'adjustment' | 'waste'; qty: number; stock_after: number; note: string | null; created_at: string }
export interface FinanceEntry { id: string; type: 'income' | 'expense'; category: string; amount: number; note: string | null; entry_date: string }
export interface Settings {
  id: number; business_name: string; address: string | null; phone: string | null
  tax_percent: number; service_percent: number; receipt_footer: string | null
  paper_width: number; default_float: number; dark_mode: boolean
  auto_print: boolean; print_margin_mm: number; print_font_scale: number
  promo_text: string | null; show_promo_on_receipt: boolean
}

export const ONLINE_CHANNELS: Channel[] = ['gofood', 'grabfood', 'shopeefood']
export const isOnlineChannel = (c: Channel) => ONLINE_CHANNELS.includes(c)
