// Export the base types
export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'repaid' | 'defaulted';
export type OfferStatus = 'open' | 'fulfilled' | 'cancelled';

// Define interfaces
export interface LoanOffer {
  offer_id: string;
  lender: string;
  amount: number;
  interest_rate: number;
  duration_days: number;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
  borrower_details_hash?: string;
  collateral_details_hash?: string;
}

export interface LoanRequest {
  request_id: string;
  offer_id: string;
  borrower: string;
  lender: string;
  loan_amount: number;
  interest_rate: number;
  loan_duration_days: number;
  status: LoanStatus;
  collateral_amount: number;
  collateral_value: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  repaid_at: string | null;
  liquidated_at: string | null;
  borrower_details_hash: string;
  collateral_details_hash: string;
}

export interface ContractState {
  offers: Record<string, LoanOffer>;
  loans: Record<string, LoanRequest>;
  isLoading: boolean;
  error: Error | null;
}

export interface ContractResource<T> {
  data: T;
  type: string;
}

export interface OffersData {
  offers: Record<string, LoanOffer>;
}

export interface LoansData {
  loans: Record<string, LoanRequest>;
}

export interface AccountWithAddress {
  address: string;
  publicKey?: string;
  authKey?: string;
  // Add any other properties that might be needed from the Account type
}
