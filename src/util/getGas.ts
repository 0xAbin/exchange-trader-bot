import { Address } from "viem";
import { publicClient } from "./config";

export async function getGasLimit(account: any, address: Address, value?: bigint, data?: Address) {
  const gas = await publicClient.estimateGas({
    account,
    to: address,
    value: value || 0n, 
    data: data || "0x", 
  });
  return gas;
}