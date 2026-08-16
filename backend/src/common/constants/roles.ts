export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export const VALID_USER_ROLES = [UserRole.SUPERADMIN, UserRole.OWNER, UserRole.ADMIN];