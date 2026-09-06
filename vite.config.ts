import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    
    
    
    
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        
        
        
        
        
        
        
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/]three[\\/]build/.test(id)) return 'vendor-three';
          if (id.includes('satellite.js')) return 'vendor-satellite';
          return undefined;
        },
      },
    },
  },
});
