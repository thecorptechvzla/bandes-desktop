import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BlobService {
  constructor(private prisma: PrismaService) {}

  async create(file: Express.Multer.File, entityType?: string, entityId?: string) {
    const attachment = await this.prisma.attachment.create({
      data: {
        entityType: entityType || 'BAR',
        entityId: entityId || 'UNKNOWN',
        filename: file.originalname || `photo-${Date.now()}.jpg`,
        mimeType: file.mimetype || 'image/jpeg',
        data: Uint8Array.from(file.buffer),
      },
    });
    // contracto frontend: la app guarda este valor en Bar/Lot.photoUrl
    return { url: attachment.id };
  }

  async find(idOrUrl: string | undefined) {
    const id = this.extractId(idOrUrl);
    if (!id) throw new NotFoundException('Imagen no encontrada');
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Imagen no encontrada');
    return attachment;
  }

  private extractId(idOrUrl: string | undefined): string | null {
    if (!idOrUrl) return null;
    const decoded = decodeURIComponent(idOrUrl);
    const normalized = decoded.startsWith('http')
      ? decoded.split('/').pop() || ''
      : decoded;
    return normalized || null;
  }
}