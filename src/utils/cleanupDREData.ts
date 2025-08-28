// Cleanup function to remove DRE-related data from localStorage
export const cleanupDREData = () => {
  try {
    // Remove DRE configuration
    localStorage.removeItem('dre_config_v1');
    
    console.log('✅ DRE data cleanup completed');
  } catch (error) {
    console.error('❌ Error during DRE cleanup:', error);
  }
};

// Auto-run cleanup on import
cleanupDREData();