import { renderHook, act } from '@testing-library/react';
import useLendingContract from '../hooks/useLendingContract';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { aptos } from '../config';

// Mock the useWallet hook
jest.mock('@aptos-labs/wallet-adapter-react');

// Mock the aptos client
jest.mock('../config', () => ({
  aptos: {
    getAccountResource: jest.fn(),
  },
  CONTRACT_ADDRESS: '0x123',
  MODULE_NAME: 'lending',
  USDC_COIN: '0x1::usdc::USDC',
  formatUsdc: (val: number) => val,
  parseUsdc: (val: number) => val,
  createEntryFunctionPayload: jest.fn(),
  submitTransaction: jest.fn(),
  APTOS_NODE_URL: 'https://testnet.aptoslabs.com',
}));

describe('useLendingContract', () => {
  const mockAccount = {
    address: '0x123',
    publicKey: '0xpublicKey',
    authKey: '0xauthKey',
    address: {
      hex: '0x123',
      toString: () => '0x123'
    }
  };

  const mockOffers = {
    '1': {
      offer_id: '1',
      lender: '0x123',
      amount: 1000000, // 1 USDC (6 decimals)
      interest_rate: 10, // 10%
      duration_days: 30, // 30 days
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      borrower_details_hash: '',
      collateral_details_hash: ''
    },
  };

  const mockLoans = {
    '1': {
      request_id: '1',
      offer_id: '1',
      borrower: '0x456',
      lender: '0x123',
      loan_amount: 500000, // 0.5 USDC
      interest_rate: 10,
      loan_duration_days: 30,
      status: 'pending',
      collateral_amount: 1000000, // 1 USDC
      collateral_value: 1000000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approved_at: null,
      repaid_at: null,
      liquidated_at: null,
      borrower_details_hash: 'doc_hash_123',
      collateral_details_hash: 'collateral_hash_123'
    },
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock the wallet connection
    (useWallet as jest.Mock).mockReturnValue({
      account: mockAccount,
      isConnected: true,
    });

    // Mock the account resource responses
    (aptos.getAccountResource as jest.Mock)
      .mockImplementation(({ resourceType }) => {
        if (resourceType.includes('Offers')) {
          return Promise.resolve({
            data: { offers: mockOffers },
          });
        }
        if (resourceType.includes('Loans')) {
          return Promise.resolve({
            data: { loans: mockLoans },
          });
        }
        return Promise.resolve({});
      });
  });

  it('should fetch offers and loans on mount', async () => {
    const { result } = renderHook(() => useLendingContract());

    // Initial state
    expect(result.current.state.isLoading).toBe(true);
    expect(result.current.state.error).toBeNull();

    // Wait for the initial data to be loaded
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // After loading
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
    
    // Check if offers were fetched
    const offers = result.current.getLoanOffers();
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].lender).toBe('0x123');
    
    // Check if loans were fetched
    const loans = result.current.getLoanRequests();
    expect(loans.length).toBeGreaterThan(0);
    expect(loans[0].borrower).toBe('0x456');
  });

  it('should handle errors when fetching data', async () => {
    const errorMessage = 'Failed to fetch data';
    (aptos.getAccountResource as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useLendingContract());
    
    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch contract data');
  });

  it('should filter loan requests by offer ID', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLendingContract());
    await waitForNextUpdate();

    const filteredLoans = result.current.getLoanRequests('1');
    expect(filteredLoans).toHaveLength(1);
    expect(filteredLoans[0].offer_id).toBe('1');
  });

  it('should return empty arrays when no data is available', async () => {
    (aptos.getAccountResource as jest.Mock).mockResolvedValue({ data: {} });
    
    const { result, waitForNextUpdate } = renderHook(() => useLendingContract());
    await waitForNextUpdate();

    expect(result.current.getLoanOffers()).toHaveLength(0);
    expect(result.current.getLoanRequests()).toHaveLength(0);
  });

  it('should clean up polling on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useLendingContract());
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
