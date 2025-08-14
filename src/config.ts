import { 
  Aptos, 
  AptosConfig, 
  Network, 
  type Account, 
  type AccountAddress, 
  type U64,
  type InputGenerateTransactionPayloadData,
  type InputGenerateTransactionOptions,
  type PendingTransactionResponse
} from '@aptos-labs/ts-sdk';

export type { Account };

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';

// Backend API URL
export const API_BASE_URL = isProduction 
  ? 'https://your-production-api-url.com/api' 
  : 'http://localhost:3001/api';

// Deployed contract address
export const CONTRACT_ADDRESS = '0x4733658581be088fe23e99fce8a8de7e8fe975682f402c4394461521aa246706';

// Module name
export const MODULE_NAME = 'lending';

// Contract resource account address (if applicable)
export const RESOURCE_ACCOUNT = '';

// USDC token address (Aptos testnet USDC address)
export const USDC_COIN = '0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T';

// Default transaction options
export const DEFAULT_TX_OPTIONS: InputGenerateTransactionOptions = {
  maxGasAmount: BigInt(200000),
  gasUnitPrice: BigInt(100),
  expireTimestamp: BigInt(Math.floor(Date.now() / 1000) + 300), // 5 minutes from now
};

// Configure for Aptos testnet
const aptosConfig = new AptosConfig({ 
  network: Network.TESTNET,
  fullnode: 'https://fullnode.testnet.aptoslabs.com',
  faucet: 'https://faucet.testnet.aptoslabs.com'
});

export const aptos = new Aptos(aptosConfig);

// Helper function to format USDC amount (from atomic units)
export const formatUsdc = (amount: number | bigint): number => {
  return Number(amount) / 1e6; // USDC has 6 decimals
};

// Helper function to parse USDC amount (to atomic units)
export const parseUsdc = (amount: number): bigint => {
  return BigInt(Math.floor(amount * 1e6));
};

// Helper function to create entry function payload
export const createEntryFunctionPayload = (
  functionName: string,
  typeArgs: string[],
  args: any[]
): InputGenerateTransactionPayloadData => {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::${functionName}`,
    typeArguments: typeArgs,
    functionArguments: args,
  };
};

// Helper function to handle transaction submission
export const submitTransaction = async (
  sender: Account,
  payload: InputGenerateTransactionPayloadData
) => {
  try {
    // Generate raw transaction
    const rawTxn = await aptos.transaction.build.simple({
      sender: sender.accountAddress,
      data: payload,
      options: {
        maxGasAmount: 1000,
        gasUnitPrice: 100,
      } as InputGenerateTransactionOptions
    });

    // Sign transaction
    const senderAuthenticator = await aptos.transaction.sign({
      signer: sender,
      transaction: rawTxn
    });

    // Submit transaction
    const pendingTxn = await aptos.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator
    });

    // Wait for transaction confirmation
    const response = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash
    });

    return {
      success: true,
      hash: pendingTxn.hash,
      response,
    };
  } catch (error: any) {
    console.error('Transaction failed:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
};
