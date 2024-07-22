import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TwoSidedMarketplace } from "../target/types/two_sided_marketplace";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getOrCreateAssociatedTokenAccount,
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
    const vendor = anchor.web3.Keypair.generate();

    const airdropSignature = await provider.connection.requestAirdrop(
      vendor.publicKey,
      1000000000 // 1 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    const serviceNft = anchor.web3.Keypair.generate();

    const metadata = "Test Service NFT";
    const price = new anchor.BN(1000000);
    const is_soulbound = false;
    const royalty_rate = 10; // 10%

    await program.methods
      .mintServiceNft(metadata, price, is_soulbound, royalty_rate)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, vendor])
      .rpc();

    const serviceNftAccount = await program.account.serviceNft.fetch(
      serviceNft.publicKey
    );

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
    );
    assert.ok(
      serviceNftAccount.owner.equals(vendor.publicKey),
      "Owner mismatch"
    );
    assert.equal(
      serviceNftAccount.royaltyRate,
      royalty_rate,
      "Royalty rate mismatch"
    );
  });

  it("Lists a service", async () => {
    const vendor = anchor.web3.Keypair.generate();
    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const nftPrice = new anchor.BN(1000000); // 1 SOL
    const isSoulbound = false;

    const airdropSignature = await provider.connection.requestAirdrop(
      vendor.publicKey,
      2000000000 // 2 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    await program.methods
      .mintServiceNft(metadata, nftPrice, isSoulbound, 10)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, vendor])
      .rpc();

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

    const serviceListingAccount = await program.account.serviceListing.fetch(
      serviceListingPda
    );

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
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

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

    const mint = await createMint(
      connection,
      seller,
      seller.publicKey,
      null,
      9
    );

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

    await mintTo(
      connection,
      seller,
      mint,
      buyerTokenAccount,
      seller.publicKey,
      1000000000 // 1 token
    );

    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const nftPrice = new anchor.BN(100000000); // 0.1 token
    const isSoulbound = false;

    await program.methods
      .mintServiceNft(metadata, nftPrice, isSoulbound, 10)
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

  it("Transfers a non-soulbound service NFT", async () => {
    const currentOwner = anchor.web3.Keypair.generate();
    const newOwner = anchor.web3.Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        currentOwner.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const price = new anchor.BN(1000000); // 1 SOL
    const isSoulbound = false;

    await program.methods
      .mintServiceNft(metadata, price, isSoulbound, 10)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: currentOwner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, currentOwner])
      .rpc();

    await program.methods
      .transferServiceNft()
      .accounts({
        serviceNft: serviceNft.publicKey,
        currentOwner: currentOwner.publicKey,
        newOwner: newOwner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([currentOwner])
      .rpc();

    const updatedServiceNft = await program.account.serviceNft.fetch(
      serviceNft.publicKey
    );

    assert.ok(
      updatedServiceNft.owner.equals(newOwner.publicKey),
      "Service NFT owner should be updated to the new owner"
    );

    const soulboundNft = anchor.web3.Keypair.generate();
    await program.methods
      .mintServiceNft(metadata, price, true, 10)
      .accounts({
        serviceNft: soulboundNft.publicKey,
        vendor: currentOwner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([soulboundNft, currentOwner])
      .rpc();

    try {
      await program.methods
        .transferServiceNft()
        .accounts({
          serviceNft: soulboundNft.publicKey,
          currentOwner: currentOwner.publicKey,
          newOwner: newOwner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([currentOwner])
        .rpc();
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.equal(
        error.error.errorMessage,
        "Soulbound NFTs cannot be transferred"
      );
    }
  });

  it("Resells a non-soulbound service NFT with royalties", async () => {
    // Set up accounts
    const vendor = anchor.web3.Keypair.generate();
    const originalBuyer = anchor.web3.Keypair.generate();
    const newBuyer = anchor.web3.Keypair.generate();

    // Airdrop SOL to accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        vendor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        originalBuyer.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newBuyer.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    // Create mint and token accounts
    const mint = await createMint(
      provider.connection,
      vendor,
      vendor.publicKey,
      null,
      9
    );

    const vendorTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      vendor,
      mint,
      vendor.publicKey
    );
    const originalBuyerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      originalBuyer,
      mint,
      originalBuyer.publicKey
    );
    const newBuyerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      newBuyer,
      mint,
      newBuyer.publicKey
    );
    const marketplaceTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      vendor,
      mint,
      vendor.publicKey
    );

    // Mint tokens to accounts
    await mintTo(
      provider.connection,
      vendor,
      mint,
      originalBuyerTokenAccount.address,
      vendor.publicKey,
      1000000000 // 1 token
    );
    await mintTo(
      provider.connection,
      vendor,
      mint,
      newBuyerTokenAccount.address,
      vendor.publicKey,
      2000000000 // 2 tokens
    );

    // Initialize marketplace
    const marketplace = anchor.web3.Keypair.generate();
    const baseRoyaltyRate = 5; // 5%

    await program.methods
      .initializeMarketplace(baseRoyaltyRate)
      .accounts({
        marketplace: marketplace.publicKey,
        admin: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketplace, vendor])
      .rpc();

    // Mint a non-soulbound service NFT
    const serviceNft = anchor.web3.Keypair.generate();
    const metadata = "Test Service NFT";
    const initialPrice = new anchor.BN(100000000); // 0.1 token
    const isSoulbound = false;
    const royaltyRate = 10; // 10%

    await program.methods
      .mintServiceNft(metadata, initialPrice, isSoulbound, royaltyRate)
      .accounts({
        serviceNft: serviceNft.publicKey,
        vendor: vendor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([serviceNft, vendor])
      .rpc();

    // List the NFT for sale
    const listingPrice = new anchor.BN(150000000); // 1.5 SOL
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

    // Original purchase
    await program.methods
      .purchaseService()
      .accounts({
        serviceListing: serviceListingPda,
        serviceNft: serviceNft.publicKey,
        buyer: originalBuyer.publicKey,
        seller: vendor.publicKey,
        buyerTokenAccount: originalBuyerTokenAccount.address,
        sellerTokenAccount: vendorTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([originalBuyer])
      .rpc();

    // Resell the NFT
    const resellPrice = new anchor.BN(150000000); // 0.15 token

    await program.methods
      .resellServiceNft(resellPrice)
      .accounts({
        serviceNft: serviceNft.publicKey,
        marketplace: marketplace.publicKey,
        currentOwner: originalBuyer.publicKey,
        buyer: newBuyer.publicKey,
        vendor: vendor.publicKey,
        buyerTokenAccount: newBuyerTokenAccount.address,
        sellerTokenAccount: originalBuyerTokenAccount.address,
        marketplaceTokenAccount: marketplaceTokenAccount.address,
        vendorTokenAccount: vendorTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([originalBuyer, newBuyer])
      .rpc();

    const updatedServiceNft = await program.account.serviceNft.fetch(
      serviceNft.publicKey
    );
    const originalBuyerBalance =
      await provider.connection.getTokenAccountBalance(
        originalBuyerTokenAccount.address
      );
    const newBuyerBalance = await provider.connection.getTokenAccountBalance(
      newBuyerTokenAccount.address
    );
    const vendorBalance = await provider.connection.getTokenAccountBalance(
      vendorTokenAccount.address
    );
    const marketplaceBalance = await provider.connection.getTokenAccountBalance(
      marketplaceTokenAccount.address
    );

    // Assert results
    assert.ok(
      updatedServiceNft.owner.equals(newBuyer.publicKey),
      "Service NFT owner should be updated to the new buyer"
    );

    const expectedBaseRoyalty =
      (resellPrice.toNumber() * baseRoyaltyRate) / 100;
    const expectedVendorRoyalty = (resellPrice.toNumber() * royaltyRate) / 100;
    const expectedSellerProceeds =
      resellPrice.toNumber() - expectedBaseRoyalty - expectedVendorRoyalty;

    assert.equal(
      originalBuyerBalance.value.uiAmount,
      1 + expectedSellerProceeds / 1000000000,
      "Original buyer should receive the resell price minus royalties"
    );
    assert.equal(
      newBuyerBalance.value.uiAmount,
      2 - resellPrice.toNumber() / 1000000000,
      "New buyer's balance should be reduced by the full resell price"
    );
    assert.equal(
      vendorBalance.value.uiAmount,
      expectedVendorRoyalty / 1000000000,
      "Vendor should receive their royalty"
    );
    assert.equal(
      marketplaceBalance.value.uiAmount,
      expectedBaseRoyalty / 1000000000,
      "Marketplace should receive the base royalty"
    );
  });
});
