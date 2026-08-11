import { getClientIp, getClientUserAgent } from './client-identity.util';
import type { Request } from 'express';

describe('client-identity.util', () => {
  describe('getClientIp', () => {
    it('seharusnya mengembalikan ip jika ip ada', () => {
      const req = { ip: '127.0.0.1', socket: {} } as Request;
      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('seharusnya mengembalikan ip dari remoteAddress jika ip kosong', () => {
      const req = { socket: { remoteAddress: '10.0.0.1' } } as Request;
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('seharusnya menghapus awalan ::ffff:', () => {
      const req = { ip: '::ffff:192.168.1.1', socket: {} } as Request;
      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('seharusnya mengembalikan unknown jika ip kosong dan remoteAddress kosong', () => {
      const req = { socket: {} } as Request;
      expect(getClientIp(req)).toBe('unknown');
    });

    it('seharusnya mengembalikan unknown jika string hanya berisi spasi kosong (Edge case)', () => {
      const req = { ip: '   ', socket: {} } as Request;
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('getClientUserAgent', () => {
    it('seharusnya mengembalikan user agent yang dipotong 512 karakter (Worst case)', () => {
      const longString = 'a'.repeat(600);
      const req = {
        get: (header: string) => (header === 'user-agent' ? longString : undefined),
      } as unknown as Request;
      const ua = getClientUserAgent(req);
      expect(ua).toHaveLength(512);
      expect(ua).toBe('a'.repeat(512));
    });

    it('seharusnya mengembalikan string aslinya jika kurang dari 512 karakter', () => {
      const req = {
        get: (header: string) => (header === 'user-agent' ? ' Mozilla/5.0 ' : undefined),
      } as unknown as Request;
      expect(getClientUserAgent(req)).toBe('Mozilla/5.0');
    });

    it('seharusnya mengembalikan null jika user-agent tidak ada atau hanya spasi (Edge case)', () => {
      const req = {
        get: () => '   ',
      } as unknown as Request;
      expect(getClientUserAgent(req)).toBeNull();
    });

    it('seharusnya mengembalikan null jika header undefined', () => {
      const req = {
        get: () => undefined,
      } as unknown as Request;
      expect(getClientUserAgent(req)).toBeNull();
    });
  });
});
