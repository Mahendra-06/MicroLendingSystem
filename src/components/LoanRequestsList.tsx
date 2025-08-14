'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  CircularProgress, 
  Alert, 
  Chip, 
  IconButton, 
  Tooltip,
  ListItemAvatar,
  Avatar,
  ChipProps
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { formatUsdc } from '../config';
import { LoanRequest } from '../types';
import useLendingContract from '../hooks/useLendingContract';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

interface ActionStatus {
  [key: string]: {
    loading: boolean;
    error: string | null;
  };
}

interface LoanRequest {
  request_id: string;
  borrower: string;
  loan_amount: string | number;
  status: string;
  // Add other properties as needed
}

const getStatusColor = (status: string): ChipProps['color'] => {
  if (!status) return 'default';
  
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'pending': return 'primary';
    case 'approved': return 'success';
    case 'rejected': return 'error';
    case 'repaid': return 'default';
    case 'defaulted': return 'warning';
    default: return 'default';
  }
};

const getStatusText = (status: string): string => {
  // Capitalize first letter
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const LoanRequestsList = () => {
  const { account } = useWallet();
  const { getLoanRequests, approveLoanRequest, rejectLoanRequest } = useLendingContract();
  
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [actionStatus, setActionStatus] = useState<ActionStatus>({});

  const fetchRequests = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      setLoading(true);
      setError(null);
      const fetchedRequests = await getLoanRequests();
      if (Array.isArray(fetchedRequests)) {
        setRequests(fetchedRequests);
        setLastUpdated(new Date());
      } else {
        console.error('Invalid response format from getLoanRequests');
        setError('Invalid response from server. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching loan requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load loan requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [account, getLoanRequests]);

  useEffect(() => {
    // Set isClient to true on mount to avoid hydration mismatch
    setIsClient(true);
    
    // Initial fetch
    fetchRequests();
    
    // Set up polling every 15 seconds
    const intervalId = setInterval(fetchRequests, 15000);
    
    return () => clearInterval(intervalId);
  }, [fetchRequests]);

  const updateActionStatus = (requestId: string, updates: Partial<ActionStatus[string]>) => {
    setActionStatus(prev => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || { loading: false, error: null }),
        ...updates
      }
    }));
  };

  const handleApprove = async (requestId: string) => {
    if (!account?.address) {
      updateActionStatus(requestId, { 
        error: 'Wallet not connected' 
      });
      return;
    }
    
    try {
      updateActionStatus(requestId, { loading: true, error: null });
      await approveLoanRequest(requestId);
      await fetchRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      updateActionStatus(requestId, { 
        error: err instanceof Error ? err.message : 'Failed to approve request',
        loading: false
      });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!account?.address) {
      updateActionStatus(requestId, { 
        error: 'Wallet not connected' 
      });
      return;
    }
    
    try {
      updateActionStatus(requestId, { loading: true, error: null });
      await rejectLoanRequest(requestId);
      await fetchRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
      updateActionStatus(requestId, { 
        error: err instanceof Error ? err.message : 'Failed to reject request',
        loading: false
      });
    }
  };

  if (!account?.address) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Please connect your wallet to view loan requests.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">
          Loan Requests
        </Typography>
        <Box display="flex" alignItems="center">
          <IconButton 
            onClick={fetchRequests} 
            color="primary" 
            size="small"
            disabled={loading}
            title="Refresh requests"
            sx={{ mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          {isClient && lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>

      {loading && requests.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Box mt={1}>
            <button 
              onClick={fetchRequests} 
              style={{ 
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.875rem'
              }}
            >
              Retry
            </button>
          </Box>
        </Alert>
      ) : requests.length === 0 ? (
        <Alert severity="info">
          No loan requests found. When borrowers request loans from your offers, they will appear here.
        </Alert>
      ) : (
        <List>
          {requests.map((request) => {
            const statusColor = getStatusColor(request.status);
            const statusText = getStatusText(request.status);
            const isLoading = actionStatus[request.request_id]?.loading || false;
            
            return (
              <Box key={request.request_id} mb={2}>
                <ListItem 
                  divider
                  secondaryAction={
                    request.status.toLowerCase() === 'pending' && (
                      <Box display="flex" gap={1}>
                        <Tooltip title="Approve Request">
                          <IconButton 
                            edge="end" 
                            color="success"
                            onClick={() => handleApprove(request.request_id)}
                            disabled={isLoading}
                            size="small"
                          >
                            {isLoading ? (
                              <CircularProgress size={24} />
                            ) : (
                              <CheckCircleIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject Request">
                          <IconButton 
                            edge="end" 
                            color="error"
                            onClick={() => handleReject(request.request_id)}
                            disabled={isLoading}
                            size="small"
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar>
                      <RequestQuoteIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography component="span" variant="subtitle1">
                        Request for {formatUsdc(request.loan_amount)} USDC
                      </Typography>
                    }
                    secondary={
                      <Box component="div">
                        <Box component="span" display="block">
                          <Typography component="span" variant="body2">
                            <strong>Borrower:</strong> {`${request.borrower.slice(0, 6)}...${request.borrower.slice(-4)}`}
                          </Typography>
                        </Box>
                        <Box component="span" display="block">
                          <Typography component="span" variant="body2">
                            <strong>Status:</strong> 
                            <Chip 
                              label={statusText} 
                              size="small" 
                              color={statusColor}
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            />
                          </Typography>
                        </Box>
                        <Box component="span" display="block">
                          <Typography component="span" variant="caption" color="text.secondary">
                            Request ID: {request.request_id}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {actionStatus[request.request_id]?.error && (
                  <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
                    {actionStatus[request.request_id].error}
                  </Alert>
                )}
              </Box>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default LoanRequestsList;
