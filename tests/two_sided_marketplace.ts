import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TwoSidedMarketplace } from "../target/types/two_sided_marketplace";
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
});
