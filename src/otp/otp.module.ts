import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { OtpController } from './otp.controller';
import { PlainWsService } from './plain-ws.service';
import { MqttService } from './mqtt.service';

const otpControllersEnabled =
  (process.env.OTP_CONTROLLERS_ENABLED || 'true').toLowerCase() === 'true';

const otpProviders = otpControllersEnabled
  ? [OtpService, OtpGateway, PlainWsService, MqttService]
  : [OtpService, MqttService];

@Module({
  imports: [AuthModule],
  providers: otpProviders,
  controllers: otpControllersEnabled ? [OtpController] : [],
  exports: [OtpService],
})
export class OtpModule {}
