import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";
import fs from 'fs';
import path from 'path';

async function main() {
  // Configure the client to use the testnet
  const config = new AptosConfig({
    network: Network.TESTNET,
  });
  const aptos = new Aptos(config);

  // Load the deployment account from private key
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Please set the DEPLOYER_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const account = Account.fromPrivateKey({ privateKey });
  console.log(`Deploying with account: ${account.accountAddress}`);

  // Get the account balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
  });
  console.log(`Account balance: ${balance} APT`);

  if (balance === 0) {
    console.error('Account has 0 APT. Please fund it first using the testnet faucet.');
    process.exit(1);
  }

  // Compile the package
  console.log('Compiling Move package...');
  const packageMetadata = await aptos.compilePackage({
    packageDir: __dirname,
    namedAddresses: {
      LendingContract: account.accountAddress.toString(),
    },
  });

  // Publish the package
  console.log('Publishing package...');
  const txn = await aptos.publishPackageTransaction({
    account: account.accountAddress,
    metadata: packageMetadata,
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  const response = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  console.log('Transaction successful!');
  console.log(`Transaction hash: ${response.hash}`);
  console.log(`Contract address: ${account.accountAddress}`);
}

main().catch(console.error);
