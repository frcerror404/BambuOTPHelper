import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server as WsServer, WebSocket } from 'ws';
import { OtpPayload } from './otp.types';

@Injectable()
export class PlainWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlainWsService.name);
  private server?: WsServer;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const httpServer = this.adapterHost.httpAdapter?.getHttpServer();

    if (!httpServer) {
      this.logger.warn('HTTP server not available; plain WebSocket gateway disabled');
      return;
    }

    this.server = new WsServer({
      server: httpServer,
      path: '/ws',
    });

    this.server.on('connection', (socket: WebSocket) => {
      this.logger.log('Plain WebSocket client connected');

      socket.on('close', () => {
        this.logger.log('Plain WebSocket client disconnected');
      });
    });

    this.logger.log('Plain WebSocket gateway initialized at path /ws');
  }

  broadcastOtp(payload: OtpPayload) {
    if (!this.server) {
      return;
    }

    const message = JSON.stringify(payload);
    this.server.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  onModuleDestroy() {
    this.server?.close();
  }
}
