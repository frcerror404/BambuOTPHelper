import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5;

@Injectable()
export class AuthService {
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly jwtService: JwtService) {
    this.username = process.env.AUTH_USERNAME || 'admin';
    this.password = process.env.AUTH_PASSWORD || 'bambu-secure';
  }

  validateCredentials(username: string, password: string): boolean {
    return username === this.username && password === this.password;
  }

  issueToken(username: string) {
    const token = this.jwtService.sign({ sub: username });
    const expiresAt = new Date(Date.now() + FIVE_YEARS_MS).toISOString();
    return { token, expiresAt };
  }

  verifyToken(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
