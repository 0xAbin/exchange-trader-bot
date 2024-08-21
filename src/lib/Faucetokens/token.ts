import { MOVEMENT_DEVNET } from "../../util/chains";

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