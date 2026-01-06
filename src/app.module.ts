import { Module } from '@nestjs/common';
import { OtpModule } from './otp/otp.module';
import { ImapModule } from './imap/imap.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, OtpModule, ImapModule],
})
export class AppModule {}
