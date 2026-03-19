// Model colors
export const MODEL_COLORS = {
  gpt4: '#3b82f6',     // blue
  claude3: '#8b5cf6',  // purple
  llama3: '#10b981',   // green
  deepseek: '#f97316'  // orange
};

// Mock data for a 15-minute city analysis cluster
export const clusterData = {
  name: "Downtown LA Arts District",
  type: "Mixed-Use Urban Core",
  walkScore: 92,
  bikeScore: 86,
  transitScore: 88,
  address: "Arts District",
  city: "Los Angeles, CA 90013",
  amenitiesWithin15Min: 284,
  essentialServices: "95%",
  greenSpaces: "12 acres",
  lastMajorDev: "2022",
  keyFeatures: "Creative Offices, Residential Lofts, Art Galleries, Restaurants",
  imageUrl: "https://images.unsplash.com/photo-1582225373839-3f67b3057106?q=80&w=2787&auto=format&fit=crop"
};

// LLM models for analysis
export const llmModels = [
  { id: 'gpt4', name: 'GPT-4', color: '#3b82f6', confidence: 89 },
  { id: 'claude3', name: 'Claude 3', color: '#8b5cf6', confidence: 92 },
  { id: 'llama3', name: 'Llama 3', color: '#10b981', confidence: 85 },
  { id: 'deepseek', name: 'DeepSeek-R1', color: '#f97316', confidence: 87 }
];

// Add milestone categories for 15-minute city metrics
export const milestoneCategories = {
  'Mobility': {
    color: '#4B5563',
    factors: ['Public Transit', 'Bike Infrastructure']
  },
  'Accessibility': {
    color: '#047857',
    factors: ['Essential Services', 'Green Spaces']
  },
  'Urban Design': {
    color: '#1D4ED8',
    factors: ['Mixed-Use Development', 'Walkability']
  }
};

// Update risk factor data with 15-minute city metrics
export const accessibilityData = [
  { 
    factor: 'Public Transit',
    category: 'Mobility',
    'GPT-4': 85, 
    'Claude 3': 88, 
    'Llama 3': 82,
    'DeepSeek-R1': 84,
    description: '4 metro stops within 10-minute walk',
    impact: 'Excellent transit connectivity'
  },
  { 
    factor: 'Bike Infrastructure',
    category: 'Mobility', 
    'GPT-4': 75, 
    'Claude 3': 78, 
    'Llama 3': 72,
    'DeepSeek-R1': 76,
    description: '8.5 miles of protected bike lanes',
    impact: 'Strong cycling infrastructure'
  },
  { 
    factor: 'Essential Services',
    category: 'Accessibility', 
    'GPT-4': 92, 
    'Claude 3': 90, 
    'Llama 3': 88,
    'DeepSeek-R1': 89,
    description: '95% of essentials within 15 minutes',
    impact: 'Excellent daily needs access'
  },
  { 
    factor: 'Green Spaces',
    category: 'Accessibility', 
    'GPT-4': 68, 
    'Claude 3': 65, 
    'Llama 3': 70,
    'DeepSeek-R1': 66,
    description: '12 acres of parks and plazas',
    impact: 'Moderate green space access'
  },
  { 
    factor: 'Mixed-Use Development',
    category: 'Urban Design', 
    'GPT-4': 88, 
    'Claude 3': 85, 
    'Llama 3': 82,
    'DeepSeek-R1': 84,
    description: '78% mixed-use zoning',
    impact: 'Strong land use diversity'
  },
  { 
    factor: 'Walkability',
    category: 'Urban Design', 
    'GPT-4': 95, 
    'Claude 3': 92, 
    'Llama 3': 90,
    'DeepSeek-R1': 93,
    description: 'Walk Score: 92/100',
    impact: 'Excellent pedestrian environment'
  }
];

// Recovery timeline data
export const recoveryTimelineData = [
  { day: 0, 'GPT-4': 0, 'Claude 3': 0, 'Llama 3': 0, 'DeepSeek-R1': 0 },
  { day: 2, 'GPT-4': 8, 'Claude 3': 15, 'Llama 3': 5, 'DeepSeek-R1': 3 },
  { day: 4, 'GPT-4': 21, 'Claude 3': 32, 'Llama 3': 11, 'DeepSeek-R1': 9 },
  { day: 6, 'GPT-4': 36, 'Claude 3': 48, 'Llama 3': 18, 'DeepSeek-R1': 16 },
  { day: 8, 'GPT-4': 47, 'Claude 3': 62, 'Llama 3': 26, 'DeepSeek-R1': 35 },
  { day: 10, 'GPT-4': 58, 'Claude 3': 73, 'Llama 3': 35, 'DeepSeek-R1': 52 },
  { day: 12, 'GPT-4': 67, 'Claude 3': 81, 'Llama 3': 43, 'DeepSeek-R1': 63 },
  { day: 14, 'GPT-4': 74, 'Claude 3': 89, 'Llama 3': 51, 'DeepSeek-R1': 70 },
  { day: 16, 'GPT-4': 81, 'Claude 3': 94, 'Llama 3': 58, 'DeepSeek-R1': 76 },
  { day: 18, 'GPT-4': 86, 'Claude 3': 98, 'Llama 3': 65, 'DeepSeek-R1': 82 },
  { day: 20, 'GPT-4': 91, 'Claude 3': 100, 'Llama 3': 71, 'DeepSeek-R1': 87 },
  { day: 24, 'GPT-4': 97, 'Claude 3': 100, 'Llama 3': 83, 'DeepSeek-R1': 95 },
  { day: 28, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 91, 'DeepSeek-R1': 98 },
  { day: 32, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 96, 'DeepSeek-R1': 100 },
  { day: 36, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 100, 'DeepSeek-R1': 100 }
];

// Model conclusions
export const modelConclusions = [
  {
    id: 'llama3',
    name: 'Llama 3',
    color: '#10b981',
    recoveryTime: '36 days',
    riskScore: 78,
    keyInsight: 'Elevation is the dominant risk factor',
    uniqueFinding: 'Historical flood patterns suggest longer recovery periods than other models predict'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1',
    color: '#f97316',
    recoveryTime: '32 days',
    riskScore: 73,
    keyInsight: 'Elevation combined with bayou proximity creates compound risk',
    uniqueFinding: 'Retail businesses recover significantly slower than office spaces in this area'
  },
  {
    id: 'gpt4',
    name: 'GPT-4',
    color: '#3b82f6',
    recoveryTime: '24 days',
    riskScore: 65,
    keyInsight: 'Power infrastructure is the critical path dependency',
    uniqueFinding: 'Building proximity to backup power grid significantly reduces recovery time'
  },
  {
    id: 'claude3',
    name: 'Claude 3',
    color: '#8b5cf6',
    recoveryTime: '20 days',
    riskScore: 52,
    keyInsight: 'Business continuity plans most important for rapid recovery',
    uniqueFinding: 'Tenants with remote work capabilities recover 42% faster than those without'
  }
];
