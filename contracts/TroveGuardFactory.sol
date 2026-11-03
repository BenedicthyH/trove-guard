// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./TroveGuardVault.sol";

contract TroveGuardFactory {
    address public immutable musd; address public immutable sp; address public immutable tm;
    address public immutable pf; address public immutable bos;
    mapping(address => address) public vaultOf;
    event VaultCreated(address indexed owner, address vault);
    constructor(address _musd, address _sp, address _tm, address _pf, address _bos) {
        musd = _musd; sp = _sp; tm = _tm; pf = _pf; bos = _bos;
    }
    function createVault() external returns (address v) {
        require(vaultOf[msg.sender] == address(0), "exists");
        v = address(new TroveGuardVault(msg.sender, musd, sp, tm, pf, bos));
        vaultOf[msg.sender] = v;
        emit VaultCreated(msg.sender, v);
    }
}
