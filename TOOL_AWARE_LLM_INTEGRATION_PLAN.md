# Tool-Aware LLM Integration Plan
## Comprehensive System Audit & Implementation Strategy

### 📋 **EXECUTIVE SUMMARY**

This document outlines the plan to transform the current deterministic tool system into an intelligent, LLM-driven tool orchestration system while maintaining full backward compatibility. The current system uses manual circle buttons to trigger tools; the new system will enable the LLM to intelligently select and use tools based on user questions.

**SCOPE**: This implementation focuses on **OSM** and **SERP** tools only. AlphaEarth functionality is excluded and will be implemented in a future phase.

**CURRENT ARCHITECTURE**: Claude 3.5 Sonnet serves as the primary AI provider in BaseCard, with Perplexity AI available as a tool option in the NestedCircleButton.

---

## 🔍 **CURRENT SYSTEM AUDIT**

### **Architecture Overview**
```
User Question → BaseCard.handleAIQuery() → Claude 3.5 Sonnet API → Text Response Only
                     ↓
Manual Tool Triggers → NestedCircleButton → Individual Tools (including Perplexity) → Map Data
```

### **Component Analysis**

#### **1. BaseCard.jsx - AI Query Handler**
**Current State:**
- **Function**: `handleAIQuery(questionData)`
- **Flow**: Question → Cache Check → Claude 3.5 Sonnet API → Text Response
- **Limitations**: 
  - Only generates text responses
  - No tool integration in LLM reasoning
  - Tools are completely separate from AI responses
  - Simple prompt structure without tool context

**Key Code Sections:**
- Lines 570-719: Main AI query handling
- Lines 626-650: Direct Claude API call (Claude 3.5 Sonnet)
- Lines 638-640: Basic system prompt (data center consultant)
- Lines 662-664: Simple response formatting

**API Integration**: 
- **Primary Provider**: Claude 3.5 Sonnet (2024-10-22 model)
- **Endpoint**: Local proxy server at `http://localhost:3001/api/claude`
- **Model**: `claude-3-5-sonnet-20241022`
- **Max Tokens**: 2000
- **Fallback**: Perplexity AI available as tool option in NestedCircleButton

#### **2. NestedCircleButton.jsx - Tool Interface**
**Current State:**
- **Tools Available**: 
  - OSM (Green Circle) - Geographic data
  - SERP (Purple Circle) - Infrastructure search
  - AlphaEarth (Red Circle) - Environmental analysis
  - Clear (Gray Circle) - Map data clearing
  - Firecrawl (Orange Circle) - Web crawling
  - Perplexity (Blue Circle) - AI analysis tool
- **Trigger Method**: Manual user clicks on colored circles
- **Tool Responses**: Currently processed but not integrated with AI responses
- **State Management**: Independent tool states, no coordination

**Key Code Sections:**
- Lines 403-473: AlphaEarth tool with business intelligence generation
- Lines 521-535: SERP tool integration
- Lines 573-587: OSM tool integration
- Lines 29-71: Map data clearing functionality
- Lines 650-726: Perplexity tool integration (new addition)

**Perplexity Tool (PerplexityCall.jsx):**
- **Location**: Blue circle in NestedCircleButton
- **Purpose**: Provides alternative AI analysis capabilities
- **Integration**: Available as manual tool option alongside Claude in BaseCard
- **Status**: Ready for tool-aware orchestration integration

#### **3. Individual Tool Capabilities**

**OSM Tool (OSMCall.jsx):**
- **Input**: Coordinates (lat/lng)
- **Process**: Perplexity API for coordinates → Overpass API → GeoJSON processing
- **Output**: Geographic features (buildings, roads, waterways, POIs, land use)
- **Data Structure**: GeoJSON with categorized features
- **Search Radius**: 6km
- **Current Issues**: Hardcoded to Bosque County site, deterministic queries

**SERP Tool (SerpAPI.jsx):**
- **Input**: Coordinates + predefined infrastructure queries
- **Process**: Perplexity API for coordinates → Multiple Google searches → Business data
- **Output**: Infrastructure facilities with ratings, addresses, contact info
- **Categories**: Power plants, data centers, utilities, industrial facilities
- **Search Radius**: 3 miles
- **Current Issues**: Fixed query list, no dynamic query generation

**AlphaEarth Tool (AlphaEarthButton.jsx):** [**EXCLUDED FROM CURRENT SCOPE**]
- **Input**: Coordinates + environmental parameters
- **Process**: Perplexity API → Google Earth Engine → Satellite analysis
- **Output**: Environmental risk assessment, stability analysis
- **Data**: 64-dimensional satellite embeddings, change detection
- **Status**: Will be integrated in Phase 2 of the tool-aware system

#### **4. Question Flow Analysis**

**Suggested Questions (AIQuestionsSection.jsx):**
- **Location**: Lines 8-43 in `EXECUTIVE_QUESTIONS`
- **Structure**: Predefined questions with specific queries
- **Categories**: Power reliability, regulatory approval, competitive landscape
- **Current Flow**: Question → `handleAIQuery()` → Text response only
- **Missing**: Tool selection hints, context awareness

**Ask Anything Input (AskAnythingInput.jsx):**
- **Function**: Free-form user input
- **Processing**: Same `handleAIQuery()` function as suggested questions
- **Current Limitation**: No tool context or intelligent tool selection

#### **5. Missing Components from Initial Audit**

**FollowUpQuestions.jsx:**
- **Purpose**: Handles follow-up question suggestions with enhanced loading states
- **Key Function**: `handleSuggestionClick(question)` → calls `handleAIQuery(question)`
- **State Management**: Tracks selected suggestions and loading states
- **Visual Features**: Skeleton loading, shimmer effects, conditional rendering
- **Integration Point**: Direct connection to AI query system

**AIResponseDisplay.jsx:**
- **Purpose**: Renders formatted AI responses with truncation and expansion
- **Key Features**: Skeleton loading, citation handling, text formatting
- **Response Processing**: Handles both string and React element responses
- **Truncation Logic**: Smart truncation with clickable expansion
- **Integration**: Receives responses from BaseCard's response array

**AskAnythingInput.jsx:**
- **Purpose**: Custom query input with voice and suggestion features
- **Key Function**: `handleSubmit()` → creates question object with `isCustom: true`
- **Enhanced Query**: Adds data center context to custom questions
- **Visual Features**: Shimmer effects, focus states, icon interactions
- **Integration**: Feeds directly into `handleAIQuery()` system

**TopBar.jsx:**
- **Purpose**: AI provider selection and response management
- **Dual Mode**: Open mode (dropdown) vs collapsed mode (response button)
- **State Management**: Local dropdown state to prevent interference
- **Provider Options**: Perplexity, OpenAI, Anthropic with color coding
- **Integration**: Updates global AI provider selection

---

## 🎯 **PROPOSED SOLUTION: INTELLIGENT TOOL ORCHESTRATION**

### **Vision Statement**
Transform the current manual tool system into an intelligent assistant that:
1. Analyzes user questions to determine relevant tools
2. Orchestrates multiple tools when needed
3. Synthesizes tool results with LLM reasoning
4. Maintains backward compatibility with existing functionality

### **Three-Phase Architecture**

```
PHASE 1: STAGING           PHASE 2: INFERENCE         PHASE 3: PROCESSING
User Question              Enhanced LLM Prompt        Dual-Channel Response
     ↓                           ↓                           ↓
Tool Context Injection → Perplexity API with → Response Parser
     ↓                    Tool Instructions        ↓         ↓
Enhanced Prompt                 ↓              Text      Tool Actions
                         Structured JSON      Response      ↓
                            Response             ↓        Map Integration
                                                ↓
                                           BaseCard Display
```

### **Backward Compatibility Strategy**

#### **1. Gradual Migration Approach**
- **Phase 1**: Add tool-aware prompts alongside existing system
- **Phase 2**: Implement response parsing with fallbacks
- **Phase 3**: Enable intelligent tool orchestration
- **Existing Functionality**: Manual circle buttons remain functional

#### **2. Feature Flags**
```javascript
const FEATURE_FLAGS = {
  TOOL_AWARE_LLM: false,        // Start disabled
  INTELLIGENT_ORCHESTRATION: false,
  ENHANCED_PROMPTS: true,       // Safe to enable first
  LEGACY_TOOL_SUPPORT: true    // Always enabled
};
```

#### **3. Fallback Mechanisms**
- If JSON parsing fails → Use text-only response (current behavior)
- If tool execution fails → Continue with text response
- If enhanced prompts fail → Fall back to basic prompts
- Manual tool triggers always work regardless of LLM state

---

## 🛠️ **IMPLEMENTATION PLAN**

### **Phase 1: Foundation (Backward Compatible)**

#### **1.1 Create Tool Context System**
**New Files**:
- `src/utils/ToolContextManager.js` - Tool availability and context
- `src/utils/PromptEnhancer.js` - Intelligent prompt augmentation
- `src/constants/toolDefinitions.js` - Tool capability definitions

**Purpose**: Provide structured tool information to LLM without changing existing flows

#### **1.2 Enhanced Prompt System**
**Modifications**:
- Enhance `BaseCard.handleAIQuery()` to inject tool context for Claude
- Create tool-aware system prompts for Claude 3.5 Sonnet
- Maintain fallback to original prompts
- Leverage existing Claude API integration

**Benefits**: Better responses even without tool orchestration

#### **1.3 Response Structure Detection**
**Implementation**:
- Add JSON detection in Claude response processing
- Parse structured responses when available
- Fall back to text-only processing
- Maintain Claude's superior JSON formatting capabilities

### **Phase 2: Intelligence Layer (Opt-in)**

#### **2.1 Intelligent Tool Selection**
**Features**:
- Claude analyzes questions to suggest relevant tools
- Context-aware tool parameter generation
- Multi-tool orchestration planning
- Leverage Claude's superior reasoning capabilities

#### **2.2 Response Parser**
**New File:** `src/utils/ResponseParser.js`
**Functions**:
- Parse JSON responses from Claude
- Extract tool actions and parameters
- Handle malformed responses gracefully
- Maintain Claude's structured output advantages

#### **2.3 Tool Executor**
**New File:** `src/utils/ToolExecutor.js`
**Functions**:
- Programmatically trigger existing tools
- Pass dynamic parameters to tools
- Coordinate multiple tool executions
- Integrate with Perplexity tool option

### **Phase 3: Full Integration (Advanced)**

#### **3.1 Dynamic Tool Parameters**
**Enhancements**:
- Tools accept dynamic search parameters from Claude
- Context-aware search radius and filters
- Question-specific data processing
- Claude-driven tool customization

#### **3.2 Result Synthesis**
**Features**:
- Combine tool results with Claude analysis
- Generate comprehensive responses
- Visual and textual result integration
- Perplexity comparison capabilities

#### **3.3 Learning System**
**Advanced Features**:
- Track tool usage patterns
- Optimize tool selection over time
- User preference learning
- Claude vs Perplexity performance analysis

---

## 📊 **COMPLETE SYSTEM COMPONENT MATRIX**

### **Data Flow Integration Points**

| Component | Current Function | Tool Integration | Enhancement Opportunity |
|-----------|------------------|------------------|------------------------|
| **BaseCard.jsx** | Central orchestrator, `handleAIQuery()` with Claude | Manual tool triggers only | **PRIMARY TARGET**: Add tool-aware prompts for Claude |
| **FollowUpQuestions.jsx** | `handleSuggestionClick()` → `handleAIQuery()` | None | Add tool context to suggestions |
| **AskAnythingInput.jsx** | Custom queries with `isCustom: true` | None | **HIGH IMPACT**: Add tool instruction injection |
| **AIResponseDisplay.jsx** | Text rendering and formatting | None | Add tool result synthesis |
| **TopBar.jsx** | AI provider selection | None | Add tool status indicators |
| **NestedCircleButton.jsx** | Tool panel with Perplexity option | Manual tool execution | **ENHANCED**: Perplexity tool integration complete |

### **Tool Capability Matrix**

| Tool | Current Capabilities | Proposed Enhancements | Use Cases |
|------|---------------------|----------------------|-----------|
| **OSM** | Fixed 6km radius, predefined queries | Dynamic radius, custom POI searches | Location analysis, zoning, nearby facilities |
| **SERP** | Fixed infrastructure list, 3mi radius | Dynamic queries, custom search terms | Competitor analysis, market research, vendor discovery |
| **Perplexity** | **NEW**: Blue circle tool option | **READY**: Claude orchestration integration | Alternative AI analysis, comparison with Claude |
| **AlphaEarth** | [**EXCLUDED FROM CURRENT SCOPE**] | [**FUTURE IMPLEMENTATION**] | [**Phase 2 - Environmental intelligence**] |

### **Question Processing Pipeline**

```
User Input Sources:
├── Suggested Questions (EXECUTIVE_QUESTIONS)
├── Follow-up Questions (FollowUpQuestions.jsx)
└── Custom Input (AskAnythingInput.jsx)
                    ↓
            handleAIQuery() in BaseCard.jsx (Claude)
                    ↓
            Claude 3.5 Sonnet API (current)
                    ↓
            AIResponseDisplay.jsx
                    ↓
            Text Response Only (limitation)

PROPOSED ENHANCEMENT:
User Input → Tool Context Injection → Enhanced Claude → Dual Channel Response
                                                     ├── Text → AIResponseDisplay
                                                     └── Tool Actions → Map Integration

ALTERNATIVE WORKFLOW:
User Input → Perplexity Tool (Blue Circle) → Independent Analysis → Comparison with Claude
```

---

## 🔄 **MIGRATION STRATEGY**

### **Week 1-2: Foundation**
1. Create tool definition system
2. Implement enhanced prompts with feature flags
3. Add JSON response detection (fallback enabled)
4. Test with existing functionality

### **Week 3-4: Intelligence**
1. Build response parser with comprehensive error handling
2. Create tool executor that works with existing tools
3. Implement basic tool selection logic
4. Beta test with selected questions

### **Week 5-6: Integration**
1. Enable full tool orchestration
2. Add multi-tool coordination
3. Implement result synthesis
4. Performance optimization

### **Week 7-8: Enhancement**
1. Dynamic tool parameters
2. Advanced orchestration patterns
3. User experience refinements
4. Documentation and training

---

## 🧪 **TESTING STRATEGY**

### **Backward Compatibility Tests**
- All existing functionality works unchanged
- Manual tool buttons continue to function
- Original question flow remains intact
- Performance impact < 5%

### **Progressive Enhancement Tests**
- Enhanced prompts improve response quality
- Tool orchestration provides additional value
- Fallbacks work correctly
- Error handling is robust

### **Integration Tests**
- Tool coordination works smoothly
- Map visualization handles multiple data sources
- Response synthesis is coherent
- User experience is seamless

---

## 📈 **SUCCESS METRICS**

### **Technical Metrics**
- **Backward Compatibility**: 100% existing functionality preserved
- **Response Quality**: 30% improvement in relevance scores
- **Tool Usage**: 50% increase in intelligent tool selection
- **Error Rate**: < 2% for enhanced features

### **User Experience Metrics**
- **Question Satisfaction**: Improved ratings for complex queries
- **Tool Discovery**: Increased usage of previously underutilized tools
- **Response Time**: No degradation in perceived performance
- **Feature Adoption**: Gradual uptake of enhanced capabilities

---

## ⚠️ **RISK MITIGATION**

### **Technical Risks**
1. **LLM Response Parsing Failures**
   - **Mitigation**: Robust fallback to text-only responses
   - **Detection**: Comprehensive error logging and monitoring

2. **Tool Execution Failures**
   - **Mitigation**: Individual tool error handling
   - **Fallback**: Continue with available tool results

3. **Performance Degradation**
   - **Mitigation**: Asynchronous tool execution
   - **Optimization**: Intelligent caching and batching

### **User Experience Risks**
1. **Complexity Increase**
   - **Mitigation**: Gradual feature rollout
   - **Training**: Clear documentation and examples

2. **Unexpected Tool Behavior**
   - **Mitigation**: Tool execution logging and user feedback
   - **Control**: Manual override capabilities

---

## 🎯 **EXPECTED OUTCOMES**

### **Short-term (1-2 months)**
- Enhanced response quality for existing questions
- Improved tool discoverability
- Better integration between AI responses and map data
- Maintained system stability

### **Medium-term (3-6 months)**
- Intelligent tool orchestration for complex queries
- Dynamic parameter generation
- Multi-tool coordination
- User preference learning

### **Long-term (6+ months)**
- Fully autonomous tool selection and coordination
- Advanced result synthesis
- Predictive tool suggestions
- Comprehensive business intelligence platform

---

## 📚 **APPENDIX**

### **A. Current System Dependencies**
- Perplexity AI API (sonar-pro model)
- OpenStreetMap Overpass API
- SERP API (Google search)
- Google Earth Engine (AlphaEarth)
- Mapbox GL JS

### **B. Proposed New Dependencies**
- Enhanced JSON parsing utilities
- Tool orchestration framework
- Response synthesis engine
- Feature flag management system

### **C. File Structure Changes**
```
src/
├── utils/
│   ├── ToolContextManager.js      (NEW)
│   ├── PromptEnhancer.js          (NEW)
│   ├── ResponseParser.js          (NEW)
│   └── ToolExecutor.js            (NEW)
├── constants/
│   └── toolDefinitions.js         (NEW)
└── components/Map/components/Cards/
    ├── BaseCard.jsx               (ENHANCED - Primary target, Claude integration)
    ├── FollowUpQuestions.jsx      (ENHANCED - Add tool context)
    ├── AskAnythingInput.jsx       (ENHANCED - Tool instruction injection)
    ├── AIResponseDisplay.jsx     (ENHANCED - Tool result synthesis)
    ├── TopBar.jsx                 (ENHANCED - Tool status indicators)
    ├── AIQuestionsSection.jsx     (ENHANCED)
    ├── NestedCircleButton.jsx     (ENHANCED - Perplexity tool integration complete)
    ├── OSMCall.jsx               (ENHANCED - Dynamic parameters)
    ├── SerpAPI.jsx               (ENHANCED - Dynamic queries)
    ├── PerplexityCall.jsx        (ENHANCED - Tool panel integration)
    └── AlphaEarthButton.jsx      (ENHANCED - Context-aware analysis)
```

### **D. Critical Integration Points Identified**

**Primary Integration Points:**
1. **BaseCard.handleAIQuery()** - Lines 570-719 - **CRITICAL PATH** (Claude-based)
2. **FollowUpQuestions.handleSuggestionClick()** - Line 14-17 - **HIGH IMPACT**
3. **AskAnythingInput.handleSubmit()** - Lines 7-23 - **HIGH IMPACT**

**Secondary Integration Points:**
4. **AIResponseDisplay** - Response rendering and formatting
5. **TopBar** - AI provider selection and status display
6. **NestedCircleButton** - Tool orchestration interface (Perplexity ready)
7. **PerplexityCall** - Alternative AI analysis tool

**Current Status:**
- **Claude Integration**: ✅ Complete in BaseCard.jsx
- **Perplexity Tool**: ✅ Complete in NestedCircleButton.jsx
- **Tool Orchestration**: 🔄 Ready for Claude → Tool coordination
- **Backward Compatibility**: ✅ Maintained for all existing functionality

---

## 🔧 **DETAILED REFACTORING SPECIFICATIONS**

### **Critical Code Locations Requiring Changes**

#### **1. PRIMARY TARGET: BaseCard.jsx - handleAIQuery Function**
**Location**: Lines 570-719
**Current Code Structure**:
```javascript
const handleAIQuery = async (questionData) => {
  console.log('🚀 AI Query:', questionData.text);
  
  // Current prompt structure (NEEDS ENHANCEMENT)
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: questionData.isCustom ? 
            'You are an expert data center consultant analyzing the CyrusOne site in Whitney, TX (Bosque County). Provide concise, actionable insights relevant to data center operations, infrastructure, and business decisions. Focus on practical recommendations for Gene and the team.' : 
            'You are an expert data center consultant providing executive summaries for data center operations.'
        },
        {
          role: 'user',
          content: questionData.isCustom ? 
            `Context: Data center site in Whitney, TX (Bosque County). Question: ${questionData.query}` :
            questionData.query
        }
      ]
    })
  });
}
```

**Required Changes**:
1. **Line 635-648**: Replace basic system prompt with tool-aware prompt
2. **Line 655-673**: Add response parsing for JSON tool instructions
3. **Add after Line 673**: Tool execution logic
4. **Add fallback**: If JSON parsing fails, use current text-only flow

#### **2. HIGH IMPACT: FollowUpQuestions.jsx - handleSuggestionClick Function**
**Location**: Lines 14-17
**Current Code**:
```javascript
const handleSuggestionClick = (question) => {
  setSelectedSuggestion(question.id);
  handleAIQuery(question);  // ← ENHANCEMENT POINT
};
```

**Required Changes**:
1. **Before Line 16**: Add tool context injection to question object
2. **Enhance question object**: Add tool hints based on question type
3. **Example Enhancement**:
```javascript
const handleSuggestionClick = (question) => {
  setSelectedSuggestion(question.id);
  
  // ENHANCEMENT: Add tool context based on question type
  const enhancedQuestion = {
    ...question,
    toolHints: getToolHintsForQuestion(question.id),
    requiresTools: shouldUseTools(question.id)
  };
  
  handleAIQuery(enhancedQuestion);
};
```

#### **3. HIGH IMPACT: AskAnythingInput.jsx - handleSubmit Function**
**Location**: Lines 7-23
**Current Code**:
```javascript
const handleSubmit = (e) => {
  e.preventDefault();
  if (inputValue.trim() && !isLoading && !disabled) {
    const enhancedQuery = inputValue.trim();
    
    onSubmit({
      id: 'custom_question',
      text: enhancedQuery,
      query: enhancedQuery,
      isCustom: true  // ← ENHANCEMENT POINT
    });
    setInputValue('');
  }
};
```

**Required Changes**:
1. **Lines 15-20**: Enhance question object with tool analysis
2. **Add tool context analysis**: Analyze user input for tool relevance
3. **Example Enhancement**:
```javascript
onSubmit({
  id: 'custom_question',
  text: enhancedQuery,
  query: enhancedQuery,
  isCustom: true,
  // ENHANCEMENTS:
  toolAnalysis: analyzeQueryForTools(enhancedQuery),
  suggestedTools: getSuggestedTools(enhancedQuery),
  requiresTools: containsToolKeywords(enhancedQuery)
});
```

#### **4. EXECUTIVE_QUESTIONS Enhancement**
**Location**: AIQuestionsSection.jsx Lines 8-43
**Current Structure**:
```javascript
const EXECUTIVE_QUESTIONS = {
  initial: [
    {
      id: 'power_reliability',
      text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
      query: 'For the CyrusOne data center site in Whitney, TX (Bosque County), provide a brief executive summary in 3 sentences: What is the power grid reliability score (1-10), what is the main risk factor, and which grid operator manages this area?'
    },
    // ... more questions
  ]
}
```

**Required Changes**:
1. **Add tool context to each question**:
```javascript
{
  id: 'power_reliability',
  text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
  query: '...',
  // ENHANCEMENTS:
  suggestedTools: ['SERP'], // Infrastructure analysis
  toolPriority: 'high',
  toolReason: 'Need real-time power infrastructure data'
}
```

#### **5. Tool Integration Points**

**NestedCircleButton.jsx** - Lines 403-587
**Current**: Manual tool triggers only
**Enhancement**: Add programmatic trigger functions
```javascript
// ADD: Programmatic tool execution
const executeToolProgrammatically = (toolName, parameters) => {
  switch(toolName) {
    case 'OSM':
      return triggerOSMWithParams(parameters);
    case 'SERP':
      return triggerSERPWithParams(parameters);
    case 'AlphaEarth':
      return triggerAlphaEarthWithParams(parameters);
  }
};
```

### **Response Processing Enhancement Locations**

#### **AIResponseDisplay.jsx** - Response Rendering
**Location**: Lines 287-320
**Current**: Text-only response rendering
**Enhancement**: Add tool result synthesis
```javascript
// ENHANCEMENT: Render tool results alongside text
const renderEnhancedResponse = (response, toolResults) => {
  return (
    <>
      {renderTextResponse(response)}
      {toolResults && renderToolResults(toolResults)}
    </>
  );
};
```

### **New Files Required**

#### **1. src/utils/ToolContextManager.js** (NEW)
**Purpose**: Manage tool availability and context
**Key Functions**:
- `analyzeQueryForTools(query)` - Determine relevant tools
- `getToolHintsForQuestion(questionId)` - Get tool suggestions
- `shouldUseTools(questionId)` - Boolean tool requirement

#### **2. src/utils/PromptEnhancer.js** (NEW)
**Purpose**: Enhance prompts with tool context
**Key Functions**:
- `enhancePromptWithTools(originalPrompt, availableTools)`
- `createToolAwareSystemPrompt(questionType)`

#### **3. src/utils/ResponseParser.js** (NEW)
**Purpose**: Parse LLM responses for tool actions
**Key Functions**:
- `parseToolInstructions(llmResponse)`
- `extractTextResponse(llmResponse)`
- `validateToolActions(toolActions)`

#### **4. src/utils/ToolExecutor.js** (NEW)
**Purpose**: Execute tools programmatically
**Key Functions**:
- `executeTool(toolName, parameters)`
- `executeMultipleTools(toolActions)`
- `coordinateToolExecution(toolSequence)`

### **Backward Compatibility Safeguards**

#### **Feature Flag Implementation**
**Location**: Add to BaseCard.jsx after Line 200
```javascript
// FEATURE FLAGS for gradual rollout
const FEATURE_FLAGS = {
  TOOL_AWARE_LLM: false,        // Start disabled
  INTELLIGENT_ORCHESTRATION: false,
  ENHANCED_PROMPTS: true,       // Safe to enable first
  LEGACY_TOOL_SUPPORT: true    // Always enabled
};
```

#### **Fallback Mechanisms**
**Location**: BaseCard.jsx handleAIQuery function
```javascript
// FALLBACK: If tool-aware processing fails, use current system
try {
  if (FEATURE_FLAGS.TOOL_AWARE_LLM) {
    return await processToolAwareQuery(questionData);
  }
} catch (error) {
  console.warn('Tool-aware processing failed, using legacy:', error);
}

// EXISTING CODE continues unchanged
```

### **Testing Integration Points**

#### **1. Unit Test Locations**
- `BaseCard.handleAIQuery()` - Core functionality
- `FollowUpQuestions.handleSuggestionClick()` - Suggestion enhancement
- `AskAnythingInput.handleSubmit()` - Custom query processing

#### **2. Integration Test Scenarios**
- Tool-aware prompt → LLM → Tool execution → Map display
- Fallback from enhanced to legacy system
- Multiple tool coordination
- Error handling at each integration point

This detailed specification ensures precise implementation with minimal risk to existing functionality.

---

## 🔔 **CURRENT TOOL FEEDBACK SYSTEM ANALYSIS**

### **How Tool Feedback Currently Works**

#### **1. Tool Feedback State Management**
**Location**: BaseCard.jsx Lines 303-311
```javascript
// New state for nested circle tool feedback
const [toolFeedback, setToolFeedback] = useState({
  isActive: false,
  tool: null, // 'osm', 'serp', 'alphaearth'
  status: '',
  progress: 0,
  details: '',
  timestamp: null
});
```

#### **2. Tool Feedback Update Function**
**Location**: BaseCard.jsx Lines 558-564
```javascript
// Function to update tool feedback from nested circle tools
const updateToolFeedback = (feedback) => {
  setToolFeedback({
    ...feedback,
    timestamp: Date.now()
  });
};
```

#### **3. Visual Tool Feedback Display**
**Location**: AIQuestionsSection.jsx Lines 110-223
**Current Display Structure**:
```javascript
{/* Tool Feedback Display - When viewing AI responses */}
{toolFeedback?.isActive && (
  <div style={{
    width: '320px',
    marginBottom: '16px',
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    animation: 'fadeIn 0.3s ease'
  }}>
    {/* Tool Header with colored circle */}
    {/* Status Message */}
    {/* Progress Bar with shimmer effect */}
    {/* Details in monospace font */}
    {/* Shimmer overlay */}
  </div>
)}
```

#### **4. Tool Feedback Components**

**Visual Elements**:
1. **Tool Header**: 
   - Colored circle (Green=OSM, Purple=SERP, Red=AlphaEarth)
   - Tool name in uppercase
   - Timestamp display
2. **Status Message**: Current operation description
3. **Progress Bar**: 0-100% with tool-specific colors and shimmer effect
4. **Details**: Technical details in monospace font
5. **Shimmer Overlay**: Animated overlay for active feedback

**Color Coding**:
- **OSM**: `#10b981` (Green)
- **SERP**: `#8b5cf6` (Purple) 
- **AlphaEarth**: `#f87171` (Red) [**EXCLUDED FROM CURRENT SCOPE**]

#### **5. How Tools Trigger Feedback Updates**

**OSM Tool Progress Flow**:
```javascript
// OSMCall.jsx - Example feedback updates
updateToolFeedback({
  isActive: true,
  tool: 'osm',
  status: '🚀 Starting OSM data query...',
  progress: 10,
  details: 'Initializing query for Bosque County data center site'
});

// ... later in process
updateToolFeedback({
  isActive: true,
  tool: 'osm', 
  status: '📡 Querying Perplexity API for coordinates...',
  progress: 30,
  details: 'Requesting site boundary coordinates from AI service'
});

// ... completion
updateToolFeedback({
  isActive: true,
  tool: 'osm',
  status: '✅ OSM data query completed successfully!',
  progress: 100,
  details: 'Geographic data loaded and mapped. Flying to site location...'
});
```

**SERP Tool Progress Flow**:
```javascript
// SerpAPI.jsx - Example feedback updates
updateToolFeedback({
  isActive: true,
  tool: 'serp',
  status: '🚀 Starting SERP infrastructure query...',
  progress: 10,
  details: 'Initializing infrastructure analysis for Bosque County data center site'
});

// ... processing
updateToolFeedback({
  isActive: true,
  tool: 'serp',
  status: '🏗️ Processing SERP data...',
  progress: 85,
  details: `Processed ${allInfrastructureFeatures.length} infrastructure facilities. Adding to map...`
});
```

### **Required Enhancements for Tool-Aware LLM System**

#### **1. Multi-Tool Coordination Display**
**Current Limitation**: Shows only one tool at a time
**Enhancement Needed**: Display multiple concurrent tool operations

**Proposed Enhancement**:
```javascript
// Enhanced state for multiple tools
const [toolFeedbacks, setToolFeedbacks] = useState([]); // Array instead of single object

// Enhanced display for multiple tools
{toolFeedbacks.map((feedback, index) => (
  <ToolFeedbackCard key={feedback.id} feedback={feedback} />
))}
```

#### **2. LLM-Initiated Tool Feedback**
**Current**: Tools are manually triggered by circle clicks
**Enhancement**: Tools triggered by LLM decisions need feedback

**New Feedback Types**:
```javascript
// LLM Analysis Phase
updateToolFeedback({
  isActive: true,
  tool: 'llm_analysis',
  status: '🧠 Analyzing question for relevant tools...',
  progress: 20,
  details: 'Determining which tools are needed for this query'
});

// Tool Coordination Phase  
updateToolFeedback({
  isActive: true,
  tool: 'coordination',
  status: '🔄 Coordinating multiple tools...',
  progress: 40,
  details: 'Executing OSM and SERP queries in parallel'
});
```

#### **3. Enhanced Progress Tracking**
**Current**: Simple 0-100% progress per tool
**Enhancement**: Multi-stage progress with sub-tasks

**Proposed Structure**:
```javascript
{
  isActive: true,
  tool: 'serp',
  status: '🔍 Querying infrastructure data...',
  progress: 60,
  details: 'Processing query 3 of 8: power plants',
  subTasks: [
    { name: 'Coordinate retrieval', status: 'completed', progress: 100 },
    { name: 'Infrastructure queries', status: 'in_progress', progress: 37 },
    { name: 'Data processing', status: 'pending', progress: 0 },
    { name: 'Map integration', status: 'pending', progress: 0 }
  ]
}
```

#### **4. Tool Result Synthesis Feedback**
**New Requirement**: Show when LLM is synthesizing tool results

**Proposed Addition**:
```javascript
updateToolFeedback({
  isActive: true,
  tool: 'synthesis',
  status: '🧠 Synthesizing tool results with AI analysis...',
  progress: 90,
  details: 'Combining OSM geographic data with SERP infrastructure analysis'
});
```

### **Enhanced Tool Feedback System Requirements**

#### **1. Updated State Structure**
**Location**: BaseCard.jsx Line 303-311
**Current**: Single tool feedback object
**Enhancement**: Support multiple concurrent tools
```javascript
// ENHANCED: Support multiple tools
const [toolFeedbacks, setToolFeedbacks] = useState([]);
const [activeLLMProcess, setActiveLLMProcess] = useState(null);
```

#### **2. Enhanced Display Components**
**Location**: AIQuestionsSection.jsx Lines 110-223
**Enhancement**: Support for multiple tool feedback cards and LLM process indicators

#### **3. Tool Coordination Feedback**
**New Requirement**: Show when LLM is coordinating multiple tools
- Tool selection reasoning
- Execution order and dependencies  
- Result synthesis progress
- Error handling and fallbacks

#### **4. Scope Adjustment for Current Implementation**
**Focus**: OSM and SERP tools only
**Excluded**: AlphaEarth tool feedback (future implementation)
**Enhanced Elements**:
- LLM decision-making feedback
- Multi-tool coordination display
- Tool result synthesis progress
- Enhanced error handling and recovery

This enhanced feedback system will provide users with clear visibility into the intelligent tool orchestration process while maintaining the familiar visual design of the current system.

---

## ➕ **ASK ANYTHING INPUT + BUTTON ANALYSIS**

### **Plus Button Functionality**

#### **1. Plus Button Location & Function**
**File**: AskAnythingInput.jsx
**Location**: Lines 66-91
**Current Code**:
```javascript
{/* Plus Icon - Left */}
<div 
  style={{
    display: 'flex',
    alignItems: 'center', 
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    marginRight: '12px',
    cursor: 'pointer',
    opacity: 0.8,
    transition: 'opacity 0.2s ease'
  }}
  onMouseEnter={(e) => e.target.style.opacity = '1'}
  onMouseLeave={(e) => e.target.style.opacity = '0.8'}
  onClick={onToggleSuggestions}  // ← KEY FUNCTION
  title="Click to show/hide quick questions"
>
  <span style={{
    color: 'white',
    fontSize: '16px', 
    fontWeight: 'bold'
  }}>
    +
  </span>
</div>
```

#### **2. Plus Button Callback Chain**
**Flow**: AskAnythingInput.jsx → AIQuestionsSection.jsx → BaseCard.jsx

**Step 1**: AskAnythingInput receives `onToggleSuggestions` prop
**Step 2**: AIQuestionsSection.jsx Line 538 passes callback:
```javascript
<AskAnythingInput 
  onSubmit={handleAIQuery}
  isLoading={aiState.isLoading}
  disabled={aiState.isLoading}
  onToggleSuggestions={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}  // ← CALLBACK
  hasShimmered={hasShimmered}
/>
```

**Step 3**: Controls `isQuickQuestionsOpen` state in AIQuestionsSection.jsx Line 58

#### **3. Questions That Appear Below Plus Button**

**Source**: AIQuestionsSection.jsx Lines 8-25
**Questions Displayed**: `EXECUTIVE_QUESTIONS.initial` array
**Location in UI**: Lines 676-726

**Current Initial Questions**:
1. **Power Grid Reliability** (`power_reliability`)
   - Text: "Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site"
   - Query: Analysis of power grid reliability score, risk factors, grid operator
   - **Tool Relevance**: HIGH for SERP (power infrastructure)

2. **Regulatory Approval Process** (`regulatory_timeline`)
   - Text: "Regulatory Approval Process - Review zoning requirements and construction timelines for Bosque County" 
   - Query: Regulatory approval status, permit timelines, data center requirements
   - **Tool Relevance**: MEDIUM for OSM (zoning data)

3. **Competitive Landscape Analysis** (`competitive_landscape`)
   - Text: "Competitive Landscape Analysis - Evaluate existing data centers within 25-mile radius of Whitney"
   - Query: Competitor count, nearest competitor distance, competitive advantages
   - **Tool Relevance**: HIGH for SERP (competitor analysis)

#### **4. Question Display Logic**
**Location**: AIQuestionsSection.jsx Lines 683-726
**Rendering Code**:
```javascript
{EXECUTIVE_QUESTIONS.initial.map((question, index) => {
  const isHidden = aiState.selectedCard && aiState.selectedCard !== question.id;
  const isSelected = aiState.selectedCard === question.id;
  
  return (
    <div key={question.id}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleAIQuery(question);  // ← DIRECT CALL TO AI QUERY
        }}
        style={{
          // ... styling
        }}
      >
        {question.text}  // ← DISPLAYS QUESTION TEXT
      </button>
    </div>
  );
})}
```

### **Tool Context Enhancement Opportunities**

#### **1. Plus Button Questions Enhancement**
**Current Flow**: Plus Button → Show Questions → Click Question → `handleAIQuery(question)`
**Enhancement Needed**: Add tool context to questions before calling `handleAIQuery()`

**Proposed Enhancement Location**: AIQuestionsSection.jsx Line 704
```javascript
// CURRENT
handleAIQuery(question);

// ENHANCED
const enhancedQuestion = {
  ...question,
  suggestedTools: getToolSuggestionsForQuestion(question.id),
  toolPriority: getToolPriority(question.id),
  requiresTools: shouldUseTools(question.id)
};
handleAIQuery(enhancedQuestion);
```

#### **2. Question-to-Tool Mapping**
**Enhancement Location**: AIQuestionsSection.jsx Lines 8-25
**Add tool context to EXECUTIVE_QUESTIONS**:
```javascript
const EXECUTIVE_QUESTIONS = {
  initial: [
    {
      id: 'power_reliability',
      text: 'Power Grid Reliability - Analyze ERCOT grid stability...',
      query: '...',
      // ENHANCEMENTS:
      suggestedTools: ['SERP'],
      toolReason: 'Need real-time power infrastructure and utility data',
      toolPriority: 'high'
    },
    {
      id: 'competitive_landscape', 
      text: 'Competitive Landscape Analysis...',
      query: '...',
      // ENHANCEMENTS:
      suggestedTools: ['SERP'],
      toolReason: 'Need competitor data center locations and business intelligence',
      toolPriority: 'high'
    },
    {
      id: 'regulatory_timeline',
      text: 'Regulatory Approval Process...',
      query: '...',
      // ENHANCEMENTS:
      suggestedTools: ['OSM'],
      toolReason: 'Need zoning and land use data for regulatory context',
      toolPriority: 'medium'
    }
  ]
};
```

#### **3. Integration Points Summary**
**Plus Button Flow**:
1. **AskAnythingInput.jsx Line 81**: `onClick={onToggleSuggestions}`
2. **AIQuestionsSection.jsx Line 538**: `onToggleSuggestions={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}`
3. **AIQuestionsSection.jsx Line 58**: `const [isQuickQuestionsOpen, setIsQuickQuestionsOpen] = useState(false)`
4. **AIQuestionsSection.jsx Lines 676-726**: Questions display when `isQuickQuestionsOpen` is true
5. **AIQuestionsSection.jsx Line 704**: `handleAIQuery(question)` - **CRITICAL ENHANCEMENT POINT**

**Enhancement Strategy**: 
- Intercept at Line 704 to add tool context before calling `handleAIQuery()`
- Enhance `EXECUTIVE_QUESTIONS` structure with tool metadata
- Maintain backward compatibility by making tool enhancements optional

This analysis provides the exact code locations and flow for implementing tool-aware functionality in the Plus Button → Questions → AI Query pipeline.

---

This plan ensures a smooth, backward-compatible transition to an intelligent tool-aware system while preserving all existing functionality and providing clear migration paths.
