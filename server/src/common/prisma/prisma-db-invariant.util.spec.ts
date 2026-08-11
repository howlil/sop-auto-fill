import { extractDbInvariantMessage } from './prisma-db-invariant.util';

describe('Pengujian extractDbInvariantMessage', () => {
  it('seharusnya mengambil pesan dari bentuk error driver adapter', () => {
    const err = {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '1644',
        originalMessage:
          'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu',
        kind: 'mysql',
        code: 1644,
        message:
          'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu',
        state: '45000',
      },
    };
    const actual = extractDbInvariantMessage(err);
    expect(actual).toBe(
      'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu',
    );
  });

  it('seharusnya mengembalikan null untuk error yang tidak terkait', () => {
    expect(extractDbInvariantMessage(new Error('network timeout'))).toBeNull();
    expect(extractDbInvariantMessage({ message: 'not found' })).toBeNull();
  });

  it('seharusnya mengambil pesan self-loop SOP terkait', () => {
    const err = {
      message: 'SOP terkait tidak boleh merujuk diri sendiri',
      state: '45000',
    };
    expect(extractDbInvariantMessage(err)).toBe('SOP terkait tidak boleh merujuk diri sendiri');
  });
  it('seharusnya mengembalikan null jika input null, undefined, atau tipe primitif (Edge Case)', () => {
    expect(extractDbInvariantMessage(null)).toBeNull();
    expect(extractDbInvariantMessage(undefined)).toBeNull();
    expect(extractDbInvariantMessage('string error')).toBeNull();
    expect(extractDbInvariantMessage(123)).toBeNull();
  });

  it('seharusnya menghentikan traversal dan tidak terjebak infinite loop jika terdeteksi circular reference (Worst Case)', () => {
    const err1: any = { message: 'not interesting' };
    const err2: any = { message: 'also not interesting', cause: err1 };
    err1.cause = err2; // circular!

    expect(extractDbInvariantMessage(err1)).toBeNull(); // Should safely terminate
  });

  it('seharusnya menemukan originalMessage meskipun jauh di dalam struktur nested object', () => {
    const err = {
      name: 'OuterError',
      cause: {
        error: {
          originalMessage: '   SOP terkait ditemukan secara nested   ',
        },
      },
    };
    expect(extractDbInvariantMessage(err)).toBe('SOP terkait ditemukan secara nested');
  });
});
