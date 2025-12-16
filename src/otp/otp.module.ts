import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { OtpController } from './otp.controller';

@Module({
  providers: [OtpService, OtpGateway],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
