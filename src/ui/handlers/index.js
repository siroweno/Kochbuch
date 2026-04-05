import { createAuthHandlers } from './auth-handlers.js';
import { createFormHandlers } from './form-handlers.js';
import { createPlannerHandlers } from './planner-handlers.js';
import { createModalHandlers } from './modal-handlers.js';
import { createImportExportHandlers } from './import-export-handlers.js';
import { createDeleteHandlers } from './delete-handlers.js';
import { createToolbarHandlers } from './toolbar-handlers.js';
import { createSearchHandlers } from './search-handlers.js';
import { createDragHandlers } from './drag-handlers.js';
import { createDocumentHandlers } from './document-handlers.js';

export function createAppEventHandlers(deps) {
  return {
    ...createAuthHandlers(deps),
    ...createFormHandlers(deps),
    ...createPlannerHandlers(deps),
    ...createModalHandlers(deps),
    ...createImportExportHandlers(deps),
    ...createDeleteHandlers(deps),
    ...createToolbarHandlers(deps),
    ...createSearchHandlers(deps),
    ...createDragHandlers(deps),
    ...createDocumentHandlers(deps),
  };
}
