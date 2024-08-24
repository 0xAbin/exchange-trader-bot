import { Address, multicall3Abi } from 'viem';
import { getContracts } from '../lib/contracts';
import { MOVEMENT_DEVNET } from '../util/chains';
import { publicClient } from '../util/config'; 
import { colorize, customSpinner, cyan, magenta, sleep, green, red, yellow } from '../util/console';
import { loadWalletsFromJsonViem } from './account';
import { calculateClaimAmount } from './claimFaucet';
import { facuetAbi } from '../util/abi/facuetAbi';
import { expandDecimals, FacuetTestToken, processPrices, referralCodeDecimals, TRadeMarket, TradeTokens, uiFees } from '../lib/Faucetokens/token';
import { tokenabi } from '../util/abi/tokenabi';
import { ethers } from 'ethers';
import { fetchTokenPrices, getPriceForTokenAddress } from './tradeOpen';
import { singleMarketAbi } from '../util/abi/singleMarketAbi';

export const multicallTrade = async () => {
    let spinner = customSpinner('Initializing trade...');

    spinner = customSpinner('Loading wallets...');
    const wallets = loadWalletsFromJsonViem('privateKey.json');
    clearInterval(spinner);
    console.log(green(`\n✔ ${wallets.length} wallet(s) loaded`));
    await sleep(5000);

    const tokens = FacuetTestToken[MOVEMENT_DEVNET];
    const tradetkensa = TradeTokens[MOVEMENT_DEVNET];
    const ClaimToken = tokens.find(token => token.symbol === 'USDC');

    const claimableAmount = ClaimToken!.claimable;
    const tokenAmount = calculateClaimAmount(claimableAmount, ClaimToken!.decimals);

    const prices = await fetchTokenPrices();
    const processedData = processPrices(prices);
    const primaryPrices = processedData.primaryPrices;
    const primaryTokens = processedData.primaryTokens;
    clearInterval(spinner);
    console.log(green('\n✔ Token prices fetched successfully'));

    await sleep(1000);

    const Trade = tradetkensa.find((tradetkensa) => tradetkensa.symbol === "USDC");
    spinner = customSpinner('Getting API price...');
    const apiPrice = await getPriceForTokenAddress(Trade!.address);
    const numberApiPrice = BigInt(apiPrice || "0");
    clearInterval(spinner);
    console.log(green(`\n✔ API Price: ${yellow(numberApiPrice.toString())}`));

    await sleep(5000);

    if (!apiPrice) {
      throw new Error(`Max price for token address ${Trade!.address} not found.`);
    }

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        console.log(colorize.cyan(`\n🚀 Wallet: ${wallet.address} (${i + 1}/${wallets.length})`));

        try {

            const reciver = wallet.address;
      // console.log(reciver);

      const singleMarketOrderHandler = getContracts[MOVEMENT_DEVNET].SingleMarketExchangeRouter;
      // console.log(singleMarketOrderHandler);

      const tokenContract = new ethers.Contract(singleMarketOrderHandler, singleMarketAbi, wallet as any);

      spinner = customSpinner('Preparing trade parameters...');
      
      const orderVault = getContracts[MOVEMENT_DEVNET].OrderVault;
      const newCollateral = 5000000n;
      const tradeAmount = Trade!.tradeble;
      const collateral = 5;
      const collvstradeamount = tradeAmount * collateral;
      const expndedDecimals = expandDecimals(collvstradeamount, 30);

      // const tradeamount = BigInt(tradeAmount)

      const sendWnt = { method : "sendWnt", params : [orderVault, 0n] };

      const sendWntMaul = [orderVault, 0n]

      const sendTokens = { method : "sendTokens", params : [ Trade?.address, orderVault, newCollateral] };

      const sendTokensMaul = [Trade?.address, orderVault, newCollateral];
   
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

      const simulateCreateSingleMarketmaul = [orderParams, pricesParams];

      const multicall = [sendWnt, sendTokens, simulateCreateSingleMarketOrder];

      const encodedPayload = multicall.filter(Boolean).map((call) => tokenContract.interface.encodeFunctionData(call!.method, call!.params));

            
            const FaucetmulticallTaget = getContracts[MOVEMENT_DEVNET].FaucetVault;
            const syntheticsRouterAddress = getContracts[MOVEMENT_DEVNET].SyntheticsRouter;

            const faucetClaim = {
                address: FaucetmulticallTaget,
                abi: facuetAbi,
                functionName: 'claimTokens',
                args: [ClaimToken!.address, tokenAmount], 
            };

            const results = await publicClient.multicall({
                contracts: [
                    {
                        address: FaucetmulticallTaget as Address,
                        abi: facuetAbi,
                        functionName: 'claimTokens',
                        args: [ClaimToken!.address, tokenAmount],
                    },
                    {
                        address: ClaimToken!.address as Address,
                        abi: tokenabi,
                        functionName: 'approve',
                        args: [syntheticsRouterAddress, ethers.MaxUint256],
                    },
                    {
                        address: singleMarketOrderHandler as Address,
                        abi: singleMarketAbi,
                        functionName: 'multicall',
                        args: [encodedPayload],
                    }

                ],

            });

            console.log('Multicall results:', results);

        } catch (err: any) {
            console.error(red(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`));
            console.error(red(`┃           FATAL ERROR             ┃`));
            console.error(red(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`));
            console.error(yellow(`Error: ${err.message}`));
            console.error(magenta('\nStack trace:'));
            console.error(cyan(err.stack));
        }
    }
}
