import { Links, MoneyAmount, PaymentInstruction } from "./common"

export interface refundPayment {
  amount?: MoneyAmount
  invoice_id?: string
  note_to_payer?: string
  payment_instruction?: PaymentInstruction
}

export interface CapturesRefundResponse {
  id: string
  status: "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED"
  status_details?: any
  amount?: MoneyAmount
  note_to_payer?: string
  seller_payable_breakdown?: any
  invoice_id?: string
  create_time?: string
  update_time?: string
  links?: Links
}

export interface captureAuthorizedPayment {
  amount?: MoneyAmount
  final_capture?: boolean
  invoice_id?: string
  note_to_payer?: string
  payment_instruction?: PaymentInstruction
  soft_descriptor?: string
}

export interface CapturesAuthorizationResponse {
  id: string
  status:
    | "COMPLETED"
    | "DECLINED"
    | "PARTIALLY_REFUNDED"
    | "PENDING"
    | "REFUNDED"
    | "FAILED"
  status_details?: any
  amount?: MoneyAmount
  created_time?: string
  update_time?: string
  custom_id?: string
  disbursement_mode?: "INSTANT" | "DELAYED"
  final_capture?: boolean
  invoice_id?: string
  links?: Links
  processor_response?: any
  seller_protection?: any
  seller_receivable_breakdown?: any
  supplementary_data?: any
}
