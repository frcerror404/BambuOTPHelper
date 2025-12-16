import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [OtpModule],
  providers: [ImapService],
})
export class ImapModule {}
