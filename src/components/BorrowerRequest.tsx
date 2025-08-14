'use client';

import { useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';

const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || '';
import { aptos, CONTRACT_ADDRESS, MODULE_NAME, formatUsdc, USDC_COIN, MODULE_ADDRESS } from '../config';
import { LoanOffer } from '../types';

interface BorrowerRequestProps {
  offer: LoanOffer;
  onClose: () => void;
}

const BorrowerRequest = ({ offer, onClose }: BorrowerRequestProps) => {
  const { account, signAndSubmitTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [collateral, setCollateral] = useState('');
  const [borrowerDetailsFile, setBorrowerDetailsFile] = useState<File | null>(null);
  const [collateralDetailsFile, setCollateralDetailsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!account) {
      setError('Please connect your wallet first.');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid loan amount.');
      return;
    }
    
    if (!collateral || parseFloat(collateral) <= 0) {
      setError('Please enter a valid collateral amount.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert USDC to atomic units (6 decimals)
      const parsedAmount = Math.floor(parseFloat(amount) * 1_000_000);
      const parsedCollateral = Math.floor(parseFloat(collateral) * 1_000_000);

      console.log('Submitting loan request with:', {
        offerId: offer.offer_id,
        amount: parsedAmount,
        collateral: parsedCollateral,
        borrower: account.address
      });

      // In a real app, you would upload files to IPFS here and get the hashes
      // For now, we'll use dummy hashes if files are not provided
      const borrowerDetailsHash = borrowerDetailsFile 
        ? `ipfs_hash_borrower_${Date.now()}` 
        : '';
      // Collateral type is USDC; collateral_value equals amount in USDC atomic units.
      const collateralValue = parsedCollateral;

      const transaction: InputTransactionData = {
        data: {
          function: `${MODULE_ADDRESS}::lending::request_loan`,
          // Using USDC for both loan coin and collateral coin types
          typeArguments: [USDC_COIN, USDC_COIN],
          functionArguments: [
            offer.lender, // lender_addr
            offer.offer_id, // offer_id
            parsedAmount.toString(), // request_amount
            parsedCollateral.toString(), // collateral_amount
            collateralValue.toString(), // collateral_value (in USDC atomic units)
            borrowerDetailsHash, // borrower_doc_hash (IPFS or other hash)
          ],
        },
      };

      console.log('Transaction payload:', JSON.stringify(transaction, null, 2));

      const response = await signAndSubmitTransaction(transaction);
      console.log('Transaction submitted, waiting for confirmation...', response.hash);
      
      // Wait for transaction confirmation
      const result = await aptos.waitForTransaction({ 
        transactionHash: response.hash 
      });
      
      console.log('Transaction confirmed:', result);
      
      setSuccess(`Loan request submitted successfully! Transaction hash: ${response.hash}`);
      
      // Reset form and close modal after a delay
      setTimeout(() => {
        setAmount('');
        setCollateral('');
        setBorrowerDetailsFile(null);
        setCollateralDetailsFile(null);
        onClose();
      }, 3000);
      
      return response.hash;
    } catch (e: any) {
      console.error('Error submitting loan request:', e);
      const errorMsg = e.message || 
                      e.details?.message || 
                      'Failed to submit loan request. Please try again.';
      setError(errorMsg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid grey', borderRadius: 2, mt: 2 }}>
      <Typography variant="h6">Request Loan Against Offer #{offer.offer_id}</Typography>
      <Typography variant="body2">Lender: {offer.lender}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Amount: {formatUsdc(offer.amount)} USDC
      </Typography>
      <TextField
        label="Loan Amount (USDC)"
        variant="outlined"
        fullWidth
        margin="normal"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <TextField
        label="Collateral Amount (USDC)"
        variant="outlined"
        fullWidth
        margin="normal"
        type="number"
        value={collateral}
        onChange={(e) => setCollateral(e.target.value)}
      />
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button variant="contained" component="label">
          Upload Borrower Details
          <input
            type="file"
            hidden
            onChange={(e) => setBorrowerDetailsFile(e.target.files ? e.target.files[0] : null)}
          />
        </Button>
        {borrowerDetailsFile && <Typography variant="body2">Selected: {borrowerDetailsFile.name}</Typography>}

        <Button variant="contained" component="label">
          Upload Collateral Details
          <input
            type="file"
            hidden
            onChange={(e) => setCollateralDetailsFile(e.target.files ? e.target.files[0] : null)}
          />
        </Button>
        {collateralDetailsFile && <Typography variant="body2">Selected: {collateralDetailsFile.name}</Typography>}
      </Box>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleRequest} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Submit Request'}
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
    </Box>
  );
};

export default BorrowerRequest;
