import type { Browser, BrowserContext, Page } from '@playwright/test'

import type { E2eUser } from '../fixtures/users'
import { loginViaUi } from './app'

export interface RoleSession {
  context: BrowserContext
  page: Page
}

export async function newRoleSession(
  browser: Browser,
  user: E2eUser,
): Promise<RoleSession> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginViaUi(page, user)
  return { context, page }
}

export async function closeRoleSessions(sessions: RoleSession[]): Promise<void> {
  await Promise.all(sessions.map((session) => session.context.close()))
}
