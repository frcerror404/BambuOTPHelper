import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OtpPayload } from './otp.types';
import { AuthService } from '../auth/auth.service';
import { SocketJwtMiddleware } from '../auth/socket-jwt.middleware';

@WebSocketGateway({ cors: true })
export class OtpGateway {
  @WebSocketServer()
  private server?: Server;

  constructor(private readonly authService: AuthService) {}

  afterInit(server: Server) {
    const middleware = new SocketJwtMiddleware(this.authService);
    server.use(middleware.use.bind(middleware));
  }

  broadcastOtp(payload: OtpPayload) {
    if (!this.server) {
      return;
    }

    this.server.emit('otp', payload);
  }
}
