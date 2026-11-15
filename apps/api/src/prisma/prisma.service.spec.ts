import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService lifecycle', () => {
  it('disconnects Prisma during module destruction', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);

    await PrismaService.prototype.onModuleDestroy.call({
      $disconnect: disconnect,
    } as unknown as PrismaService);

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
