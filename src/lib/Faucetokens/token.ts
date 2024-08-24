import { BigNumberish, ethers } from "ethers";
import { MOVEMENT_DEVNET } from "../../util/chains";
import { fetchTokenPrices } from "../../helpers/tradeOpen";

export const FacuetTestToken = {
    [MOVEMENT_DEVNET]: [
        {
            name: "WSTETH",
            address: "0xeAC3d56DCB15a3Bc174aB292B7023e9Fc9F7aDf0",
            symbol: "WSTETH",
            decimals: 18,
            claimable: 0.01,
        },
        {
            name: "USDC Coin",
            address: "0x38604D543659121faa8F68A91A5b633C7BFE9761",
            symbol: "USDC",
            decimals: 6,
            claimable: 100,
        },
        {
            name: "Wrapped Bitcoin",
            address: "0xEb3c2e768c17E0c2AFF98bdF0024D38A18b0B62E",
            symbol: "WBTC",
            decimals: 8,
            claimable: 0.001,
        },
        {
            name: "Wrapped Ether",
            address: "0xd778B815E6AE26f547042bbbe4Bf8b1B0c746A22",
            symbol: "WETH",
            decimals: 18,
            claimable: 0.01,
        },
    ]
};

export const TradeTokens ={
    [MOVEMENT_DEVNET]: [
          {
            name: "Wrapped Bitcoin",
            symbol: "WBTC",
            address: "0xEb3c2e768c17E0c2AFF98bdF0024D38A18b0B62E",
            decimals: 8,
            tradeble : 0.001,
          },
          {
            name: "USD Coin",
            symbol: "USDC",
            address: "0x38604D543659121faa8F68A91A5b633C7BFE9761",
            decimals: 6,
            tradeble : 5,
          },
          {
            name: "Wrapped Ether",
            symbol: "WETH",
            decimals: 18,
            address: "0xd778B815E6AE26f547042bbbe4Bf8b1B0c746A22",
            tradeble : 0.01,
          },
          {
            name: "Wrapped Staked Ether",
            symbol: "WSTETH",
            decimals: 18,
            address: "0xeAC3d56DCB15a3Bc174aB292B7023e9Fc9F7aDf0",
            tradeble : 0.01,
          },
    ]
}


export const TRadeMarket = "0x3A7315a05Bfca36CD309266F99028cF80AD6b1C6"

export const  uiFees = "0x26E76B18D4A132A9397C46af11e4688BDB602E92"


type TokenPrice = {
    tokenAddress: string;
    tokenSymbol: string;
    minPrice: string;
    maxPrice: string;
    updatedAt: number;
    priceDecimals: number;
};

export const processPrices = (data: TokenPrice[]) => {
    const primaryPrices = data.map(item => ({
      min: BigInt(item.minPrice),
      max: BigInt(item.maxPrice)
    }));
  
    const primaryTokens = data.map(item => item.tokenAddress);
  
    return { primaryPrices, primaryTokens };
  };



export function expandDecimals(n: BigNumberish, decimals: number): bigint {
    return BigInt(n) * 10n ** BigInt(decimals);
  }
  
  export function convertToContractPrice(price: bigint, tokenDecimals: number) {
    return price / expandDecimals(1, tokenDecimals);
  }

  export const referralCodeDecimals = "0x0000000000000000000000000000000000000000000000000000000000000000"