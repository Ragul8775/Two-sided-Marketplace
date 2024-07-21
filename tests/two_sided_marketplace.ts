import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TwoSidedMarketplace } from "../target/types/two_sided_marketplace";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
require("dotenv").config();

describe("two_sided_marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .TwoSidedMarketplace as Program<TwoSidedMarketplace>;

  it("Initializes the marketplace", async () => {
    const marketplace = anchor.web3.Keypair.generate();
    const baseRoyaltyRate = 5; // 5%

    await program.methods
      .initializeMarketplace(baseRoyaltyRate)
      .accounts({
        marketplace: marketplace.publicKey,
        admin: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketplace])
      .rpc();

    const account = await program.account.marketplace.fetch(
      marketplace.publicKey
    );
    assert.ok(account.admin.equals(provider.wallet.publicKey));
    assert.equal(account.baseRoyaltyRate, baseRoyaltyRate);
  });
  it("Registers a vendor", async () => {
    const vendor = anchor.web3.Keypair.generate();
    const name = "Test Vendor";
    const description = "This is a test vendor";

    await program.methods
      .registerVendor(name, description)
      .accounts({
        vendor: vendor.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([vendor])
      .rpc();

    const vendorAccount = await program.account.vendor.fetch(vendor.publicKey);
    assert.ok(vendorAccount.owner.equals(provider.wallet.publicKey));
    assert.equal(vendorAccount.name, name);
    assert.equal(vendorAccount.description, description);
    assert.equal(vendorAccount.active, true);
  });
  it("Mints a service NFT", async () => {
    // Generate a new keypair for the vendor
    const vendor = anchor.web3.Keypair.generate();

    // Airdrop some SOL to the vendor
    const airdropSignature = await provider.connection.requestAirdrop(
      vendor.publicKey,
      1000000000 // 1 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Generate a new keypair for the service NFT
    const serviceNft = anchor.web3.Keypair.generate();

    const metadata = "Test Service NFT";
    const price = new anchor.BN(1000000); // 1 SOL in lamports
    const is_soulbound = false;

    await program.methods
      .mintServiceNft(metadata, price, is_soulbound)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, vendor])
      .rpc();

    // Fetch the created service NFT account

    const serviceNftAccount = await program.account.serviceNft.fetch(
      serviceNft.publicKey
    );

    console.log(
      "Service NFT Account:",
      JSON.stringify(serviceNftAccount, null, 2)
    );
    console.log("isSoulbound:", serviceNftAccount.isSoulbound);
    console.log("typeof isSoulbound:", typeof serviceNftAccount.isSoulbound);

    assert.ok(
      serviceNftAccount.vendor.equals(vendor.publicKey),
      "Vendor mismatch"
    );
    assert.equal(serviceNftAccount.metadata, metadata, "Metadata mismatch");
    assert.equal(
      serviceNftAccount.price.toNumber(),
      price.toNumber(),
      "Price mismatch"
    );
    assert.equal(
      serviceNftAccount.isSoulbound,
      is_soulbound,
      "Soulbound flag mismatch"
    ); // Change to camelCase
    assert.ok(
      serviceNftAccount.owner.equals(vendor.publicKey),
      "Owner mismatch"
    );
  });
  it("Lists a service", async () => {
    // First, mint a service NFT
    const vendor = anchor.web3.Keypair.generate();
    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const nftPrice = new anchor.BN(1000000); // 1 SOL
    const isSoulbound = false;

    // Airdrop some SOL to the vendor
    const airdropSignature = await provider.connection.requestAirdrop(
      vendor.publicKey,
      2000000000 // 2 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Mint the service NFT
    await program.methods
      .mintServiceNft(metadata, nftPrice, isSoulbound)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, vendor])
      .rpc();

    // Now, list the service
    const listingPrice = new anchor.BN(1500000); // 1.5 SOL
    const [serviceListingPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("service_listing"), serviceNft.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .listService(listingPrice)
      .accounts({
        serviceListing: serviceListingPda,
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([vendor])
      .rpc();

    // Fetch the service listing account
    const serviceListingAccount = await program.account.serviceListing.fetch(
      serviceListingPda
    );

    console.log("Service Listing Account:", serviceListingAccount);

    // Assert that the service was listed correctly
    assert.ok(
      serviceListingAccount.serviceNft.equals(serviceNft.publicKey),
      "Service NFT mismatch"
    );
    assert.ok(
      serviceListingAccount.vendor.equals(vendor.publicKey),
      "Vendor mismatch"
    );
    assert.equal(
      serviceListingAccount.price.toNumber(),
      listingPrice.toNumber(),
      "Price mismatch"
    );
    assert.equal(
      serviceListingAccount.isActive,
      true,
      "Listing should be active"
    );
  });

  it("Purchases a service", async () => {
    // Set up accounts
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

    // Airdrop SOL to buyer and seller
    const connection = provider.connection;
    await connection.confirmTransaction(
      await connection.requestAirdrop(
        buyer.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(
        seller.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    // Create mint
    const mint = await createMint(
      connection,
      seller,
      seller.publicKey,
      null,
      9
    );

    // Create token accounts
    const buyerTokenAccount = await createAccount(
      connection,
      buyer,
      mint,
      buyer.publicKey
    );
    const sellerTokenAccount = await createAccount(
      connection,
      seller,
      mint,
      seller.publicKey
    );

    // Mint some tokens to the buyer
    await mintTo(
      connection,
      seller,
      mint,
      buyerTokenAccount,
      seller.publicKey,
      1000000000 // 1 token
    );

    // Create and list a service
    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const nftPrice = new anchor.BN(100000000); // 0.1 token
    const isSoulbound = false;

    await program.methods
      .mintServiceNft(metadata, nftPrice, isSoulbound)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: seller.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, seller])
      .rpc();

    const [serviceListingPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("service_listing"), serviceNft.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .listService(nftPrice)
      .accounts({
        serviceListing: serviceListingPda,
        serviceNft: serviceNft.publicKey,
        vendor: seller.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const beforeBuyerBalance = await connection.getTokenAccountBalance(
      buyerTokenAccount
    );
    const beforeSellerBalance = await connection.getTokenAccountBalance(
      sellerTokenAccount
    );

    console.log("Before purchase:");
    console.log("Buyer balance:", beforeBuyerBalance.value.uiAmount);
    console.log("Seller balance:", beforeSellerBalance.value.uiAmount);

    try {
      await program.methods
        .purchaseService()
        .accounts({
          serviceListing: serviceListingPda,
          serviceNft: serviceNft.publicKey,
          buyer: buyer.publicKey,
          seller: seller.publicKey,
          buyerTokenAccount: buyerTokenAccount,
          sellerTokenAccount: sellerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      // Fetch updated accounts
      const updatedServiceNft = await program.account.serviceNft.fetch(
        serviceNft.publicKey
      );
      const updatedServiceListing = await program.account.serviceListing.fetch(
        serviceListingPda
      );
      const afterBuyerBalance = await connection.getTokenAccountBalance(
        buyerTokenAccount
      );
      const afterSellerBalance = await connection.getTokenAccountBalance(
        sellerTokenAccount
      );

      console.log("After purchase:");
      console.log("Buyer balance:", afterBuyerBalance.value.uiAmount);
      console.log("Seller balance:", afterSellerBalance.value.uiAmount);

      console.log("Service NFT owner:", updatedServiceNft.owner.toBase58());
      console.log("Service listing active:", updatedServiceListing.isActive);

      // Assert the results
      assert.ok(
        updatedServiceNft.owner.equals(buyer.publicKey),
        "Service NFT owner should be updated to buyer"
      );
      assert.equal(
        updatedServiceListing.isActive,
        false,
        "Service listing should be inactive after purchase"
      );

      const expectedBalanceChange = 0.1; // 0.1 tokens
      const actualBuyerBalanceChange =
        beforeBuyerBalance.value.uiAmount - afterBuyerBalance.value.uiAmount;
      const actualSellerBalanceChange =
        afterSellerBalance.value.uiAmount - beforeSellerBalance.value.uiAmount;

      console.log("Expected balance change:", expectedBalanceChange);
      console.log("Actual buyer balance change:", actualBuyerBalanceChange);
      console.log("Actual seller balance change:", actualSellerBalanceChange);

      assert.ok(
        Math.abs(actualBuyerBalanceChange - expectedBalanceChange) < 0.000001,
        `Buyer's token balance should be reduced by ${expectedBalanceChange}, but it changed by ${actualBuyerBalanceChange}`
      );
      assert.ok(
        Math.abs(actualSellerBalanceChange - expectedBalanceChange) < 0.000001,
        `Seller's token balance should be increased by ${expectedBalanceChange}, but it changed by ${actualSellerBalanceChange}`
      );
    } catch (error) {
      console.error("Error during purchase:", error);
      throw error;
    }
  });
});
