import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUser } from '../auth/jwt-auth.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import {
  CreateRoleDto,
  UpdateRoleDto,
  validateModules,
} from './dto/role.dto.js';
import { isValidModuleId } from '../../common/constants/modules.js';

const { hash } = bcryptjs;

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  roleId: true,
  customModules: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  roleRef: {
    select: { id: true, name: true, allowedModules: true, isSystem: true },
  },
} satisfies Prisma.UserSelect;

const ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  allowedModules: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  users: { select: { username: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

// Valida el override de permisos de un usuario. [] o ausente => heredar del rol.
// Nunca se permite inyectar el módulo de Sistema en un override: los endpoints
// superadmin siguen protegidos por RolesGuard (JWT role === SUPERADMIN).
function validateUserCustomModules(modules: string[] | undefined): string[] {
  const list = modules ?? [];
  for (const m of list) {
    if (!isValidModuleId(m)) {
      throw new BadRequestException(`Módulo personalizado inválido: ${m}`);
    }
    if (m === 'superadmin') {
      throw new BadRequestException(
        'No puedes otorgar el módulo de Sistema (superadmin)',
      );
    }
  }
  return list;
}

@Injectable()
export class SuperadminService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // ROLES (CRUD)
  // ─────────────────────────────────────────────

  async findAllRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: ROLE_SELECT,
    });

    // Merge resiliente de "usuarios huérfanos": cuentas creadas antes de la
    // Fase 4 tienen roleId = null (campo legacy `role` con el nombre). Aunque
    // no estén vinculadas por FK, se muestran bajo su rol para que la columna
    // de Usuarios siempre liste a todos.
    const orphans = await this.prisma.user.findMany({
      where: { roleId: null },
      select: { role: true, username: true },
    });
    const byRole = new Map<string, string[]>();
    for (const u of orphans) {
      const list = byRole.get(u.role) ?? [];
      list.push(u.username);
      byRole.set(u.role, list);
    }

    for (const role of roles) {
      const extra = byRole.get(role.name);
      if (extra?.length) {
        const seen = new Set(role.users.map((u) => u.username));
        for (const username of extra) {
          if (!seen.has(username)) {
            role.users.push({ username });
            seen.add(username);
          }
        }
        role._count.users = role.users.length;
      }
    }

    return roles;
  }

  async findRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: ROLE_SELECT,
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async createRole(dto: CreateRoleDto) {
    const name = dto.name.trim().toUpperCase();
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (existing) throw new BadRequestException(`El rol "${name}" ya existe`);

    if (!validateModules(dto.allowedModules)) {
      throw new BadRequestException(
        'Alguno de los módulos seleccionados es inválido',
      );
    }

    return this.prisma.role.create({
      data: {
        name,
        description: dto.description ?? null,
        allowedModules: dto.allowedModules,
      },
      select: ROLE_SELECT,
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    const data: Prisma.RoleUpdateInput = {};

    if (dto.name !== undefined && dto.name.trim().toUpperCase() !== role.name) {
      if (role.isSystem) {
        throw new BadRequestException('No puedes renombrar un rol del sistema');
      }
      const name = dto.name.trim().toUpperCase();
      const dup = await this.prisma.role.findUnique({ where: { name } });
      if (dup) throw new BadRequestException(`El rol "${name}" ya existe`);
      data.name = name;
    }

    if (dto.description !== undefined) data.description = dto.description;

    if (dto.allowedModules !== undefined) {
      if (role.isSystem) {
        throw new BadRequestException(
          'No puedes modificar los módulos de un rol del sistema',
        );
      }
      if (!validateModules(dto.allowedModules)) {
        throw new BadRequestException(
          'Alguno de los módulos seleccionados es inválido',
        );
      }
      data.allowedModules = dto.allowedModules;
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
      select: ROLE_SELECT,
    });

    // Sincroniza el campo legacy "role" de los usuarios que usan este rol.
    if (data.name) {
      await this.prisma.user.updateMany({
        where: { roleId: id },
        data: { role: updated.name },
      });
    }

    return updated;
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.isSystem) {
      throw new BadRequestException('No puedes eliminar un rol del sistema');
    }
    if (role._count.users > 0) {
      throw new BadRequestException(
        'No puedes eliminar un rol que tiene usuarios asignados',
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // USUARIOS
  // ─────────────────────────────────────────────

  findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException(`El usuario "${dto.username}" ya existe`);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new BadRequestException('El rol seleccionado no existe');

    const passwordHash = await hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        role: role.name,
        roleId: role.id,
        customModules: validateUserCustomModules(dto.customModules),
        active: true,
      },
      select: USER_SELECT,
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
      if (duplicate)
        throw new BadRequestException(`El usuario "${dto.username}" ya existe`);
      data.username = dto.username;
    }

    if (dto.roleId !== undefined && dto.roleId !== existing.roleId) {
      // Protección: el superadmin no puede cambiarse su propio rol o quedaría sin acceso.
      if (currentUser.sub === id) {
        throw new BadRequestException('No puedes modificar tu propio rol');
      }
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) throw new BadRequestException('El rol seleccionado no existe');
      data.roleRef = { connect: { id: role.id } };
      data.role = role.name;
    }

    if (dto.password !== undefined && dto.password.trim() !== '') {
      data.passwordHash = await hash(dto.password, 10);
    }

    if (dto.active !== undefined) data.active = dto.active;

    if (dto.customModules !== undefined) {
      data.customModules = validateUserCustomModules(dto.customModules);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async updateClient(id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cliente no encontrado');

    const data: Prisma.ClientUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.toUpperCase();
    if (dto.contactInfo !== undefined) data.contactInfo = dto.contactInfo;
    if (dto.role !== undefined) data.role = dto.role;

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
        tx.materialExit.findMany({
          where: { clientId: id },
          select: { id: true },
        }),
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

      if (barIds.length)
        await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      if (detailIds.length)
        await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      if (packingIds.length)
        await tx.packing.deleteMany({ where: { id: { in: packingIds } } });
      if (lotIds.length)
        await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
      if (exitIds.length)
        await tx.materialExit.deleteMany({ where: { id: { in: exitIds } } });
      if (processIds.length)
        await tx.process.deleteMany({ where: { id: { in: processIds } } });
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

      if (barIds.length)
        await tx.bar.deleteMany({ where: { id: { in: barIds } } });
      if (detailIds.length)
        await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      if (lotIds.length)
        await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
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
      if (detailIds.length)
        await tx.exitDetail.deleteMany({ where: { id: { in: detailIds } } });
      await tx.materialExit.delete({ where: { id } });
    });

    return { ok: true };
  }
}
