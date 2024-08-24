import { ethers } from "ethers";
import { getContracts } from "../lib/contracts";
import { MOVEMENT_DEVNET } from "../util/chains";
import { ethersprovider } from "../util/config";
import { loadWalletsFromJson } from "./account";
import {
  estimateGasWithBuffer,
  NETWORK_TIMEOUT,
} from "./getAllowance";
import { singleMarketAbi } from "../util/abi/singleMarketAbi";
import { getBalance } from "./getBalance";
import {
  expandDecimals,
  processPrices,
  referralCodeDecimals,
  TRadeMarket,
  TradeTokens,
  uiFees,
} from "../lib/Faucetokens/token";
import axios from "axios";

// Custom animation frames
const frames = ['|', '/', '-', '\\'];

// Custom color functions
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const magenta = (text: string) => `\x1b[35m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

// Custom spinner function
function customSpinner(text: string) {
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${text}`);
    i = (i + 1) % frames.length;
  }, 100);
}

// Sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch token prices function
export const fetchTokenPrices = async () => {
  const response = await axios.get("https://api.devnet.avituslabs.xyz/prices/tickers");
  return response.data;
};

// Get price for token address function
export const getPriceForTokenAddress = async (address: string) => {
  const tokenPrices = await fetchTokenPrices();
  const tokenPrice = tokenPrices.find(
    (price: any) => price.tokenAddress.toLowerCase() === address.toLowerCase()
  );
  return tokenPrice?.maxPrice;
};

// Retry function
const retry = async (fn: any, retries: number = 3, delay: number = 5000) => {
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), NETWORK_TIMEOUT)
      ),
    ]);
  } catch (error: any) {
    if (retries > 0) {
      console.warn(red(`\nRetrying due to error: ${error.message || error}\n`));
      await sleep(delay);
      return retry(fn, retries - 1, delay);
    } else {
      throw error;
    }
  }
};

// Main trade open function
export const tradeOpen = async () => {
  console.clear();
  console.log(cyan('======================================'));
  console.log(magenta('           TRADE OPEN'));
  console.log(cyan('======================================'));

  let spinner = customSpinner('Initializing trade...');

  try {
    clearInterval(spinner);
    console.log(green('\n✔ Trade initialized'));
    
    spinner = customSpinner('Fetching token prices...');
    const prices = await fetchTokenPrices();
    const processedData = processPrices(prices);
    const primaryPrices = processedData.primaryPrices;
    const primaryTokens = processedData.primaryTokens;
    clearInterval(spinner);
    console.log(green('\n✔ Token prices fetched successfully'));

    await sleep(1000);

    const tokens = TradeTokens[MOVEMENT_DEVNET];
    const Trade = tokens.find((token) => token.symbol === "USDC");

    spinner = customSpinner('Getting API price...');
    const apiPrice = await getPriceForTokenAddress(Trade!.address);
    const numberApiPrice = BigInt(apiPrice || "0");
    clearInterval(spinner);
    console.log(green(`\n✔ API Price: ${yellow(numberApiPrice.toString())}`));

    await sleep(1000);

    if (!apiPrice) {
      throw new Error(`Max price for token address ${Trade!.address} not found.`);
    }

    spinner = customSpinner('Loading wallets...');
    const wallets = loadWalletsFromJson("privateKey.json", ethersprovider);
    clearInterval(spinner);
    console.log(green(`\n✔ ${wallets.length} wallet(s) loaded`));

    await sleep(1000);

    for (const [index, wallet] of wallets.entries()) {
      console.log(
        blue(`\n🔐 Processing Wallet: ${wallet.address} (${index + 1}/${wallets.length})`)
      );

      spinner = customSpinner('Fetching gas balance...');
      const gasBalance = await retry(() => getBalance(wallet.address));
      clearInterval(spinner);
      console.log(green(`\n✔ Gas Balance: ${yellow(gasBalance)} Gas`));
      await sleep(500);

      const singleMarketOrderHandler = getContracts[MOVEMENT_DEVNET].SingleMarketExchangeRouter;
      const tokenContract = new ethers.Contract(singleMarketOrderHandler, singleMarketAbi, wallet);

      spinner = customSpinner('Preparing trade parameters...');
      
      const orderVault = getContracts[MOVEMENT_DEVNET].OrderVault;
      const newCollateral = 5000000n;
      const tradeAmount = Trade!.tradeble;
      const collateral = 5;
      const collvstradeamount = tradeAmount * collateral;
      const expndedDecimals = expandDecimals(collvstradeamount, 30);

      const orderParams = {
        addresses: {
          receiver: wallet.address,
          callbackContract: ethers.ZeroAddress,
          uiFeeReceiver: uiFees,
          market: TRadeMarket,
          initialCollateralToken: Trade!.address,
          swapPath: []
        },
        numbers: {
          sizeDeltaUsd: expndedDecimals,
          initialCollateralDeltaAmount: 0n,
          triggerPrice: 0n,
          acceptablePrice: numberApiPrice,
          executionFee: 0n,
          callbackGasLimit: 0n,
          minOutputAmount: 0n
        },
        orderType: 2, 
        decreasePositionSwapType: 0, 
        isLong: true,
        shouldUnwrapNativeToken: false,
        referralCode: referralCodeDecimals
      };
      
      const pricesParams = {
        primaryTokens: primaryTokens,
        primaryPrices: primaryPrices
      };

      clearInterval(spinner);
      console.log(green('\n✔ Trade parameters prepared'));

      await sleep(500);

      spinner = customSpinner('Estimating gas limit...');

      clearInterval(spinner);
     

      spinner = customSpinner('Checking Parms');
      let newGasPrice = await retry(() => estimateGasWithBuffer(wallet.address, 0));
      clearInterval(spinner);
      console.log(green(`\n✔ Estimated Gas Price: ${yellow(newGasPrice.toString())}`));
     
      await sleep(500);

      spinner = customSpinner('Simulating market order...');

      try {
        const tx = await tokenContract.simulateCreateSingleMarketOrder(orderParams, pricesParams );
        const receipt = await tx.wait();
        clearInterval(spinner);
        console.log("Transaction hash:", tx.hash);
        console.log("Transaction successful with receipt:", receipt);
        console.log(green(`\n✔ Market order simulated successfully for wallet: ${wallet.address}`));
      } catch (error: any) {
        clearInterval(spinner);
        if (error.code === "REPLACEMENT_UNDERPRICED") {
          console.warn(red(`\n⚠ Retrying due to error: Replacement transaction underpriced. Adjusting gas price and retrying...`));
          newGasPrice = await estimateGasWithBuffer(wallet.address, 1);
        } else {
          throw error;
        }
      }

      await sleep(1000);
    }

    console.log(cyan('\n======================================'));
    console.log(magenta('        TRADE OPEN COMPLETED'));
    console.log(cyan('======================================'));

  } catch (err: any) {
    clearInterval(spinner);
    console.error(red(`\n❌ Error: ${err.message}`));
  }
};
