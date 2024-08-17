import { zeroAddress } from "viem";
import { Mnemonicaccount } from "./helpers/account";
import { asciiConsole } from "./util/asciiConsole";
import { URlCHAIN } from "./util/chains";
import { getBalance } from "./helpers/getBalance";

// Start the bot ------->

console.log(asciiConsole); 
console.log("\n\n"); 
console.log("Wallet Address:", Mnemonicaccount.address);
console.log("\n"); 


const asyncFunc = async () => {
    try {
      const balance = await getBalance(Mnemonicaccount.address);

    } catch (error) {
      console.error("Error in async function:", error);
    }
  };
  
  // Call the async function
  asyncFunc();



