import { Address, formatUnits, formatEther, parseUnits } from "viem";
import { FacuetTestToken } from "../lib/Faucetokens/token";
import { MOVEMENT_DEVNET } from "../util/chains";
import { getContracts } from "../lib/contracts";
import { ethersprovider, publicClient } from "../util/config";
import { tokenabi } from "../util/abi/tokenabi";
import { ethers } from "ethers";
import { loadWalletsFromJson } from "./account";
import { getBalance } from "./getBalance";

// Global variable to track the last used gas price
let lastUsedGasPrice: bigint | undefined;

// Configurable timeout for network requests (in milliseconds)
const NETWORK_TIMEOUT = 10000; // 10 seconds

// Define the max fee in MOVE
const MAX_FEE_MOVE = parseUnits("0.0006517", 18);

// Helper functions for formatting the output
const colorText = (text: string, color: string) => `\x1b[${color}m${text}\x1b[0m`;
const cyan = (text: string) => colorText(text, '36');
const yellow = (text: string) => colorText(text, '33');
const green = (text: string) => colorText(text, '32');
const red = (text: string) => colorText(text, '31');
const blue = (text: string) => colorText(text, '34');

// Helper function to create a table without external libraries
const createTable = (headings: string[], colWidths: number[]) => {
    const drawRow = (columns: string[]) => {
        return '| ' + columns.map((col, i) => col.padEnd(colWidths[i])).join(' | ') + ' |';
    };

    const table = [drawRow(headings), drawRow(headings.map(() => '-'.repeat(30)))];

    return {
        addRow: (columns: string[]) => table.push(drawRow(columns)),
        print: () => console.log(table.join('\n'))
    };
};

// Retry logic for async functions with a custom timeout
const retry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 5000): Promise<T> => {
    try {
        return await Promise.race([
            fn(),
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Request timeout")), NETWORK_TIMEOUT))
        ]);
    } catch (error: any) {
        if (retries > 0) {
            console.warn(red(`\nRetrying due to error: ${error.message || error}\n`));
            await new Promise(res => setTimeout(res, delay));
            return retry(fn, retries - 1, delay);
        } else {
            throw error;
        }
    }
};

// Loading bar animation for longer tasks
const loadingBar = (task: string, duration: number) => {
    const length = 20;
    let i = 0;
    const interval = duration / length;
    const timer = setInterval(() => {
        process.stdout.write(`\r${task} [${'='.repeat(i)}${' '.repeat(length - i)}] ${Math.round((i / length) * 100)}%`);
        i++;
        if (i > length) {
            clearInterval(timer);
            process.stdout.write(`\r${task} [${'='.repeat(length)}] 100%\n`);
        }
    }, interval);
    return () => clearInterval(timer);
};

// Estimate gas with buffer and handle potential network timeouts
export const estimateGasWithBuffer = async (address: string, attempt: number): Promise<bigint> => {
    const currentBaseFee = await retry(() => publicClient.getBlock().then(block => block.baseFeePerGas || BigInt(0)));
    const currentGasPrice = await retry(() => publicClient.getGasPrice());

    // Start with a 50% increase, then double it for each subsequent attempt
    const increasePercentage = 50 * (2 ** (attempt - 1));
    let newGasPrice = currentGasPrice + (currentGasPrice * BigInt(increasePercentage) / BigInt(100));

    // Ensure the new gas price is at least the base fee
    newGasPrice = newGasPrice > currentBaseFee ? newGasPrice : currentBaseFee;

    // Ensure the new gas price is higher than the last used gas price
    if (lastUsedGasPrice) {
        newGasPrice = newGasPrice > lastUsedGasPrice ? newGasPrice : lastUsedGasPrice + (lastUsedGasPrice * BigInt(10) / BigInt(100));
    }

    // Cap the gas price to ensure it doesn't exceed the max fee
    const maxGasPrice = MAX_FEE_MOVE / BigInt(21000); // Assuming 21000 gas units for the transaction
    if (newGasPrice > maxGasPrice) {
        newGasPrice = maxGasPrice;
        console.warn(yellow(`\n⚠️ Gas price capped to max fee of ${formatEther(MAX_FEE_MOVE)} MOVE`));
    }

    lastUsedGasPrice = newGasPrice;

    // console.log(green(`\n🔧 Current Base Fee: ${formatEther(currentBaseFee)} GAS`));
    console.log(green(`🔧 Estimated Gas Price: ${formatEther(newGasPrice)} GAS`));

    return newGasPrice;
};

// Main function to process wallets
export const getAllowance = async () => {
    const tokens = FacuetTestToken[MOVEMENT_DEVNET];
    const allowanceToken = tokens.find(token => token.symbol === "USDC");

    if (!allowanceToken) {
        console.log(red("\n❌ WSTETH token not found in the FaucetTestToken list."));
        return;
    }

    const wallets = loadWalletsFromJson('privateKey.json', ethersprovider);
    const table = createTable(
        [cyan('Wallet'), yellow('Gas Balance (ETH)'), green('Allowance (USDC)')],
        [45, 25, 25]
    );

    console.log(blue('\nStarting to process wallets...\n'));

    for (const [index, wallet] of wallets.entries()) {
        console.log(blue(`\nProcessing Wallet: ${wallet.address} (${index + 1}/${wallets.length})`));

        try {
            console.log(yellow("\n⏳ Fetching current gas balance..."));
            const gasBalance = await retry(() => getBalance(wallet.address));
            console.log(green(`\n💰 Current Gas Balance: ${gasBalance} ETH`));

            console.log(yellow("\n⏳ Estimating gas price..."));
            let newGasPrice = await retry(() => estimateGasWithBuffer(wallet.address, 0));

            const syntheticsRouterAddress = getContracts[MOVEMENT_DEVNET].SyntheticsRouter;
            const tokenContract = new ethers.Contract(allowanceToken.address, tokenabi, wallet);

            console.log(yellow("\n⏳ Approving allowance..."));

            let attempt = 0;
            const stopLoading = loadingBar("\n⏳ Approving allowance", 90000); // 90 seconds loading bar

            while (true) {
                try {
                    const tx = await tokenContract.approve(syntheticsRouterAddress, ethers.MaxUint256, { gasPrice: newGasPrice });
                    await tx.wait();
                    stopLoading();
                    console.log(green(`\n✔️ Approval transaction successful for wallet: ${wallet.address}`));
                    break;
                } catch (error: any) {
                    if (error.code === 'REPLACEMENT_UNDERPRICED') {
                        console.warn(red(`\nRetrying due to error: Replacement transaction underpriced. Adjusting gas price and retrying...`));
                        attempt++;
                        newGasPrice = await estimateGasWithBuffer(wallet.address, attempt);
                    } else {
                        stopLoading();
                        throw error;
                    }
                }
            }
        } catch (error: any) {
            console.error(red(`\n❌ Error processing wallet ${wallet.address}: ${error.message || error}`));
            table.addRow([wallet.address, red('Error'), red('Error')]);
        }
    }

    console.log(green('\nAll wallets processed.\n'));
    table.print();
};