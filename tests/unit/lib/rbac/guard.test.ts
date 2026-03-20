import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { UserRole } from '@/generated/prisma';

describe('RBAC guard', () => {
  describe('SUPER_ADMIN', () => {
    it('should have all permissions', () => {
      for (const perm of Object.values(Permission)) {
        expect(hasPermission(UserRole.SUPER_ADMIN, perm)).toBe(true);
      }
    });
  });

  describe('TENANT_ADMIN', () => {
    it('should have tenant read/update but not delete', () => {
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.TENANT_READ)).toBe(true);
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.TENANT_UPDATE)).toBe(true);
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.TENANT_DELETE)).toBe(false);
    });

    it('should have full user management', () => {
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.USER_READ)).toBe(true);
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.USER_CREATE)).toBe(true);
      expect(hasPermission(UserRole.TENANT_ADMIN, Permission.USER_DELETE)).toBe(true);
    });
  });

  describe('AGENT', () => {
    it('should be able to read and update tickets', () => {
      expect(hasPermission(UserRole.AGENT, Permission.TICKET_READ)).toBe(true);
      expect(hasPermission(UserRole.AGENT, Permission.TICKET_UPDATE)).toBe(true);
    });

    it('should not be able to delete tickets', () => {
      expect(hasPermission(UserRole.AGENT, Permission.TICKET_DELETE)).toBe(false);
    });

    it('should not be able to manage users', () => {
      expect(hasPermission(UserRole.AGENT, Permission.USER_CREATE)).toBe(false);
      expect(hasPermission(UserRole.AGENT, Permission.USER_DELETE)).toBe(false);
    });
  });

  describe('CUSTOMER', () => {
    it('should only read own conversations and tickets', () => {
      expect(hasPermission(UserRole.CUSTOMER, Permission.CONVERSATION_READ_OWN)).toBe(true);
      expect(hasPermission(UserRole.CUSTOMER, Permission.CONVERSATION_READ)).toBe(false);
      expect(hasPermission(UserRole.CUSTOMER, Permission.TICKET_READ_OWN)).toBe(true);
      expect(hasPermission(UserRole.CUSTOMER, Permission.TICKET_READ)).toBe(false);
    });

    it('should be able to create tickets and conversations', () => {
      expect(hasPermission(UserRole.CUSTOMER, Permission.TICKET_CREATE)).toBe(true);
      expect(hasPermission(UserRole.CUSTOMER, Permission.CONVERSATION_CREATE)).toBe(true);
    });

    it('should be able to read KB articles', () => {
      expect(hasPermission(UserRole.CUSTOMER, Permission.KB_READ)).toBe(true);
    });

    it('should not be able to manage anything', () => {
      expect(hasPermission(UserRole.CUSTOMER, Permission.AI_CONFIG_MANAGE)).toBe(false);
      expect(hasPermission(UserRole.CUSTOMER, Permission.INTEGRATION_MANAGE)).toBe(false);
      expect(hasPermission(UserRole.CUSTOMER, Permission.SETTINGS_UPDATE)).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if any permission matches', () => {
      expect(
        hasAnyPermission(UserRole.AGENT, [Permission.TICKET_READ, Permission.USER_DELETE]),
      ).toBe(true);
    });

    it('should return false if no permissions match', () => {
      expect(
        hasAnyPermission(UserRole.CUSTOMER, [Permission.USER_DELETE, Permission.AUDIT_LOG_READ]),
      ).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if all permissions match', () => {
      expect(
        hasAllPermissions(UserRole.AGENT, [Permission.TICKET_READ, Permission.TICKET_UPDATE]),
      ).toBe(true);
    });

    it('should return false if any permission is missing', () => {
      expect(
        hasAllPermissions(UserRole.AGENT, [Permission.TICKET_READ, Permission.TICKET_DELETE]),
      ).toBe(false);
    });
  });
});
