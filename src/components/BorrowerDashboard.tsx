import React from 'react';
import { Box, Typography, Paper, Button, Card, CardContent, CardActions, Divider, TextField, Grid } from '@mui/material';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import HistoryIcon from '@mui/icons-material/History';
import { formatUsdc } from '@/config';

// Mock data - replace with actual data from the blockchain
const mockLoanOffers = [
  {
    id: 1,
    lender: '0x123...456',
    amount: 1000000000, // 1000 USDC in atomic units (6 decimals)
    interestRate: 5,
    duration: 30,
    available: 5000000000, // 5000 USDC in atomic units
  },
  {
    id: 2,
    lender: '0x789...012',
    amount: 2000000000, // 2000 USDC in atomic units
    interestRate: 7,
    duration: 60,
    available: 10000000000, // 10000 USDC in atomic units
  },
];

const BorrowerDashboard: React.FC = () => {
  const { connected } = useWallet();
  const [requestAmount, setRequestAmount] = React.useState<number | string>('');
  const [requestDuration, setRequestDuration] = React.useState<number | string>('');
  const [selectedOffer, setSelectedOffer] = React.useState<number | null>(null);

  const handleRequestLoan = (offerId: number) => {
    setSelectedOffer(offerId);
    // TODO: Implement loan request logic
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer || !requestAmount || !requestDuration) return;
    // Convert USDC to atomic units (6 decimals)
    const amountInAtomicUnits = parseFloat(requestAmount as string) * 1_000_000;
    // TODO: Submit loan request to the blockchain
    console.log('Requesting loan:', { 
      offerId: selectedOffer, 
      amount: amountInAtomicUnits,
      duration: requestDuration 
    });
    setRequestAmount('');
    setRequestDuration('');
    setSelectedOffer(null);
  };

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <MonetizationOnIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Connect your wallet to view available loan offers
        </Typography>
        <Typography color="text.secondary">
          Browse and request loans from lenders in the Aptos network
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Available Loan Offers
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Browse and request loans from lenders in the network
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          {mockLoanOffers.map((offer) => (
            <Box key={offer.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Lender</Typography>
                    <Typography>{offer.lender}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Amount</Typography>
                    <Typography>{formatUsdc(offer.amount)} USDC</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Interest Rate</Typography>
                    <Typography>{offer.interestRate}%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Duration</Typography>
                    <Typography>{offer.duration} days</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Available</Typography>
                    <Typography>{formatUsdc(offer.available)} USDC</Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => handleRequestLoan(offer.id)}
                    disabled={selectedOffer === offer.id}
                  >
                    Request Loan
                  </Button>
                </CardActions>
              </Card>
            </Box>
          ))}
        </Box>
      </Box>

      {selectedOffer && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Request Loan
          </Typography>
          <form onSubmit={handleSubmitRequest}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Loan Amount (USDC)"
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value ? Number(e.target.value) : '')}
                  margin="normal"
                  required
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Duration (days)"
                  type="number"
                  value={requestDuration}
                  onChange={(e) => setRequestDuration(e.target.value ? Number(e.target.value) : '')}
                  margin="normal"
                  required
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
              >
                Submit Request
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setSelectedOffer(null);
                  setRequestAmount('');
                  setRequestDuration('');
                }}
              >
                Cancel
              </Button>
            </Box>
          </form>
        </Paper>
      )}

      <Divider sx={{ my: 4 }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <HistoryIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">My Loan Requests</Typography>
        </Box>
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Your loan requests will appear here
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default BorrowerDashboard;
