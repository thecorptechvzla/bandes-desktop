import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service.js';
import { resolveAllowedModules } from '../../common/constants/roles.js';
import { JWT_EXPIRES_IN, jwtSecret } from './constants.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { roleRef: { select: { id: true, name: true, allowedModules: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const allowedModules = resolveAllowedModules(user.role, user.roleRef?.allowedModules);
    const roleId = user.roleId ?? user.roleRef?.id ?? null;

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        roleId,
        allowedModules,
      },
      jwtSecret(),
      { expiresIn: JWT_EXPIRES_IN },
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        roleId,
        allowedModules,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roleRef: { select: { id: true, name: true, allowedModules: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      roleId: user.roleId ?? user.roleRef?.id ?? null,
      allowedModules: resolveAllowedModules(user.role, user.roleRef?.allowedModules),
    };
  }
}