import { Injectable, Logger } from '@nestjs/common';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { createHash } from 'crypto';

@Injectable()
export class WalletService {
  private logger = new Logger(WalletService.name);
  private connection: Connection;
  private treasuryKeypair: Keypair;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    
    // Initialize treasury wallet from seed
    if (process.env.TREASURY_WALLET_SEED) {
      const seed = createHash('sha256')
        .update(process.env.TREASURY_WALLET_SEED)
        .digest()
        .slice(0, 32);
      this.treasuryKeypair = Keypair.fromSeed(seed);
      this.logger.log(`Treasury wallet: ${this.treasuryKeypair.publicKey.toBase58()}`);
    }
  }

  async createCustodialWallet(userId: string): Promise<{
    publicKey: string;
    encryptedPrivateKey: string;
  }> {
    try {
      // Generate deterministic wallet from user ID
      const seed = createHash('sha256')
        .update(`${process.env.WALLET_SEED_PREFIX || 'tickettoken'}-${userId}`)
        .digest()
        .slice(0, 32);
      
      const keypair = Keypair.fromSeed(seed);
      
      // In production, use proper key management service (AWS KMS, etc.)
      const encryptedPrivateKey = this.encryptPrivateKey(keypair.secretKey);

      this.logger.log(`Created custodial wallet for user ${userId}: ${keypair.publicKey.toBase58()}`);

      return {
        publicKey: keypair.publicKey.toBase58(),
        encryptedPrivateKey,
      };
    } catch (error) {
      this.logger.error(`Failed to create custodial wallet: ${error.message}`);
      throw error;
    }
  }

  async getCustodialWalletBalance(publicKey: string): Promise<number> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(publicKey));
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`);
      return 0;
    }
  }

  async createTemporaryWallet(): Promise<{
    publicKey: string;
    privateKey: string;
    expiresAt: Date;
  }> {
    // Create ephemeral wallet for one-time use
    const keypair = Keypair.generate();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      expiresAt,
    };
  }

  async prepareMigrationToPhantom(
    custodialWalletPublicKey: string,
    phantomWalletPublicKey: string
  ): Promise<{
    migrationId: string;
    custodialWallet: string;
    phantomWallet: string;
    status: string;
  }> {
    // Prepare for migrating tickets from custodial to user's Phantom wallet
    const migrationId = createHash('sha256')
      .update(`${custodialWalletPublicKey}-${phantomWalletPublicKey}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16);

    // In production, this would initiate a multi-step migration process
    this.logger.log(`Prepared migration ${migrationId} from ${custodialWalletPublicKey} to ${phantomWalletPublicKey}`);

    return {
      migrationId,
      custodialWallet: custodialWalletPublicKey,
      phantomWallet: phantomWalletPublicKey,
      status: 'prepared',
    };
  }

  validateSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async checkWalletExists(publicKey: string): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(publicKey));
      return accountInfo !== null;
    } catch (error) {
      this.logger.error(`Failed to check wallet: ${error.message}`);
      return false;
    }
  }

  private encryptPrivateKey(privateKey: Uint8Array): string {
    // WARNING: This is a placeholder. In production, use proper encryption
    // with AWS KMS, HashiCorp Vault, or similar key management service
    const base64 = Buffer.from(privateKey).toString('base64');
    return `encrypted:${base64}`; // This is NOT secure - just for development
  }

  private decryptPrivateKey(encryptedKey: string): Uint8Array {
    // WARNING: This is a placeholder. In production, use proper decryption
    const base64 = encryptedKey.replace('encrypted:', '');
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  getTreasuryWallet(): string {
    return this.treasuryKeypair?.publicKey.toBase58() || '';
  }
}
