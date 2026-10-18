import {
  resolveDatabaseConfig,
  maskConnectionString,
  ConfigurationError,
} from '../../src/config/env';

describe('Public API Fail-Closed Database Configuration (Phase 12)', () => {
  const secretAdminUrl = 'postgresql://neondb_owner:SuperSecretAdminPass123@ep-pooler.neon.tech/neondb?sslmode=require';
  const publicReadOnlyUrl = 'postgresql://lanka_offers_public_api:ReadOnlyPublicPass456@ep-pooler.neon.tech/neondb?sslmode=require';

  describe('1. Production Fail-Closed Credential Enforcement', () => {
    it('THROWS ConfigurationError in production if only DATABASE_URL is provided (prohibits silent admin fallback)', () => {
      expect(() => {
        resolveDatabaseConfig('production', undefined, secretAdminUrl);
      }).toThrow(ConfigurationError);

      try {
        resolveDatabaseConfig('production', undefined, secretAdminUrl);
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        const msg = (err as Error).message;
        expect(msg).toContain('[SECURITY FAIL-CLOSED]');
        expect(msg).toContain('Production strictly requires DATABASE_PUBLIC_URL');
        expect(msg).toContain('Fallback to administrative or unconfigured credentials is prohibited');
        // Ensure secret admin credentials are never leaked in error messages
        expect(msg).not.toContain('SuperSecretAdminPass123');
        expect(msg).not.toContain('neondb_owner');
      }
    });

    it('THROWS ConfigurationError in production if both variables are missing or empty', () => {
      expect(() => {
        resolveDatabaseConfig('production', '', '');
      }).toThrow(ConfigurationError);

      expect(() => {
        resolveDatabaseConfig('production', undefined, undefined);
      }).toThrow(ConfigurationError);
    });

    it('SUCCEEDS in production when DATABASE_PUBLIC_URL is explicitly configured', () => {
      const res = resolveDatabaseConfig('production', publicReadOnlyUrl, secretAdminUrl);

      expect(res.databaseUrl).toBe(publicReadOnlyUrl);
      expect(res.isDesignatedPublicUrl).toBe(true);
      // Ensures the admin URL was NOT selected
      expect(res.databaseUrl).not.toBe(secretAdminUrl);
    });

    it('STRICTLY PROHIBITS any fallback to administrative credentials in production', () => {
      expect(() => {
        resolveDatabaseConfig('production', undefined, secretAdminUrl);
      }).toThrow(ConfigurationError);

      expect(() => {
        resolveDatabaseConfig('production', '', secretAdminUrl);
      }).toThrow(ConfigurationError);

      expect(() => {
        resolveDatabaseConfig('production', '   ', secretAdminUrl);
      }).toThrow(ConfigurationError);
    });
  });

  describe('2. Safe Non-Production Development & Test Mode Behavior', () => {
    it('permits safe developer fallback to DATABASE_URL in development mode', () => {
      const res = resolveDatabaseConfig('development', undefined, secretAdminUrl);

      expect(res.databaseUrl).toBe(secretAdminUrl);
      expect(res.isDesignatedPublicUrl).toBe(false);
    });

    it('permits safe developer fallback to DATABASE_URL in test mode', () => {
      const res = resolveDatabaseConfig('test', undefined, secretAdminUrl);

      expect(res.databaseUrl).toBe(secretAdminUrl);
      expect(res.isDesignatedPublicUrl).toBe(false);
    });

    it('prefers DATABASE_PUBLIC_URL over DATABASE_URL when both are set in development', () => {
      const res = resolveDatabaseConfig('development', publicReadOnlyUrl, secretAdminUrl);

      expect(res.databaseUrl).toBe(publicReadOnlyUrl);
      expect(res.isDesignatedPublicUrl).toBe(true);
    });

    it('handles empty strings gracefully in test mode without throwing', () => {
      const res = resolveDatabaseConfig('test', '', '');

      expect(res.databaseUrl).toBe('');
      expect(res.isDesignatedPublicUrl).toBe(false);
    });
  });

  describe('3. Credential Masking Security Utility', () => {
    it('masks passwords in PostgreSQL connection strings', () => {
      const masked = maskConnectionString(publicReadOnlyUrl);

      expect(masked).toContain('lanka_offers_public_api:****@');
      expect(masked).not.toContain('ReadOnlyPublicPass456');
      expect(masked).toContain('ep-pooler.neon.tech/neondb?sslmode=require');
    });

    it('handles empty or malformed strings safely without throwing', () => {
      expect(maskConnectionString('')).toBe('<empty>');
      expect(maskConnectionString('invalid-connection-string')).toBe('invalid-connection-string');
    });
  });
});
