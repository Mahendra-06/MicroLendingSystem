/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Enable TypeScript type checking during build
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Environment variables that should be available to the client
  env: {
    NEXT_PUBLIC_MODULE_ADDRESS: '0x4733658581be088fe23e99fce8a8de7e8fe975682f402c4394461521aa246706',
    NEXT_PUBLIC_USDC_COIN: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    NEXT_PUBLIC_APTOS_NETWORK: 'testnet',
    NEXT_PUBLIC_APTOS_NODE_URL: 'https://fullnode.testnet.aptoslabs.com',
    NEXT_PUBLIC_APTOS_FAUCET_URL: 'https://faucet.testnet.aptoslabs.com',
  },
  
  // Enable webpack 5 for better performance
  webpack: (config, { isServer }) => {
    // Add fallbacks for Node.js core modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: 'mock',
        child_process: false,
      };
    }
    
    // Add support for .mjs files (required by some dependencies)
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    });
    
    return config;
  },
  
  // SWC minification is enabled by default in Next.js 13+
};

export default nextConfig;
