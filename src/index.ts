import { accountsPrivateKey, FundingWallet, Mnemonicaccount, storeAccounts } from "./helpers/account";
import { asciiConsole } from "./util/asciiConsole";
import { getBalance } from "./helpers/getBalance";
import { claimFaucet } from "./helpers/claimFaucet";
import { sendGasToAccounts } from "./helpers/getGas";

// Start the bot ------->

console.log(asciiConsole);
console.log("\n\n");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    console.log("Processing Funding Wallet...\n");
    await logWalletDetails("Funding Wallet", FundingWallet.address);

    // Fetch and log the balance of the Mnemonic Wallet (uncomment if needed)
    // console.log("Processing Mnemonic Wallet...\n");
    // await logWalletDetails("Mnemonic Wallet", Mnemonicaccount.address);

    // Uncomment to send gas to associated accounts
    console.log(`Sending gas to Mnemonic Wallet and associated accounts...`);
    await sendGasToAccounts(accountsPrivateKey);
    console.log("Gas sent successfully.\n");

    // Start the faucet claim process
    console.log("----- Starting Faucet Claim Process for All Wallets -----\n");
    await claimFaucet(); // Call the faucet claim function

  } catch (error) {
    console.error("Error in BotStart function:", error);
  } finally {
    console.log("----- Bot Process Completed -----");
  }
};

// Start the bot
BotStart();