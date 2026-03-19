// Cards system index file
export { default as BaseCard } from './BaseCard';
export { default as CardManager } from './CardManager';
export { default as cardFactory } from './factory/CardFactory';

// Texas-specific configurations
export { 
  getTexasCardsForScene, 
  getTexasSceneIds, 
  createTexasCard,
  getCardsForScene, // Backward compatibility
  getAvailableSceneIds // Backward compatibility
} from './config/TexasCardConfig';

// Default export for easy importing
export { default as Cards } from './CardManager';
