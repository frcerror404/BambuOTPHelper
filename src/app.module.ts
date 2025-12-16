import { Module } from '@nestjs/common';
import { OtpModule } from './otp/otp.module';
import { ImapModule } from './imap/imap.module';

@Module({
  imports: [OtpModule, ImapModule],
})
export class AppModule {}
