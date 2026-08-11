import { expect, test } from '@playwright/test'

import { scenarioCoverage, scenarioIds } from './support/test-data'

test.describe('Traceability rancangan E2E', () => {
  test('semua skenario E2E-01 sampai E2E-70 terpetakan tepat sekali', async () => {
    const mapped = Object.values(scenarioCoverage).flat()
    const missing = scenarioIds.filter((id) => !mapped.includes(id))
    const unexpected = mapped.filter((id) => !scenarioIds.includes(id))
    const duplicates = mapped.filter((id, index) => mapped.indexOf(id) !== index)

    expect(missing, 'ID skenario yang belum dipetakan').toEqual([])
    expect(unexpected, 'ID skenario tidak dikenal').toEqual([])
    expect(duplicates, 'ID skenario duplikat').toEqual([])
    expect(mapped).toHaveLength(70)
  })

  for (const [fileName, ids] of Object.entries(scenarioCoverage)) {
    test(`${fileName} mencakup ${ids.join(', ')}`, async ({}, testInfo) => {
      testInfo.annotations.push({
        type: 'traceability',
        description: `${fileName}: ${ids.join(', ')}`,
      })
      expect(ids).not.toEqual([])
    })
  }
})
