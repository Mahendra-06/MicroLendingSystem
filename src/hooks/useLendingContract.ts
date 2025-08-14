import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../components/WalletProvider';
import { 
  USDC_COIN, 
  CONTRACT_ADDRESS, 
  MODULE_NAME, 
  createEntryFunctionPayload, 
  submitTransaction,
  aptos,
  formatUsdc,
  parseUsdc,
  type Account
} from '../config';

// Define types locally since we're having issues with imports
type LoanStatus = 'pending' | 'approved' | 'rejected' | 'repaid' | 'defaulted';
type OfferStatus = 'open' | 'fulfilled' | 'cancelled';

interface LoanOffer {
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

interface LoanRequest {
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

interface ContractState {
  offers: Record<string, LoanOffer>;
  loans: Record<string, LoanRequest>;
  isLoading: boolean;
  error: Error | null;
}

interface ContractResource<T> {
  data: T;
  type: string;
}

interface OffersData {
  offers: Record<string, LoanOffer>;
}

interface LoansData {
  loans: Record<string, LoanRequest>;
}

interface AccountWithAddress {
  address: string;
  publicKey?: string;
  authKey?: string;
}

type LendingHookReturn = {
  state: ContractState;
  createLoanOffer: (amount: number, interestRate: number, duration: number, collateralRatio: number) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  cancelLoanOffer: (offerId: string) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  requestLoan: (offerId: string, amount: number, durationDays: number) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  approveLoanRequest: (requestId: string) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  rejectLoanRequest: (requestId: string) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  repayLoan: (loanId: string, amount: number) => Promise<{ success: boolean; hash?: string; response?: any; error?: any }>;
  refreshContractData: () => Promise<void>;
  getLoanOffers: (lender?: string) => LoanOffer[];
  getLoanRequests: (borrower?: string, offerId?: string) => LoanRequest[];
  getMyLoans: (borrower?: string) => LoanRequest[];
};

// Polling interval in milliseconds (5 seconds)
const POLL_INTERVAL = 5000;

const useLendingContract = (): LendingHookReturn => {
  const wallet = useWallet();
  const account = wallet?.account as AccountWithAddress | null;
  const isConnected = wallet?.isConnected ?? false;
  
  // State for contract data
  const [state, setState] = useState<ContractState>({
    offers: {},
    loans: {},
    isLoading: true,
    error: null
  });
  
  // Polling reference
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch all contract data
  const fetchContractData = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch offers
      const offersResource = await aptos.getAccountResource({
        accountAddress: CONTRACT_ADDRESS,
        resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::Offers`,
      });
      
      // Fetch loans
      const loansResource = await aptos.getAccountResource({
        accountAddress: CONTRACT_ADDRESS,
        resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::Loans`,
      });
      
      const offersData = offersResource as unknown as ContractResource<OffersData>;
      const loansData = loansResource as unknown as ContractResource<LoansData>;
      
      setState({
        offers: offersData?.data?.offers || {},
        loans: loansData?.data?.loans || {},
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching contract data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch contract data')
      }));
    }
  }, [account?.address]);
  
  // Set up polling for contract data
  useEffect(() => {
    // Initial fetch
    fetchContractData();
    
    // Set up polling
    const interval = setInterval(fetchContractData, POLL_INTERVAL);
    setPollingInterval(interval);
    
    // Clean up
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [account?.address]);
  
  // Manually refresh contract data
  const refreshContractData = useCallback(() => {
    return fetchContractData();
  }, [fetchContractData]);

  // Helper function to check if wallet is connected
  const ensureConnected = useCallback(() => {
    if (!isConnected || !account) {
      throw new Error('Please connect your wallet first');
    }
    return account;
  }, [isConnected, account]);

  // Create a new loan offer
  const createLoanOffer = useCallback(async (
    amount: number,
    interestRate: number,
    duration: number,
    collateralRatio: number
  ) => {
    const currentAccount = ensureConnected();
    
    // Convert USD amount to USDC atomic units
    const usdcAmount = parseUsdc(amount);
    
    const payload = createEntryFunctionPayload(
      'create_offer',
      [USDC_COIN],
      [usdcAmount.toString(), interestRate, duration, collateralRatio]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Cancel a loan offer
  const cancelLoanOffer = useCallback(async (offerId: string) => {
    const currentAccount = ensureConnected();
    
    const payload = createEntryFunctionPayload(
      'cancel_offer',
      [USDC_COIN],
      [offerId]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Request a loan against an offer
  const requestLoan = useCallback(async (offerId: string, amount: number, collateralAmount: number) => {
    const currentAccount = ensureConnected();
    
    // Convert USD amounts to USDC atomic units
    const usdcAmount = parseUsdc(amount);
    const usdcCollateral = parseUsdc(collateralAmount);
    
    const payload = createEntryFunctionPayload(
      'request_loan',
      [USDC_COIN],
      [offerId, usdcAmount.toString(), usdcCollateral.toString()]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Approve a loan request
  const approveLoanRequest = useCallback(async (requestId: string) => {
    const currentAccount = ensureConnected();
    
    const payload = createEntryFunctionPayload(
      'approve_loan',
      [USDC_COIN],
      [requestId]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Reject a loan request
  const rejectLoanRequest = useCallback(async (requestId: string) => {
    const currentAccount = ensureConnected();
    
    const payload = createEntryFunctionPayload(
      'reject_loan',
      [USDC_COIN],
      [requestId]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Repay a loan
  const repayLoan = useCallback(async (loanId: string, amount: number) => {
    const currentAccount = ensureConnected();
    
    // Convert USD amount to USDC atomic units
    const usdcAmount = parseUsdc(amount);
    
    const payload = createEntryFunctionPayload(
      'repay_loan',
      [USDC_COIN],
      [loanId, usdcAmount.toString()]
    );

    return submitTransaction(currentAccount, payload);
  }, [ensureConnected]);

  // Get all loan offers
  const getLoanOffers = useCallback((lender?: string): LoanOffer[] => {
    if (!state.offers) return [];
    
    return Object.entries(state.offers)
      .filter(([_, offer]) => !lender || offer.lender === lender)
      .map(([id, offer]) => ({
        offer_id: id,
        lender: offer.lender,
        amount: offer.amount || 0,
        interest_rate: offer.interest_rate || 0,
        duration_days: offer.duration_days || 0,
        status: offer.status || 'open',
        created_at: offer.created_at || new Date().toISOString(),
        updated_at: offer.updated_at || new Date().toISOString(),
        borrower_details_hash: offer.borrower_details_hash || '',
        collateral_details_hash: offer.collateral_details_hash || ''
      }));
  }, [state.offers]);

  // Get loan requests (optionally filtered by borrower and offerId)
  const getLoanRequests = useCallback((borrower?: string, offerId?: string): LoanRequest[] => {
    if (!state.loans) return [];
    
    return Object.entries(state.loans)
      .filter(([_, loan]) => {
        const matchesBorrower = !borrower || loan.borrower === borrower;
        const matchesOffer = !offerId || loan.offer_id === offerId;
        return matchesBorrower && matchesOffer;
      })
      .map(([id, loan]) => ({
        request_id: id,
        offer_id: loan.offer_id,
        borrower: loan.borrower,
        lender: loan.lender,
        loan_amount: loan.loan_amount || 0,
        interest_rate: loan.interest_rate || 0,
        loan_duration_days: loan.loan_duration_days || 0,
        status: loan.status || 'pending',
        collateral_amount: loan.collateral_amount || 0,
        collateral_value: loan.collateral_value || 0,
        created_at: loan.created_at || new Date().toISOString(),
        updated_at: loan.updated_at || new Date().toISOString(),
        approved_at: loan.approved_at || null,
        repaid_at: loan.repaid_at || null,
        liquidated_at: loan.liquidated_at || null,
        borrower_details_hash: loan.borrower_details_hash || '',
        collateral_details_hash: loan.collateral_details_hash || ''
      }));
  }, [state.loans]);

  const getUserLoans = useCallback((address: string) => {
    const allLoans = getLoanRequests();
    return allLoans.filter(loan => loan.borrower === address || loan.lender === address);
  }, [getLoanRequests]);

  // Create a wrapper for requestLoan to handle the collateral amount calculation
  const requestLoanWrapper = useCallback(async (offerId: string, amount: number, durationDays: number) => {
    // Default collateral amount to 150% of loan amount
    const collateralAmount = amount * 1.5;
    return requestLoan(offerId, amount, collateralAmount);
  }, [requestLoan]);

  // Create a wrapper for getMyLoans
  };
}, [account?.address]);

// Manually refresh contract data
const refreshContractData = useCallback(() => {
  return fetchContractData();
}, [fetchContractData]);

// Helper function to check if wallet is connected
const ensureConnected = useCallback(() => {
  if (!isConnected || !account) {
    throw new Error('Please connect your wallet first');
  }
  return account;
}, [isConnected, account]);

// Create a new loan offer
const createLoanOffer = useCallback(async (
  amount: number,
  interestRate: number,
  duration: number,
  collateralRatio: number
) => {
  const currentAccount = ensureConnected();
  
  // Convert USD amount to USDC atomic units
  const usdcAmount = parseUsdc(amount);
  
  const payload = createEntryFunctionPayload(
    'create_offer',
    [USDC_COIN],
    [usdcAmount.toString(), interestRate, duration, collateralRatio]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Cancel a loan offer
const cancelLoanOffer = useCallback(async (offerId: string) => {
  const currentAccount = ensureConnected();
  
  const payload = createEntryFunctionPayload(
    'cancel_offer',
    [USDC_COIN],
    [offerId]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Request a loan against an offer
const requestLoan = useCallback(async (offerId: string, amount: number, collateralAmount: number) => {
  const currentAccount = ensureConnected();
  
  // Convert USD amounts to USDC atomic units
  const usdcAmount = parseUsdc(amount);
  const usdcCollateral = parseUsdc(collateralAmount);
  
  const payload = createEntryFunctionPayload(
    'request_loan',
    [USDC_COIN],
    [offerId, usdcAmount.toString(), usdcCollateral.toString()]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Approve a loan request
const approveLoanRequest = useCallback(async (requestId: string) => {
  const currentAccount = ensureConnected();
  
  const payload = createEntryFunctionPayload(
    'approve_loan',
    [USDC_COIN],
    [requestId]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Reject a loan request
const rejectLoanRequest = useCallback(async (requestId: string) => {
  const currentAccount = ensureConnected();
  
  const payload = createEntryFunctionPayload(
    'reject_loan',
    [USDC_COIN],
    [requestId]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Repay a loan
const repayLoan = useCallback(async (loanId: string, amount: number) => {
  const currentAccount = ensureConnected();
  
  // Convert USD amount to USDC atomic units
  const usdcAmount = parseUsdc(amount);
  
  const payload = createEntryFunctionPayload(
    'repay_loan',
    [USDC_COIN],
    [loanId, usdcAmount.toString()]
  );

  return submitTransaction(currentAccount, payload);
}, [ensureConnected]);

// Get all loan offers
const getLoanOffers = useCallback((lender?: string): LoanOffer[] => {
  if (!state.offers) return [];
  
  return Object.entries(state.offers)
    .filter(([_, offer]) => !lender || offer.lender === lender)
    .map(([id, offer]) => ({
      offer_id: id,
      lender: offer.lender,
      amount: offer.amount || 0,
      interest_rate: offer.interest_rate || 0,
      duration_days: offer.duration_days || 0,
      status: offer.status || 'open',
      created_at: offer.created_at || new Date().toISOString(),
      updated_at: offer.updated_at || new Date().toISOString(),
      borrower_details_hash: offer.borrower_details_hash || '',
      collateral_details_hash: offer.collateral_details_hash || ''
    }));
}, [state.offers]);

// Get loan requests (optionally filtered by borrower and offerId)
const getLoanRequests = useCallback((borrower?: string, offerId?: string): LoanRequest[] => {
  if (!state.loans) return [];
  
  return Object.entries(state.loans)
    .filter(([_, loan]) => {
      const matchesBorrower = !borrower || loan.borrower === borrower;
      const matchesOffer = !offerId || loan.offer_id === offerId;
      return matchesBorrower && matchesOffer;
    })
    .map(([id, loan]) => ({
      request_id: id,
      offer_id: loan.offer_id,
      borrower: loan.borrower,
      lender: loan.lender,
      loan_amount: loan.loan_amount || 0,
      interest_rate: loan.interest_rate || 0,
      loan_duration_days: loan.loan_duration_days || 0,
      status: loan.status || 'pending',
      collateral_amount: loan.collateral_amount || 0,
      collateral_value: loan.collateral_value || 0,
      created_at: loan.created_at || new Date().toISOString(),
      updated_at: loan.updated_at || new Date().toISOString(),
      approved_at: loan.approved_at || null,
      repaid_at: loan.repaid_at || null,
      liquidated_at: loan.liquidated_at || null,
      borrower_details_hash: loan.borrower_details_hash || '',
      collateral_details_hash: loan.collateral_details_hash || ''
    }));
}, [state.loans]);

const getUserLoans = useCallback((address: string) => {
  const allLoans = getLoanRequests();
  return allLoans.filter(loan => loan.borrower === address || loan.lender === address);
}, [getLoanRequests]);

// Create a wrapper for requestLoan to handle the collateral amount calculation
const requestLoanWrapper = useCallback(async (offerId: string, amount: number, durationDays: number) => {
  // Default collateral amount to 150% of loan amount
  const collateralAmount = amount * 1.5;
  return requestLoan(offerId, amount, collateralAmount);
}, [requestLoan]);

// Create a wrapper for getMyLoans
const getMyLoans = useCallback((borrower?: string) => {
  const address = borrower || (account?.address ? account.address.toString() : '');
  return address ? getLoanRequests(address) : [];
}, [account?.address, getLoanRequests]);

return {
  state: {
    offers: state.offers || {},
    loans: state.loans || {},
    isLoading: state.isLoading,
    error: state.error
  },
  createLoanOffer,
  cancelLoanOffer,
  requestLoan: requestLoanWrapper,
  approveLoanRequest,
  rejectLoanRequest,
  repayLoan,
  refreshContractData: fetchContractData,
  getLoanOffers,
  getLoanRequests,
  getMyLoans
};

export default useLendingContract;
