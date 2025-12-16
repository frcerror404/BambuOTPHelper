import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { OtpController } from './otp.controller';
import { PlainWsService } from './plain-ws.service';

@Module({
  providers: [OtpService, OtpGateway, PlainWsService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
