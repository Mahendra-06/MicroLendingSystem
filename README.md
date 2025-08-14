# Fullstack Blockchain Loan Platform

## Overview
This project implements a decentralized loan platform where users can participate as **lenders** or **borrowers**. The platform supports:
- Lenders creating loan offers (loan amount, interest rate, repayment deadline)
- Borrowers requesting loans with collateral
- Digital contract signing between parties
- Asset collateral transfer to lender during loan period

The stack includes:
- **Frontend:** React (Vite + Tailwind)
- **Backend:** Node.js + Express
- **Smart Contract:** Move (Aptos Blockchain)

## Features
- Lender and borrower dashboards
- Real-time offers/requests listing
- Smart contract enforcing loan terms
- Collateral lock & release logic
- Digital signing of loan agreements

## Project Structure
```
root/
  ├── backend/      # Node.js API
  ├── frontend/     # React UI
  ├── move_contract/ # Move module
  └── README.md
```

## Prerequisites
- Node.js >= 18
- npm or yarn
- Aptos CLI installed & configured
- Git installed

## Setup Instructions
### 1. Clone Repository
```bash
git clone <repo-url>
cd loan-platform
```

### 2. Deploy Move Contract
```bash
cd move_contract
aptos move compile
aptos move publish --profile default
```
**Note:** Ensure your Aptos account has testnet coins.

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # configure contract address, Aptos keys
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The app runs on `http://localhost:5173`

## Workflow
### As a Lender:
1. Select **Lender** role
2. Fill loan offer details (amount, interest, deadline)
3. Submit offer — becomes visible to borrowers

### As a Borrower:
1. Select **Borrower** role
2. Browse lender offers
3. Provide collateral details
4. Sign digital contract — collateral is transferred to lender

## Move Contract Functions
- `create_offer(amount, interest_rate, deadline)`
- `accept_offer(offer_id, collateral_asset)`
- `create_request(amount, collateral_asset)`
- `accept_request(request_id)`
- `repay_loan(loan_id)`
- `release_collateral(loan_id)`

## Backend API Endpoints
- `POST /offers`
- `GET /offers`
- `POST /requests`
- `GET /requests`
- `POST /loan/accept`
- `POST /loan/repay`

## Environment Variables (`backend/.env`)
```
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com
APTOS_PRIVATE_KEY=<your-private-key>
MOVE_CONTRACT_ADDRESS=<published-contract-address>
```

## Deployment
For production, use:
```bash
cd frontend
npm run build
```
Serve the `dist` folder via Nginx or similar.

Backend can be hosted on any Node.js-compatible platform.

## License
