use anchor_lang::prelude::*;

declare_id!("G28Vo4fCX9EEQHjTLuKjucKMwjjP8JtKjvSDxn3qX89w");

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
    ) -> Result<()> {
        let service_nft = &mut ctx.accounts.service_nft;
        service_nft.vendor = ctx.accounts.vendor.key();
        service_nft.metadata = metadata;
        service_nft.price = price;
        service_nft.isSoulbound = is_soulbound; // Make sure this is camelCase
        service_nft.owner = ctx.accounts.vendor.key();

        msg!("Service NFT minted successfully");
        msg!("isSoulbound: {}", service_nft.isSoulbound);
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
    #[account(
        init,
        payer = vendor,
        space = 8 + 32 + 256 + 8 + 1 + 32
    )]
    pub service_nft: Account<'info, ServiceNft>,
    #[account(mut)]
    pub vendor: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    pub isSoulbound: bool, // Make sure this is camelCase
    pub owner: Pubkey,
}

#[error_code]
pub enum MarketplaceError {
    #[msg("Name must be 50 characters or less")]
    NameTooLong,
    #[msg("Description must be 100 characters or less")]
    DescriptionTooLong,
}
