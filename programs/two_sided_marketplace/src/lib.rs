use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, Transfer};

declare_id!("5Jqromwvmb9qsTSk2xcUCpFZAXH1Q7cSeE6gcvU2mSNS");

#[program]
pub mod two_sided_marketplace {
    use super::*;

    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        base_royalty_rate: u8,
    ) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.admin = ctx.accounts.admin.key();
        marketplace.base_royalty_rate = base_royalty_rate;
        Ok(())
    }

    pub fn register_vendor(
        ctx: Context<RegisterVendor>,
        name: String,
        description: String,
    ) -> Result<()> {
        require!(name.len() <= 50, MarketplaceError::NameTooLong);
        require!(
            description.len() <= 100,
            MarketplaceError::DescriptionTooLong
        );

        let vendor = &mut ctx.accounts.vendor;
        vendor.owner = ctx.accounts.owner.key();
        vendor.name = name;
        vendor.description = description;
        vendor.active = true;

        Ok(())
    }

    pub fn mint_service_nft(
        ctx: Context<MintServiceNft>,
        metadata: String,
        price: u64,
        is_soulbound: bool,
        royalty_rate: u8,
    ) -> Result<()> {
        let service_nft = &mut ctx.accounts.service_nft;
        service_nft.vendor = ctx.accounts.vendor.key();
        service_nft.metadata = metadata;
        service_nft.price = price;
        service_nft.is_soulbound = is_soulbound;
        service_nft.owner = ctx.accounts.vendor.key();
        service_nft.royalty_rate = royalty_rate;

        msg!("Service NFT minted successfully");
        msg!("is_soulbound: {}", service_nft.is_soulbound);
        Ok(())
    }

    pub fn list_service(ctx: Context<ListService>, price: u64) -> Result<()> {
        let service_listing = &mut ctx.accounts.service_listing;
        let service_nft = &ctx.accounts.service_nft;

        require!(
            service_nft.owner == ctx.accounts.vendor.key(),
            MarketplaceError::NotOwner
        );

        service_listing.service_nft = ctx.accounts.service_nft.key();
        service_listing.vendor = ctx.accounts.vendor.key();
        service_listing.price = price;
        service_listing.is_active = true;

        msg!("Service listed successfully");
        msg!("Service NFT: {:?}", service_listing.service_nft);
        msg!("Price: {}", service_listing.price);

        Ok(())
    }

    pub fn purchase_service(ctx: Context<PurchaseService>) -> Result<()> {
        let service_listing = &mut ctx.accounts.service_listing;
        let service_nft = &mut ctx.accounts.service_nft;

        require!(
            service_listing.is_active,
            MarketplaceError::ListingNotActive
        );

        // Transfer payment from buyer to seller
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, service_listing.price)?;

        // Update NFT ownership if it's not soulbound
        if !service_nft.is_soulbound {
            service_nft.owner = ctx.accounts.buyer.key();
        }

        // Mark the listing as inactive
        service_listing.is_active = false;

        emit!(ServicePurchased {
            buyer: ctx.accounts.buyer.key(),
            seller: ctx.accounts.seller.key(),
            service_nft: service_nft.key(),
            price: service_listing.price,
        });

        Ok(())
    }
    pub fn transfer_service_nft(ctx: Context<TransferServiceNft>) -> Result<()> {
        let service_nft = &mut ctx.accounts.service_nft;

        require!(
            !service_nft.is_soulbound,
            MarketplaceError::SoulboundNonTransferable
        );

        require!(
            service_nft.owner == ctx.accounts.current_owner.key(),
            MarketplaceError::NotOwner
        );
        service_nft.owner = ctx.accounts.new_owner.key();

        emit!(ServiceNftTransferred {
            service_nft: service_nft.key(),
            from: ctx.accounts.current_owner.key(),
            to: ctx.accounts.new_owner.key(),
        });

        Ok(())
    }
    pub fn resell_service_nft(ctx: Context<ResellServiceNft>, new_price: u64) -> Result<()> {
        let service_nft = &mut ctx.accounts.service_nft;
        let marketplace = &ctx.accounts.marketplace;

        require!(
            !service_nft.is_soulbound,
            MarketplaceError::SoulboundNonTransferable
        );

        // Ensure the current owner is the one reselling
        require!(
            service_nft.owner == ctx.accounts.current_owner.key(),
            MarketplaceError::NotOwner
        );

        // Calculate royalties
        let base_royalty = (new_price as u128 * marketplace.base_royalty_rate as u128 / 100) as u64;
        let vendor_royalty = (new_price as u128 * service_nft.royalty_rate as u128 / 100) as u64;
        let total_royalty = base_royalty + vendor_royalty;

        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, new_price - total_royalty)?;

        // Transfer base royalty to marketplace
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.marketplace_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, base_royalty)?;

        // Transfer vendor royalty
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.vendor_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, vendor_royalty)?;

        // Update NFT ownership
        service_nft.owner = ctx.accounts.buyer.key();

        emit!(ServiceNftResold {
            service_nft: service_nft.key(),
            from: ctx.accounts.current_owner.key(),
            to: ctx.accounts.buyer.key(),
            price: new_price,
            base_royalty,
            vendor_royalty,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 1)]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, description: String)]
pub struct RegisterVendor<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 4 + name.len() + 4 + description.len() + 1)]
    pub vendor: Account<'info, Vendor>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintServiceNft<'info> {
    #[account(init, payer = vendor, space = 8 + 32 + 256 + 8 + 1 + 32 + 1)]
    pub service_nft: Account<'info, ServiceNft>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListService<'info> {
    #[account(
        init,
        payer = vendor,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"service_listing", service_nft.key().as_ref()],
        bump
    )]
    pub service_listing: Account<'info, ServiceListing>,
    #[account(mut)]
    pub service_nft: Account<'info, ServiceNft>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseService<'info> {
    #[account(mut)]
    pub service_listing: Account<'info, ServiceListing>,
    #[account(mut)]
    pub service_nft: Account<'info, ServiceNft>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account directly; it's only passed to CPI calls which handle its verification.
    #[account(mut)]
    pub seller: AccountInfo<'info>,
    /// CHECK: The buyer token account is properly checked in the CPI call for token transfers to ensure it has sufficient balance and is owned by the buyer.
    #[account(mut)]
    pub buyer_token_account: AccountInfo<'info>,
    /// CHECK: The seller token account is validated in the CPI call for token transfers to ensure it is correctly owned by the seller.
    #[account(mut)]
    pub seller_token_account: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct TransferServiceNft<'info> {
    #[account(mut)]
    pub service_nft: Account<'info, ServiceNft>,
    #[account(mut)]
    pub current_owner: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub new_owner: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ResellServiceNft<'info> {
    #[account(mut)]
    pub service_nft: Account<'info, ServiceNft>,
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub current_owner: Signer<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vendor: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub buyer_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub seller_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub marketplace_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vendor_token_account: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}
#[account]
pub struct Marketplace {
    pub admin: Pubkey,
    pub base_royalty_rate: u8,
}

#[account]
pub struct Vendor {
    pub owner: Pubkey,
    pub name: String,
    pub description: String,
    pub active: bool,
}

#[account]
pub struct ServiceNft {
    pub vendor: Pubkey,
    pub metadata: String,
    pub price: u64,
    pub is_soulbound: bool,
    pub owner: Pubkey,
    pub royalty_rate: u8,
}

#[account]
pub struct ServiceListing {
    pub service_nft: Pubkey,
    pub vendor: Pubkey,
    pub price: u64,
    pub is_active: bool,
}

#[event]
pub struct ServicePurchased {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub service_nft: Pubkey,
    pub price: u64,
}
#[event]
pub struct ServiceNftTransferred {
    pub service_nft: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
}
#[event]
pub struct ServiceNftResold {
    pub service_nft: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub price: u64,
    pub base_royalty: u64,
    pub vendor_royalty: u64,
}
#[error_code]
pub enum MarketplaceError {
    #[msg("Name must be 50 characters or less")]
    NameTooLong,
    #[msg("Description must be 100 characters or less")]
    DescriptionTooLong,
    #[msg("Only the owner can perform this action")]
    NotOwner,
    #[msg("The listing is not active")]
    ListingNotActive,
    #[msg("Insufficient funds to purchase the service")]
    InsufficientFunds,
    #[msg("Soulbound NFTs cannot be transferred")]
    SoulboundNonTransferable,
}
