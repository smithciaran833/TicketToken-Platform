import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CustodialWalletService } from './services/walletManager/custodialWallet';
import { PhantomIntegrationService } from './services/walletManager/phantomIntegration';
import { WalletMigrationService } from './services/walletManager/walletMigration';
import { KeyEncryptionService } from './services/walletManager/keyEncryption';
import { WalletAnalyticsService } from './services/walletManager/walletAnalytics';
import { WalletController } from './controllers/wallet.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'wallet-migration' },
      { name: 'analytics' }
    ),
  ],
  controllers: [WalletController],
  providers: [
    CustodialWalletService,
    PhantomIntegrationService,
    WalletMigrationService,
    KeyEncryptionService,
    WalletAnalyticsService,
  ],
  exports: [
    CustodialWalletService,
    PhantomIntegrationService,
    WalletMigrationService,
  ],
})
export class UserModule {}
