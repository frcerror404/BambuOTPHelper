import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { IncomingMessage } from 'http';
import { Server as WsServer, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service';
import { OtpPayload } from './otp.types';

@Injectable()
export class PlainWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlainWsService.name);
  private server?: WsServer;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly authService: AuthService,
  ) {}

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

    this.server.on('connection', (socket: WebSocket, request: IncomingMessage) => {
      const token = this.extractTokenFromRequest(request);

      try {
        this.authService.verifyToken(token);
      } catch (error) {
        this.logger.warn('Unauthorized WebSocket connection attempt');
        socket.close(1008, 'unauthorized');
        return;
      }

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

  private extractTokenFromRequest(request: IncomingMessage) {
    if (!request.url) return undefined;

    const url = new URL(request.url, 'http://localhost');
    return url.searchParams.get('token') || undefined;
  }
}
