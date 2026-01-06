import { AuthService } from './auth.service';
import { Socket } from 'socket.io';

export class SocketJwtMiddleware {
  constructor(private readonly authService: AuthService) {}

  use = (socket: Socket, next: (err?: Error) => void) => {
    const token = this.extractToken(socket);

    try {
      const payload = this.authService.verifyToken(token);
      (socket as Socket & { user?: unknown }).user = payload;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  };

  private extractToken(socket: Socket): string | undefined {
    const authHeader = socket.handshake.headers['authorization'];
    const headerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.replace('Bearer ', '')
        : undefined;

    if (headerToken) {
      return headerToken;
    }

    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return undefined;
  }
}
