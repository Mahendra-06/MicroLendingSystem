import axios from 'axios';
import { API_BASE_URL } from '../config';

// Create axios instance with base URL and headers
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
  timeout: 30000, // 30 seconds timeout
});

// Add a request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API Service for Authentication
export const authService = {
  // Request a nonce for wallet authentication
  requestNonce: async (address: string) => {
    const response = await api.post('/auth/nonce', { address });
    return response.data.nonce;
  },

  // Authenticate with signature
  authenticate: async (address: string, signature: string) => {
    const response = await api.post('/auth/verify', { address, signature });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// API Service for Loan Offers
export const offerService = {
  // Get all loan offers
  getAllOffers: async () => {
    try {
      const response = await api.get('/offers');
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  },

  // Get offer by ID
  getOfferById: async (offerId: string) => {
    try {
      const response = await api.get(`/offers/${offerId}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  },

  // Create a new loan offer
  createOffer: async (offerData: {
    amount: number;
    interestRate: number;
    durationDays: number;
    collateralType?: string;
    minCreditScore?: number;
  }) => {
    try {
      const response = await api.post('/offers', {
        amount: offerData.amount,
        interestRate: offerData.interestRate,
        durationDays: offerData.durationDays,
        ...(offerData.collateralType && { collateralType: offerData.collateralType }),
        ...(offerData.minCreditScore && { minCreditScore: offerData.minCreditScore })
      });
      return { data: response.data, error: null };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash // Include transaction hash if available
      };
    }
  },

  // Cancel a loan offer
  cancelOffer: async (offerId: string) => {
    try {
      const response = await api.delete(`/offers/${offerId}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash // Include transaction hash if available
      };
    }
  },

  // Get offers by lender
  getOffersByLender: async (lenderAddress: string) => {
    try {
      const response = await api.get(`/offers/lender/${lenderAddress}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  }
};

// API Service for Loans
export const loanService = {
  // Get all loans (for admins)
  getAllLoans: async () => {
    try {
      const response = await api.get('/loans');
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  },

  // Get loan by ID
  getLoanById: async (loanId: string) => {
    try {
      const response = await api.get(`/loans/${loanId}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  },

  // Request a new loan
  requestLoan: async (loanData: {
    offerId: string;
    amount: number;
    collateralAmount?: number;
    collateralValue?: number;
    borrowerDocHash?: string;
  }) => {
    try {
      const response = await api.post('/loans/request', {
        offerId: loanData.offerId,
        amount: loanData.amount,
        ...(loanData.collateralAmount && { collateralAmount: loanData.collateralAmount }),
        ...(loanData.collateralValue && { collateralValue: loanData.collateralValue }),
        ...(loanData.borrowerDocHash && { borrowerDocHash: loanData.borrowerDocHash })
      });
      return { 
        data: response.data, 
        error: null,
        txHash: response.data.txHash
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash
      };
    }
  },

  // Approve and disburse loan (lender action)
  approveAndDisburse: async (loanId: string) => {
    try {
      const response = await api.post(`/loans/${loanId}/approve`);
      return { 
        data: response.data, 
        error: null,
        txHash: response.data.txHash
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash
      };
    }
  },

  // Record loan repayment (borrower action)
  recordRepayment: async (loanId: string, amount: number) => {
    try {
      const response = await api.post(`/loans/${loanId}/repay`, { amount });
      return { 
        data: response.data, 
        error: null,
        txHash: response.data.txHash
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash
      };
    }
  },

  // Liquidate loan (lender action)
  liquidateLoan: async (loanId: string) => {
    try {
      const response = await api.post(`/loans/${loanId}/liquidate`);
      return { 
        data: response.data, 
        error: null,
        txHash: response.data.txHash
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message,
        txHash: error.response?.data?.txHash
      };
    }
  },

  // Get loans for borrower
  getBorrowerLoans: async (borrowerAddress: string) => {
    try {
      const response = await api.get(`/loans/borrower/${borrowerAddress}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  },

  // Get loans for lender
  getLenderLoans: async (lenderAddress: string) => {
    try {
      const response = await api.get(`/loans/lender/${lenderAddress}`);
      return { data: response.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data?.message || error.message };
    }
  }
};

// Types for user profile
export interface UserProfile {
  address: string;
  name?: string;
  email?: string;
  creditScore?: number;
  isLender: boolean;
  isBorrower: boolean;
  createdAt: string;
  updatedAt: string;
}

// API Service for User
export const userService = {
  // Get user profile
  getProfile: async (address: string) => {
    try {
      const response = await api.get(`/users/${address}`);
      return { data: response.data as UserProfile, error: null };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  },

  // Update user profile
  updateProfile: async (address: string, profileData: { 
    name?: string; 
    email?: string; 
    creditScore?: number;
    isLender?: boolean;
    isBorrower?: boolean;
  }) => {
    try {
      const response = await api.put(`/users/${address}`, profileData);
      return { 
        data: response.data as UserProfile, 
        error: null 
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  },

  // Register as a lender
  registerAsLender: async (address: string, profileData: { name?: string; email?: string }) => {
    try {
      const response = await api.post(`/users/${address}/register-lender`, profileData);
      return { 
        data: response.data as UserProfile, 
        error: null 
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  },

  // Register as a borrower
  registerAsBorrower: async (address: string, profileData: { 
    name?: string; 
    email?: string;
    creditScore?: number;
  }) => {
    try {
      const response = await api.post(`/users/${address}/register-borrower`, profileData);
      return { 
        data: response.data as UserProfile, 
        error: null 
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  },

  // Get user's credit score
  getCreditScore: async (address: string) => {
    try {
      const response = await api.get(`/users/${address}/credit-score`);
      return { 
        data: response.data as { score: number; lastUpdated: string }, 
        error: null 
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  },

  // Get user's activity
  getActivity: async (address: string) => {
    try {
      const response = await api.get(`/users/${address}/activity`);
      return { 
        data: response.data as Array<{
          type: 'LOAN_CREATED' | 'LOAN_REPAID' | 'OFFER_CREATED' | 'OFFER_ACCEPTED';
          timestamp: string;
          data: any;
        }>, 
        error: null 
      };
    } catch (error: any) {
      return { 
        data: null, 
        error: error.response?.data?.message || error.message 
      };
    }
  }
};

export default api;
