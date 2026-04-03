import { getAppConfig } from '../app-config.js';
import { createAuthService } from '../auth.js';
import { createCookbookRepository } from '../repository.js';

export function createAppServices() {
  const config = getAppConfig();
  const authService = createAuthService(config);
  const repository = createCookbookRepository({ config, authService });

  return {
    config,
    authService,
    repository,
  };
}
