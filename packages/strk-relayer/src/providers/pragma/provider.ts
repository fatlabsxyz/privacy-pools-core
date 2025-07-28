import { ChainName } from "../../config/types.js";
import { Address } from "../../types.js";
import { IQuoteProvider, QuoteResponse } from "../quote.provider.js";
import { Contract, Provider, uint256 } from "starknet";

// pragma oracle addresses:
// main:
// 0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b
// sepolia:
// 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a

// async function getStrkPrice() {
//     const provider = new Provider({ sequencer: { network: "mainnet-alpha" } });
//     const pragmaContractAddress = "PRAGMA_STARKNET_ADDRESS"; // Replace with actual address
//     const abi = [
//         {
//             name: "get_price",
//             type: "function",
//             inputs: [{ name: "pair_id", type: "felt" }],
//             outputs: [{ name: "price", type: "uint256" }]
//         }
//     ];
//     const contract = new Contract(abi, pragmaContractAddress, provider);
//     const pairId = "STRK/USD"; // Replace with actual pair ID from Pragma docs
//     const result = await contract.get_price(pairId);
//     const price = uint256.uint256ToBN(result.price).toString();
//     console.log(`STRK Price: ${Number(price) / 1e8} USD`); // Adjust decimals
// }


export class PragmaProvider implements IQuoteProvider {
  quoteNativeTokenInERC20(chainName: ChainName, addressIn: Address, amountIn: bigint): Promise<QuoteResponse> {
    const quote: QuoteResponse = {num: 1n, den: 2n, path: 3};
    return Promise.resolve(quote); //TODO fix using pragma, since this is insane
  } 
}
