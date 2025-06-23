import { Injectable, Logger } from '@nestjs/common';
import { Keypair, PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import bs58 from 'bs58';

@Injectable()
export class CustodialWalletService {
  private logger = new Logger(CustodialWalletService.name);
  private connection: Connection;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
  }

  async createCustodialWallet(email: string, userId: string): Promise<{
    walletAddress: string;
    encryptedSeed: string;
    walletType: 'CUSTODIAL';
    createdAt: Date;
  }> {
    try {
      // Generate deterministic seed from email + userId + secret
      const seedString = `${process.env.CUSTODIAL_SEED_PREFIX}-${email}-${userId}`;
      const seed = createHash('sha256').update(seedString).digest().slice(0, 32);
      
      // Create keypair from seed
      const keypair = Keypair.fromSeed(seed);
      const walletAddress = keypair.publicKey.toBase58();
      
      // Encrypt the seed for storage (in production, use KMS)
      const encryptedSeed = await this.encryptSeed(seed);
      
      this.logger.log(`Created custodial wallet for ${email}: ${walletAddress}`);
      
      // Fund with minimum rent exemption amount (optional in dev)
      if (process.env.AUTO_FUND_WALLETS === 'true') {
        await this.fundWalletWithMinimumRent(walletAddress);
      }
      
      return {
        walletAddress,
        encryptedSeed,
        walletType: 'CUSTODIAL',
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to create custodial wallet: ${error.message}`);
      throw error;
    }
  }

  async getWalletBalance(walletAddress: string): Promise<{
    balance: number;
    hasMinimumRent: boolean;
  }> {
    try {
      const pubkey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(pubkey);
      const minimumRent = await this.connection.getMinimumBalanceForRentExemption(0);
      
      return {
        balance: balance / 1e9, // Convert lamports to SOL
        hasMinimumRent: balance >= minimumRent,
      };
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`);
      return { balance: 0, hasMinimumRent: false };
    }
  }

  async signTransaction(
    walletAddress: string,
    encryptedSeed: string,
    transaction: Transaction
  ): Promise<Transaction> {
    try {
      // Decrypt seed
      const seed = await this.decryptSeed(encryptedSeed);
      const keypair = Keypair.fromSeed(seed);
      
      // Verify wallet address matches
      if (keypair.publicKey.toBase58() !== walletAddress) {
        throw new Error('Wallet address mismatch');
      }
      
      // Sign transaction
      transaction.sign(keypair);
      
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to sign transaction: ${error.message}`);
      throw error;
    }
  }

  async transferTicketOwnership(
    fromWallet: string,
    fromEncryptedSeed: string,
    toWallet: string,
    ticketPDA: string,
    programId: string
  ): Promise<string> {
    try {
      // This would call your smart contract's transfer instruction
      // For now, return mock transaction ID
      this.logger.log(`Transferring ticket ${ticketPDA} from ${fromWallet} to ${toWallet}`);
      
      // TODO: Implement actual transfer logic
      const mockTxId = bs58.encode(Buffer.from(new Uint8Array(64).map(() => Math.floor(Math.random() * 256))));
      
      return mockTxId;
    } catch (error) {
      this.logger.error(`Failed to transfer ticket: ${error.message}`);
      throw error;
    }
  }

  async recoverWallet(email: string, userId: string, verificationCode: string): Promise<{
    success: boolean;
    walletAddress?: string;
  }> {
    try {
      // Verify the recovery code (in production, use 2FA/email verification)
      const expectedCode = this.generateRecoveryCode(email, userId);
      if (verificationCode !== expectedCode) {
        return { success: false };
      }
      
      // Recreate wallet with same deterministic seed
      const seedString = `${process.env.CUSTODIAL_SEED_PREFIX}-${email}-${userId}`;
      const seed = createHash('sha256').update(seedString).digest().slice(0, 32);
      const keypair = Keypair.fromSeed(seed);
      
      return {
        success: true,
        walletAddress: keypair.publicKey.toBase58(),
      };
    } catch (error) {
      this.logger.error(`Failed to recover wallet: ${error.message}`);
      return { success: false };
    }
  }

  private async encryptSeed(seed: Uint8Array): Promise<string> {
    // WARNING: This is a placeholder. Use AWS KMS in production!
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-this';
    const encrypted = Buffer.from(seed).toString('base64');
    return `enc:v1:${encrypted}`;
  }

  private async decryptSeed(encryptedSeed: string): Promise<Uint8Array> {
    // WARNING: This is a placeholder. Use AWS KMS in production!
    const parts = encryptedSeed.split(':');
    if (parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error('Invalid encrypted seed format');
    }
    return new Uint8Array(Buffer.from(parts[2], 'base64'));
  }

  private generateRecoveryCode(email: string, userId: string): string {
    const data = `${email}-${userId}-${process.env.JWT_SECRET}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 8).toUpperCase();
  }

  private async fundWalletWithMinimumRent(walletAddress: string): Promise<void> {
    // In production, this would use a funded treasury wallet
    // For dev, just log
    this.logger.log(`Would fund wallet ${walletAddress} with minimum rent`);
  }

  async getUserWallets(userId: string): Promise<Array<{ walletAddress: string; type: string }>> {
    // Mock implementation - in production would query database
    return [{
      walletAddress: 'mock-custodial-wallet',
      type: 'CUSTODIAL'
    }];
  }

}

