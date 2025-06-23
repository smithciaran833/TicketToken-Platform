import { Connection, PublicKey } from '@solana/web3.js';
import { CacheStrategy } from '../types';
import { RedisMultiTierCache } from './redisCaching';
import { Logger } from '../utils/logger';

export class BlockchainRPCCache {
  private cache: RedisMultiTierCache;
  private connection: Connection;
  private logger: Logger;
  private readonly DEFAULT_TTL = 30000; // 30 seconds for blockchain data

  constructor(cache: RedisMultiTierCache, rpcEndpoint: string) {
    this.cache = cache;
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.logger = new Logger('BlockchainCache');
  }

  async getTransaction(signature: string): Promise<any> {
    const cacheKey = `blockchain:tx:${signature}`;
    
    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Transaction cache hit', { signature });
        return cached;
      }

      // Fetch from Solana RPC
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (transaction) {
        // Cache for longer if transaction is confirmed
        const ttl = transaction.meta?.err ? this.DEFAULT_TTL : this.DEFAULT_TTL * 10;
        await this.cache.set(cacheKey, transaction, ttl / 1000);
      }

      return transaction;

    } catch (error) {
      this.logger.error('Failed to get transaction', { signature, error: error.message });
      throw error;
    }
  }

  async getAccountInfo(pubkey: string): Promise<any> {
    const cacheKey = `blockchain:account:${pubkey}`;
    
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Account info cache hit', { pubkey });
        return cached;
      }

      const accountInfo = await this.connection.getAccountInfo(new PublicKey(pubkey));
      
      if (accountInfo) {
        // Cache account info for 60 seconds
        await this.cache.set(cacheKey, {
          ...accountInfo,
          data: accountInfo.data.toString('base64') // Serialize Buffer
        }, 60);
      }

      return accountInfo;

    } catch (error) {
      this.logger.error('Failed to get account info', { pubkey, error: error.message });
      throw error;
    }
  }

  async getTokenSupply(mintAddress: string): Promise<any> {
    const cacheKey = `blockchain:token:supply:${mintAddress}`;
    
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const supply = await this.connection.getTokenSupply(new PublicKey(mintAddress));
      
      // Cache token supply for 5 minutes
      await this.cache.set(cacheKey, supply, 300);
      
      return supply;

    } catch (error) {
      this.logger.error('Failed to get token supply', { mintAddress, error: error.message });
      throw error;
    }
  }

  async getBlockHeight(): Promise<number> {
    const cacheKey = 'blockchain:blockheight';
    
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5000) { // 5 seconds
        return cached.height;
      }

      const height = await this.connection.getBlockHeight();
      
      await this.cache.set(cacheKey, {
        height,
        timestamp: Date.now()
      }, 10); // Cache for 10 seconds

      return height;

    } catch (error) {
      this.logger.error('Failed to get block height', { error: error.message });
      throw error;
    }
  }

  async preloadTicketData(ticketMints: string[]): Promise<void> {
    this.logger.info('Preloading ticket data', { count: ticketMints.length });

    const promises = ticketMints.map(async (mint) => {
      try {
        await this.getAccountInfo(mint);
        await this.getTokenSupply(mint);
      } catch (error) {
        this.logger.warn('Failed to preload ticket data', { mint, error: error.message });
      }
    });

    await Promise.allSettled(promises);
    this.logger.info('Ticket data preloading completed');
  }

  async invalidateTransaction(signature: string): Promise<void> {
    const cacheKey = `blockchain:tx:${signature}`;
    await this.cache.delete(cacheKey);
  }

  async invalidateAccount(pubkey: string): Promise<void> {
    const cacheKey = `blockchain:account:${pubkey}`;
    await this.cache.delete(cacheKey);
  }

  async getCacheStats(): Promise<any> {
    const stats = await this.cache.stats();
    return {
      ...stats,
      rpcEndpoint: this.connection.rpcEndpoint,
      defaultTTL: this.DEFAULT_TTL
    };
  }
}
