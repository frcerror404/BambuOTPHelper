import { Controller, Get } from '@nestjs/common';
import { OtpService } from './otp.service';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Get()
  getLatestOtp() {
    return this.otpService.getLastOtp() || {};
  }
}
