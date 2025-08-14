// jest.setup.js
import '@testing-library/jest-dom';

// Mock window.aptos
Object.defineProperty(window, 'aptos', {
  writable: true,
  value: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    account: jest.fn(),
    signAndSubmitTransaction: jest.fn(),
    signMessage: jest.fn(),
    onAccountChange: jest.fn(),
    onNetworkChange: jest.fn(),
  },
});

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: '',
      asPath: '',
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => null),
      prefetch: jest.fn(() => null),
    };
  },
}));

// Mock the wallet provider
jest.mock('../src/components/WalletProvider', () => ({
  useWallet: () => ({
    connect: jest.fn(),
    account: { address: '0x123' },
    network: { name: 'testnet' },
    connected: true,
    wallet: { name: 'Petra' },
  }),
}));
