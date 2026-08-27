export const abi = [
  {
    "type": "function",
    "name": "relay",
    "inputs": [
      {
        "name": "_withdrawal",
        "type": "tuple",
        "internalType": "struct IPrivacyPool.Withdrawal",
        "components": [
          {
            "name": "processooor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_proof",
        "type": "tuple",
        "internalType": "struct ProofLib.WithdrawProof",
        "components": [
          {
            "name": "pA",
            "type": "uint256[2]",
            "internalType": "uint256[2]"
          },
          {
            "name": "pB",
            "type": "uint256[2][2]",
            "internalType": "uint256[2][2]"
          },
          {
            "name": "pC",
            "type": "uint256[2]",
            "internalType": "uint256[2]"
          },
          {
            "name": "pubSignals",
            "type": "uint256[8]",
            "internalType": "uint256[8]"
          }
        ]
      },
      {
        "name": "_scope",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;

export const assetConfigAbi = [
  {
    "type": "function",
    "name": "assetConfig",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "outputs": [
      {
        "name": "pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "minimumDepositAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "vettingFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;
