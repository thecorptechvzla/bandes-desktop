import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUser } from '../auth/jwt-auth.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

const { hash } = bcryptjs;

@Injectable()
export class SuperadminService {
  constructor(private prisma: PrismaService) {}

  findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new BadRequestException(`El usuario "${dto.username}" ya existe`);
    }

    const passwordHash = await hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        role: dto.role,
        active: true,
      },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: string, currentUser: AuthUser) {
    if (currentUser.sub === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async updateUser(id: string, dto: UpdateUserDto, currentUser: AuthUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    const data: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined && dto.username !== existing.username) {
      const duplicate = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (duplicate) throw new BadRequestException(`El usuario "${dto.username}" ya existe`);
      data.username = dto.username;
    }

    if (dto.role !== undefined && dto.role !== existing.role) {
      // Protección: el superadmin no puede rebajarse su propio rol o quedaría sin acceso.
      if (currentUser.sub === id) {
        throw new BadRequestException('No puedes modificar tu propio rol');
      }
      data.role = dto.role as any;
    }

    if (dto.password !== undefined && dto.password.trim() !== '') {
      data.passwordHash = await hash(dto.password, 10);
    }

    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateClient(id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cliente no encontrado');

    const data: Prisma.ClientUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.toUpperCase();
    if (dto.contactInfo !== undefined) data.contactInfo = dto.contactInfo;
    if (dto.role !== undefined) data.role = dto.role as any;

    if (dto.rif !== undefined) {
      const normalizedRif = this.normalizeRif(dto.rif);
      if (normalizedRif !== existing.rif) {
        const duplicate = await this.prisma.client.findUnique({
          where: { rif: normalizedRif },
        });
        if (duplicate) throw new BadRequestException('El RIF ya existe');
      }
      data.rif = normalizedRif;
    }

    return this.prisma.client.update({
      where: { id },
      data,
      select: {
        id: true,
        rif: true,
        name: true,
        contactInfo: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private normalizeRif(raw: string): string {
    const digits = raw.replace(/^J/i, '').replace(/\D/g, '');
    return `J${digits}`;
  }

  // ─────────────────────────────────────────────────────────────
  // ZONA DE PELIGRO: HARD DELETES en cascada manual.
  // El schema no define onDelete: Cascade, por lo que cada borrado
  // se ejecuta en una transacción que elimina los hijos primero.
  // ─────────────────────────────────────────────────────────────

  async deleteClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    await this.prisma.$transaction(async (tx) => {
      const [processes, exits, packings] = await Promise.all([
        tx.process.findMany({ where: { clientId: id }, select: { id: true } }),
        tx.materialExit.findMany({ where: { clientId: id }, select: { id: true } }),
        tx.packing.findMany({ where: { clientId: id }, select: { id: true } }),
      ]);
      const processIds = processes.map((p) => p.id);
      const exitIds = exits.map((e) => e.id);
      const packingIds = packings.map((p) => p.id);

      const lots = await tx.lot.findMany({
        where: { processId: { in: processIds } },
        select: { id: true },
      });
      const lotIds = lots.map((l) => l.id);

      const details = await tx.exitDetail.findMany({
        where: {
          OR: [
            ...(exitIds.length ? [{ exitId: { in: exitIds } }] : []),
            ...(lotIds.length ? [{ lotId: { in: lotIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const detailIds = details.map((d) => d.id);

      const bars = await tx.bar.findMany({
        where: {
          OR: [
            { clientId: id },
            ...(detailIds.length ? [{ exitDetailId: { in: detailIds } }] : []),
            ...(lotIds.length ? [{ lotId: { in: lotIds } }] : []),
            ...(packingIds.length ? [{ packingId: { in: packingIds } }] : []),
            ...(exitIds.length ? [{ exitId: { in: exitIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const barIds = bars.map((b) => b.id);

      if (barIds.length || lotIds.length) {
        await tx.attachment.deleteMany({
          where: {
            OR: [
              ...(barIds.length ? [{ entityId: { in: barIds } }] : []),
              ...(lotIds.length ? [{ entityId: { in: lotIds } }] : []),
            ],
          },
        });
      }

      if (barIds.length) await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      if (detailIds.length) await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      if (packingIds.length) await tx.packing.deleteMany({ where: { id: { in: packingIds } } });
      if (lotIds.length) await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
      if (exitIds.length) await tx.materialExit.deleteMany({ where: { id: { in: exitIds } } });
      if (processIds.length) await tx.process.deleteMany({ where: { id: { in: processIds } } });
      await tx.client.delete({ where: { id } });
    });

    return { ok: true };
  }

  async deletePacking(id: string) {
    const packing = await this.prisma.packing.findUnique({ where: { id } });
    if (!packing) throw new NotFoundException('Packing no encontrado');

    await this.prisma.$transaction(async (tx) => {
      const bars = await tx.bar.findMany({
        where: { packingId: id },
        select: { id: true },
      });
      const barIds = bars.map((b) => b.id);

      if (barIds.length) {
        await tx.attachment.deleteMany({ where: { entityId: { in: barIds } } });
        await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      }
      await tx.packing.delete({ where: { id } });
    });

    return { ok: true };
  }

  async deleteProcess(id: string) {
    const process = await this.prisma.process.findUnique({ where: { id } });
    if (!process) throw new NotFoundException('Proceso no encontrado');

    await this.prisma.$transaction(async (tx) => {
      const lots = await tx.lot.findMany({
        where: { processId: id },
        select: { id: true },
      });
      const lotIds = lots.map((l) => l.id);

      const details = await tx.exitDetail.findMany({
        where: { lotId: { in: lotIds } },
        select: { id: true },
      });
      const detailIds = details.map((d) => d.id);

      const bars = await tx.bar.findMany({
        where: {
          OR: [
            ...(lotIds.length ? [{ lotId: { in: lotIds } }] : []),
            ...(detailIds.length ? [{ exitDetailId: { in: detailIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const barIds = bars.map((b) => b.id);

      if (barIds.length || lotIds.length) {
        await tx.attachment.deleteMany({
          where: {
            OR: [
              ...(barIds.length ? [{ entityId: { in: barIds } }] : []),
              ...(lotIds.length ? [{ entityId: { in: lotIds } }] : []),
            ],
          },
        });
      }

      if (barIds.length) await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      if (detailIds.length) await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      if (lotIds.length) await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
      await tx.process.delete({ where: { id } });
    });

    return { ok: true };
  }

  async deleteMaterialExit(id: string) {
    const exit = await this.prisma.materialExit.findUnique({ where: { id } });
    if (!exit) throw new NotFoundException('Egreso no encontrado');

    await this.prisma.$transaction(async (tx) => {
      const details = await tx.exitDetail.findMany({
        where: { exitId: id },
        select: { id: true },
      });
      const detailIds = details.map((d) => d.id);

      const bars = await tx.bar.findMany({
        where: {
          OR: [
            { exitId: id },
            ...(detailIds.length ? [{ exitDetailId: { in: detailIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const barIds = bars.map((b) => b.id);

      if (barIds.length) {
        await tx.attachment.deleteMany({ where: { entityId: { in: barIds } } });
        await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      }
      if (detailIds.length) await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      await tx.materialExit.delete({ where: { id } });
    });

    return { ok: true };
  }
}