import { Injectable, Logger } from '@nestjs/common';
import { OtpGateway } from './otp.gateway';
import { OtpPayload } from './otp.types';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private lastOtp?: OtpPayload;
  private expirationMinutes: number;

  constructor(private readonly gateway: OtpGateway) {
    const minutes = Number(process.env.OTP_EXPIRATION_MINUTES || 5);
    this.expirationMinutes = Number.isFinite(minutes) ? minutes : 5;
  }

  setOtp(code: string, receivedAt: Date) {
    const expiresAt = new Date(
      receivedAt.getTime() + this.expirationMinutes * 60_000,
    );

    this.lastOtp = {
      code,
      receivedAt: receivedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.logger.log(`Updated OTP to ${code} (expires at ${this.lastOtp.expiresAt})`);
    this.gateway.broadcastOtp(this.lastOtp);
  }

  getLastOtp(): OtpPayload | undefined {
    return this.lastOtp;
  }
}
