module LendingContract::lending {
    use aptos_framework::coin;
    use std::signer;
    use std::string;
    use std::timestamp;
    use aptos_framework::account;
    use aptos_std::table;
    use aptos_std::event;
    use std::vector;
    use aptos_std::type_info;
    use aptos_std::fixed_point32;

    // --- Errors ---
    const E_PLATFORM_ALREADY_INITIALIZED: u64 = 1;
    const E_LOAN_OFFER_NOT_FOUND: u64 = 2;
    const E_LOAN_OFFER_NOT_ACTIVE: u64 = 3;
    const E_INSUFFICIENT_FUNDS_IN_OFFER: u64 = 4;
    const E_LOAN_NOT_FOUND: u64 = 5;
    const E_NOT_LENDER: u64 = 6;
    const E_NOT_BORROWER: u64 = 7;
    const E_LOAN_NOT_ACTIVE: u64 = 8;
    const E_LOAN_ALREADY_REPAID: u64 = 9;
    const E_LOAN_NOT_OVERDUE: u64 = 10;
    const E_LOAN_ALREADY_ACTIVE: u64 = 11;
    const E_OFFER_IN_USE: u64 = 12; // Cannot cancel offer that has active loans
    const E_INSUFFICIENT_COLLATERAL: u64 = 13;
    const E_COLLATERAL_NOT_FOUND: u64 = 14;
    const E_INVALID_COLLATERAL_RATIO: u64 = 15;
    const E_COLLATERAL_ALREADY_DEPOSITED: u64 = 16;
    const E_COLLATERAL_NOT_LIQUIDATABLE: u64 = 17;
    
    // Constants
    const MAX_LTV_RATIO: u64 = 7500; // 75% LTV ratio (in basis points)
    const LIQUIDATION_THRESHOLD: u64 = 8000; // 80% of LTV (in basis points)
    const LIQUIDATION_BONUS: u64 = 1050; // 5% bonus for liquidators (in basis points)

    // Collateral information for a loan
    struct Collateral<phantom AssetType> has store {
        amount: u64,
        asset_type: type_info::TypeInfo,
        deposit_timestamp: u64,
        last_updated: u64,
        is_liquidated: bool,
    }

    // Active loan with enhanced collateral handling
    struct Loan<phantom CoinType> has key {
        loan_id: u64,
        offer_id: u64,
        lender: address,
        borrower: address,
        principal: u64,
        interest_rate: u64,
        duration_secs: u64,
        start_ts: u64,
        due_ts: u64,
        collateral: Option<Collateral<CoinType>>,
        collateral_value: u64, // Value in stablecoin terms
        borrower_doc_hash: vector<u8>,
        approval_doc_hash: vector<u8>,
        is_repaid: bool,
        is_active: bool,
        ltv_ratio: u64, // Current LTV ratio in basis points
        liquidation_threshold: u64, // LTV at which liquidation is triggered
    }

    // Generic loan container to store loans of different coin types
    struct LoanContainer has store {
        loan_id: u64,
        coin_type: type_info::TypeInfo,
    }

    // PlatformConfig stored at admin address - Fixed to use LoanContainer
    struct PlatformConfig has key {
        admin: address,
        resource_signer_cap: account::SignerCapability, // To hold and transfer funds
        loan_offer_counter: u64,
        loan_counter: u64,
        // We'll use a vector to store offer IDs and their types
        offer_ids: vector<u64>,
        // Store loan metadata with type info
        loan_containers: table::Table<u64, LoanContainer>,
    }

    // A lender's offer (lender sets amount, interest, duration)
    struct LoanOffer<phantom CoinType> has store {
        offer_id: u64,
        lender: address,
        amount: u64,            // stablecoin amount available in offer
        interest_rate: u64,     // e.g., basis points or percent * 100
        duration_secs: u64,     // loan duration
        remaining: u64,         // remaining available in this offer
        active: bool,
    }

    // Struct to store all offers for a specific coin type for a lender
    struct LoanOffers<phantom CoinType> has key {
        offers: table::Table<u64, LoanOffer<CoinType>>,
    }

    // Store loans of a specific coin type
    struct Loans<phantom CoinType> has key {
        loans: table::Table<u64, Loan<CoinType>>,
    }

    // Events for backend indexing
    #[event]
    struct OfferCreatedEvent has store, copy, drop { 
        offer_id: u64, 
        lender: address, 
        amount: u64 
    }
    
    #[event]
    struct LoanRequestedEvent has store, copy, drop { 
        loan_id: u64, 
        offer_id: u64, 
        borrower: address, 
        amount: u64 
    }
    
    #[event]
    struct LoanDisbursedEvent has store, copy, drop { 
        loan_id: u64, 
        lender: address, 
        borrower: address, 
        principal: u64 
    }
    
    #[event]
    struct RepaymentEvent has store, copy, drop { 
        loan_id: u64, 
        amount: u64, 
        offchain_tx_ref: vector<u8> 
    }
    
    #[event]
    struct LiquidationEvent has store, copy, drop { 
        loan_id: u64, 
        result_ref: vector<u8> 
    }
    
    #[event]
    struct OfferCancelledEvent has store, copy, drop {
        offer_id: u64,
        lender: address,
        amount: u64
    }
    
    #[event]
    struct CollateralDepositedEvent has store, drop {
        loan_id: u64,
        borrower: address,
        amount: u64,
        asset_type: string::String,
        timestamp: u64
    }
    
    #[event]
    struct CollateralWithdrawnEvent has store, drop {
        loan_id: u64,
        borrower: address,
        amount: u64,
        asset_type: string::String,
        timestamp: u64
    }
    
    #[event]
    struct CollateralLiquidatedEvent has store, drop {
        loan_id: u64,
        liquidator: address,
        amount: u64,
        liquidator_share: u64,
        protocol_share: u64,
        asset_type: string::String,
        reason: vector<u8>
    }
    
    #[event]
    struct CollateralReleasedEvent has store, drop {
        loan_id: u64,
        borrower: address,
        amount: u64,
        asset_type: string::String
    }

    /* ---------- public APIs (high-level) ---------- */

    // admin initializes platform at their address
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<PlatformConfig>(admin_addr), E_PLATFORM_ALREADY_INITIALIZED);

        let (_resource_signer, resource_signer_cap) = account::create_resource_account(admin, b"lending_escrow");

        move_to(admin, PlatformConfig {
            admin: admin_addr,
            resource_signer_cap,
            loan_offer_counter: 0,
            loan_counter: 0,
            offer_ids: vector::empty(),
            loan_containers: table::new(),
        });
    }

    // Lender deposits fiat off-chain, backend mints stablecoin to lender,
    // then lender creates an on-chain loan offer specifying terms.
    public entry fun create_offer<CoinType>(
        lender: &signer,
        offer_amount: u64,
        interest_rate: u64,
        duration_secs: u64
    ) acquires PlatformConfig, LoanOffers {
        let lender_addr = signer::address_of(lender);
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);

        // Get the resource signer and address
        let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
        let resource_addr = signer::address_of(&resource_signer);

        // The resource account must be registered for the coin type to receive deposits.
        if (!coin::is_account_registered<CoinType>(resource_addr)) {
            coin::register<CoinType>(&resource_signer);
        };

        // Transfer the funds to the platform's resource account to be held in escrow.
        let coins = coin::withdraw<CoinType>(lender, offer_amount);
        coin::deposit(resource_addr, coins);

        let offer_id = config.loan_offer_counter;
        config.loan_offer_counter = offer_id + 1;

        // Store the offer in a resource under the lender's account
        let offer = LoanOffer<CoinType> {
            offer_id,
            lender: lender_addr,
            amount: offer_amount,
            interest_rate,
            duration_secs,
            remaining: offer_amount,
            active: true,
        };

        // Store the offer in a resource under the lender's account
        if (!exists<LoanOffers<CoinType>>(lender_addr)) {
            move_to(lender, LoanOffers<CoinType> {
                offers: table::new(),
            });
        };
        let offers = borrow_global_mut<LoanOffers<CoinType>>(lender_addr);
        table::add(&mut offers.offers, offer_id, offer);

        // Add the offer ID to the global list
        vector::push_back(&mut config.offer_ids, offer_id);

        event::emit(OfferCreatedEvent {
            offer_id,
            lender: lender_addr,
            amount: offer_amount,
        });
    }

    // Borrower creates a loan request tied to an offer
    public entry fun request_loan<CoinType, CollateralType>(
        borrower: &signer,
        lender_addr: address,
        offer_id: u64,
        request_amount: u64,
        collateral_amount: u64,
        collateral_value: u64, // Value of collateral in stablecoin terms
        borrower_doc_hash: vector<u8>
    ) acquires PlatformConfig, LoanOffers, Loans {
        let borrower_addr = signer::address_of(borrower);
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);

        // Get the lender's offers
        assert!(exists<LoanOffers<CoinType>>(lender_addr), E_LOAN_OFFER_NOT_FOUND);
        let offers = borrow_global_mut<LoanOffers<CoinType>>(lender_addr);
        
        assert!(table::contains(&offers.offers, offer_id), E_LOAN_OFFER_NOT_FOUND);
        let offer = table::borrow_mut(&mut offers.offers, offer_id);
        
        assert!(offer.active, E_LOAN_OFFER_NOT_ACTIVE);
        assert!(offer.remaining >= request_amount, E_INSUFFICIENT_FUNDS_IN_OFFER);

        // Calculate and validate LTV ratio
        let ltv_ratio = if (collateral_value > 0) {
            (request_amount * 10000) / collateral_value // Basis points
        } else {
            0
        };
        
        // Ensure LTV is within acceptable range
        assert!(ltv_ratio <= MAX_LTV_RATIO, E_INVALID_COLLATERAL_RATIO);
        
        // Update offer remaining amount
        offer.remaining = offer.remaining - request_amount;

        let loan_id = config.loan_counter;
        config.loan_counter = loan_id + 1;

        // Create the loan
        // Create collateral if amount > 0
        let collateral = if (collateral_amount > 0) {
            // In a real implementation, this would transfer the collateral
            // from the borrower to the contract's escrow
            option::some(Collateral<CollateralType> {
                amount: collateral_amount,
                asset_type: type_info::type_of<CollateralType>(),
                deposit_timestamp: timestamp::now_seconds(),
                last_updated: timestamp::now_seconds(),
                is_liquidated: false,
            })
        } else {
            option::none<Collateral<CollateralType>>()
        };

        let new_loan = Loan<CoinType> {
            loan_id,
            offer_id,
            lender: lender_addr,
            borrower: borrower_addr,
            principal: request_amount,
            interest_rate: offer.interest_rate,
            duration_secs: offer.duration_secs,
            start_ts: 0, // Will be set on disbursement
            due_ts: 0,   // Will be set on disbursement
            collateral,
            collateral_value,
            borrower_doc_hash,
            approval_doc_hash: vector::empty<u8>(),
            is_repaid: false,
            is_active: false, // Becomes active upon disbursement
            ltv_ratio,
            liquidation_threshold: (MAX_LTV_RATIO * LIQUIDATION_THRESHOLD) / 10000, // 80% of MAX_LTV
        };

        // Store loans in a separate resource by coin type
        if (!exists<Loans<CoinType>>(@LendingContract)) {
            let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
            move_to(&resource_signer, Loans<CoinType> {
                loans: table::new(),
            });
        };
        
        let loans_resource = borrow_global_mut<Loans<CoinType>>(@LendingContract);
        table::add(&mut loans_resource.loans, loan_id, new_loan);

        // Add loan container to track the loan with its type
        let loan_container = LoanContainer {
            loan_id,
            coin_type: type_info::type_of<CoinType>(),
        };
        table::add(&mut config.loan_containers, loan_id, loan_container);

        event::emit(LoanRequestedEvent {
            loan_id,
            offer_id,
            borrower: borrower_addr,
            amount: request_amount,
        });
    }

    // A simple interest calculation. Assumes interest_rate is in basis points (1% = 100).
    fun calculate_interest(principal: u64, interest_rate: u64): u64 {
        (principal * interest_rate) / 10000
    }

    public entry fun approve_and_disburse<CoinType>(
        lender: &signer,
        loan_id: u64,
        approval_doc_hash: vector<u8>
    ) acquires PlatformConfig, Loans {
        let lender_addr = signer::address_of(lender);
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);

        // Get the loan from the typed loans resource
        assert!(exists<Loans<CoinType>>(@LendingContract), E_LOAN_NOT_FOUND);
        let loans_resource = borrow_global_mut<Loans<CoinType>>(@LendingContract);
        assert!(table::contains(&loans_resource.loans, loan_id), E_LOAN_NOT_FOUND);
        let loan = table::borrow_mut(&mut loans_resource.loans, loan_id);

        // Verify the lender is the one approving
        assert!(loan.lender == lender_addr, E_NOT_LENDER);
        assert!(!loan.is_active, E_LOAN_ALREADY_ACTIVE);

        // Update loan with approval details
        loan.approval_doc_hash = approval_doc_hash;

        // Withdraw from the platform's resource account (escrow)
        let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
        let resource_addr = signer::address_of(&resource_signer);
        
        // Ensure the resource account is registered for the coin type
        if (!coin::is_account_registered<CoinType>(resource_addr)) {
            coin::register<CoinType>(&resource_signer);
        };
        
        // Transfer the funds to the borrower
        let coins = coin::withdraw<CoinType>(&resource_signer, loan.principal);
        coin::deposit(loan.borrower, coins);

        // Update loan status
        let start_ts = timestamp::now_seconds();
        loan.is_active = true;
        loan.start_ts = start_ts;
        loan.due_ts = start_ts + loan.duration_secs;

        event::emit(LoanDisbursedEvent {
            loan_id,
            lender: lender_addr,
            borrower: loan.borrower,
            principal: loan.principal,
        });
    }

    // When borrower repays, release collateral if any
    public entry fun record_repayment<CoinType, CollateralType>(
        borrower: &signer,
        loan_id: u64
    ) acquires Loans, PlatformConfig {
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);
        let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
        let borrower_addr = signer::address_of(borrower);

        // Get the loan from the typed loans resource
        assert!(exists<Loans<CoinType>>(@LendingContract), E_LOAN_NOT_FOUND);
        let loans_resource = borrow_global_mut<Loans<CoinType>>(@LendingContract);
        assert!(table::contains(&loans_resource.loans, loan_id), E_LOAN_NOT_FOUND);
        let loan = table::borrow_mut(&mut loans_resource.loans, loan_id);

        // Verify the borrower is the one repaying
        assert!(loan.borrower == borrower_addr, E_NOT_BORROWER);
        assert!(loan.is_active, E_LOAN_NOT_ACTIVE);
        assert!(!loan.is_repaid, E_LOAN_ALREADY_REPAID);

        // Calculate interest and total repayment amount
        let interest = calculate_interest(loan.principal, loan.interest_rate);
        let total_repayment = loan.principal + interest;

        // Borrower transfers the funds to the lender
        let coins = coin::withdraw<CoinType>(borrower, total_repayment);
        coin::deposit(loan.lender, coins);

        // Mark the loan as repaid
        loan.is_repaid = true;
        loan.is_active = false;

        // Release collateral if any exists
        if (option::is_some(&loan.collateral)) {
            let collateral = option::extract(&mut loan.collateral);
            // In a real implementation, transfer collateral back to borrower
            // This is a placeholder for the actual transfer logic
            event::emit(CollateralReleasedEvent {
                loan_id,
                borrower: borrower_addr,
                amount: collateral.amount,
                asset_type: string::utf8(b"COLLATERAL_TYPE"), // Would use actual type name
            });
        }

        event::emit(RepaymentEvent {
            loan_id,
            amount: total_repayment,
            offchain_tx_ref: vector::empty<u8>(), // Could include off-chain transaction reference
        });
    }

    // Liquidate if overdue or undercollateralized; called by liquidator
    public entry fun liquidate<CoinType, CollateralType>(
        liquidator: &signer,
        loan_id: u64,
        current_collateral_value: u64, // Current market value of collateral
        result_ref: vector<u8>
    ) acquires Loans, PlatformConfig {
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);
        let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
        let liquidator_addr = signer::address_of(liquidator);
        let lender_addr = signer::address_of(lender);

        // Get the loan from the typed loans resource
        assert!(exists<Loans<CoinType>>(@LendingContract), E_LOAN_NOT_FOUND);
        let loans_resource = borrow_global_mut<Loans<CoinType>>(@LendingContract);
        assert!(table::contains(&loans_resource.loans, loan_id), E_LOAN_NOT_FOUND);
        let loan = table::borrow_mut(&mut loans_resource.loans, loan_id);

        // Verify the lender is the one liquidating
        assert!(loan.lender == lender_addr, E_NOT_LENDER);
        assert!(loan.is_active, E_LOAN_NOT_ACTIVE);
        assert!(!loan.is_repaid, E_LOAN_ALREADY_REPAID);
        assert!(timestamp::now_seconds() > loan.due_ts, E_LOAN_NOT_OVERDUE);

        // Mark loan as inactive (liquidated)
        loan.is_active = false;
        loan.is_repaid = true; // Consider the loan as closed

        // Calculate current LTV ratio
        let current_ltv = if (current_collateral_value > 0) {
            (loan.principal * 10000) / current_collateral_value
        } else {
            u64::max_value() // Infinite LTV if collateral value is 0
        };

        // Check if loan is liquidatable (overdue or undercollateralized)
        let is_undercollateralized = current_ltv > loan.liquidation_threshold;
        let is_overdue = timestamp::now_seconds() > loan.due_ts;
        
        assert!(is_undercollateralized || is_overdue, E_COLLATERAL_NOT_LIQUIDATABLE);

        // Handle collateral if it exists
        if (option::is_some(&loan.collateral)) {
            let collateral = option::extract(&mut loan.collateral);
            
            // Calculate liquidation bonus (5% for liquidator)
            let liquidator_share = (collateral.amount * LIQUIDATION_BONUS) / 10000;
            let protocol_share = collateral.amount - liquidator_share;
            
            // In a real implementation, transfer collateral to liquidator and protocol
            // This is a placeholder for the actual transfer logic
            
            // Mark collateral as liquidated
            collateral.is_liquidated = true;
            
            event::emit(CollateralLiquidatedEvent {
                loan_id,
                liquidator: liquidator_addr,
                amount: collateral.amount,
                liquidator_share,
                protocol_share,
                asset_type: string::utf8(b"COLLATERAL_TYPE"), // Would use actual type name
                reason: if (is_undercollateralized) b"undercollateralized" else b"overdue"
            });
        }
        
        // Mark loan as liquidated
        loan.is_active = false;
        loan.is_repaid = true;

        event::emit(LiquidationEvent {
            loan_id,
            result_ref,
        });
    }

    // Lender can cancel an offer if no active loans are using it
    public entry fun cancel_offer<CoinType>(
        lender: &signer,
        offer_id: u64
    ) acquires PlatformConfig, LoanOffers {
        let lender_addr = signer::address_of(lender);
        let config = borrow_global_mut<PlatformConfig>(@LendingContract);

        // Get the lender's offers
        assert!(exists<LoanOffers<CoinType>>(lender_addr), E_LOAN_OFFER_NOT_FOUND);
        let offers = borrow_global_mut<LoanOffers<CoinType>>(lender_addr);
        
        // Verify the offer exists and belongs to the lender
        assert!(table::contains(&offers.offers, offer_id), E_LOAN_OFFER_NOT_FOUND);
        let offer = table::borrow_mut(&mut offers.offers, offer_id);
        
        assert!(offer.active, E_LOAN_OFFER_NOT_ACTIVE);

        // Check if the full amount is still available (no loans taken from this offer)
        assert!(offer.remaining == offer.amount, E_OFFER_IN_USE);

        // Mark offer as inactive
        offer.active = false;

        // Refund any remaining funds to the lender
        if (offer.remaining > 0) {
            let resource_signer = account::create_signer_with_capability(&config.resource_signer_cap);
            let coins = coin::withdraw<CoinType>(&resource_signer, offer.remaining);
            coin::deposit(lender_addr, coins);
        };

        event::emit(OfferCancelledEvent {
            offer_id,
            lender: lender_addr,
            amount: offer.remaining,
        });
    }
}