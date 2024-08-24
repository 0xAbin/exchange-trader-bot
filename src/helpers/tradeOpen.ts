import { ethers } from "ethers";
import { getContracts } from "../lib/contracts";
import { MOVEMENT_DEVNET } from "../util/chains";
import { ethersprovider } from "../util/config";
import { loadWalletsFromJson } from "./account";
import {
  blue,
  estimateGasWithBuffer,
  green,
  NETWORK_TIMEOUT,
  red,
  yellow,
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
import { Address } from "viem";
import { customSpinner, cyan, magenta, sleep } from "../util/console";

// Custom animation frames
const frames = ['|', '/', '-', '\\'];

// Fetch token prices function
export const fetchTokenPrices = async () => {
  try {
    const response = await axios.get("https://api.devnet.avituslabs.xyz/prices/tickers");
    return response.data;
  } catch (error: any) {
    console.error(red(`Error fetching token prices: ${error.message}`));
    throw error;
  }
};

// Get price for token address function
export const getPriceForTokenAddress = async (address: string) => {
  try {
    const tokenPrices = await fetchTokenPrices();
    const tokenPrice = tokenPrices.find(
      (price: any) => price.tokenAddress.toLowerCase() === address.toLowerCase()
    );
    return tokenPrice?.maxPrice;
  } catch (error: any) {
    console.error(red(`Error getting price for token address: ${error.message}`));
    throw error;
  }
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

// Countdown function
const countdown = async (seconds: number) => {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\rRetrying in ${i} seconds... ${frames[i % frames.length]}`);
    await sleep(1000);
  }
  process.stdout.write('\r'); // Clear the line after countdown
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

      const reciver = wallet.address;
      const singleMarketOrderHandler = getContracts[MOVEMENT_DEVNET].SingleMarketExchangeRouter;
      const tokenContract = new ethers.Contract(singleMarketOrderHandler, singleMarketAbi, wallet);

      spinner = customSpinner('Preparing trade parameters...');

      const orderVault = getContracts[MOVEMENT_DEVNET].OrderVault;
      const newCollateral = 5000000n;
      const tradeAmount = Trade!.tradeble;
      const collateral = 5;
      const collvstradeamount = tradeAmount * collateral;
      const expndedDecimals = expandDecimals(collvstradeamount, 30);

      const sendWnt = { method : "sendWnt", params : [orderVault, 0n] };
      const sendTokens = { method : "sendTokens", params : [ Trade?.address, orderVault, newCollateral] };

      const orderParams = {
        addresses: {
          receiver: reciver as Address,
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

      const simulateCreateSingleMarketOrder = { method : "simulateCreateSingleMarketOrder", params : [orderParams, pricesParams] };

      const multicall = [sendWnt, sendTokens, simulateCreateSingleMarketOrder];
      const encodedPayload = multicall.filter(Boolean).map((call) => tokenContract.interface.encodeFunctionData(call!.method, call!.params));

      clearInterval(spinner);
      console.log(green('\n✔ Trade parameters prepared'));

      await sleep(500);

      spinner = customSpinner('Estimating gas limit...');
      let newGasPrice = await retry(() => estimateGasWithBuffer(wallet.address, 0));
      clearInterval(spinner);
      console.log(green(`\n✔ Estimated Gas Price: ${yellow(newGasPrice.toString())}`));

      await sleep(500);

      spinner = customSpinner('Sending multicall request...');
      
      try {
        const tx = await tokenContract.multicall(encodedPayload);
        const receipt = await tx.wait();
        clearInterval(spinner);
        console.log(green("\n✔ Transaction sent successfully"));
        console.log(yellow(`Transaction hash: ${tx.hash}`));
        console.log(green("✔ Transaction confirmed"));
        console.log(yellow(`Gas used: ${receipt.gasUsed.toString()}`));
        console.log(green(`✔ Market order successfully executed!`));
      } catch (error: any) {
        clearInterval(spinner);
        console.error(red(`Failed to send transaction: ${error.message}`));
      }
    }
  } catch (error: any) {
    console.error(red(`\nUnexpected error: ${error.message}`));
  }
};
