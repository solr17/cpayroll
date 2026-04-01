export interface BankPaymentRecord {
  employeeName: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  amountCents: number;
  reference: string;
  payNowId?: string;
}

export interface BankFileResult {
  filename: string;
  content: string;
  format: string;
  recordCount: number;
  totalAmountCents: number;
}
