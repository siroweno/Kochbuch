import { getAppConfig } from '../app-config.js';
import { createAuthService } from '../auth.js';
import { createBrowserTestAuthBackend } from '../auth-backends/browser-test-auth-backend.js';
import { createSupabaseAuthBackend } from '../auth-backends/supabase-auth-backend.js';
import { createCookbookRepository } from '../repository.js';
import { createBrowserTestRepositoryDriver } from '../repository-drivers/browser-test-driver.js';
import { createSupabaseRepositoryDriver } from '../repository-drivers/supabase-driver.js';

export function createAppServices() {
  const config = getAppConfig();
  const authBackend = config.backend === 'browser-test'
    ? createBrowserTestAuthBackend()
    : createSupabaseAuthBackend();
  const authService = createAuthService({ config, backend: authBackend });
  const createDriver = config.backend === 'browser-test'
    ? () => createBrowserTestRepositoryDriver({
      authService,
      browserTestBasePath: config.browserTestBasePath,
    })
    : () => createSupabaseRepositoryDriver({ authService });
  const repository = createCookbookRepository({ authService, createDriver });

  return {
    config,
    authService,
    repository,
  };
}
