import { facuetAbi } from '../util/abi/facuetAbi';
import { Address, http } from "viem";
import { movementDevnet, walletClient } from "../util/config";
import { parseEther } from "viem";
import { FundingWallet } from "./account";
import { getBalance } from './getBalance';


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

export async function sendGasToAddress(address: string, attempt: number, maxAttempts: number): Promise<any> {
    const account = await FundingWallet;
    const initialGasPrice = parseEther('0.001');

    console.log(`\nWallet Address: ${address}`);
    
    let spinnerInterval: NodeJS.Timeout | undefined;
    
    try {
        let frame = 0;
        spinnerInterval = setInterval(() => {
            process.stdout.write(`\rSending gas ${animateSpinner(frame)} ${animateProgress(attempt, maxAttempts)}`);
            frame++;
        }, 100);

        const tx = await walletClient.sendTransaction({
            account,
            to: address as Address,
            value: initialGasPrice,
        });

        if (spinnerInterval) {
            clearInterval(spinnerInterval);
        }
        process.stdout.write(`\r✅ Gas sent successfully! Transaction hash: ${tx}\n`);
        const balance = await getBalance(address);
        process.stdout.write(`\r💰 Balance after gas sent: ${balance}\n`);
        return tx;
    } catch (error: any) {
        if (spinnerInterval) {
            clearInterval(spinnerInterval);
        }
        const errorDetails = error.details || "No detailed error message provided.";
        process.stdout.write(`\r❌ Sending failed for ${address} - Retry attempt ${attempt}/${maxAttempts}\n`);
        console.error(`Error details: ${errorDetails}`);
        throw error;
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
            console.log(`\nProcessing address: ${account.address}`);
            try {
                await sendGasToAddress(account.address, attempt, maxAttempts);
                console.log(`\n✅ Gas sent successfully to ${account.address}`);
                success = true; // Exit the loop if successful
            } catch (error) {
                console.error(`❌ Failed to send gas to ${account.address}.`);
                console.log('Retrying after 30 seconds...');
                await delay(30000); // Wait for 30 seconds before retrying
            }
        }
        if (!success) {
            console.log(`❌ Failed to send gas after ${maxAttempts} attempts.`);
        }
        await delay(30000); // Wait for 30 seconds before sending gas to the next address
    }
};