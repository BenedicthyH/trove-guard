/**
 * Mezo matsnet (31611) end-to-end: fund user, open trove, deploy factory+vault,
 * arm EIP-712 repay, keeper rescue. Never logs private keys.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const A = require("../keeper/addresses");

const DEPLOYER = "0xD5761668bB6F1f0D0d3bD65765703feDa2e7fab4";
const USER = "0x33AB20a7f5a71B5A0447AA96553D6a263391E0Ab";
const EXPLORER = "https://explorer.test.mezo.org/tx/";
const OUT = path.join(__dirname, "../logs/testnet-rescue.json");

const e = (n) => ethers.parseEther(String(n));
const log = (...a) => console.log(...a);

function loadWallet(file, provider) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "../.secrets", file), "utf8"));
  if (!j.privateKey) throw new Error(`missing privateKey in ${file}`);
  const w = new ethers.Wallet(j.privateKey, provider);
  if (j.address && w.address.toLowerCase() !== j.address.toLowerCase()) {
    throw new Error(`address mismatch in ${file}`);
  }
  return w;
}

function factoryArtifact() {
  return JSON.parse(fs.readFileSync(
    path.join(__dirname, "../artifacts/contracts/TroveGuardFactory.sol/TroveGuardFactory.json"), "utf8"));
}
function vaultArtifact() {
  return JSON.parse(fs.readFileSync(
    path.join(__dirname, "../artifacts/contracts/TroveGuardVault.sol/TroveGuardVault.json"), "utf8"));
}

async function wait(tx, label) {
  log(`  sent ${label}: ${tx.hash}`);
  const rc = await tx.wait();
  if (rc.status !== 1) throw new Error(`${label} failed status=${rc.status}`);
  log(`  ok   ${label}: ${EXPLORER}${tx.hash}  gas=${rc.gasUsed}`);
  return rc;
}

async function hints(provider, coll, debt) {
  const hh = new ethers.Contract(A.HintHelpers, [
    "function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)",
  ], provider);
  const st = new ethers.Contract(A.SortedTroves, [
    "function findInsertPosition(uint256,address,address) view returns (address,address)",
  ], provider);
  // NICR = coll * 1e20 / debt  (Liquity nominal CR)
  const nicr = coll * 10n ** 20n / debt;
  const [approx] = await hh.getApproxHint(nicr, 50, 42);
  const [upper, lower] = await st.findInsertPosition(nicr, approx, approx);
  return { upper, lower, nicr };
}

async function main() {
  const step = process.argv[2] || "all";
  const provider = new ethers.JsonRpcProvider(A.rpc);
  const net = await provider.getNetwork();
  if (net.chainId !== 31611n) throw new Error(`wrong chain ${net.chainId}`);

  const deployer = loadWallet("deployer.json", provider);
  const user = loadWallet("user.json", provider);
  if (deployer.address.toLowerCase() !== DEPLOYER.toLowerCase()) throw new Error("deployer addr");
  if (user.address.toLowerCase() !== USER.toLowerCase()) throw new Error("user addr");

  const state = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const save = () => fs.writeFileSync(OUT, JSON.stringify(state, null, 2));

  const bo = new ethers.Contract(A.BorrowerOperations, [
    "function openTrove(uint256,address,address) payable",
    "function minNetDebt() view returns (uint256)",
    "function borrowingRate() view returns (uint256)",
    "function borrowerOperationsSignaturesAddress() view returns (address)",
  ], provider);
  const tm = new ethers.Contract(A.TroveManager, [
    "function getTroveStatus(address) view returns (uint256)",
    // Mezo order: coll, principal, interest, pendingColl, pendingPrincipal, pendingInterest
    "function getEntireDebtAndColl(address) view returns (uint256 coll,uint256 principal,uint256 interest,uint256 pendingCollateral,uint256 pendingPrincipal,uint256 pendingInterest)",
    "function getCurrentICR(address,uint256) view returns (uint256)",
  ], provider);
  const pf = new ethers.Contract(A.PriceFeed, ["function fetchPrice() view returns (uint256)"], provider);
  const musd = new ethers.Contract(A.MUSD, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
  ], provider);
  const bos = new ethers.Contract(A.BorrowerOperationsSignatures, [
    "function getNonce(address) view returns (uint256)",
    "function repayMUSDWithSignature(uint256,address,address,address,bytes,uint256)",
  ], provider);

  // ---- step verify ----
  if (step === "verify" || step === "all") {
    log("== verify ==");
    const bosLive = await bo.borrowerOperationsSignaturesAddress();
    if (bosLive.toLowerCase() !== A.BorrowerOperationsSignatures.toLowerCase()) {
      throw new Error(`BOS mismatch live=${bosLive}`);
    }
    for (const [k, v] of Object.entries(A)) {
      if (typeof v === "string" && v.startsWith("0x")) {
        const code = await provider.getCode(v);
        if (code === "0x") throw new Error(`no code at ${k}`);
      }
    }
    const price = await pf.fetchPrice();
    log("price", ethers.formatEther(price));
    log("minNetDebt", ethers.formatEther(await bo.minNetDebt()));
    log("deployer BTC", ethers.formatEther(await provider.getBalance(DEPLOYER)));
    log("user BTC", ethers.formatEther(await provider.getBalance(USER)));
    state.verified = true;
    state.price = ethers.formatEther(price);
    save();
  }

  // ---- step fund ----
  if (step === "fund" || step === "all") {
    log("== fund user ==");
    const userBal = await provider.getBalance(USER);
    const target = e("0.042");
    if (userBal >= target) {
      log("user already funded", ethers.formatEther(userBal));
    } else {
      const need = target - userBal;
      const tx = await deployer.sendTransaction({ to: USER, value: need });
      await wait(tx, "fund-user");
      state.fundTx = tx.hash;
      save();
    }
    log("user BTC now", ethers.formatEther(await provider.getBalance(USER)));
  }

  // ---- step open ----
  if (step === "open" || step === "all") {
    log("== open trove ==");
    const status = await tm.getTroveStatus(USER);
    if (status === 1n) {
      log("trove already active");
      const d = await tm.getEntireDebtAndColl(USER);
      state.troveDebt = (d.principal + d.interest).toString();
      state.troveColl = d.coll.toString();
      save();
    } else {
      const debtAmount = e("2000"); // net debt ~2002 after 0.1% fee; room to repay ~200
      const coll = e("0.038");
      const fee = debtAmount * (await bo.borrowingRate()) / e("1");
      const netDebt = debtAmount + fee;
      const composite = netDebt + e("200");
      log("planned debtAmount", ethers.formatEther(debtAmount), "fee", ethers.formatEther(fee),
        "composite", ethers.formatEther(composite), "coll", ethers.formatEther(coll));
      const { upper, lower } = await hints(provider, coll, composite);
      log("hints", upper, lower);
      const tx = await bo.connect(user).openTrove(debtAmount, upper, lower, { value: coll, gasLimit: 2_500_000 });
      const rc = await wait(tx, "openTrove");
      state.openTx = tx.hash;
      const d = await tm.getEntireDebtAndColl(USER);
      state.troveDebt = (d.principal + d.interest).toString();
      state.troveColl = d.coll.toString();
      save();
    }
    const price = await pf.fetchPrice();
    const icr = await tm.getCurrentICR(USER, price);
    log("ICR%", Number(icr) / 1e16);
    log("user MUSD", ethers.formatEther(await musd.balanceOf(USER)));
    state.icrPct = Number(icr) / 1e16;
    save();
  }

  // ---- step deploy ----
  if (step === "deploy" || step === "all") {
    log("== deploy factory ==");
    if (state.factory) {
      log("factory already", state.factory);
    } else {
      const art = factoryArtifact();
      const Factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
      const factory = await Factory.deploy(
        A.MUSD, A.StabilityPool, A.TroveManager, A.PriceFeed, A.BorrowerOperationsSignatures,
        { gasLimit: 3_000_000 }
      );
      await factory.waitForDeployment();
      const addr = await factory.getAddress();
      const depTx = factory.deploymentTransaction();
      log("factory", addr);
      if (depTx) await wait(depTx, "deploy-factory");
      state.factory = addr;
      state.factoryTx = depTx?.hash;
      save();
    }

    const art = factoryArtifact();
    const factory = new ethers.Contract(state.factory, art.abi, user);
    let vaultAddr = await factory.vaultOf(USER);
    if (vaultAddr === ethers.ZeroAddress) {
      const tx = await factory.createVault({ gasLimit: 2_500_000 });
      const rc = await wait(tx, "createVault");
      vaultAddr = await factory.vaultOf(USER);
      state.createVaultTx = tx.hash;
    }
    state.vault = vaultAddr;
    save();
    log("vault", vaultAddr);
  }

  // ---- step deposit+arm ----
  if (step === "arm" || step === "all") {
    log("== deposit + arm ==");
    if (!state.vault) throw new Error("no vault");
    const vArt = vaultArtifact();
    const vault = new ethers.Contract(state.vault, vArt.abi, user);

    const reserveTarget = e("150");
    const currentReserve = await vault.reserve();
    if (currentReserve >= reserveTarget) {
      log("reserve already", ethers.formatEther(currentReserve));
    } else {
      const need = reserveTarget - currentReserve;
      const bal = await musd.balanceOf(USER);
      if (bal < need) throw new Error(`user MUSD ${ethers.formatEther(bal)} < need ${ethers.formatEther(need)}`);
      const aTx = await musd.connect(user).approve(state.vault, need);
      await wait(aTx, "approve-vault");
      const dTx = await vault.deposit(need, { gasLimit: 1_500_000 });
      await wait(dTx, "deposit");
      state.depositTx = dTx.hash;
      save();
    }
    log("reserve", ethers.formatEther(await vault.reserve()));

    const rescueAmount = e("100");
    const tipBps = 100n; // 1%
    // High trigger so needsRescue is true without waiting for a real near-liq ICR.
    // Current ICR ~129%; trigger 150% forces rescue path on testnet.
    const triggerICR = e("1.5");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
    const nonce = await bos.getNonce(USER);
    log("nonce", nonce.toString(), "deadline", deadline.toString());

    const domain = {
      name: "BorrowerOperationsSignatures",
      version: "1",
      chainId: 31611,
      verifyingContract: A.BorrowerOperationsSignatures,
    };
    const types = {
      RepayMUSD: [
        { name: "amount", type: "uint256" },
        { name: "borrower", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      amount: rescueAmount,
      borrower: USER,
      nonce,
      deadline,
    };
    const signature = await user.signTypedData(domain, types, value);
    log("sig bytes", (signature.length - 2) / 2);

    // sanity: recover
    const digest = ethers.TypedDataEncoder.hash(domain, types, value);
    const recovered = ethers.recoverAddress(digest, signature);
    if (recovered.toLowerCase() !== USER.toLowerCase()) {
      throw new Error(`bad sig recover ${recovered}`);
    }

    const armTx = await vault.arm(triggerICR, rescueAmount, deadline, tipBps, signature, { gasLimit: 500_000 });
    await wait(armTx, "arm");
    state.armTx = armTx.hash;
    state.rescueAmount = rescueAmount.toString();
    state.deadline = deadline.toString();
    state.triggerICR = triggerICR.toString();
    state.signature = signature;
    save();
    log("needsRescue", await vault.needsRescue());
    log("armed", await vault.armed());
  }

  // ---- step rescue ----
  if (step === "rescue" || step === "all") {
    log("== rescue ==");
    if (!state.vault) throw new Error("no vault");
    const vArt = vaultArtifact();
    const vault = new ethers.Contract(state.vault, vArt.abi, deployer); // keeper = deployer
    const price = await pf.fetchPrice();
    const icrBefore = await tm.getCurrentICR(USER, price);
    const debtBefore = await tm.getEntireDebtAndColl(USER);
    const totalDebtBefore = debtBefore.principal + debtBefore.interest;
    log("before ICR%", Number(icrBefore) / 1e16, "debt", ethers.formatEther(totalDebtBefore), "coll", ethers.formatEther(debtBefore.coll));
    log("needsRescue", await vault.needsRescue(), "armed", await vault.armed());
    log("reserve", ethers.formatEther(await vault.reserve()));

    // Hints for post-repay NICR (Mezo: coll first, then principal+interest)
    const rescueAmount = BigInt(state.rescueAmount || e("100").toString());
    const newDebt = totalDebtBefore - rescueAmount;
    if (newDebt <= e("1800")) throw new Error(`new debt ${ethers.formatEther(newDebt)} below/near minNetDebt`);
    const { upper, lower } = await hints(provider, debtBefore.coll, newDebt);
    log("rescue hints", upper, lower);

    const tx = await vault.rescue(upper, lower, { gasLimit: 2_500_000 });
    await wait(tx, "rescue");
    state.rescueTx = tx.hash;
    save();

    const icrAfter = await tm.getCurrentICR(USER, price);
    const debtAfter = await tm.getEntireDebtAndColl(USER);
    const totalDebtAfter = debtAfter.principal + debtAfter.interest;
    log("after ICR%", Number(icrAfter) / 1e16, "debt", ethers.formatEther(totalDebtAfter));
    log("armed", await vault.armed(), "reserve", ethers.formatEther(await vault.reserve()));
    log("keeper tip MUSD", ethers.formatEther(await musd.balanceOf(DEPLOYER)));
    state.icrAfterPct = Number(icrAfter) / 1e16;
    state.debtAfter = totalDebtAfter.toString();
    state.done = true;
    save();
  }

  log("\n== summary ==");
  log(JSON.stringify({
    factory: state.factory,
    vault: state.vault,
    fundTx: state.fundTx && EXPLORER + state.fundTx,
    openTx: state.openTx && EXPLORER + state.openTx,
    factoryTx: state.factoryTx && EXPLORER + state.factoryTx,
    createVaultTx: state.createVaultTx && EXPLORER + state.createVaultTx,
    depositTx: state.depositTx && EXPLORER + state.depositTx,
    armTx: state.armTx && EXPLORER + state.armTx,
    rescueTx: state.rescueTx && EXPLORER + state.rescueTx,
    icrPct: state.icrPct,
    icrAfterPct: state.icrAfterPct,
    done: state.done,
  }, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e.shortMessage || e.message);
  if (e.data) console.error("data", e.data);
  if (e.receipt) console.error("receipt status", e.receipt.status, e.receipt.hash);
  process.exit(1);
});
