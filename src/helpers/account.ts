import { createWalletClient, custom } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { english, generateMnemonic } from 'viem/accounts'
import 'dotenv/config'


export const Mnemonicaccount = mnemonicToAccount(process.env.MNEMONIC as string)


