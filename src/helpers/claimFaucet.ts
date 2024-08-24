import { Address, formatUnits, parseUnits } from "viem";
import { getContracts } from "../lib/contracts";
import { facuetAbi } from "../util/abi/facuetAbi";
import { MOVEMENT_DEVNET } from "../util/chains";
import { ethers } from "ethers";
import { FacuetTestToken } from "../lib/Faucetokens/token";
import { publicClient, ethersprovider } from "../util/config";
import { tokenabi } from "../util/abi/tokenabi";
import { loadWalletsFromJson } from "./account";
import { saveJsonToFile } from "../util/saveTologs";
import { estimateGasWithBuffer, getGasLimit } from "../util/getGas";
import { colorize, delay, printProgressBar, spinner } from "../util/console";

export const calculateClaimAmount = (claimable: number, decimals: number) => {
    return parseUnits(claimable.toString(), decimals);
};

const formatBalance = (balance: bigint | undefined, decimals: number): string => {
    if (balance === undefined) return "0";
    return parseFloat(formatUnits(balance, decimals)).toFixed(2);
};

export const claimFaucet = async (): Promise<void> => {
    console.log(colorize.cyan("\n🚀 Starting Faucet Claim Process...\n"));

    const tokens = FacuetTestToken[MOVEMENT_DEVNET];
    const ClaimToken = tokens.find(token => token.symbol === "USDC");

    if (!ClaimToken) {
        console.log(colorize.red("❌ Token not found."));
        return;
    }

    const claimableAmount = ClaimToken.claimable;
    const tokenAmount = calculateClaimAmount(claimableAmount, ClaimToken.decimals);

    console.log(colorize.yellow("🔍 Claiming Token Details:"));
    console.log(colorize.yellow(`   Symbol: ${ClaimToken.symbol}`));
    console.log(colorize.yellow(`   Address: ${ClaimToken.address}`));
    console.log(colorize.yellow(`   Claimable Amount: ${claimableAmount}`));
    console.log(colorize.yellow(`   Parsed Amount: ${tokenAmount}\n`));

    const chaingasprice = await publicClient.getGasPrice();
    console.log(colorize.magenta(`⛽️ Chain Gas Price: ${formatUnits(chaingasprice, 9)} Gwei\n`));

    const wallets = loadWalletsFromJson('privateKey.json', ethersprovider);

    const claimedAddresses: string[] = [];
    const unclaimedAddresses: { address: string; error: string }[] = [];

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        console.log(colorize.cyan(`\n🚀 Processing Wallet: ${wallet.address} (${i + 1}/${wallets.length})`));

        // Check gas balance
        const gasBalance = await publicClient.getBalance({ address: wallet.address as Address });
        const gasBalanceEth = parseFloat(formatUnits(gasBalance, 18));
        console.log(colorize.yellow(`💰 Current Gas Balance: ${gasBalanceEth.toFixed(4)} ETH`));

        if (gasBalanceEth < 0.001) {
            console.log(colorize.red("❌ Insufficient gas balance. Skipping this wallet."));
            unclaimedAddresses.push({
                address: wallet.address,
                error: "Insufficient gas balance",
            });
            continue;
        }

        try {
            const faucetContractAddress = getContracts[MOVEMENT_DEVNET].FaucetVault;
            const faucetContract = new ethers.Contract(faucetContractAddress, facuetAbi, wallet);

            // Check if the wallet has already claimed tokens
            const currentBalance = await publicClient.readContract({
                address: ClaimToken.address as Address,
                abi: tokenabi,
                functionName: "balanceOf",
                args: [wallet.address],
            });

            if (typeof currentBalance === 'bigint') {
                const currentBalanceValue = currentBalance as bigint;
                const currentBalanceInTokens = parseFloat(formatUnits(currentBalanceValue, ClaimToken.decimals));
                const claimAmountInTokens = parseFloat(formatUnits(tokenAmount, ClaimToken.decimals));

                if (currentBalanceInTokens >= claimAmountInTokens) {
                    console.log(colorize.yellow("💰 Wallet already has sufficient token balance. Skipping this wallet."));
                    unclaimedAddresses.push({
                        address: wallet.address,
                        error: "Already has sufficient token balance",
                    });
                    continue;
                }
            } else {
                console.error("❌ Error: currentBalance is not of type bigint");
                unclaimedAddresses.push({
                    address: wallet.address,
                    error: "currentBalance is not a bigint",
                });
                continue;
            }

            let success = false;
            let retries = 0;
            let delayTime = 60000; // Start with 1 minute delay

            while (!success) {
                try {
                    console.log(colorize.blue("📜 Preparing Transaction..."));
                    spinner.start('Claiming tokens...');
                    
                    const newgasprice = await estimateGasWithBuffer(wallet.address, 1);

                    const tx = await faucetContract.claimTokens(ClaimToken.address, tokenAmount, { gasPrice: newgasprice });
                    spinner.stop();
                    spinner.start('Transaction sent. Awaiting confirmation...');

                    const receipt = await tx.wait();
                    spinner.stop();

                    if (receipt.status === 1) {
                        console.log(colorize.green("\n✅ Transaction confirmed!"));
                        claimedAddresses.push(wallet.address);
                        success = true;
                    } else {
                        throw new Error("Receipt status indicates failure.");
                    }

                    console.log(colorize.green(`Faucet Claim Completed For: ${wallet.address}`));

                } catch (e) {
                    spinner.stop();
                    const error = e as Error;

                    if (error.message.includes("Cooldown period has not passed")) {
                        console.log(colorize.yellow("⏩ Cooldown period has not passed. Skipping to next wallet."));
                        success = true; // Exit retry loop if cooldown is the issue
                        break;
                    } else if (error.message.includes("server response 524")) {
                        console.log(colorize.red(`❌ Server error 524: ${error.message}`));
                        console.log(colorize.yellow(`🔄 Retrying in ${delayTime / 1000} seconds...`));
                        await delay(delayTime);
                        delayTime += 60000; // Increase delay by 1 minute each retry
                    } else {
                        console.log(colorize.red(`❌ Transaction failed: ${error.message}`));
                        if (retries < 2) {
                            retries++;
                            console.log(colorize.yellow(`🔄 Retrying in ${delayTime / 1000} seconds... (Attempt ${retries + 1}/3)`));
                            await delay(delayTime);
                            delayTime += 60000; // Increase delay by 1 minute each retry
                        } else {
                            unclaimedAddresses.push({
                                address: wallet.address,
                                error: error.message,
                            });
                            console.log(colorize.red("❌ Maximum retries reached. Moving to the next wallet."));
                            success = true; // Exit retry loop after max retries
                            break;
                        }
                    }
                }
            }

        } catch (error: any) {
            console.error(colorize.red(`\n❌ Unexpected error: ${error.message}`));
            unclaimedAddresses.push({
                address: wallet.address,
                error: "Unexpected error",
            });
        }

        const getBalanceClaimed = await publicClient.readContract({
            address: ClaimToken.address as Address,
            abi: tokenabi,
            functionName: "balanceOf",
            args: [wallet.address],
        });

        console.log(colorize.blue(`🔍 Claimed Wallet Balance: ${ClaimToken.symbol} ${formatBalance(getBalanceClaimed as bigint, ClaimToken.decimals)}`));

        // Progress bar
        printProgressBar(i + 1, wallets.length);

        // Wait for 10 seconds before processing the next address
        if (i < wallets.length - 1) {
            spinner.start('Waiting for next wallet...');
            await delay(10000);
            spinner.stop();
        }
    }

    console.log(colorize.cyan("\n\n----- Bot Process Completed -----"));

    // Save claimed and unclaimed addresses to JSON files
    saveJsonToFile('logs/claimed.json', claimedAddresses);
    saveJsonToFile('logs/unclaimed.json', unclaimedAddresses);

    console.log(colorize.yellow(`\n📊 Summary:`));
    console.log(colorize.green(`   Claimed Addresses: ${claimedAddresses.length}/${wallets.length}`));
    console.log(colorize.red(`   Unclaimed Addresses: ${unclaimedAddresses.length}/${wallets.length}`));
};
