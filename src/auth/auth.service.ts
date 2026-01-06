import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify, JwtPayload } from 'jsonwebtoken';

export const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 60 * 60;

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  private readonly username = process.env.UI_USERNAME || 'admin';
  private readonly password = process.env.UI_PASSWORD || 'password';
  private readonly secret = process.env.AUTH_SECRET || 'change-me-secret';
  private readonly cookieName = 'auth_token';

  get tokenCookieName() {
    return this.cookieName;
  }

  validateCredentials(username: string, password: string) {
    return username === this.username && password === this.password;
  }

  issueToken(username: string) {
    return sign({ sub: username }, this.secret, {
      expiresIn: `${FIVE_YEARS_SECONDS}s`,
    });
  }

  verifyToken(token?: string): AuthTokenPayload {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      return verify(token, this.secret) as AuthTokenPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: FIVE_YEARS_SECONDS * 1000,
    };
  }

  extractTokenFromCookie(cookieHeader?: string) {
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(';').map((c) => c.trim());

    for (const cookie of cookies) {
      const [name, ...rest] = cookie.split('=');
      if (name === this.cookieName) {
        return rest.join('=');
      }
    }

    return undefined;
  }
}
