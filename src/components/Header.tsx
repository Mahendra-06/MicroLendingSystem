'use client';

import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';

const Header = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Aptos Lending dApp
        </Typography>
        <Box>
          <WalletSelector />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
