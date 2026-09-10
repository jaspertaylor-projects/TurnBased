import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createSnapshot(
    scrapeRunId: string,
    url: string,
    html: string,
    productId?: string,
  ) {
    const hash = crypto.createHash('sha256').update(html).digest('hex');
    const storageKey = `snapshots/${scrapeRunId}/${Date.now()}.html`;
    // Mock save to an S3 bucket or equivalent here

    return this.prisma.rawSnapshot.create({
      data: {
        scrapeRunId,
        productId,
        sourceUrl: url,
        contentType: 'text/html',
        storageKey,
        contentHash: hash,
      },
    });
  }
}
