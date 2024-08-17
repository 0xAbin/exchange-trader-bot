import { Address, formatEther } from 'viem';
import { publicClient } from '../util/config';


export  async function getBalance(Walletaddress: string) {
  try {
    const balance = await publicClient.getBalance({
      address: Walletaddress as Address
    });
    const formattedBalance = formatEther(balance);
    console.log('Wallet Balance:', formattedBalance, 'GAS');
  } catch (error) {
    console.error('Error fetching balance:', error);
  }
}

