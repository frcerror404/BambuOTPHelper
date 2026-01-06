import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { OtpService } from './otp.service';

@Controller('otp')
@UseGuards(AuthGuard)
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Get()
  getLatestOtp() {
    return this.otpService.getLastOtp() || {};
  }
}
