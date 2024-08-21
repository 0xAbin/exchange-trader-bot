import { Address, formatUnits, parseUnits } from "viem";
import { getContracts } from "../lib/contracts";
import { facuetAbi } from "../util/abi/facuetAbi";
import { MOVEMENT_DEVNET } from "../util/chains";
import { ethers } from "ethers";
import { FacuetTestToken } from "../lib/Faucetokens/token";
import { publicClient, ethersprovider } from "../util/config";
import { tokenabi } from "../util/abi/tokenabi";
import { loadWalletsFromJson } from "./account";
import * as fs from 'fs';
import * as path from 'path';
import { saveJsonToFile } from "../util/saveTologs";


const calculateClaimAmount = (claimable: number, decimals: number) => {
    return parseUnits(claimable.toString(), decimals);
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const renderProgressBar = (progress: number, width: number) => {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${" ".repeat(empty)}] ${progress}%`;
};

const formatBalance = (balance: bigint | undefined, decimals: number): string => {
    if (balance === undefined) return "0";
    return parseFloat(formatUnits(balance, decimals)).toFixed(2);
};


const loadingAnimation = (
    text = "",
    chars = ["⠙", "⠘", "⠰", "⠴", "⠤", "⠦", "⠆", "⠃", "⠋", "⠉"],
    delay = 100
) => {
    let x = 0;

    return setInterval(function() {
        process.stdout.write("\r" + chars[x++] + " " + text);
        x = x % chars.length;
    }, delay);
};

export const claimFaucet = async (): Promise<void> => {
    console.log("🚀 Starting Faucet Claim Process...");

    const tokens = FacuetTestToken[MOVEMENT_DEVNET];
    const ClaimToken = tokens.find(token => token.symbol === "USDC");

    if (!ClaimToken) {
        console.log("❌ Token not found.");
        return;
    }

    const claimableAmount = ClaimToken.claimable;
    const tokenAmount = calculateClaimAmount(claimableAmount, ClaimToken.decimals);

    console.log(`🔍 Claiming ${ClaimToken.symbol}:`);
    console.log(`- Address: ${ClaimToken.address}`);
    console.log(` - Claimable Amount: ${claimableAmount}`);
    console.log(` - Parsed Amount: ${tokenAmount}\n`);
    const chaingasprice = await publicClient.getGasPrice();
    console.log(`⛽️ Chain Gas Price: ${chaingasprice}\n`);
    const wallets = loadWalletsFromJson('privateKey.json', ethersprovider);

    const claimedAddresses: string[] = [];
    const unclaimedAddresses: { address: string; error: string }[] = [];

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        console.log(`\n🚀 Processing Wallet: ${wallet.address} (${i + 1}/${wallets.length})`);

        try {
            const faucetContractAddress = getContracts[MOVEMENT_DEVNET].FaucetVault;
            const faucetContract = new ethers.Contract(faucetContractAddress, facuetAbi, wallet);

            console.log("📜 Transaction Request Prepared\n");

            const tx = await faucetContract.claimTokens(ClaimToken.address, tokenAmount);
            console.log("⏳ Transaction Pending...");

            const loadingInterval = loadingAnimation("Awaiting confirmation...");

            const receipt = await tx.wait();
            clearInterval(loadingInterval);
            process.stdout.write("\r   [██████████████████████████████] 100%\n");

            if (receipt.status === 1) {
                console.log("\n✅ Transaction confirmed!");
                claimedAddresses.push(wallet.address);
            } else {
                console.log("\n❌ Transaction failed: Receipt status indicates failure.");
                unclaimedAddresses.push({
                    address: wallet.address,
                    error: "Receipt status indicates failure.",
                });
            }

            console.log("Faucet Claim Completed At:", `${wallet.address}`);

        } catch (e) {
            const error = e as Error;
            let errorMessage = "Unknown error";

            const replacementFeeMatch = error.message.match(/replacement fee too low/);
            const insufficientBalanceMatch = error.message.match(/insufficient balance/);
            const revertedMatch = error.message.match(/execution reverted: "(.*?)"/);

            if (replacementFeeMatch) {
                errorMessage = "Replacement fee too low";
            } else if (insufficientBalanceMatch) {
                errorMessage = "Insufficient balance";
            } else if (revertedMatch) {
                errorMessage = revertedMatch[1];
            } else {
                errorMessage = error.message;
            }

            console.log(`❌ Transaction failed:`);
            console.error(`   - Message: ${errorMessage}`);
            unclaimedAddresses.push({
                address: wallet.address,
                error: errorMessage,
            });
        }

        const getBalanceClaimed = await publicClient.readContract({
            address: ClaimToken.address as Address,
            abi: tokenabi,
            functionName: "balanceOf",
            args: [wallet.address],
        });

        console.log(`🔍 Claimed Wallet Balance: ${ClaimToken.symbol} ${formatBalance(getBalanceClaimed as bigint, ClaimToken.decimals)}`);

        // Wait for 10 seconds before processing the next address
        await delay(10000);
    }

    console.log("\n\n----- Bot Process Completed -----");

    // Save claimed and unclaimed addresses to JSON files
    saveJsonToFile('logs/claimed.json', claimedAddresses);
    saveJsonToFile('logs/unclaimed.json', unclaimedAddresses);

    console.log(`\n📊 Summary:`);
    console.log(`   Claimed Addresses: ${claimedAddresses.length}/${wallets.length}`);
    console.log(`   Unclaimed Addresses: ${unclaimedAddresses.length}/${wallets.length}`);
};

