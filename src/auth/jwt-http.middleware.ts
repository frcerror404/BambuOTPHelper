import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class JwtHttpMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const header = req.headers['authorization'];
    const token = header?.startsWith('Bearer ')
      ? header.replace('Bearer ', '')
      : undefined;

    try {
      const payload = this.authService.verifyToken(token);
      (req as Request & { user?: unknown }).user = payload;
      next();
    } catch (error) {
      const status = error instanceof UnauthorizedException ? 401 : 500;
      res.status(status).json({ message: 'Unauthorized' });
    }
  }
}
