import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('metrics')
  getMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('supplierId') supplierId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.service.getMetrics({ startDate, endDate, supplierId, clientId });
  }

  // Métricas personales del operador autenticado (Dashboard Operativo / Mi Panel).
  @Get('operator-metrics')
  getOperatorMetrics(@Req() req: Request & { user?: { username: string } }) {
    return this.service.getOperatorMetrics(req.user!.username);
  }
}
