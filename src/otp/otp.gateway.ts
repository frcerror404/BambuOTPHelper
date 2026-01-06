import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { OtpPayload } from './otp.types';

@WebSocketGateway({ cors: true })
export class OtpGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  constructor(private readonly authService: AuthService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ||
      (client.handshake.query.token as string | undefined);

    try {
      this.authService.verifyToken(token);
    } catch (error) {
      client.emit('unauthorized');
      client.disconnect(true);
      return;
    }
  }

  broadcastOtp(payload: OtpPayload) {
    if (!this.server) {
      return;
    }

    this.server.emit('otp', payload);
  }
}
