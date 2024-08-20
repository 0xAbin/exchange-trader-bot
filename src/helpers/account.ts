import { Address, createWalletClient, custom } from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import 'dotenv/config';

const generateAccounts = (mnemonic: string) => {
    const accounts = [];
    for (let i = 0; i < 5; i++) {
        const account = mnemonicToAccount(mnemonic, {
            accountIndex: 0,
            addressIndex: i,
            changeIndex: 0,
        });

        const privateKeyBuffer = account.getHdKey().privateKey;
        
        if (privateKeyBuffer) {
            const privateKeyHex = `0x${Buffer.from(privateKeyBuffer).toString('hex')}`;
            accounts.push({
                address: account.address,
                privateKey: privateKeyHex,
            });
        } else {
            console.error(`Could not retrieve private key for address index ${i}`);
        }
    }
    return accounts;
};

export const storeAccounts = (accounts: { address: string, privateKey: string }[]) => {
    const data: { [key: string]: string } = {};
    accounts.forEach(account => {
        data[account.address] = account.privateKey;
    });
    fs.writeFileSync('privateKey.json', JSON.stringify(data, null, 2));
};

const mnemonic = process.env.MNEMONIC as string;
export const accountsPrivateKey = generateAccounts(mnemonic);

storeAccounts(accountsPrivateKey)



export const Mnemonicaccount = mnemonicToAccount(process.env.MNEMONIC as string);

export const FundingWallet = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);