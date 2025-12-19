import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { OtpController } from './otp.controller';
import { PlainWsService } from './plain-ws.service';
import { MqttService } from './mqtt.service';

const otpControllersEnabled =
  (process.env.OTP_CONTROLLERS_ENABLED || '').toLowerCase() === 'true';

const otpProviders = otpControllersEnabled
  ? [OtpService, OtpGateway, PlainWsService, MqttService]
  : [OtpService, MqttService];

@Module({
  providers: otpProviders,
  controllers: otpControllersEnabled ? [OtpController] : [],
  exports: [OtpService],
})
export class OtpModule {}
