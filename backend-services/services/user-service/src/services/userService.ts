import { RedisService } from './redisService';
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  private redisService = new RedisService();

  async createUser(userData: any) {
    try {
      // Simulate custodial wallet creation
      const custodialWallet = {
        publicKey: 'simulated_pubkey_' + Date.now(),
      };

      const user = {
        id: userData.userId || uuidv4(),
        email: userData.email,
        name: userData.name,
        custodialWallet: custodialWallet,
        phantomWallet: userData.phantomWallet || null,
        createdAt: new Date(),
      };

      // Store in Redis
      await this.redisService.set(`user:${user.id}`, JSON.stringify(user));

      return {
        success: true,
        user: {
          ...user,
          custodialWallet: {
            publicKey: user.custodialWallet.publicKey,
          }
        }
      };
    } catch (error) {
      console.error('User creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserWallets(userId: string) {
    try {
      const userData = await this.redisService.get(`user:${userId}`);
      
      if (!userData) {
        return { success: false, error: 'User not found' };
      }

      const user = JSON.parse(userData);
      
      return {
        success: true,
        wallets: {
          custodial: {
            publicKey: user.custodialWallet.publicKey,
            balance: 1.5, // Simulated balance
          },
          phantom: user.phantomWallet ? {
            publicKey: user.phantomWallet,
            balance: 0.8, // Simulated balance
          } : null,
        }
      };
    } catch (error) {
      console.error('Get user wallets failed:', error);
      return { success: false, error: error.message };
    }
  }

  async connectPhantomWallet(userId: string, phantomPublicKey: string) {
    try {
      const userData = await this.redisService.get(`user:${userId}`);
      if (!userData) {
        return { success: false, error: 'User not found' };
      }

      const user = JSON.parse(userData);
      user.phantomWallet = phantomPublicKey;
      user.updatedAt = new Date();

      await this.redisService.set(`user:${userId}`, JSON.stringify(user));

      return {
        success: true,
        phantomWallet: phantomPublicKey,
      };
    } catch (error) {
      console.error('Phantom wallet connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}
