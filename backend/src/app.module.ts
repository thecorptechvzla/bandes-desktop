import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { BarsModule } from './modules/bars/bars.module.js';
import { MaterialExitsModule } from './modules/material-exits/material-exits.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { LotsModule } from './modules/lots/lots.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { PackingsModule } from './modules/packings/packings.module.js';
import { ScaleModule } from './modules/scale/scale.module.js';
import { BlobModule } from './modules/blob/blob.module.js';
import { SuperadminModule } from './modules/superadmin/superadmin.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BlobModule,
    ClientsModule,
    BarsModule,
    MaterialExitsModule,
    ReportsModule,
    ProcessesModule,
    LotsModule,
    DashboardModule,
    PackingsModule,
    ScaleModule,
    SuperadminModule,
  ],
})
export class AppModule {}
