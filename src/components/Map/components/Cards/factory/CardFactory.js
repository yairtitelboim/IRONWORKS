// CardFactory - Creates cards from templates and handles different card types

class CardFactory {
  constructor() {
    this.templates = new Map();
    this.cardTypes = new Map();
    this.defaultTheme = 'default';
  }

  // Register a card template
  registerTemplate(templateName, template) {
    this.templates.set(templateName, {
      ...this.getDefaultTemplate(),
      ...template
    });
  }

  // Register a card type
  registerCardType(typeName, typeHandler) {
    this.cardTypes.set(typeName, typeHandler);
  }

  // Get default template
  getDefaultTemplate() {
    return {
      type: 'scene',
      draggable: true,
      pinnable: true,
      closable: true,
      style: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50',
        priority: 1
      },
      behavior: {
        autoClose: false,
        autoNavigate: false,
        showNavigation: true
      }
    };
  }

  // Create a card from a template
  createFromTemplate(templateName, overrides = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      console.warn(`Template '${templateName}' not found, using default`);
      return this.createFromTemplate('default', overrides);
    }

    return {
      ...template,
      ...overrides,
      id: overrides.id || `${templateName}-${Date.now()}`,
      style: {
        ...template.style,
        ...overrides.style
      },
      behavior: {
        ...template.behavior,
        ...overrides.behavior
      }
    };
  }

  // Create a card from configuration
  createFromConfig(config) {
    const baseCard = {
      id: config.id || `card-${Date.now()}`,
      title: config.title || 'Untitled Card',
      content: config.content || {},
      style: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50',
        priority: 1,
        ...config.style
      },
      position: config.position || { lng: 0, lat: 0 },
      nextSceneId: config.nextSceneId,
      draggable: config.draggable !== false,
      pinnable: config.pinnable !== false,
      closable: config.closable !== false
    };

    // Apply type-specific handling
    const cardType = config.type || 'scene';
    const typeHandler = this.cardTypes.get(cardType);
    
    if (typeHandler) {
      return typeHandler(baseCard, config);
    }

    return baseCard;
  }

  // Create multiple cards from a scene configuration
  createFromScene(sceneConfig) {
    if (!sceneConfig || !Array.isArray(sceneConfig)) {
      return [];
    }

    return sceneConfig.map(cardConfig => this.createFromConfig(cardConfig));
  }

  // Validate card configuration
  validateCard(card) {
    const required = ['id', 'title', 'content'];
    const missing = required.filter(field => !card[field]);
    
    if (missing.length > 0) {
      console.warn(`Card missing required fields: ${missing.join(', ')}`);
      return false;
    }

    if (!card.position || typeof card.position.lng !== 'number' || typeof card.position.lat !== 'number') {
      console.warn('Card position must have valid lng and lat coordinates');
      return false;
    }

    return true;
  }

  // Get all registered templates
  getTemplates() {
    return Array.from(this.templates.keys());
  }

  // Get all registered card types
  getCardTypes() {
    return Array.from(this.cardTypes.keys());
  }

  // Clear all templates and types
  clear() {
    this.templates.clear();
    this.cardTypes.clear();
  }
}

// Create default instance
const cardFactory = new CardFactory();

// Register default templates
cardFactory.registerTemplate('default', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#4caf50'
  }
});

cardFactory.registerTemplate('info', {
  type: 'info',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#2196f3'
  },
  behavior: {
    autoClose: false,
    showNavigation: false
  }
});

cardFactory.registerTemplate('warning', {
  type: 'warning',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#ff9800'
  }
});

cardFactory.registerTemplate('error', {
  type: 'error',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#f44336'
  }
});

// Register default card types
cardFactory.registerCardType('scene', (baseCard, config) => ({
  ...baseCard,
  type: 'scene',
  behavior: {
    ...baseCard.behavior,
    showNavigation: true,
    autoClose: false
  }
}));

cardFactory.registerCardType('info', (baseCard, config) => ({
  ...baseCard,
  type: 'info',
  behavior: {
    ...baseCard.behavior,
    showNavigation: false,
    autoClose: false
  }
}));

export default cardFactory;
