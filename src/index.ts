import { accountsPrivateKey, FundingWallet, Mnemonicaccount, storeAccounts } from "./helpers/account";
import { asciiConsole } from "./util/asciiConsole";
import { getBalance } from "./helpers/getBalance";
import { sendGasToAccounts } from "./helpers/getGas";
import { claimFaucet } from "./helpers/claimFaucet";

// Start the bot ------->

console.log(asciiConsole);
console.log("\n\n");

const logWalletDetails = async (walletName: string, walletAddress: string): Promise<void> => {
  console.log(`Fetching balance for ${walletName} (${walletAddress})`);
  try {
    const balance = await getBalance(walletAddress);
    console.log(`${walletName} balance: ${balance}`);
  } catch (error) {
    console.error(`Failed to get balance for ${walletName}:`, error);
    throw error;
  }
};

const BotStart = async (): Promise<void> => {
  console.log("----- Starting Bot -----\n");

  try {
    console.log("Processing Funding Wallet...\n");
    await logWalletDetails("Funding Wallet", FundingWallet.address);

    // Uncomment if needed
    // console.log("Processing Mnemonic Wallet...\n");
    // await logWalletDetails("Mnemonic Wallet", Mnemonicaccount.address);

    console.log(`Sending gas to Mnemonic Wallet and associated accounts...`);
    // await sendGasToAccounts(accountsPrivateKey);
    console.log("Gas sent successfully.\n");

    // Log message indicating that faucet claiming is about to start
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