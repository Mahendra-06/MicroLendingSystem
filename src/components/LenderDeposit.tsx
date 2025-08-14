'use client';

import { useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';
import { aptos } from '@/config';
const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || '';

const LenderDeposit = () => {
  const { account, signAndSubmitTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!account) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!amount || !interestRate || !duration) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Convert USDC to atomic units (6 decimals)
    const parsedAmount = Math.floor(parseFloat(amount) * 1_000_000); // USDC has 6 decimals
    const parsedInterest = Math.floor(parseFloat(interestRate) * 100); // Convert to basis points
    const parsedDuration = parseInt(duration, 10);

    const transaction: InputTransactionData = {
      data: {
        function: `${MODULE_ADDRESS}::lending::deposit`,
        functionArguments: [parsedAmount, parsedInterest, parsedDuration],
      },
    };

    try {
      const response = await signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      setSuccess(`Transaction successful with hash: ${response.hash}`);
      setAmount('');
      setInterestRate('');
      setDuration('');
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

    

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Create a Loan Offer
      </Typography>
      <Box component="form" sx={{ mt: 2 }}>
        <TextField
          label="Amount (USDC)"
          variant="outlined"
          fullWidth
          margin="normal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <TextField
          label="Interest Rate (%)"
          variant="outlined"
          fullWidth
          margin="normal"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
          type="number"
        />
        <TextField
          label="Loan Duration (Days)"
          variant="outlined"
          fullWidth
          margin="normal"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          type="number"
        />
        <Button variant="contained" color="primary" onClick={handleDeposit} sx={{ mt: 2 }} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Deposit Funds'}
        </Button>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      </Box>
    </Box>
  );
};

export default LenderDeposit;
