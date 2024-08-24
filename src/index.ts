import { accountsPrivateKey, FundingWallet, Mnemonicaccount, storeAccounts } from "./helpers/account";
import { asciiConsole } from "./util/asciiConsole";
import { getBalance } from "./helpers/getBalance";
import { claimFaucet } from "./helpers/claimFaucet";
import { sendGasToAccounts } from "./helpers/getGas";
import { getAllowance } from "./helpers/getAllowance";
import { tradeOpen } from "./helpers/tradeOpen";
import { multicallTrade } from "./helpers/multicallTrade";

// Start the bot ------->

console.log(asciiConsole);
console.log("\n\n");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track start time
const startTime = Date.now();

const logElapsedTime = () => {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingSeconds = seconds % 60;
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
};

const logWalletDetails = async (walletName: string, walletAddress: string): Promise<void> => {
  console.log(`Fetching balance for ${walletName} (${walletAddress})`);
  try {
    const balance = await getBalance(walletAddress);
    console.log(`${walletName} balance: ${balance}` + "\n");

    // Wait for 5 seconds before continuing
    await delay(5000);
  } catch (error) {
    console.error(`Failed to get balance for ${walletName}:`, error);
    throw error;
  }
};

const BotStart = async (): Promise<void> => {
  console.log("----- Starting Bot -----\n");

  try {
    // Fetch and log the balance of the Funding Wallet
    // console.log("Processing Funding Wallet...\n");
    // await logWalletDetails("Funding Wallet", FundingWallet.address);

    // // Fetch and log the balance of the Mnemonic Wallet (uncomment if needed)
    // // console.log("Processing Mnemonic Wallet...\n");
    // // await logWalletDetails("Mnemonic Wallet", Mnemonicaccount.address);

    console.log(`Sending gas to Mnemonic Wallet and associated accounts...`);
    await sendGasToAccounts(accountsPrivateKey);
    console.log("Gas sent successfully.\n");

    // // Log elapsed time after sending gas
    // console.log(`Elapsed time after sending gas: ${logElapsedTime()}`);

    // console.log("----- Starting Faucet Claim Process for All Wallets -----\n");
    // await claimFaucet();

    // // Log elapsed time after claiming faucet
    // console.log(`Elapsed time after faucet claim: ${logElapsedTime()}`);

    // console.log("----- Starting Allowance Check Process for All Wallets -----\n");
    // await getAllowance();

    // // Log elapsed time after allowance check
    // console.log(`Elapsed time after allowance check: ${logElapsedTime()}`);

    // console.log("----- Starting Trade Open Process for All Wallets -----\n");
    // await tradeOpen();

    multicallTrade()

    // Log elapsed time after trading
    console.log(`Elapsed time after trade open: ${logElapsedTime()}`);

  } catch (error) {
    console.error("Error in BotStart function:", error);
  } finally {
    // Log total elapsed time
    console.log("----- Bot Process Completed -----");
    console.log(`Total elapsed time: ${logElapsedTime()}`);
  }
};

// Start the bot
BotStart();
