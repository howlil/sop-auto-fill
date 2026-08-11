/** Runtime integration test hanya diizinkan di container `sop-integration-test`. */
export function isIntegrationDockerRuntime(): boolean {
  return process.env.INTEGRATION_TEST_DOCKER === 'true';
}

export function isIntegrationEnabled(): boolean {
  return process.env.RUN_INTEGRATION === 'true' && isIntegrationDockerRuntime();
}

export function assertIntegrationDockerOnly(): void {
  if (isIntegrationDockerRuntime()) {
    return;
  }
  throw new Error(
    'Integration test wajib dijalankan melalui Docker (database test terisolasi).\n' +
      '  cd server\n' +
      '  pnpm test:integration:docker          # semua suite\n' +
      '  pnpm test:integration:docker:pdf      # hanya tte-pdf-qr-verifikasi\n' +
      'Pastikan DB test hidup: docker compose -f docker-compose.test.yml up -d sop-test-db',
  );
}
