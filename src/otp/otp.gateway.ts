import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OtpPayload } from './otp.types';

@WebSocketGateway({ cors: true })
export class OtpGateway {
  @WebSocketServer()
  private server?: Server;

  broadcastOtp(payload: OtpPayload) {
    if (!this.server) {
      return;
    }

    this.server.emit('otp', payload);
  }
}
