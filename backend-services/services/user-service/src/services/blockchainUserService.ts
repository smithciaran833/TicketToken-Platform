import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getConnection } from '../blockchain/program';

export class BlockchainUserService {
  private connection = getConnection();

  async createCustodialWallet() {
    try {
      const keypair = Keypair.generate();
      
      return {
        success: true,
        wallet: {
          publicKey: keypair.publicKey.toString(),
          privateKey: Array.from(keypair.secretKey), // Store securely in production
        }
      };
    } catch (error) {
      console.error('Custodial wallet creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getWalletBalance(publicKey: string) {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      
      return {
        success: true,
        balance: balance / LAMPORTS_PER_SOL, // Convert to SOL
        lamports: balance,
      };
    } catch (error) {
      console.error('Balance fetch failed:', error);
      return { success: false, error: error.message };
    }
  }

  async validateWallet(publicKey: string) {
    try {
      const pubKey = new PublicKey(publicKey);
      const accountInfo = await this.connection.getAccountInfo(pubKey);
      
      return {
        success: true,
        exists: accountInfo !== null,
        owner: accountInfo?.owner.toString(),
        lamports: accountInfo?.lamports || 0,
      };
    } catch (error) {
      console.error('Wallet validation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async airdropDevnetSOL(publicKey: string, amount: number = 1) {
    try {
      const pubKey = new PublicKey(publicKey);
      const signature = await this.connection.requestAirdrop(
        pubKey,
        amount * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature);
      
      return {
        success: true,
        signature,
        amount,
      };
    } catch (error) {
      console.error('Airdrop failed:', error);
      return { success: false, error: error.message };
    }
  }
}
