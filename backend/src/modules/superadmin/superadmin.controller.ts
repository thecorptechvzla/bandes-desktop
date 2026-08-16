import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../common/constants/roles.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthUser } from '../auth/jwt-auth.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { CreateRoleDto, RoleIdParamDto, UpdateRoleDto } from './dto/role.dto.js';
import { SuperadminService } from './superadmin.service.js';

@Controller('superadmin')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class SuperadminController {
  constructor(private service: SuperadminService) {}

  // ── Roles dinámicos ──

  @Get('roles')
  findAllRoles() {
    return this.service.findAllRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.service.createRole(dto);
  }

  @Patch('roles/:id')
  updateRole(@Param() params: RoleIdParamDto, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(params.id, dto);
  }

  @Delete('roles/:id')
  removeRole(@Param() params: RoleIdParamDto) {
    return this.service.deleteRole(params.id);
  }

  // ── Usuarios ──

  @Get('users')
  findAllUsers() {
    return this.service.findAllUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.service.createUser(dto);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string, @Req() req: Request & { user: AuthUser }) {
    return this.service.deleteUser(id, req.user);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.service.updateUser(id, dto, req.user);
  }

  // ── Zona de Peligro: Hard Deletes en cascada ──

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.service.updateClient(id, dto);
  }

  @Delete('clients/:id')
  removeClient(@Param('id') id: string) {
    return this.service.deleteClient(id);
  }

  @Delete('packings/:id')
  removePacking(@Param('id') id: string) {
    return this.service.deletePacking(id);
  }

  @Delete('processes/:id')
  removeProcess(@Param('id') id: string) {
    return this.service.deleteProcess(id);
  }

  @Delete('material-exits/:id')
  removeMaterialExit(@Param('id') id: string) {
    return this.service.deleteMaterialExit(id);
  }
}