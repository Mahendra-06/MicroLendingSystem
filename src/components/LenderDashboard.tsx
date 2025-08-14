import React from 'react';
import { Box, Typography, Paper, Button, Grid, Card, CardContent, CardActions, Divider, TextField, Tabs, Tab } from '@mui/material';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { formatUsdc } from '@/config';

// Mock data - replace with actual data from the blockchain
const mockLoanOffers = [
  {
    id: 1,
    amount: 1000000000, // 1000 USDC in atomic units (6 decimals)
    interestRate: 5,
    duration: 30,
    remaining: 5000000000, // 5000 USDC in atomic units
    active: true,
  },
  {
    id: 2,
    amount: 2000000000, // 2000 USDC in atomic units
    interestRate: 7,
    duration: 60,
    remaining: 10000000000, // 10000 USDC in atomic units
    active: true,
  },
];

const mockLoanRequests = [
  {
    id: 1,
    borrower: '0xabc...def',
    amount: 500000000, // 500 USDC in atomic units
    offerId: 1,
    status: 'Pending',
  },
  {
    id: 2,
    borrower: '0xghi...jkl',
    amount: 1000000000, // 1000 USDC in atomic units
    offerId: 2,
    status: 'Pending',
  },
];

const LenderDashboard: React.FC = () => {
  const { connected } = useWallet();
  const [tabValue, setTabValue] = React.useState(0);
  const [offerAmount, setOfferAmount] = React.useState('');
  const [interestRate, setInterestRate] = React.useState('');
  const [duration, setDuration] = React.useState('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert USDC to atomic units (6 decimals)
    const amountInAtomicUnits = parseFloat(offerAmount) * 1_000_000;
    // TODO: Create loan offer on the blockchain
    console.log('Creating loan offer:', { 
      amount: amountInAtomicUnits, 
      interestRate, 
      duration 
    });
    setOfferAmount('');
    setInterestRate('');
    setDuration('');
  };

  const handleApproveRequest = (requestId: number) => {
    // TODO: Approve loan request on the blockchain
    console.log('Approving loan request:', requestId);
  };

  const handleRejectRequest = (requestId: number) => {
    // TODO: Reject loan request on the blockchain
    console.log('Rejecting loan request:', requestId);
  };

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <AccountBalanceWalletIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Connect your wallet to manage your lending portfolio
        </Typography>
        <Typography color="text.secondary">
          Create loan offers and manage your lending activities
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="My Offers" />
        <Tab label="Loan Requests" />
        <Tab label="Active Loans" />
      </Tabs>

      {tabValue === 0 && (
        <Box>
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Create New Loan Offer
            </Typography>
            <form onSubmit={handleCreateOffer}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Amount (USDC)"
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  required
                  margin="normal"
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Interest Rate (%)"
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  required
                  margin="normal"
                  inputProps={{ min: 0, step: 0.1 }}
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Duration (days)"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  margin="normal"
                />
              </Box>
            </Box>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              sx={{ mt: 2 }}
            >
              Create Offer
            </Button>
            </form>
          </Paper>

          <Typography variant="h6" gutterBottom>
            My Loan Offers
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
            {mockLoanOffers.map((offer) => (
              <Box key={offer.id}>
                <Card>
                  <CardContent>
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
                      <Typography color="text.secondary">Remaining</Typography>
                      <Typography>{formatUsdc(offer.remaining)} USDC</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography color="text.secondary">Status</Typography>
                      <Typography color={offer.active ? 'success.main' : 'error.main'}>
                        {offer.active ? 'Active' : 'Inactive'}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                    {offer.active ? (
                      <Button 
                        variant="outlined" 
                        color="error"
                        onClick={() => console.log('Cancel offer:', offer.id)}
                      >
                        Cancel Offer
                      </Button>
                    ) : (
                      <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={() => console.log('Reactivate offer:', offer.id)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Pending Loan Requests
          </Typography>
          {mockLoanRequests.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {mockLoanRequests.map((request) => (
                <Box key={request.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Borrower</Typography>
                        <Typography>{request.borrower}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Amount</Typography>
                        <Typography>{formatUsdc(request.amount)} USDC</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Offer ID</Typography>
                        <Typography>#{request.offerId}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Status</Typography>
                        <Typography color={request.status === 'Pending' ? 'warning.main' : 'inherit'}>
                          {request.status}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2, gap: 1 }}>
                      <Button 
                        variant="contained" 
                        color="success"
                        size="small"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        Approve
                      </Button>
                      <Button 
                        variant="outlined" 
                        color="error"
                        size="small"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        Reject
                      </Button>
                    </CardActions>
                  </Card>
                </Box>
              ))}
            </Box>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No pending loan requests
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {tabValue === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Active Loans
          </Typography>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Your active loans will appear here
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default LenderDashboard;
