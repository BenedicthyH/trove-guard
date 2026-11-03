// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStabilityPool {
    function provideToSP(uint256 amount) external;
    function withdrawFromSP(uint256 amount) external;
    function getCompoundedMUSDDeposit(address depositor) external view returns (uint256);
    function getDepositorCollateralGain(address depositor) external view returns (uint256);
}
interface ITroveManager {
    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
}
interface IPriceFeed { function fetchPrice() external view returns (uint256); }
interface IBorrowerOperationsSignatures {
    function repayMUSDWithSignature(uint256 amount, address upperHint, address lowerHint,
        address borrower, bytes memory signature, uint256 deadline) external;
    function getNonce(address user) external view returns (uint256);
}

/// One vault per borrower. The MUSD reserve sits in the Mezo Stability Pool.
/// The owner pre-signs one Mezo RepayMUSD EIP-712 message. Anyone (a keeper) can
/// call rescue() when the trove ICR is below the owner's trigger; the vault pulls
/// MUSD from the pool and repays the owner's trove through BorrowerOperationsSignatures.
contract TroveGuardVault {
    address public immutable owner;
    IERC20 public immutable musd;
    IStabilityPool public immutable sp;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IBorrowerOperationsSignatures public immutable bos;

    uint256 public triggerICR;   // 1e18 = 100%
    uint256 public rescueAmount; // MUSD, must match the signed RepayMUSD amount
    uint256 public deadline;
    uint256 public keeperTipBps; // paid in MUSD from the reserve, capped at 200 (2%)
    bytes public signature;
    bool public armed;

    event Deposited(uint256 amount);
    event Withdrawn(uint256 amount);
    event Armed(uint256 triggerICR, uint256 rescueAmount, uint256 deadline);
    event Disarmed();
    event Rescued(address keeper, uint256 icrBefore, uint256 icrAfter, uint256 repaid, uint256 tip);

    error NotOwner(); error NotArmed(); error AboveTrigger(); error BadTip(); error ShortReserve(); error NoImprovement();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address _owner, address _musd, address _sp, address _tm, address _pf, address _bos) {
        owner = _owner; musd = IERC20(_musd); sp = IStabilityPool(_sp);
        troveManager = ITroveManager(_tm); priceFeed = IPriceFeed(_pf);
        bos = IBorrowerOperationsSignatures(_bos);
    }

    receive() external payable {} // BTC liquidation gains from the Stability Pool

    function deposit(uint256 amount) external onlyOwner {
        musd.transferFrom(msg.sender, address(this), amount);
        musd.approve(address(sp), amount);
        sp.provideToSP(amount);
        emit Deposited(amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        sp.withdrawFromSP(amount);
        musd.transfer(owner, musd.balanceOf(address(this)));
        if (address(this).balance > 0) { (bool ok,) = owner.call{value: address(this).balance}(""); require(ok); }
        emit Withdrawn(amount);
    }

    function arm(uint256 _trigger, uint256 _amount, uint256 _deadline, uint256 _tipBps, bytes calldata _sig) external onlyOwner {
        if (_tipBps > 200) revert BadTip();
        triggerICR = _trigger; rescueAmount = _amount; deadline = _deadline; keeperTipBps = _tipBps;
        signature = _sig; armed = true;
        emit Armed(_trigger, _amount, _deadline);
    }

    function disarm() external onlyOwner { armed = false; delete signature; emit Disarmed(); }

    function reserve() public view returns (uint256) { return sp.getCompoundedMUSDDeposit(address(this)); }

    function needsRescue() public view returns (bool) {
        if (!armed || block.timestamp > deadline) return false;
        return troveManager.getCurrentICR(owner, priceFeed.fetchPrice()) < triggerICR;
    }

    function rescue(address upperHint, address lowerHint) external {
        if (!armed) revert NotArmed();
        uint256 price = priceFeed.fetchPrice();
        uint256 icrBefore = troveManager.getCurrentICR(owner, price);
        if (icrBefore >= triggerICR) revert AboveTrigger();
        uint256 tip = rescueAmount * keeperTipBps / 10_000;
        if (reserve() < rescueAmount + tip) revert ShortReserve();
        armed = false; // signature is single use (Mezo nonce)
        sp.withdrawFromSP(rescueAmount + tip);
        // BorrowerOperations burns MUSD from the caller of BorrowerOperationsSignatures, i.e. this vault.
        bos.repayMUSDWithSignature(rescueAmount, upperHint, lowerHint, owner, signature, deadline);
        if (tip > 0) musd.transfer(msg.sender, tip);
        uint256 icrAfter = troveManager.getCurrentICR(owner, price);
        if (icrAfter <= icrBefore) revert NoImprovement();
        emit Rescued(msg.sender, icrBefore, icrAfter, rescueAmount, tip);
    }
}
