/**
 * Startup Ecosystem Query Configuration
 * Defines search queries for mapping startup ecosystem in Boston/Cambridge area
 */

export const STARTUP_QUERIES = {
  // Core startup ecosystem queries
  startups: [
    'startups in Boston Cambridge',
    'tech companies near MIT Harvard',
    'early stage startups Cambridge',
    'venture backed companies Boston',
    'AI startups Cambridge',
    'biotech startups Boston',
    'fintech startups Boston',
    'clean tech startups Cambridge'
  ],

  // Investment and funding
  investors: [
    'venture capital firms Boston Cambridge',
    'angel investors near MIT',
    'seed stage investors Boston',
    'Series A investors Cambridge',
    'corporate venture capital Boston',
    'university venture funds MIT Harvard',
    'accelerator programs Boston',
    'incubator programs Cambridge'
  ],

  // Support infrastructure
  coWorking: [
    'co-working spaces Boston Cambridge',
    'startup incubators near MIT',
    'accelerator programs Boston',
    'innovation labs Cambridge',
    'maker spaces Boston',
    'startup hubs Cambridge',
    'tech meetups Boston',
    'entrepreneur events Cambridge'
  ],

  // Professional services
  services: [
    'startup lawyers Boston Cambridge',
    'venture capital lawyers near MIT',
    'startup accountants Boston',
    'IP lawyers Cambridge',
    'startup consultants Boston',
    'recruiting firms tech startups',
    'marketing agencies startups',
    'PR firms tech companies'
  ],

  // Research and talent
  research: [
    'MIT research labs Cambridge',
    'Harvard research facilities Boston',
    'university tech transfer offices',
    'research institutes Cambridge',
    'innovation centers Boston',
    'university entrepreneurship programs',
    'tech talent Boston Cambridge',
    'engineering talent MIT Harvard'
  ],

  // Corporate innovation
  corporate: [
    'corporate innovation labs Boston',
    'tech company offices Cambridge',
    'Fortune 500 companies Boston',
    'innovation centers Cambridge',
    'R&D facilities Boston',
    'tech company headquarters',
    'corporate venture arms Boston',
    'innovation partnerships Cambridge'
  ]
};

export const STARTUP_CATEGORIES = {
  startups: {
    icon: '🚀',
    color: '#10b981', // Green
    description: 'Startup Companies'
  },
  investors: {
    icon: '💰',
    color: '#f59e0b', // Orange
    description: 'Investors & VCs'
  },
  coWorking: {
    icon: '🏢',
    color: '#8b5cf6', // Purple
    description: 'Co-working & Incubators'
  },
  services: {
    icon: '⚖️',
    color: '#06b6d4', // Cyan
    description: 'Professional Services'
  },
  research: {
    icon: '🔬',
    color: '#ef4444', // Red
    description: 'Research & Universities'
  },
  corporate: {
    icon: '🏭',
    color: '#6b7280', // Gray
    description: 'Corporate Innovation'
  }
};

export const STARTUP_ANALYSIS_METRICS = {
  density: 'Startup density per square mile',
  funding: 'Total funding raised in area',
  talent: 'University talent concentration',
  network: 'Network effects and clustering',
  accessibility: 'Transit and walkability score',
  cost: 'Cost of living and office space',
  quality: 'Quality of life factors',
  growth: 'Growth rate and trends'
};
