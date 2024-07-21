# Two-Sided Marketplace on Solana

This project implements a two-sided marketplace on the Solana blockchain where vendors can list services as NFTs and buyers can purchase them. The marketplace supports both soulbound and non-soulbound NFTs and includes mechanisms for transferring payments and updating ownership.

## Overview

The project includes the following key features:

- Initialize the marketplace
- Register vendors
- Mint service NFTs
- List services for sale
- Purchase services

## Smart Contract (Rust)

### Functions

1. **initialize_marketplace**
   Initializes the marketplace with an admin and a base royalty rate. This function sets the admin's public key and the base royalty rate.

2. **register_vendor**
   Registers a new vendor by storing the owner's public key, vendor name, and description. This function also ensures that the name and description lengths are within specified limits.

3. **mint_service_nft**
   Mints a new service NFT for a vendor with specified metadata, price, and a flag indicating if it is soulbound. This function sets the vendor's public key as the owner of the NFT.

4. **list_service**
   Lists a service NFT for sale by creating a service listing with the specified price. This function ensures that the vendor owns the NFT before listing it.

5. **purchase_service**
   Allows a buyer to purchase a listed service. This function transfers the payment from the buyer to the seller and updates the NFT ownership if it is not soulbound. It also marks the listing as inactive.

### Accounts

- **InitializeMarketplace**

  - `marketplace`: Stores the marketplace state.
  - `admin`: The admin initializing the marketplace.
  - `system_program`: Solana system program.

- **RegisterVendor**

  - `vendor`: Stores the vendor state.
  - `owner`: The vendor's owner.
  - `system_program`: Solana system program.

- **MintServiceNft**

  - `service_nft`: Stores the service NFT state.
  - `vendor`: The vendor minting the NFT.
  - `system_program`: Solana system program.

- **ListService**

  - `service_listing`: Stores the service listing state.
  - `service_nft`: The NFT being listed.
  - `vendor`: The vendor listing the service.
  - `system_program`: Solana system program.

- **PurchaseService**
  - `service_listing`: Stores the service listing state.
  - `service_nft`: The NFT being purchased.
  - `buyer`: The buyer purchasing the service.
  - `seller`: The vendor selling the service.
  - `buyer_token_account`: Token account of the buyer.
  - `seller_token_account`: Token account of the seller.
  - `token_program`: Token program.
  - `system_program`: Solana system program.

### Events

- **ServicePurchased**
  - `buyer`: The public key of the buyer.
  - `seller`: The public key of the seller.
  - `service_nft`: The public key of the purchased NFT.
  - `price`: The purchase price.

### Errors

- **MarketplaceError**
  - `NameTooLong`: Name exceeds the allowed length.
  - `DescriptionTooLong`: Description exceeds the allowed length.
  - `NotOwner`: Only the owner can list the service.
  - `ListingNotActive`: The listing is not active.
  - `InsufficientFunds`: Insufficient funds to purchase the service.

## Test Suite (JavaScript)

### Test Cases

1. **Initializes the marketplace**
   Tests the `initialize_marketplace` function by creating a new marketplace and verifying the admin and base royalty rate.

2. **Registers a vendor**
   Tests the `register_vendor` function by creating a new vendor and verifying the vendor's details.

3. **Mints a service NFT**
   Tests the `mint_service_nft` function by minting a new NFT and verifying the NFT's details.

4. **Lists a service**
   Tests the `list_service` function by listing a previously minted NFT and verifying the listing details.

5. **Purchases a service**
   Tests the `purchase_service` function by purchasing a listed NFT and verifying the payment transfer and NFT ownership update.

## Setup and Deployment

1. **Prerequisites**

   - Install Rust and Solana CLI.
   - Install Anchor framework.

2. **Build and Deploy**
   ```bash
   anchor build
   anchor deploy


3. **Run Tests**
   ```bash
   anchor test
   ```

## Environment Variables

Create a `.env` file in the root directory and add the following environment variables:

```env
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=/path/to/your/solana/wallet.json
```

## Conclusion

This two-sided marketplace on Solana enables vendors to list services as NFTs and buyers to purchase them securely. The provided smart contract and test suite ensure the marketplace's functionality and reliability.


