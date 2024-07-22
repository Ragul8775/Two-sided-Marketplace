# Two-Sided Marketplace

This is a Solana-based decentralized marketplace where vendors can list their services as NFTs, and consumers can purchase them. The marketplace supports both soulbound and non-soulbound NFTs and includes a royalty mechanism.

## Functions

### Initialize Marketplace

**Description**: Initializes the marketplace with a base royalty rate.

**Signature**:

```rust
pub fn initialize_marketplace(
    ctx: Context<InitializeMarketplace>,
    base_royalty_rate: u8,
) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `InitializeMarketplace`.
- `base_royalty_rate`: The base royalty rate for the marketplace.

### Register Vendor

**Description**: Registers a new vendor in the marketplace.

**Signature**:

```rust
pub fn register_vendor(
    ctx: Context<RegisterVendor>,
    name: String,
    description: String,
) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `RegisterVendor`.
- `name`: The name of the vendor.
- `description`: A brief description of the vendor.

### Mint Service NFT

**Description**: Mints a new service NFT.

**Signature**:

```rust
pub fn mint_service_nft(
    ctx: Context<MintServiceNft>,
    metadata: String,
    price: u64,
    is_soulbound: bool,
    royalty_rate: u8,
) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `MintServiceNft`.
- `metadata`: Metadata for the service NFT.
- `price`: Price of the service NFT.
- `is_soulbound`: Indicates if the NFT is soulbound.
- `royalty_rate`: The royalty rate for the vendor.

### List Service

**Description**: Lists a service NFT for sale.

**Signature**:

```rust
pub fn list_service(ctx: Context<ListService>, price: u64) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `ListService`.
- `price`: Listing price of the service NFT.

### Purchase Service

**Description**: Purchases a listed service NFT.

**Signature**:

```rust
pub fn purchase_service(ctx: Context<PurchaseService>) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `PurchaseService`.

### Transfer Service NFT

**Description**: Transfers a non-soulbound service NFT to a new owner.

**Signature**:

```rust
pub fn transfer_service_nft(ctx: Context<TransferServiceNft>) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `TransferServiceNft`.

### Resell Service NFT

**Description**: Resells a non-soulbound service NFT with royalties.

**Signature**:

```rust
pub fn resell_service_nft(ctx: Context<ResellServiceNft>, new_price: u64) -> Result<()>;
```

**Parameters**:

- `ctx`: Context of `ResellServiceNft`.
- `new_price`: The new price of the service NFT.

## Errors

### Marketplace Errors

- `NameTooLong`: The name must be 50 characters or less.
- `DescriptionTooLong`: The description must be 100 characters or less.
- `NotOwner`: Only the owner can perform this action.
- `ListingNotActive`: The listing is not active.
- `InsufficientFunds`: Insufficient funds to purchase the service.
- `SoulboundNonTransferable`: Soulbound NFTs cannot be transferred.

## Events

### Service Purchased

Emitted when a service is purchased.

**Structure**:

```rust
pub struct ServicePurchased {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub service_nft: Pubkey,
    pub price: u64,
}
```

### Service NFT Transferred

Emitted when a service NFT is transferred.

**Structure**:

```rust
pub struct ServiceNftTransferred {
    pub service_nft: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
}
```

### Service NFT Resold

Emitted when a service NFT is resold.

**Structure**:

```rust
pub struct ServiceNftResold {
    pub service_nft: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub price: u64,
    pub base_royalty: u64,
    pub vendor_royalty: u64,
}
```

## Tests

### Initialize Marketplace

**Description**: Tests initializing the marketplace with a base royalty rate.

### Register Vendor

**Description**: Tests registering a new vendor in the marketplace.

### Mint Service NFT

**Description**: Tests minting a new service NFT.

### List Service

**Description**: Tests listing a service NFT for sale.

### Purchase Service

**Description**: Tests purchasing a listed service NFT.

### Transfer Service NFT

**Description**: Tests transferring a non-soulbound service NFT to a new owner.

### Resell Service NFT

**Description**: Tests reselling a non-soulbound service NFT with royalties.

**Test Case**:

- Set up accounts and initialize the marketplace.
- Mint and list a non-soulbound service NFT.
- Purchase the listed service NFT.
- Resell the purchased NFT and verify balance changes and royalties distribution.

**Assertions**:

- Ensure the original buyer receives the resell price minus royalties.
- Ensure the new buyer's balance decreases by the full resell price.
- Ensure the vendor receives their royalty.
- Ensure the marketplace receives the base royalty.
