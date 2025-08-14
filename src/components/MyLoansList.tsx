'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, List, ListItem, ListItemText, CircularProgress, Alert, Button } from '@mui/material';

import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';

import { aptos, formatUsdc, CONTRACT_ADDRESS, MODULE_NAME } from '../config';
import { LoanRequest } from '@/types';

const MyLoansList = () => {
  const { account, signAndSubmitTransaction } = useWallet();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repayStatus, setRepayStatus] = useState<{ [key: string]: { loading: boolean; error: string | null } }>({});

  const fetchLoans = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const platformConfig = await aptos.getAccountResource({
        accountAddress: CONTRACT_ADDRESS,
        resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::PlatformConfig`,
      });

      const totalRequests = (platformConfig.data as any).total_requests;
      const loanRequestsTableHandle = (platformConfig.data as any).loan_requests.handle;
      const requestPromises = [];

      for (let i = 0; i < totalRequests; i++) {
        requestPromises.push(
          aptos.getTableItem<LoanRequest>({ 
            handle: loanRequestsTableHandle, 
            data: { 
              key: i.toString(), 
              key_type: 'u64', 
              value_type: `${CONTRACT_ADDRESS}::${MODULE_NAME}::LoanRequest` 
            } 
          })
        );
      }

      const fetchedRequests = await Promise.all(requestPromises);

      // Filter for loans taken by the current user that are approved (status 1)
      setLoans(fetchedRequests.filter(req => req.borrower === account.address.toString() && req.status === 1));
    } catch (e: any) {
      console.error(e);
      setError('Failed to fetch your loans. Is the module deployed and initialized?');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleRepay = async (loan: LoanRequest) => {
    if (!account) return;

    setRepayStatus(prev => ({ ...prev, [loan.request_id]: { loading: true, error: null } }));

    const transaction: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::repay_loan`,
        functionArguments: [loan.request_id],
      },
    };

    try {
      const response = await signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      setRepayStatus(prev => ({ ...prev, [loan.request_id]: { loading: false, error: null } }));
      fetchLoans(); // Refresh list
    } catch (e: any) {
      console.error(e);
      setRepayStatus(prev => ({ ...prev, [loan.request_id]: { loading: false, error: e.message || 'An error occurred.' } }));
    }
  };

  if (!account) {
    return null; // Don't show this component if wallet is not connected
  }

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        My Active Loans
      </Typography>
      {loans.length === 0 ? (
        <Typography>You have no active loans.</Typography>
      ) : (
        <List>
          {loans.map((loan) => {
            const displayInterest = Number(loan.interest_rate) / 100;
            const loanAmount = typeof loan.loan_amount === 'string' 
              ? parseInt(loan.loan_amount, 10) 
              : Number(loan.loan_amount);
            const collateralAmount = typeof loan.collateral_amount === 'string'
              ? parseInt(loan.collateral_amount, 10)
              : Number(loan.collateral_amount);

            return (
              <ListItem
                key={loan.request_id}
                divider
                secondaryAction={
                  <Button 
                    variant="contained" 
                    onClick={() => handleRepay(loan)}
                    disabled={repayStatus[loan.request_id]?.loading}
                    sx={{ minWidth: '120px' }}
                  >
                    {repayStatus[loan.request_id]?.loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'Repay Loan'
                    )}
                  </Button>
                }
              >
                <ListItemText
                  primary={`Loan #${loan.request_id} from ${loan.lender}`}
                  secondary={
                    <Box component="span">
                      <Typography component="span" variant="body2" display="block">
                        {`Amount: ${formatUsdc(loanAmount)} USDC`}
                      </Typography>
                      <Typography component="span" variant="body2" display="block">
                        {`Interest: ${displayInterest}%`}
                      </Typography>
                      <Typography component="span" variant="body2" display="block">
                        {`Collateral: ${formatUsdc(collateralAmount)} USDC`}
                      </Typography>
                      {repayStatus[loan.request_id]?.error && (
                        <Alert 
                          severity="error" 
                          sx={{ mt: 1, p: 0.5, fontSize: '0.75rem' }}
                        >
                          {repayStatus[loan.request_id]?.error}
                        </Alert>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default MyLoansList;
