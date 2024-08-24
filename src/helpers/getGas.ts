import { facuetAbi } from '../util/abi/facuetAbi';
import { Address, http } from "viem";
import { movementDevnet, walletClient, publicClient } from "../util/config";
import { parseEther, formatEther } from "viem"; 
import { FundingWallet } from "./account";
import { getBalance } from './getBalance';
import { baseFee, estimateGasWithBuffer } from '../util/getGas';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const spinnerFrames = ['|', '/', '-', '\\'];

const animateProgress = (progress: number, total: number) => {
    const barLength = 30; // length of the progress bar
    const filledLength = Math.round((progress / total) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `${bar} ${progress}/${total}`;
};

const animateSpinner = (frame: number) => {
    return spinnerFrames[frame % spinnerFrames.length];
};

// Helper function to format ETA
const formatETA = (startTime: number, total: number, progress: number) => {
    const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
    const remaining = (total - progress) * (elapsedTime / progress);
    const eta = Math.max(0, Math.round(remaining - elapsedTime));
    const minutes = Math.floor(eta / 60);
    const seconds = eta % 60;
    return `ETA: ${minutes}m ${seconds}s`;
};

// Helper function to convert balance to Wei
const toWei = (balanceStr: string): bigint => {
    return BigInt(parseEther(balanceStr).toString());
};

// Function to wait until the balance is updated
const waitForBalanceUpdate = async (address: string, amountSent: bigint, initialTimeout: number = 60000, maxIncrement: number = 300000) => {
    let timeout = initialTimeout;
    const start = Date.now();
    while (Date.now() - start < maxIncrement) {
        const currentBalanceStr = await getBalance(address);
        const currentBalance = currentBalanceStr ? toWei(currentBalanceStr) : BigInt(0);

        if (currentBalance >= amountSent) {
            console.log(`💰 Balance updated successfully to ${formatEther(currentBalance)} GAS`);
            return true;
        }

        await delay(timeout); // Check balance after the current timeout period
        timeout = Math.min(timeout + 60000, maxIncrement); // Increment the timeout, up to maxIncrement
    }
    console.error(`❌ Timeout: Balance did not update to the expected amount within ${maxIncrement / 1000} seconds`);
    return false;
};

// Function to wait if there are pending transaction
const waitForPendingTransactions = async (address: Address) => {
    while (true) {
        const pendingNonce = await publicClient.getTransactionCount({ address, blockTag: 'pending' });
        const confirmedNonce = await publicClient.getTransactionCount({ address, blockTag: 'latest' });

        if (pendingNonce <= confirmedNonce) {
            break;
        }

        console.log("Waiting for pending transactions to confirm...");
        await delay(15000); // Wait for 15 seconds before checking again
    }
};

export async function sendGasToAddress(address: string, attempt: number, maxAttempts: number): Promise<any> {
    const account = await FundingWallet;
    let gasPrice = await publicClient.getGasPrice(); // Get current gas price

    const transactionValue = parseEther('0.05'); // This is the amount of Ether being sent

    console.log(`\n⛽️ Sending gas to Wallet Address: ${address}`,`\n`);

    let spinnerInterval: NodeJS.Timeout | undefined;
    const startTime = Date.now();

    try {
        await waitForPendingTransactions(account.address);

        const currentBalanceStr = await getBalance(address);
        console.log(`🔍 Current balance for ${address}: ${currentBalanceStr} GAS`); // Log the balance fetched
        
        // Convert balance string to Wei
        const currentBalance = currentBalanceStr ? toWei(currentBalanceStr) : BigInt(0);
        const threshold = parseEther('0.05'); // This is in Wei

        // Skip if balance is more than the threshold
        if (currentBalance > threshold) {
            console.log(`💰 Balance is above 0.05 GAS (${formatEther(currentBalance)} GAS), skipping address: ${address}`);
            return null; // Skip this address
        }

        // Spinner for sending gas with ETA
        let frame = 0;
        spinnerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const eta = formatETA(startTime, maxAttempts, attempt);
            process.stdout.write(`\rSending gas ${animateSpinner(frame)} ${animateProgress(attempt, maxAttempts)} ${eta}`);
            frame++;
        }, 100);

        // Send the transaction
        const tx = await walletClient.sendTransaction({
            account,
            to: address as Address,
            value: transactionValue,
            gasPrice,  // Set the gas price
        });

        if (spinnerInterval) {
            clearInterval(spinnerInterval);
        }
        console.log(`\r✅ Gas sent successfully! Transaction hash: ${tx}`);

        // Wait for balance to be updated
        const sentAmount = parseEther('0.05');
        const balanceUpdated = await waitForBalanceUpdate(address, sentAmount);

        if (!balanceUpdated) {
            throw new Error('Balance update failed');
        }

        const balanceAfter = await getBalance(address);
        console.log(`💰 Balance after gas sent: ${balanceAfter}`);
        return tx;
    } catch (error: any) {
        if (spinnerInterval) {
            clearInterval(spinnerInterval);
        }

        const errorDetails = error.message || "No detailed error message provided.";

        // Check for "replacement transaction underpriced" error
        if (errorDetails.includes("replacement transaction underpriced")) {
            console.error("Details: replacement transaction underpriced");

            console.log(`⛽️ Estimating new gas price for attempt ${attempt + 1}...`);

            gasPrice = await estimateGasWithBuffer(address, attempt + 1);
            
            console.log(`💵 New gas price: ${formatEther(gasPrice)} GAS`);
            try {
                const tx = await walletClient.sendTransaction({
                    account,
                    to: address as Address,
                    value: transactionValue,
                    gasPrice,  // Set the new gas price
                });
                console.log(`\r✅ Gas sent successfully on retry! Transaction hash: ${tx}`);

                // Wait for balance to be updated
                const sentAmount = parseEther('0.05');
                const balanceUpdated = await waitForBalanceUpdate(address, sentAmount);

                if (!balanceUpdated) {
                    throw new Error('Balance update failed');
                }

                const balanceAfter = await getBalance(address);
                console.log(`💰 Balance after gas sent: ${balanceAfter}`);
                return tx;
            } catch (retryError: any) {
                console.error(`❌ Retried sending failed for ${address} - Retry attempt ${attempt}/${maxAttempts}`);
                console.error(`Error details: ${retryError.message || "No detailed error message provided."}`);
                await delay(60000); // Retry after 1 minute
                throw retryError;
            }
        } else {
            console.error(`❌ Sending failed for ${address} - Retry attempt ${attempt}/${maxAttempts}`);
            console.error(`Error details: ${errorDetails}`);
            await delay(60000); // Retry after 1 minute
            throw error;
        }
    }
}

export const sendGasToAccounts = async (accounts: { address: string, privateKey: string }[]) => {
    for (const account of accounts) {
        let success = false;
        let attempt = 0;
        const maxAttempts = 5;

        while (!success && attempt < maxAttempts) {
            attempt++;
            console.clear();
            console.log(`\n🔄 Processing address: ${account.address}`);
            try {
                const result = await sendGasToAddress(account.address, attempt, maxAttempts);
                if (result === null) {
                    console.log(`\nSkipping address: ${account.address} as it already has sufficient gas.`);
                    success = true; // Skip to the next address immediately
                } else {
                    console.log(`\n✅ Gas sent successfully to ${account.address}`);
                    success = true; // Exit the loop if successful
                }
            } catch (error) {
                console.error(`❌ Failed to send gas to ${account.address}.`);
                console.log('Retrying after 1 minute...');
                await delay(60000); // Wait for 1 minute before retrying
            }
        }
        if (!success) {
            console.log(`❌ Failed to send gas after ${maxAttempts} attempts.`);
        }

        // Apply minimal delay (100 milliseconds) only if the address was processed and not skipped
        if (success) {
            await delay(100); // 100 milliseconds before sending gas to the next address
        }
    }
};
