import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWalletDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['CUSTODIAL', 'PHANTOM'] })
  @IsEnum(['CUSTODIAL', 'PHANTOM'])
  walletType: 'CUSTODIAL' | 'PHANTOM';
}

export class ConnectPhantomDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phantomPublicKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phantomWallet?: string;

  @ApiProperty()
  @IsString()
  signature: string;
}

export class MigrateWalletDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  targetWallet: string;
}

export class WalletBalanceDto {
  @ApiProperty()
  balance: number;

  @ApiProperty()
  walletAddress: string;

  @ApiPropertyOptional()
  formatted?: string;
}
