import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      throw new UnauthorizedException('Invalid request context');
    }

    const token = this.getTokenFromRequest(request);
    this.authService.verifyToken(token);
    return true;
  }

  private getTokenFromRequest(request: Request) {
    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const [, token] = authHeader.split(' ');
      if (token) {
        return token;
      }
    }

    return this.authService.extractTokenFromCookie(request.headers.cookie);
  }
}
