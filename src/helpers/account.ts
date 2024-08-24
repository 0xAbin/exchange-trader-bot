import { Address, createWalletClient, custom } from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import 'dotenv/config';
import { ethers } from 'ethers';

const generateAccounts = (mnemonic: string) => {
    const accounts = [];
    for (let i = 0; i < 20; i++) {
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

export const FundingWallet = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

export function loadWalletsFromJson(filePath: string, provider: ethers.JsonRpcProvider): ethers.Wallet[] {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const privateKeys = JSON.parse(data);
        const wallets: ethers.Wallet[] = [];

        for (const [address, privateKey] of Object.entries(privateKeys)) {
            const wallet = new ethers.Wallet(privateKey as string, provider);
            wallets.push(wallet);
            console.log(`Wallet created for address: ${address}`);
        }

        return wallets;
    } catch (error) {
        console.error("Error reading privateKey.json or creating wallets:", error);
        return [];
    }
}




export function loadWalletsFromJsonViem(filePath: string) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const privateKeys = JSON.parse(data);
        const wallets = [];

        for (const [address, privateKey] of Object.entries(privateKeys)) {
            try {
                if (typeof privateKey !== 'string') {
                    throw new Error(`Invalid private key format for address ${address}`);
                }
                const wallet = privateKeyToAccount(privateKey as Address); 
                wallets.push(wallet);
                console.log(`Wallet created for address: ${wallet.address}`);
            } catch (err) {
                console.error(`Failed to create wallet for address ${address}:`, err);
            }
        }

        return wallets;
    } catch (error) {
        console.error("Error reading privateKey.json or creating wallets:", error);
        return [];
    }
}
