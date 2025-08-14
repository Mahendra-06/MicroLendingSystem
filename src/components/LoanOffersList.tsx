'use client';

import { useEffect, useState, useCallback } from 'react';
import BorrowerRequest from './BorrowerRequest';
import { Box, Typography, List, ListItem, ListItemText, CircularProgress, Alert, Button, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import { formatUsdc } from '../config';
import { LoanOffer } from '../types';
import useLendingContract from '../hooks/useLendingContract';

// Extended type for the component's internal use
interface LoanOfferWithAvailableFunds extends Omit<LoanOffer, 'interest_rate' | 'duration_days'> {
  interest_rate: string;
  duration_days: string;
  available_funds: { value: string };
  loan_duration_days: string;
}

const LoanOffersList = () => {
  const [offers, setOffers] = useState<LoanOfferWithAvailableFunds[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOfferWithAvailableFunds | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { getLoanOffers } = useLendingContract();

  const handleRequestClick = (offer: LoanOffer) => {
    setSelectedOffer(offer);
  };

  const handleCloseRequest = () => {
    setSelectedOffer(null);
    // Refresh offers after a request is submitted
    fetchOffers();
  };

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching loan offers...');
      const fetchedOffers = await getLoanOffers();
      
      console.log('Fetched offers:', fetchedOffers);
      
      // Type guard to check if an object is a valid LoanOffer
      const isValidLoanOffer = (obj: any): obj is LoanOffer => {
        return (
          obj &&
          typeof obj === 'object' &&
          'offer_id' in obj &&
          'lender' in obj &&
          'amount' in obj &&
          'interest_rate' in obj &&
          'duration_days' in obj
        );
      };

      // Transform and validate the offers
      const validOffers: LoanOfferWithAvailableFunds[] = fetchedOffers
        .filter(isValidLoanOffer)
        .map(offer => ({
          // Base LoanOffer fields
          offer_id: offer.offer_id,
          lender: offer.lender,
          amount: offer.amount,
          status: offer.status || 'open',
          created_at: offer.created_at || new Date().toISOString(),
          updated_at: offer.updated_at || new Date().toISOString(),
          // Optional fields with defaults
          borrower_details_hash: offer.borrower_details_hash || '',
          collateral_details_hash: offer.collateral_details_hash || '',
          // Converted fields to string for UI
          interest_rate: offer.interest_rate.toString(),
          duration_days: offer.duration_days.toString(),
          // UI-specific fields
          available_funds: { value: offer.amount.toString() },
          loan_duration_days: offer.duration_days.toString()
        }));
      
      setOffers(validOffers);
      setLastUpdated(new Date());
    } catch (e: any) {
      console.error('Error fetching offers:', e);
      setError(e.message || 'Failed to fetch loan offers');
    } finally {
      setLoading(false);
    }
  }, [getLoanOffers]);

  // Initial fetch
  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);
  
  // Set up polling to refresh offers periodically
  useEffect(() => {
    const intervalId = setInterval(fetchOffers, 15000); // Refresh every 15 seconds
    return () => clearInterval(intervalId);
  }, [fetchOffers]);

  if (loading && offers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Box mt={1}>
          <Button onClick={fetchOffers} size="small" color="inherit">
            Retry
          </Button>
        </Box>
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">
          Available Loan Offers
        </Typography>
        <Box display="flex" alignItems="center">
          <IconButton 
            onClick={fetchOffers} 
            color="primary" 
            size="small"
            disabled={loading}
            title="Refresh offers"
            sx={{ mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>
      
      {selectedOffer ? (
        <BorrowerRequest offer={selectedOffer} onClose={handleCloseRequest} />
      ) : (
        <>
          {offers.length === 0 ? (
            <Alert severity="info">
              No loan offers available at the moment. Please check back later.
            </Alert>
          ) : (
            <List>
              {offers.map((offer) => (
                <ListItem
                  key={offer.offer_id}
                  divider
                  secondaryAction={
                    <Button 
                      variant="contained" 
                      onClick={() => handleRequestClick(offer)}
                      disabled={parseInt(offer.available_funds.value) <= 0}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Request Loan
                    </Button>
                  }
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1" fontWeight="medium">
                          {formatUsdc(parseInt(offer.available_funds.value))} USDC Available
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          (Offer #{offer.offer_id})
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box component="div" mt={1}>
                        <Box component="span" display="block">
                          <Typography component="span" variant="body2">
                            <strong>Interest Rate:</strong> {offer.interest_rate}% | 
                            <strong>Duration:</strong> {offer.loan_duration_days} days
                          </Typography>
                        </Box>
                        <Box component="span" display="block" mt={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            Lender: {`${offer.lender.slice(0, 6)}...${offer.lender.slice(-4)}`}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Box>
  );
};

export default LoanOffersList;
