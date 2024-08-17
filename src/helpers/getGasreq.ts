import axios from "axios";

export async function mevmRequestFaucet(
    mevmUrl: string,
    address: string,
    token: string,
  ): Promise<any> {
  
    const requestData = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_batch_faucet",
      params: [
        address
      ]
    };
  
    const res = await axios.post(mevmUrl, requestData, {
      headers: {
        "Content-Type": "application/json",
        "Token": token
      }
    });
  
    if(res.status !== 200) {
      return {error: res.data};
    }else{
      if(res.data.error){
        return {error: res.data.error.message};
      }else{
        return {success:res.data};
      }
    }
}