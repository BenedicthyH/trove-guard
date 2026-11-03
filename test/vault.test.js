const { expect } = require("chai");
const { ethers } = require("hardhat");
const e = (n) => ethers.parseEther(String(n));

describe("TroveGuardVault", () => {
  async function setup() {
    const [owner, keeper] = await ethers.getSigners();
    const musd = await (await ethers.getContractFactory("MockMUSD")).deploy();
    const sp = await (await ethers.getContractFactory("MockSP")).deploy(musd);
    const pf = await (await ethers.getContractFactory("MockPF")).deploy();
    const sys = await (await ethers.getContractFactory("MockTroveSystem")).deploy(musd);
    const f = await (await ethers.getContractFactory("TroveGuardFactory")).deploy(musd, sp, sys, pf, sys);
    await f.connect(owner).createVault();
    const vault = await ethers.getContractAt("TroveGuardVault", await f.vaultOf(owner));
    await musd.mint(owner, e(1000));
    await musd.connect(owner).approve(vault, e(1000));
    await vault.connect(owner).deposit(e(1000));
    // 0.05 BTC at 76k = 3800 collateral value, 3000 debt -> ICR 126.6%
    await sys.setTrove(owner, e(0.05), e(3000));
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await vault.connect(owner).arm(e(1.2), e(500), dl, 100, "0x");
    return { owner, keeper, musd, sp, pf, sys, vault };
  }

  it("parks reserve in the Stability Pool", async () => {
    const { vault } = await setup();
    expect(await vault.reserve()).to.equal(e(1000));
  });

  it("refuses rescue above trigger", async () => {
    const { vault, keeper } = await setup();
    await expect(vault.connect(keeper).rescue(ethers.ZeroAddress, ethers.ZeroAddress)).to.be.revertedWithCustomError(vault, "AboveTrigger");
  });

  it("repays from reserve and tips keeper when ICR drops below trigger", async () => {
    const { vault, keeper, pf, sys, musd, owner } = await setup();
    await pf.set(e(70000)); // ICR -> 116.7%
    expect(await vault.needsRescue()).to.equal(true);
    await expect(vault.connect(keeper).rescue(ethers.ZeroAddress, ethers.ZeroAddress)).to.emit(vault, "Rescued");
    expect(await sys.debt(owner)).to.equal(e(2500));
    expect(await musd.balanceOf(keeper)).to.equal(e(5));
    expect(await vault.reserve()).to.equal(e(495));
    expect(await vault.armed()).to.equal(false);
  });

  it("only owner can arm or withdraw", async () => {
    const { vault, keeper } = await setup();
    await expect(vault.connect(keeper).withdraw(1)).to.be.revertedWithCustomError(vault, "NotOwner");
  });
});
