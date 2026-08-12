import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { jwtSecret } from './constants.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export interface AuthUser {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('No se recibió token de acceso');
    }

    try {
      request.user = verify(token, jwtSecret()) as unknown as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    // Fallback para <img src>: token por query (?token=...)
    const query = (request.query as Record<string, string | undefined>).token;
    if (query) return query;
    return null;
  }
}