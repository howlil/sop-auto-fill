import { ConflictException } from '@nestjs/common';
import {
  assertCanEditCurrentVersion,
  assertCanCreateNewVersion,
} from './sop-version-policy';

describe('SOP version policy', () => {
  it('allows editing while the SOP project is draft', () => {
    expect(() => assertCanEditCurrentVersion('DRAFT')).not.toThrow();
  });

  it('locks a completed SOP version from direct edits', () => {
    expect(() => assertCanEditCurrentVersion('COMPLETED')).toThrow(ConflictException);
  });

  it('allows a completed SOP to create the next cloned version', () => {
    expect(() => assertCanCreateNewVersion('COMPLETED')).not.toThrow();
  });

  it('does not create another version while the current project is draft', () => {
    expect(() => assertCanCreateNewVersion('DRAFT')).toThrow(ConflictException);
  });

  it('does not create a new version for an archived SOP', () => {
    expect(() => assertCanCreateNewVersion('ARCHIVED')).toThrow(ConflictException);
  });
});
