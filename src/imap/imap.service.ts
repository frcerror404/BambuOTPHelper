import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ImapFlow, ExistsEvent } from 'imapflow';
import { simpleParser } from 'mailparser';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class ImapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapService.name);
  private client?: ImapFlow;

  constructor(private readonly otpService: OtpService) {}

  async onModuleInit() {
    const user = process.env.GMAIL_USER;
    const password = process.env.GMAIL_APP_PASSWORD;

    if (!user || !password) {
      this.logger.error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
      return;
    }

    this.client = new ImapFlow({
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
      secure: true,
      auth: { user, pass: password },
      logger: false,
    });

    this.client.on('error', (err) => {
      this.logger.error('IMAP connection error', err as Error);
    });

    await this.startListening();
  }

  async onModuleDestroy() {
    await this.client?.logout().catch((error) => {
      this.logger.error('Error closing IMAP connection', error as Error);
    });
  }

  private async startListening() {
    if (!this.client) {
      return;
    }

    await this.client.connect();
    await this.client.mailboxOpen('INBOX');
    this.logger.log('Connected to Gmail IMAP and monitoring INBOX');

    this.client.on('exists', async (event: ExistsEvent) => {
      await this.handleNewMail(event.count).catch((error) => {
        this.logger.error('Error handling new mail', error as Error);
      });
    });
  }

  private async handleNewMail(sequence: number) {
    if (!this.client) {
      return;
    }

    const message = await this.client.fetchOne(sequence, {
      envelope: true,
      source: true,
    });

    if (!message) {
      return;
    }

    if (!message.source) {
      return;
    }

    const parsed = await simpleParser(message.source);
    const isBambuEmail = this.isFromBambu(parsed.subject, parsed.from?.text);

    if (!isBambuEmail) {
      this.logger.log(
        `Ignoring non-Bambu email: subject="${parsed.subject || ''}" from="${
          parsed.from?.text || ''
        }"`,
      );
      return;
    }

    const textBody = parsed.text || '';
    const codeMatch = textBody.match(/\b(\d{6})\b/);

    if (!codeMatch) {
      this.logger.warn('Bambu email received but no OTP code found');
      return;
    }

    const receivedAt = parsed.date ?? new Date();
    this.otpService.setOtp(codeMatch[1], receivedAt);
  }

  private isFromBambu(subject?: string | null, fromText?: string): boolean {
    const combined = `${subject || ''} ${fromText || ''}`.toLowerCase();
    return combined.includes('bambu');
  }
}
