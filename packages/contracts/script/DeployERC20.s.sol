// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import { Script } from 'forge-std/Script.sol';
import {ERC20} from '@oz/token/ERC20/ERC20.sol';
import {ICreateX} from 'interfaces/external/ICreateX.sol';
import {console} from 'forge-std/console.sol';

contract ERC20forTest is ERC20 {
  constructor(string memory _name, string memory _symbol, address owner) ERC20(_name, _symbol) {
    _mint(owner, 100000000000000000000);
  }
}

contract ERC20Deploy is Script {
    string public erc20Name;
    string public erc20Symbol;
    address public deployer;
    ICreateX public constant CreateX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    function deployERC20() public returns (address) {
        bytes memory _erc20Params = abi.encode(erc20Name, erc20Symbol, deployer);
        address fakeTokenAddress = CreateX.deployCreate2(0x0, abi.encodePacked(type(ERC20forTest).creationCode, _erc20Params));
        return fakeTokenAddress;
    }

    function setUp() public virtual {
        erc20Name = vm.envString('ERC20_NAME');
        erc20Symbol = vm.envString('ERC20_SYMBOL');
        deployer = vm.envAddress('DEPLOYER_ADDRESS');
    }

    function run() public virtual {
        vm.startBroadcast(deployer);
        address tokenAddress = deployERC20();
        console.log('Deployed ERC20 Name is:', erc20Name);
        console.log('Deployed ERC20 Symbol is:', erc20Symbol);
        console.log('Deployed ERC20 Address is:', tokenAddress);
    }
}