import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { OtpController } from './otp.controller';
import { PlainWsService } from './plain-ws.service';
import { MqttService } from './mqtt.service';
import { AuthModule } from '../auth/auth.module';
import { JwtHttpMiddleware } from '../auth/jwt-http.middleware';

@Module({
  imports: [AuthModule],
  providers: [OtpService, OtpGateway, PlainWsService, MqttService, JwtHttpMiddleware],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtHttpMiddleware).forRoutes(OtpController);
  }
}
