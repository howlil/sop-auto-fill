import { NotFoundException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService ownership', () => {
  it('returns a workspace owned by the authenticated user', async () => {
    const repository = {
      findOwnedById: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        ownerId: 'user-1',
        name: 'Project SOP',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const service = new WorkspaceService(repository as never);

    const result = await service.getOwned('user-1', 'workspace-1');

    expect(result.workspaceId).toBe('workspace-1');
  });

  it('does not expose a workspace owned by another user', async () => {
    const repository = {
      findOwnedById: jest.fn().mockResolvedValue(null),
    };
    const service = new WorkspaceService(repository as never);

    await expect(service.getOwned('user-1', 'workspace-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
