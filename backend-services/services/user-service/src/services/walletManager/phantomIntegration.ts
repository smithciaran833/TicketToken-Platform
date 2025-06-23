import { Injectable, Logger } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';

@Injectable()
export class PhantomIntegrationService {
  private logger = new Logger(PhantomIntegrationService.name);

  generateConnectUrl(data: {
    userId: string;
    redirectUrl: string;
    cluster?: 'mainnet-beta' | 'testnet' | 'devnet';
  }): string {
    // Generate a unique session ID for this connection attempt
    const sessionId = this.generateSessionId(data.userId);
    
    // Phantom deep link parameters
    const params = new URLSearchParams({
      cluster: data.cluster || 'devnet',
      app_url: process.env.FRONTEND_URL || 'https://tickettoken.io',
      redirect_url: data.redirectUrl,
      session: sessionId,
    });

    const phantomUrl = `https://phantom.app/ul/connect?${params.toString()}`;
    
    this.logger.log(`Generated Phantom connect URL for user ${data.userId}`);
    
    return phantomUrl;
  }

  validatePhantomWallet(walletAddress: string): {
    isValid: boolean;
    error?: string;
  } {
    try {
      // Validate it's a valid Solana address
      const pubkey = new PublicKey(walletAddress);
      
      // Could add additional checks here (e.g., check if it's a Phantom wallet)
      
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Invalid Solana wallet address' 
      };
    }
  }

  async verifyWalletOwnership(
    walletAddress: string,
    signedMessage: string,
    expectedMessage: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would verify the signature
      // For now, we'll implement a basic check
      
      // TODO: Implement actual signature verification
      // const publicKey = new PublicKey(walletAddress);
      // const verified = nacl.sign.detached.verify(
      //   Buffer.from(expectedMessage),
      //   Buffer.from(signedMessage, 'base64'),
      //   publicKey.toBytes()
      // );
      
      this.logger.log(`Verifying ownership of wallet ${walletAddress}`);
      
      // Placeholder - always return true in dev
      return true;
    } catch (error) {
      this.logger.error(`Failed to verify wallet ownership: ${error.message}`);
      return false;
    }
  }

  generateSignInMessage(data: {
    walletAddress: string;
    timestamp: number;
    nonce: string;
  }): string {
    return `Sign this message to prove you own this wallet.

Wallet: ${data.walletAddress}
Timestamp: ${data.timestamp}
Nonce: ${data.nonce}
Service: TicketToken

This request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  private generateSessionId(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const data = `${userId}-${timestamp}-${random}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  generatePhantomUniversalLink(action: 'connect' | 'signMessage' | 'signTransaction', params: any): string {
    const baseUrl = 'https://phantom.app/ul/v1';
    
    switch (action) {
      case 'connect':
        return `${baseUrl}/connect?${new URLSearchParams(params).toString()}`;
      
      case 'signMessage':
        return `${baseUrl}/signMessage?${new URLSearchParams(params).toString()}`;
      
      case 'signTransaction':
        return `${baseUrl}/signTransaction?${new URLSearchParams(params).toString()}`;
      
      default:
        throw new Error(`Unknown Phantom action: ${action}`);
    }
  }

  async checkPhantomInstalled(userAgent: string): Promise<{
    isInstalled: boolean;
    platform?: 'ios' | 'android' | 'desktop' | 'unknown';
  }> {
    // Basic user agent detection
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const isDesktop = !isIOS && !isAndroid;
    
    // In a real app, you'd check for the Phantom provider
    // window.solana && window.solana.isPhantom
    
    return {
      isInstalled: false, // Can't detect from backend
      platform: isIOS ? 'ios' : isAndroid ? 'android' : isDesktop ? 'desktop' : 'unknown',
    };
  }
}
