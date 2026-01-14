import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class ImapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapService.name);
  private client?: ImapFlow;
  private reconnectTimer?: NodeJS.Timeout;
  private idleLoopActive = false;
  private lastKnownCount = 0;
  private readonly reconnectIntervalMs = process.env.IMAP_RECONNECT_INTERVAL_MS
    ? Number(process.env.IMAP_RECONNECT_INTERVAL_MS)
    : 60 * 60 * 1000;

  constructor(private readonly otpService: OtpService) {}

  async onModuleInit() {
    if (!this.imapUser || !this.imapPassword) {
      this.logger.error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
      return;
    }
    this.client = this.createClient();
    await this.startListening(this.client);
  }

  async onModuleDestroy() {
    this.stopIdleLoop();

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    await this.client?.logout().catch((error) => {
      this.logger.error('Error closing IMAP connection', error as Error);
    });
  }

  private async startListening(client: ImapFlow) {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    this.lastKnownCount = mailbox.exists;
    this.logger.log('Connected to Gmail IMAP and monitoring INBOX');

    this.startIdleLoop();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(() => {
      void this.restartConnection().catch((error) => {
        this.logger.error('Error restarting IMAP connection', error as Error);
      });
    }, this.reconnectIntervalMs);
  }

  private async restartConnection() {
    if (!this.client) {
      return;
    }

    this.logger.log('Restarting IMAP connection');
    this.stopIdleLoop();

    await this.client.logout().catch((error) => {
      this.logger.error('Error closing IMAP connection', error as Error);
    });

    const newClient = this.createClient();
    this.client = newClient;
    await this.startListening(newClient);
  }

  private createClient() {
    if (!this.imapUser || !this.imapPassword) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
    }

    const client = new ImapFlow({
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
      secure: true,
      auth: { user: this.imapUser, pass: this.imapPassword },
      logger: false,
      disableAutoIdle: true,
    });

    client.on('error', (err) => {
      this.logger.error('IMAP connection error', err as Error);
    });

    this.client.on('exists', (data) => {
      void this.handleExists(data.count).catch((error) => {
        this.logger.error('Error handling new mail notification', error as Error);
      });
    });

    await this.startListening();
  }

  async onModuleDestroy() {
    this.stopIdleLoop();

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    await this.client?.logout().catch((error) => {
      this.logger.error('Error closing IMAP connection', error as Error);
    });

    return client;
  }

  private startIdleLoop() {
    if (this.idleLoopActive || !this.client) {
      return;
    }

    this.idleLoopActive = true;
    void this.runIdleLoop();
  }

    this.startIdleLoop();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(() => {
      void this.restartConnection().catch((error) => {
        this.logger.error('Error restarting IMAP connection', error as Error);
      });
    }, this.reconnectIntervalMs);
  }

  private async restartConnection() {
    if (!this.client) {
      return;
    }

    this.logger.log('Restarting IMAP connection');
    this.stopIdleLoop();

    await this.client.logout().catch((error) => {
      this.logger.error('Error closing IMAP connection', error as Error);
    });

    await this.client.connect();
    const mailbox = await this.client.mailboxOpen('INBOX');
    this.lastKnownCount = mailbox.exists;

    this.startIdleLoop();
  }

  private startIdleLoop() {
    if (this.idleLoopActive || !this.client) {
      return;
    }

    this.idleLoopActive = true;
    void this.runIdleLoop();
  }

  private stopIdleLoop() {
    this.idleLoopActive = false;
  }

  private async runIdleLoop() {
    if (!this.client) {
      return;
    }

    while (this.client && this.idleLoopActive) {
      try {
        await this.client.idle();
      } catch (error) {
        if (!this.idleLoopActive) {
          return;
        }
        this.logger.error('IMAP idle error', error as Error);
        await this.delay(1000);
      }
    }
  }

  private async handleExists(totalMessages: number) {
    if (!this.client) {
      return;
    }

    if (totalMessages <= this.lastKnownCount) {
      return;
    }

    for (let sequence = this.lastKnownCount + 1; sequence <= totalMessages; sequence += 1) {
      await this.handleNewMail(sequence);
    }

    this.lastKnownCount = totalMessages;
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

  private async delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
