export interface LoanRequest {
  request_id: string;
  borrower: string;
  lender: string;
  loan_amount: string;
  collateral_amount: string;
  interest_rate: string;
  loan_duration_days: string;
  status: number; // 0: Pending, 1: Approved, 2: Repaid, 3: Defaulted
  borrower_details_hash: string;
  collateral_details_hash: string;
  approval_letter_hash?: string; // Optional since it might not always be present
}

export interface LoanOffer {
    offer_id: string;
    lender: string;
    available_funds: { value: string };
    interest_rate: string;
    loan_duration_days: string;
}
