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

// Helper function to convert balance to Wei
const toWei = (balanceStr: string): bigint => {
    return BigInt(parseEther(balanceStr).toString());
};

export async function sendGasToAddress(address: string, attempt: number, maxAttempts: number): Promise<any> {
    const account = await FundingWallet;
    // baseFee()
    let gasPrice = await publicClient.getGasPrice(); // Get current gas price

    const transactionValue = parseEther('0.01'); // This is the amount of Ether being sent

    console.log(`\n⛽️ Sending gas to Wallet Address: ${address}`,`\n`);

    let spinnerInterval: NodeJS.Timeout | undefined;

    try {
        
        const pendingNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
        const confirmedNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' });

        if (pendingNonce > confirmedNonce) {
            console.log("Waiting for pending transaction to confirm...");
            await new Promise(resolve => setTimeout(resolve, 15000)); 
            return sendGasToAddress(address, attempt, maxAttempts); 
        }

        const currentBalanceStr = await getBalance(address);
        console.log(`🔍 Current balance for ${address}: ${currentBalanceStr} GAS`); // Log the balance fetched
        
        // Convert balance string to Wei
        const currentBalance = currentBalanceStr ? toWei(currentBalanceStr) : BigInt(0);
        const threshold = parseEther('0.01'); // This is in Wei

        // Skip if balance is more than the threshold
        if (currentBalance > threshold) {
            console.log(`💰 Balance is above 0.01 GAS (${formatEther(currentBalance)} GAS), skipping address: ${address}`);
            return null; // Skip this address
        }

        // Spinner for sending gas
        let frame = 0;
        spinnerInterval = setInterval(() => {
            process.stdout.write(`\rSending gas ${animateSpinner(frame)} ${animateProgress(attempt, maxAttempts)}`);
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
                const balanceAfter = await getBalance(address);
                console.log(`💰 Balance after gas sent: ${balanceAfter}`);
                return tx;
            } catch (retryError: any) {
                console.error(`❌ Retried sending failed for ${address} - Retry attempt ${attempt}/${maxAttempts}`);
                console.error(`Error details: ${retryError.message || "No detailed error message provided."}`);
                await delay(5000); // Retry after 5 seconds
                throw retryError;
            }
        } else {
            console.error(`❌ Sending failed for ${address} - Retry attempt ${attempt}/${maxAttempts}`);
            console.error(`Error details: ${errorDetails}`);
            await delay(5000); // Retry after 5 seconds
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
                await sendGasToAddress(account.address, attempt, maxAttempts);
                console.log(`\n✅ Gas sent successfully to ${account.address}`);
                success = true; // Exit the loop if successful
            } catch (error) {
                console.error(`❌ Failed to send gas to ${account.address}.`);
                console.log('Retrying after 30 seconds...');
                await delay(10000); // Wait for 10 seconds before retrying
            }
        }
        if (!success) {
            console.log(`❌ Failed to send gas after ${maxAttempts} attempts.`);
        }
        await delay(15000); // Wait for 15 seconds before sending gas to the next address
    }
};
