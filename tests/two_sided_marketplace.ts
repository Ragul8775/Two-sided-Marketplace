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
});
