
export const STORAGE_KEYS = {
  APPOINTMENTS: 'lunari_appointments',
  CLIENTS: 'lunari_clients',
  PACKAGES: 'lunari_packages',
  BUDGETS: 'lunari_budgets',
  TEMPLATES: 'lunari_templates',
  ORIGINS: 'lunari_origins',
  TRANSACTIONS: 'lunari_transactions',
  CATEGORIES: 'lunari_categories',
  SUBCATEGORIES: 'lunari_subcategories',
  DESCRIPTIONS: 'lunari_descriptions',
  PRICING_SETTINGS: 'lunari_pricing_settings',
  WORKFLOW_ITEMS: 'lunari_workflow_items',
  WORKFLOW_COLUMNS: 'lunari_workflow_columns',
  WORKFLOW_STATUS: 'lunari_workflow_status',
  // Nova arquitetura de Blueprints
  FIN_TRANSACTIONS: 'lunari_fin_transactions',
  FIN_BLUEPRINTS: 'lunari_fin_recurring_blueprints',
  FIN_ITEMS: 'lunari_fin_items'
} as const;

export const storage = {
  save: <T>(key: string, data: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },

  load: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return defaultValue;
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },

  clearAllAppData: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      // Also remove configuration keys
      localStorage.removeItem('configuracoes_categorias');
      localStorage.removeItem('configuracoes_produtos');
      localStorage.removeItem('configuracoes_pacotes');
      // Remove old financial keys that may cause conflicts
      localStorage.removeItem('lunari_fin_recurring_templates');
      localStorage.removeItem('lunari_fin_credit_cards');
      localStorage.removeItem('blueprint_migration_completed');
      console.log('All app data cleared from localStorage');
    } catch (error) {
      console.error('Error clearing app data from localStorage:', error);
    }
  }
};
