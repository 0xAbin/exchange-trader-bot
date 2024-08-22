import { Address, formatEther, parseEther } from "viem";
import { publicClient } from "./config";
import { FundingWallet } from "../helpers/account";

export async function getGasLimit(account: any, address: Address, value?: bigint, data?: Address) {
  const gas = await publicClient.estimateGas({
    account,
    to: address,
    value: value || 0n, 
    data: data || "0x", 
  });
  return gas;
}


let lastUsedGasPrice: bigint | null = null;

export const estimateGasWithBuffer = async (address: string, attempt: number): Promise<bigint> => {
    const currentBaseFee = await publicClient.getBlock().then(block => block.baseFeePerGas || BigInt(0));
    const currentGasPrice = await publicClient.getGasPrice();

    // Start with a 50% increase, then double it for each subsequent attempt
    const increasePercentage = 50 * (2 ** (attempt - 1));
    let newGasPrice = currentGasPrice + (currentGasPrice * BigInt(increasePercentage) / BigInt(100));

    // Ensure the new gas price is at least the base fee
    newGasPrice = newGasPrice > currentBaseFee ? newGasPrice : currentBaseFee;

    // Ensure the new gas price is higher than the last used gas price
    if (lastUsedGasPrice) {
        newGasPrice = newGasPrice > lastUsedGasPrice ? newGasPrice : lastUsedGasPrice + (lastUsedGasPrice * BigInt(10) / BigInt(100));
    }

    lastUsedGasPrice = newGasPrice;

    console.log(`Current Base Fee: ${formatEther(currentBaseFee)} GAS`);
    console.log(`Estimated Gas Price: ${formatEther(newGasPrice)} GAS`);

    return newGasPrice;
};

export const  baseFee = async () => {
    const baseFee = await publicClient.getBlobBaseFee();
    console.log(`💵 Base Fee: ${baseFee}`);
    return baseFee;
};