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

export const calculateClaimAmount = (claimable: number, decimals: number) => {
    return parseUnits(claimable.toString(), decimals);
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatBalance = (balance: bigint | undefined, decimals: number): string => {
    if (balance === undefined) return "0";
    return parseFloat(formatUnits(balance, decimals)).toFixed(2);
};

const printProgressBar = (current: number, total: number, barLength: number = 30) => {
    const filledLength = Math.floor(barLength * current / total);
    const emptyLength = barLength - filledLength;
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    const percentage = Math.round((current / total) * 100);
    console.log(`\r[${filledBar}${emptyBar}] ${percentage}% | ${current}/${total}`);
};

export const colorize = {
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
    magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
};

const spinner = {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80,
    current: 0,
    timer: null as NodeJS.Timeout | null,
    start(text: string) {
        this.current = 0;
        this.timer = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.current]} ${text}`);
            this.current = (this.current + 1) % this.frames.length;
        }, this.interval);
    },
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            process.stdout.write('\r');
        }
    }
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

            console.log(colorize.blue("📜 Preparing Transaction..."));

            spinner.start('Claiming tokens...');
            const newgasprice = await estimateGasWithBuffer(wallets[0].address, 1); // Assuming first attempt

            const gasLimit = await getGasLimit(wallet.address, faucetContractAddress as Address, tokenAmount);

            // console.log("Gas Limit: " + gasLimit);

            const tx = await faucetContract.claimTokens(ClaimToken.address, tokenAmount, { newgasprice});
            spinner.stop();
            spinner.start('Transaction sent. Awaiting confirmation...');

            try {
                const receipt = await tx.wait();
                spinner.stop();

                if (receipt.status === 1) {
                    console.log(colorize.green("\n✅ Transaction confirmed!"));
                    claimedAddresses.push(wallet.address);
                } else {
                    console.log(colorize.red("\n❌ Transaction failed: Receipt status indicates failure."));
                    unclaimedAddresses.push({
                        address: wallet.address,
                        error: "Receipt status indicates failure.",
                    });
                }

                console.log(colorize.green(`Faucet Claim Completed For: ${wallet.address}`));

            } catch (waitError : any) {
                spinner.stop();
                console.error(colorize.red(`\n❌ Error while waiting for transaction confirmation: ${waitError.message}`));
                console.log(colorize.yellow("⏳ Showing error message for 10 seconds..."));
                await delay(10000);
            }

        } catch (e) {
            spinner.stop();
            const error = e as Error;
            let errorMessage = "Unknown error";

            if (error.message.includes("replacement fee too low")) {
                errorMessage = "Replacement fee too low";
            } else if (error.message.includes("insufficient balance")) {
                errorMessage = "Insufficient balance";
            } else {
                const revertedMatch = error.message.match(/execution reverted: "(.*?)"/);
                errorMessage = revertedMatch ? revertedMatch[1] : error.message;
            }

            console.log(colorize.red(`❌ Transaction failed:`));
            console.error(colorize.red(`   - Message: ${errorMessage}`));
            unclaimedAddresses.push({
                address: wallet.address,
                error: errorMessage,
            });

            console.log(colorize.yellow("⏳ Showing error message for 10 seconds..."));
            await delay(10000);
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
