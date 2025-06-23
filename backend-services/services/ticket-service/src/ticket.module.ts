import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TicketController } from './controllers/ticket.controller';
import { MintingService } from './services/mintingService';
import { QRService } from './services/qrService';
import { DeliveryService } from './services/deliveryService';
import { WalletService } from './services/walletService';
import { BatchService } from './services/batchService';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'minting' },           // Changed from 'ticket-minting'
      { name: 'delivery' },          // Changed from 'ticket-delivery'
      { name: 'batch-operations' }   // Changed from 'batch-processing'
    ),
  ],
  controllers: [TicketController],
  providers: [
    MintingService,
    QRService,
    DeliveryService,
    WalletService,
    BatchService,
  ],
  exports: [
    MintingService,
    QRService,
    DeliveryService,
  ],
})
export class TicketModule {}
