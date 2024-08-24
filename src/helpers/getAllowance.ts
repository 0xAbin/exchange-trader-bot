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
export const NETWORK_TIMEOUT = 10000; // 10 seconds

// Define the max fee in MOVE
const MAX_FEE_MOVE = parseUnits("0.0006517", 18);

// Helper functions for formatting the output
const colorText = (text: string, color: string) => `\x1b[${color}m${text}\x1b[0m`;
const cyan = (text: string) => colorText(text, '36');
export const yellow = (text: string) => colorText(text, '33');
export const green = (text: string) => colorText(text, '32');
export const red = (text: string) => colorText(text, '31');
export const blue = (text: string) => colorText(text, '34');

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
    const maxGasPrice = MAX_FEE_MOVE / BigInt(1000); // Assuming 21000 gas units for the transaction
    if (newGasPrice > maxGasPrice) {
        newGasPrice = maxGasPrice;
        console.warn(yellow(`\n⚠️ Gas price capped to max fee of ${formatEther(MAX_FEE_MOVE)} MOVE`));
    }

    lastUsedGasPrice = newGasPrice;

    // console.log(green(`\n🔧 Current Base Fee: ${formatEther(currentBaseFee)} GAS`));
    console.log(green(`🔧 Estimated Gas Price: ${formatEther(newGasPrice)} GAS`));

    return newGasPrice;
};

const checkAllowance = async (tokenContract: ethers.Contract, owner: string, spender: string): Promise<bigint> => {
    try {
        const allowance = await tokenContract.allowance(owner, spender);
        return allowance;
    } catch (error: any) {
        console.error(red(`Error checking allowance: ${error.message}`));
        throw error;
    }
};


export const getAllowance = async () => {
    const tokens = FacuetTestToken[MOVEMENT_DEVNET];
    const allowanceToken = tokens.find(token => token.symbol === "USDC");

    if (!allowanceToken) {
        console.log(red("\n❌ USDC token not found in the FaucetTestToken list."));
        return;
    }

    const wallets = loadWalletsFromJson('privateKey.json', ethersprovider);
    const table = createTable(
        [cyan('Wallet'), yellow('Gas Balance (ETH)'), green('Allowance (USDC)')],
        [45, 25, 25]
    );

    console.log(blue('\nStarting to process wallets...\n'));

    for (const [index, wallet] of wallets.entries()) {
        console.log(blue(`\n📊 Processing Wallet: ${wallet.address} (${index + 1}/${wallets.length})`));

        try {
            console.log(yellow("  ⏳ Fetching current gas balance..."));
            const gasBalance = await retry(() => getBalance(wallet.address));

            if (gasBalance === undefined) {
                console.error(red(`  ❌ Failed to fetch gas balance for wallet: ${wallet.address}`));
                table.addRow([wallet.address, red('Error'), red('Error')]);
                continue;
            }

            console.log(green(`  💰 Current Gas Balance: ${gasBalance} Gas`));

            console.log(yellow("  ⏳ Estimating gas price..."));
            let newGasPrice = await retry(() => estimateGasWithBuffer(wallet.address, 0));

            const syntheticsRouterAddress = getContracts[MOVEMENT_DEVNET].SyntheticsRouter;
            const tokenContract = new ethers.Contract(allowanceToken.address, tokenabi, wallet);

            console.log(yellow("  ⏳ Checking current allowance..."));
            const currentAllowance = await checkAllowance(tokenContract, wallet.address, syntheticsRouterAddress);
            console.log(green(`  🔓 Current Allowance: ${formatUnits(currentAllowance, allowanceToken.decimals)} USDC`));

            if (currentAllowance >= 1000000n) {
                console.log(green("  ✅ Maximum allowance already granted. Skipping approval."));
                table.addRow([wallet.address, gasBalance.toString(), "Max"]);
                continue;
            }

            console.log(yellow("  ⏳ Approving allowance..."));

            let attempt = 0;
            while (true) {
                try {
                    const tx = await tokenContract.approve(syntheticsRouterAddress, ethers.MaxUint256, { gasPrice: newGasPrice });
                    console.log(cyan(`  📝 Approval transaction sent. Waiting for confirmation...`));
                    await tx.wait();
                    console.log(green(`  ✔️ Approval transaction successful for wallet: ${wallet.address}`));
                    
                    // const newAllowance = await checkAllowance(tokenContract, wallet.address, syntheticsRouterAddress);
                    table.addRow([wallet.address, gasBalance.toString(), "Max"]);
                    break;
                } catch (error: any) {
                    if (error.code === 'REPLACEMENT_UNDERPRICED') {
                        console.warn(red(`  ⚠️ Replacement transaction underpriced. Adjusting gas price and retrying...`));
                        attempt++;
                        newGasPrice = await estimateGasWithBuffer(wallet.address, attempt);
                    } else {
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
