import { zeroAddress } from "viem";
import { Mnemonicaccount } from "./helpers/account";
import { mevmRequestFaucet } from "./helpers/getGasreq";
import { asciiConsole } from "./util/asciiConsole";
import { URlCHAIN } from "./util/chains";
import { getBalance } from "./helpers/getBalance";

// Start the bot ------->

console.log(asciiConsole); 
console.log("\n\n"); 
console.log("Wallet Address:", Mnemonicaccount.address);
console.log("\n"); 


const BotRun = async () => {
    try {
    //   await mevmRequestFaucet(URlCHAIN.mevmM1.url, Mnemonicaccount.address, "6LdPgxMqAAAAAByFdD5V8PiPKYZS4mSZWUUcZW6B");
      const balance = await getBalance(Mnemonicaccount.address);
    //   console.log("Balance after faucet request:", balance);
    } catch (error) {
      console.error("Error in async function:", error);
    }
  };
  

  BotRun();



