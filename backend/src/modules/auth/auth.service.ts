import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JWT_EXPIRES_IN, jwtSecret } from './constants.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      jwtSecret(),
      { expiresIn: JWT_EXPIRES_IN },
    );

    return {
      token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return { id: user.id, username: user.username, role: user.role };
  }
}