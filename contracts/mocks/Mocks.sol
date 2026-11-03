// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockMUSD is ERC20 {
    constructor() ERC20("Mock MUSD", "MUSD") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function burn(address from, uint256 a) external { _burn(from, a); }
}
contract MockSP {
    MockMUSD public musd; mapping(address => uint256) public dep;
    constructor(MockMUSD m) { musd = m; }
    function provideToSP(uint256 a) external { musd.transferFrom(msg.sender, address(this), a); dep[msg.sender] += a; }
    function withdrawFromSP(uint256 a) external { dep[msg.sender] -= a; musd.transfer(msg.sender, a); }
    function getCompoundedMUSDDeposit(address d) external view returns (uint256) { return dep[d]; }
    function getDepositorCollateralGain(address) external pure returns (uint256) { return 0; }
}
contract MockPF { uint256 public p = 76_000e18; function set(uint256 x) external { p = x; } function fetchPrice() external view returns (uint256) { return p; } }
contract MockTroveSystem {
    MockMUSD public musd; mapping(address => uint256) public coll; mapping(address => uint256) public debt;
    mapping(address => uint256) public nonces;
    constructor(MockMUSD m) { musd = m; }
    function setTrove(address b, uint256 c, uint256 d) external { coll[b] = c; debt[b] = d; }
    function getCurrentICR(address b, uint256 price) external view returns (uint256) { return coll[b] * price / debt[b]; }
    function getNonce(address u) external view returns (uint256) { return nonces[u]; }
    // Signature check is out of scope for the mock; the real contract verifies EIP-712.
    function repayMUSDWithSignature(uint256 a, address, address, address b, bytes memory, uint256 dl) external {
        require(block.timestamp <= dl, "Signature expired");
        nonces[b]++; musd.burn(msg.sender, a); debt[b] -= a;
    }
}
