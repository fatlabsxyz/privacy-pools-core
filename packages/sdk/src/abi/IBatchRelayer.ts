export const IBatchRelayerABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "batchRelay",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      },
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
        "name": "_proofs",
        "type": "tuple[]",
        "internalType": "struct ProofLib.WithdrawProof[]",
        "components": [
          {
            "name": "proof",
            "type": "tuple",
            "internalType": "struct IVerifier.Proof",
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
              }
            ]
          },
          {
            "name": "publicSignals",
            "type": "uint256[4]",
            "internalType": "uint256[4]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_RELAY_FEE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BatchRelayed",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "indexed": true,
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_feeRecipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_amountAfterFees",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_fee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NativeAssetTransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptyProofs",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidRelayFeeBPS",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BalanceChanged",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidBatchSize",
    "inputs": []
  }
] as const;