# Power Grid Reliability - Tool-Aware LLM Proof of Concept
## ✅ **COMPLETED IMPLEMENTATION** - Tactical Execution Plan

### 🎉 **POC STATUS: SUCCESSFULLY COMPLETED**

**✅ ALL OBJECTIVES ACHIEVED**: This document outlines the **successfully completed** implementation of tool-aware LLM functionality using the "Power Grid Reliability" question as a proof-of-concept. The implementation serves as a proven foundation for the broader tool-aware system outlined in `TOOL_AWARE_LLM_INTEGRATION_PLAN.md`.

**✅ SCOPE COMPLETED**: Single question implementation with SERP tool integration
**✅ TARGET ACHIEVED**: Power Grid Reliability question with intelligent SERP tool orchestration
**✅ GOAL ACHIEVED**: Demonstrated LLM → Tool Selection → Map Integration → Enhanced Response

### 🚀 **IMPLEMENTATION HIGHLIGHTS**

**✅ Core Features Delivered**:
- **Claude Tool-Aware Orchestration**: Claude 3.5 Sonnet successfully analyzes questions and decides when to use tools
- **Real SERP Integration**: Working integration with SERP API, processing both local_results and organic_results
- **Map Visualization**: Infrastructure markers appear on map with proper categorization and legend integration
- **Error Handling**: Robust fallback mechanisms for API failures and data format issues
- **Backward Compatibility**: All existing functionality preserved

**✅ Technical Architecture**:
- **useAIQuery.js**: New hook for AI query logic with tool orchestration
- **PowerGridToolExecutor.js**: Tool execution utility for Claude-initiated actions
- **AIResponseDisplay.jsx**: Dedicated response display component
- **Refactored BaseCard.jsx**: Cleaner separation of concerns using useAIQuery hook

**✅ User Experience**:
- User clicks "Power Grid Reliability" question
- Sees immediate text analysis from Claude
- If Claude decides tools are helpful, sees automatic tool execution
- Gets enhanced response combining Claude analysis + real infrastructure data
- Manual tool buttons (including Perplexity) still work independently

---

## 🎯 **TARGET QUESTION ANALYSIS**

### **Current Power Grid Reliability Question**
**Location**: AIQuestionsSection.jsx Lines 10-14
```javascript
{
  id: 'power_reliability',
  text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
  query: 'For the CyrusOne data center site in Whitney, TX (Bosque County), provide a brief executive summary in 3 sentences: What is the power grid reliability score (1-10), what is the main risk factor, and which grid operator manages this area?'
}
```

### **Tool Relevance Analysis**
**Primary Tool**: SERP API
**Reasoning**: Need real-time power infrastructure data, utility providers, and grid facilities
**Expected SERP Queries**:
- "power plants near Whitney TX"
- "electric utilities Bosque County Texas"
- "ERCOT transmission lines Whitney"
- "electrical substations Whitney TX"

**Secondary Tool**: OSM (Optional)
**Reasoning**: Geographic context for power infrastructure
**Expected OSM Data**: Power lines, electrical facilities, transmission infrastructure

---

## 🛠️ **IMPLEMENTATION STRATEGY**

### **Phase 1: Enhanced Prompt (Week 1)**
**Goal**: Modify the LLM prompt to include tool awareness for Power Grid question
**Scope**: Single question enhancement with fallback support

#### **1.1 Modify handleAIQuery Function**
**Location**: BaseCard.jsx Lines 626-650
**Current Prompt Enhancement**:
```javascript
// ENHANCED PROMPT for Power Grid Reliability question
if (questionData.id === 'power_reliability') {
  const toolAwarePrompt = `
You are an expert data center consultant analyzing power grid reliability for the CyrusOne site in Whitney, TX (Bosque County).

Available Tools:
- CLAUDE: Primary LLM for analysis and orchestration decisions (current system)
- SERP: Can search for power plants, utilities, transmission facilities near the site
- OSM: Can provide geographic context for power infrastructure
- PERPLEXITY: Available as alternative AI analysis tool in tool panel

Note: Claude 3.5 Sonnet serves as both the analysis engine AND the orchestrator for this POC.

User Question: ${questionData.query}

Instructions:
1. Provide your expert analysis in 3 sentences as requested
2. Determine if SERP tool would enhance this analysis with real-time infrastructure data
3. Respond in this JSON format:

{
  "textResponse": "Your 3-sentence expert analysis here",
  "useTools": true/false,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Why SERP is needed for this analysis",
      "queries": ["power plants", "electric utilities", "transmission facilities"]
    }
  ]
}

If you cannot provide JSON format, provide only the text analysis.
`;

  // Use enhanced prompt for power grid question
  systemContent = toolAwarePrompt;
} else {
  // Use existing prompt for other questions
  systemContent = questionData.isCustom ? 
    'You are an expert data center consultant analyzing the CyrusOne site in Whitney, TX (Bosque County)...' :
    'You are an expert data center consultant providing executive summaries for data center operations.';
}
```

#### **1.2 Add Response Parsing**
**Location**: BaseCard.jsx After Line 656
```javascript
// Try to parse JSON response for tool actions
let parsedResponse;
try {
  parsedResponse = JSON.parse(aiResponse);
  
  if (parsedResponse.textResponse && parsedResponse.toolActions) {
    console.log('✅ Received tool-aware response for Power Grid question');
    
    // Channel 1: Display text response immediately
    const formattedResponse = `## 🔋 Power Grid Reliability Analysis\n\n${parsedResponse.textResponse}`;
    updateResponseOnly(queryId, formattedResponse, citations, false);
    
    // Channel 2: Execute tool actions if requested
    if (parsedResponse.useTools && parsedResponse.toolActions.length > 0) {
      console.log('🛠️ LLM requested tool execution:', parsedResponse.toolActions);
      // TODO: Execute tools programmatically
    }
    
    return; // Exit early for tool-aware response
  }
} catch (parseError) {
  console.log('📝 Standard text response - continuing with normal flow');
  // Continue with existing text-only processing
}
```

### **Phase 2: Tool Execution (Week 2)**
**Goal**: Programmatically trigger SERP tool when LLM requests it

#### **2.1 Create Simple Tool Executor**
**New File**: `src/utils/PowerGridToolExecutor.js`
```javascript
// Simple tool executor for Power Grid POC
export const executePowerGridTools = async (toolActions, map, updateToolFeedback) => {
  for (const action of toolActions) {
    if (action.tool === 'SERP') {
      console.log('🔋 Executing SERP for Power Grid analysis:', action.queries);
      
      // Show feedback
      updateToolFeedback({
        isActive: true,
        tool: 'serp',
        status: '🔋 Analyzing power infrastructure...',
        progress: 50,
        details: `LLM-initiated search for: ${action.queries.join(', ')}`
      });
      
      // Trigger existing SERP functionality programmatically
      await triggerSerpWithCustomQueries(action.queries, map, updateToolFeedback);
    }
  }
};
```

#### **2.2 Integrate Tool Executor**
**Location**: BaseCard.jsx After parsing logic
```javascript
// Channel 2: Execute tool actions if requested
if (parsedResponse.useTools && parsedResponse.toolActions.length > 0) {
  console.log('🛠️ LLM requested tool execution for Power Grid question');
  
  // Import and execute tool actions
  const { executePowerGridTools } = await import('../utils/PowerGridToolExecutor');
  await executePowerGridTools(parsedResponse.toolActions, map, updateToolFeedback);
}
```

### **Phase 3: Enhanced Response (Week 3)**
**Goal**: Combine LLM analysis with tool results

#### **3.1 Tool Result Integration**
**Enhancement**: Update response after tool execution completes
```javascript
// Listen for SERP data completion
if (window.mapEventBus) {
  window.mapEventBus.on('serp:dataLoaded', (serpData) => {
    if (questionData.id === 'power_reliability') {
      // Enhance response with tool results
      const enhancedResponse = synthesizePowerGridResponse(
        parsedResponse.textResponse,
        serpData.features
      );
      
      updateResponseOnly(queryId, enhancedResponse, citations, false);
    }
  });
}
```

---

## 🔍 **DETAILED IMPLEMENTATION STEPS**

### **Step 1: Minimal Viable Enhancement**
**Time**: 2-3 hours
**Target**: Single question with enhanced prompt

#### **Code Changes Required**:

**1. BaseCard.jsx - handleAIQuery Enhancement**
**Location**: Lines 635-648
**Change Type**: Conditional prompt enhancement
```javascript
// BEFORE (Line 638-640)
content: questionData.isCustom ? 
  'You are an expert data center consultant...' : 
  'You are an expert data center consultant providing executive summaries...'

// AFTER (Enhanced)
content: getPowerGridPrompt(questionData)

// New function to add
const getPowerGridPrompt = (questionData) => {
  if (questionData.id === 'power_reliability') {
    return `You are an expert data center consultant with access to real-time infrastructure tools.

Available Tools:
- SERP: Search for power plants, utilities, transmission facilities
- OSM: Geographic power infrastructure mapping

Question: ${questionData.query}

Provide your analysis AND determine if tools would enhance it. Respond in JSON:
{
  "textResponse": "Your 3-sentence analysis",
  "useTools": true/false,
  "toolReason": "Why tools are/aren't needed"
}

If JSON fails, provide text only.`;
  }
  
  // Fallback to existing prompts
  return questionData.isCustom ? 
    'You are an expert data center consultant...' : 
    'You are an expert data center consultant providing executive summaries...';
};
```

### **Step 2: Response Detection**
**Time**: 1 hour
**Target**: Detect and parse JSON responses

**Location**: BaseCard.jsx After Line 656
```javascript
// Add JSON detection for Power Grid question
if (questionData.id === 'power_reliability') {
  try {
    const parsed = JSON.parse(aiResponse);
    if (parsed.textResponse) {
      console.log('✅ Power Grid tool-aware response received');
      console.log('🛠️ Tool usage decision:', parsed.useTools);
      console.log('💡 Tool reasoning:', parsed.toolReason);
      
      // Display enhanced response
      const enhancedResponse = `## 🔋 Power Grid Reliability Analysis\n\n${parsed.textResponse}\n\n---\n\n**Tool Analysis**: ${parsed.toolReason}`;
      updateResponseOnly(queryId, enhancedResponse, citations, false);
      return;
    }
  } catch (error) {
    console.log('📝 Standard response format - using existing flow');
  }
}

// Continue with existing processing for non-tool-aware responses
```

### **Step 3: Tool Execution Integration**
**Time**: 4-6 hours
**Target**: Programmatically trigger SERP when LLM requests it

#### **New Utility Functions**:

**1. Create PowerGridToolExecutor.js**
```javascript
// Minimal tool executor for POC
export const executePowerGridSERP = async (map, updateToolFeedback) => {
  console.log('🔋 Executing Power Grid SERP analysis...');
  
  // Show LLM-initiated tool feedback
  updateToolFeedback({
    isActive: true,
    tool: 'serp',
    status: '🔋 LLM-initiated power infrastructure analysis...',
    progress: 30,
    details: 'Searching for power plants and utilities near Whitney, TX'
  });
  
  // Get coordinates (hardcoded for POC)
  const coordinates = { lat: 31.9315, lng: -97.347 };
  
  // Custom power-focused SERP queries
  const powerQueries = [
    'power plants near Whitney TX',
    'electric utilities Bosque County Texas', 
    'electrical substations Whitney TX',
    'ERCOT transmission Whitney Texas'
  ];
  
  // Execute SERP with power-specific queries
  // (Reuse existing SERP infrastructure but with custom queries)
  return await executeSerpWithCustomQueries(powerQueries, coordinates, map, updateToolFeedback);
};
```

**2. Integrate with BaseCard**
```javascript
// In BaseCard.jsx after JSON parsing
if (parsed.useTools) {
  console.log('🛠️ LLM requested Power Grid tool execution');
  
  // Dynamic import for tool executor
  const { executePowerGridSERP } = await import('../utils/PowerGridToolExecutor');
  await executePowerGridSERP(map, updateToolFeedback);
}
```

---

## 🧪 **TESTING PLAN**

### **Test Case 1: Enhanced Prompt**
**Scenario**: Click "Power Grid Reliability" question
**Expected**: LLM provides analysis + tool decision in JSON format
**Fallback**: If JSON fails, standard text response works

### **Test Case 2: Tool Decision Logic**
**Scenario**: LLM decides tools are needed
**Expected**: SERP tool executes with power-specific queries
**Validation**: Tool feedback shows LLM-initiated execution

### **Test Case 3: Backward Compatibility**
**Scenario**: Manual SERP circle button click
**Expected**: Existing functionality unchanged
**Validation**: Original tool behavior preserved

### **Test Case 4: Error Handling**
**Scenario**: JSON parsing fails or tool execution errors
**Expected**: Graceful fallback to text-only response
**Validation**: No system crashes, user sees meaningful feedback

---

## 📊 **SUCCESS CRITERIA**

### **MVP Success Indicators**:
1. ✅ Power Grid question triggers enhanced Claude prompt
2. ✅ Claude responds with JSON including tool decision
3. ✅ When Claude requests tools, SERP executes automatically
4. ✅ Tool feedback shows "LLM-initiated" execution
5. ✅ Manual circle buttons continue working unchanged
6. ✅ Fallback to text-only response works if JSON fails
7. ✅ Perplexity tool available as blue circle option
8. ✅ Claude and Perplexity can be used independently

### **✅ IMPLEMENTATION STATUS: COMPLETE**
All MVP success indicators have been achieved and tested successfully.

### **User Experience Validation**:
- User clicks "Power Grid Reliability" question
- Sees immediate text analysis from Claude
- If Claude decides tools are helpful, sees tool execution feedback
- Gets enhanced response combining Claude analysis + real infrastructure data
- Manual tool buttons (including Perplexity) still work independently
- Can choose between Claude (BaseCard) and Perplexity (tool panel) for analysis

### **Technical Validation**:
- Claude 3.5 Sonnet successfully processes Power Grid question
- JSON response parsing works with Claude output
- SERP tool executes when Claude requests it
- Perplexity tool integrates seamlessly in NestedCircleButton
- All existing functionality preserved
- Performance maintained with new architecture

---

## 🔧 **IMPLEMENTATION CHECKLIST**

### **Week 1: Foundation (3-4 hours) - ✅ COMPLETED**
- [x] Create `getPowerGridPrompt()` function in BaseCard.jsx for Claude
- [x] Add conditional prompt logic for power_reliability question
- [x] Test enhanced Claude prompt generates JSON responses
- [x] Add JSON parsing with fallback to existing flow
- [x] Validate Claude API integration and backward compatibility

### **Week 2: Tool Integration (6-8 hours) - ✅ COMPLETED**
- [x] Create PowerGridToolExecutor.js utility
- [x] Implement `executePowerGridSERP()` function
- [x] Integrate tool executor with Claude-based BaseCard.jsx
- [x] Add LLM-initiated tool feedback messages
- [x] Test Claude → Tool orchestration workflow
- [x] Verify Perplexity tool integration in NestedCircleButton

### **Week 3: Enhancement & Testing (4-6 hours) - ✅ COMPLETED**
- [x] Add tool result synthesis to Claude response
- [x] Enhance tool feedback for multi-stage operations
- [x] Test Claude vs Perplexity analysis capabilities
- [x] Comprehensive testing of all scenarios
- [x] Performance optimization and error handling
- [x] Documentation and code cleanup

---

## 🎪 **EXPECTED WORKFLOW**

### **✅ IMPLEMENTED Power Grid Question Flow**:
```
1. User clicks "Power Grid Reliability" question
   ↓
2. useAIQuery hook detects power_reliability ID
   ↓
3. Enhanced Claude prompt sent with tool context
   ↓
4. Claude responds with JSON: text analysis + tool decision
   ↓
5. AIResponseDisplay shows text response immediately
   ↓
6. PowerGridToolExecutor executes SERP with Claude's queries
   ↓
7. Tool feedback shows "Claude-initiated SERP analysis"
   ↓
8. SERP finds power infrastructure data and adds to map
   ↓
9. Legend updates with SERP infrastructure categories
   ↓
10. ✅ WORKFLOW COMPLETE - Both analysis AND map visualization
```

### **Alternative Analysis Workflow**:
```
1. User clicks Perplexity (blue circle) in tool panel
   ↓
2. PerplexityCall component executes independent analysis
   ↓
3. Perplexity provides alternative AI insights
   ↓
4. Results displayed alongside Claude analysis
   ↓
5. User can compare Claude vs Perplexity perspectives
```

### **Fallback Workflow**:
```
1. User clicks "Power Grid Reliability" question
   ↓
2. Enhanced Claude prompt sent
   ↓
3. Claude responds with plain text (not JSON)
   ↓
4. System detects non-JSON response
   ↓
5. Falls back to existing text-only processing
   ↓
6. User sees standard Claude response (no tools executed)
   ↓
7. Manual tool buttons (including Perplexity) remain available
```

---

## 🔍 **TECHNICAL SPECIFICATIONS**

### **Code Locations for Changes**

#### **1. BaseCard.jsx Enhancements**
**Lines 626-650**: Add conditional prompt logic for Claude API
**After Line 656**: Add JSON response parsing
**New Function**: `getPowerGridPrompt(questionData)`

**Current API Integration**:
- **Provider**: Claude 3.5 Sonnet (2024-10-22 model)
- **Endpoint**: `http://localhost:3001/api/claude`
- **Model**: `claude-3-5-sonnet-20241022`
- **Max Tokens**: 2000
- **System Prompt**: Data center consultant role

#### **2. New Utility File**
**File**: `src/utils/PowerGridToolExecutor.js`
**Functions**:
- `executePowerGridSERP(map, updateToolFeedback)`
- `executeSerpWithCustomQueries(queries, coordinates, map, updateToolFeedback)`

#### **3. Tool Integration Points**
**Location**: NestedCircleButton.jsx Lines 650-726
**Perplexity Tool**: Blue circle button with PerplexityCall component
**Status**: Available for manual tool selection and future orchestration
**Integration**: Ready for tool-aware LLM coordination

#### **4. Tool Feedback Enhancements**
**Location**: AIQuestionsSection.jsx Lines 146-148
**Enhancement**: Add "LLM-initiated" indicator
```javascript
// Current
{toolFeedback.tool === 'serp' ? 'SERP Infrastructure' : 'Tool'}

// Enhanced
{toolFeedback.tool === 'serp' ? 
  (toolFeedback.isLLMInitiated ? 'LLM → SERP Infrastructure' : 'SERP Infrastructure') : 
  'Tool'}
```

### **Current System Architecture**

#### **AI Providers**:
1. **Claude 3.5 Sonnet** (BaseCard.jsx)
   - Primary AI provider for question analysis
   - Handles executive summaries and custom queries
   - Ready for tool-aware orchestration
   - Local proxy server integration

2. **Perplexity AI** (NestedCircleButton.jsx)
   - Available as blue circle tool option
   - Alternative AI analysis capabilities
   - Ready for future orchestration integration
   - Manual tool selection available

#### **Tool Panel**:
- **OSM** (Green): Geographic data and site analysis
- **SERP** (Purple): Infrastructure and business intelligence
- **AlphaEarth** (Red): Environmental and satellite analysis
- **Firecrawl** (Orange): Web crawling and content extraction
- **Perplexity** (Blue): AI analysis and insights
- **Clear** (Gray): Map data management

#### **Integration Points**:
- **BaseCard.handleAIQuery()**: Claude-based question processing
- **NestedCircleButton**: Tool selection and execution
- **Tool Feedback System**: Progress tracking and user communication
- **Map Integration**: Visual data display and interaction

---

## 🚀 **IMPLEMENTATION PRIORITIES**

### **Priority 1: Core Functionality (Must Have)**
1. Enhanced prompt for Power Grid question
2. JSON response parsing with fallback
3. Basic tool execution when LLM requests it
4. Backward compatibility preservation

### **Priority 2: User Experience (Should Have)**
1. Enhanced tool feedback for LLM-initiated actions
2. Tool result integration with text response
3. Error handling and recovery
4. Performance optimization

### **Priority 3: Advanced Features (Nice to Have)**
1. Dynamic SERP query generation based on LLM analysis
2. OSM integration for geographic context
3. Multi-tool coordination
4. Advanced response synthesis

---

## ⚠️ **RISK MITIGATION**

### **Technical Risks**
1. **JSON Parsing Failures**: 
   - **Mitigation**: Robust fallback to text-only processing
   - **Test**: Deliberately malformed JSON responses

2. **Tool Execution Errors**:
   - **Mitigation**: Continue with text response if tools fail
   - **Test**: Network failures, API errors

3. **Performance Impact**:
   - **Mitigation**: Asynchronous tool execution
   - **Test**: Response time measurements

### **User Experience Risks**
1. **Confusion from New Behavior**:
   - **Mitigation**: Clear feedback when tools are LLM-initiated
   - **Test**: User testing with tool-aware responses

2. **Broken Existing Functionality**:
   - **Mitigation**: Extensive backward compatibility testing
   - **Test**: All existing question types and manual tools

---

## 📈 **SUCCESS METRICS FOR POC**

### **Functional Success**:
- [ ] Power Grid question generates enhanced prompt
- [ ] LLM provides JSON response with tool decision
- [ ] SERP executes when LLM requests it
- [ ] Tool feedback shows LLM-initiated status
- [ ] Map displays power infrastructure data
- [ ] All other questions work unchanged

### **Quality Success**:
- [ ] Enhanced response quality for Power Grid question
- [ ] Relevant power infrastructure data on map
- [ ] Smooth user experience with clear feedback
- [ ] No performance degradation
- [ ] Error-free operation under normal conditions

### **Technical Success**:
- [ ] Clean, maintainable code
- [ ] Proper error handling and fallbacks
- [ ] Minimal impact on existing codebase
- [ ] Clear path for expanding to other questions
- [ ] Comprehensive logging and debugging

---

## 🎯 **NEXT STEPS AFTER POC**

### **✅ POC SUCCESSFULLY COMPLETED**:
The Power Grid Reliability POC has been successfully implemented and tested. All core functionality is working:

1. ✅ **Claude Tool-Aware Orchestration**: Claude successfully analyzes questions and decides when to use tools
2. ✅ **SERP Integration**: Real SERP API integration with both local_results and organic_results processing
3. ✅ **Map Visualization**: Infrastructure markers appear on map with proper categorization
4. ✅ **Legend Integration**: SERP data properly integrated with map legend system
5. ✅ **Error Handling**: Robust fallback mechanisms for API failures and data format issues
6. ✅ **Backward Compatibility**: All existing functionality preserved

### **🚀 RECOMMENDED NEXT STEPS**:
1. **Expand to Additional Questions**: Apply tool-aware pattern to "Competitive Landscape" and "Regulatory Timeline" questions
2. **Multi-Tool Coordination**: Implement OSM + SERP + Firecrawl coordination for comprehensive analysis
3. **Advanced Response Synthesis**: Combine multiple tool results into enhanced responses
4. **Performance Optimization**: Add caching and parallel tool execution
5. **Full System Rollout**: Apply pattern across all AI questions in the system

### **📈 SUCCESS METRICS ACHIEVED**:
- ✅ **Functional Success**: All core features working as designed
- ✅ **Quality Success**: Enhanced response quality with real infrastructure data
- ✅ **Technical Success**: Clean, maintainable code with proper error handling
- ✅ **User Experience**: Smooth workflow with clear feedback and map visualization

---

## 📚 **REFERENCE DOCUMENTATION**

### **✅ IMPLEMENTED FILES**:
- `TOOL_AWARE_LLM_INTEGRATION_PLAN.md` - Main integration strategy
- `src/hooks/useAIQuery.js` - ✅ **NEW**: Extracted AI query logic with tool-aware orchestration
- `src/utils/PowerGridToolExecutor.js` - ✅ **NEW**: Tool execution utility for Claude-initiated tools
- `src/components/Map/components/Cards/BaseCard.jsx` - ✅ **REFACTORED**: Now uses useAIQuery hook
- `src/components/Map/components/Cards/AIResponseDisplay.jsx` - ✅ **NEW**: Dedicated response display component
- `src/components/Map/components/Cards/SerpAPI.jsx` - Tool integration (working with real SERP API)
- `src/components/Map/components/Cards/AIQuestionsSection.jsx` - Question source
- `src/components/Map/components/Cards/NestedCircleButton.jsx` - Tool panel (including Perplexity)
- `src/components/Map/components/Cards/PerplexityCall.jsx` - Perplexity tool integration

### **✅ KEY IMPLEMENTED FUNCTIONS**:
- `useAIQuery.handleAIQuery()` - ✅ **NEW**: Main AI query logic with tool orchestration
- `PowerGridToolExecutor.executePowerGridTools()` - ✅ **NEW**: Claude-initiated tool execution
- `PowerGridToolExecutor.executeSERP()` - ✅ **NEW**: SERP tool execution with real API
- `AIResponseDisplay.renderResponse()` - ✅ **NEW**: Enhanced response display
- `updateToolFeedback()` - Feedback system integration (working)
- `PerplexityCall.onClick()` - Perplexity tool execution (working)

### **✅ IMPLEMENTED Architecture Summary**:
- **useAIQuery.js**: ✅ **NEW**: Claude 3.5 Sonnet with tool-aware orchestration
- **PowerGridToolExecutor.js**: ✅ **NEW**: Tool execution utility for Claude-initiated actions
- **BaseCard.jsx**: ✅ **REFACTORED**: Now uses useAIQuery hook for cleaner separation
- **AIResponseDisplay.jsx**: ✅ **NEW**: Dedicated response display component
- **NestedCircleButton.jsx**: Tool panel with OSM, SERP, AlphaEarth, Firecrawl, Perplexity
- **API Integration**: Claude via local proxy server, SERP via Express server, Perplexity as tool option
- **Tool Orchestration**: ✅ **IMPLEMENTED**: Claude → Tool coordination working
- **User Experience**: Choice between Claude (BaseCard) and Perplexity (tool panel)

### **✅ COMPLETED Integration Points**:
1. ✅ **Claude Prompt Enhancement**: Tool-aware instructions added to Power Grid question
2. ✅ **JSON Response Parsing**: Claude's tool decisions parsed and executed
3. ✅ **Tool Execution**: SERP triggers automatically when Claude requests it
4. ✅ **Perplexity Integration**: Tool panel functionality verified and working
5. ✅ **Tool Feedback**: Claude-initiated tool execution feedback implemented
6. ✅ **Result Synthesis**: Claude analysis combined with SERP infrastructure data
7. ✅ **Map Integration**: SERP data displayed as markers with legend integration
8. ✅ **Error Handling**: Robust fallback mechanisms for API failures

---

## 🧠 **ORCHESTRATION STRATEGY DECISION**

### **Question: Should we use Claude as main orchestrator or stick with Perplexity?**

**ANSWER: Use Claude for POC, Perplexity Available as Tool Option**

#### **For Current POC Implementation: Claude 3.5 Sonnet (Current System)**
**Reasoning**:
1. **Already Integrated**: Current system uses Claude 3.5 Sonnet in BaseCard
2. **Sufficient for POC**: Can handle JSON responses and basic tool decisions
3. **Lower Risk**: Minimal changes to existing codebase
4. **Faster Implementation**: No new API integration required
5. **Proven Reliability**: Current system is stable with Claude

**Architecture**:
```
User Question → Claude 3.5 Sonnet (Orchestrator + Analyst) → Tool Decision → SERP/OSM → Map
```

#### **Perplexity AI: Available as Tool Option**
**Current Status**: Perplexity is now available as a blue circle button in NestedCircleButton
**Purpose**: Provides alternative AI analysis capabilities alongside Claude
**Integration**: Available for manual tool selection and future tool-aware orchestration
**Benefits**: 
- Alternative AI provider for comparison
- Different analysis perspectives
- Backup analysis capabilities
- Future orchestration potential

#### **For Future Production: Enhanced Claude + Perplexity Coordination**
**Reasoning**:
1. **Claude Orchestration**: Superior function calling and tool coordination
2. **Perplexity Specialization**: Domain-specific analysis capabilities
3. **Hybrid Approach**: Best of both worlds for complex workflows
4. **Tool Diversity**: Multiple AI perspectives for comprehensive analysis

**Future Architecture**:
```
User Question → Claude 3.5 (Orchestrator) → Claude Analysis + Perplexity Analysis + SERP + OSM → Synthesis
```

### **✅ POC Decision: Claude as Primary Orchestrator - SUCCESSFULLY IMPLEMENTED**

**For the Power Grid Reliability POC**, we successfully used **Claude 3.5 Sonnet as both the analyst AND orchestrator** because:

1. ✅ **Minimal Risk**: Built on existing, working system
2. ✅ **Faster Validation**: Successfully tested tool-aware concept immediately
3. ✅ **Incremental Enhancement**: Easy to add Perplexity coordination later
4. ✅ **Proven Foundation**: Current Claude integration is stable

**✅ IMPLEMENTED**: Claude now:
- ✅ Analyzes the power grid question with enhanced tool-aware prompts
- ✅ Decides if SERP tool would enhance the analysis
- ✅ Provides both text response AND tool instructions in JSON format
- ✅ Coordinates tool execution through PowerGridToolExecutor

**✅ Perplexity Integration**: Available as manual tool option for:
- ✅ Alternative analysis perspectives
- ✅ Comparison with Claude responses
- ✅ Future orchestration experiments
- ✅ User choice between AI providers

**✅ RESULT**: Successfully validated the tool-aware concept while maintaining access to Perplexity's capabilities through the tool panel.

---

## 🔧 **TECHNICAL IMPLEMENTATION DETAILS**

### **1. JSON Schema for Claude Tool-Aware Responses**

#### **1.1 Expected Response Format**
```json
{
  "textResponse": "Your 3-sentence expert analysis here",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Why SERP is needed for this analysis",
      "queries": ["power plants", "electric utilities", "transmission facilities"],
      "priority": "high",
      "expectedOutcome": "Real-time power infrastructure data near Whitney site"
    }
  ],
  "metadata": {
    "confidence": 0.95,
    "reasoning": "Power grid analysis requires current infrastructure data",
    "fallback": "If tools fail, provide analysis based on general ERCOT knowledge"
  }
}
```

#### **1.2 Schema Validation Rules**
- **textResponse**: Required string, minimum 50 characters
- **useTools**: Required boolean
- **toolActions**: Array, required if useTools is true
- **tool**: Must be one of ["SERP", "OSM", "ALPHAEARTH"]
- **queries**: Array of strings, minimum 1 query
- **priority**: Optional string ["low", "medium", "high"]
- **metadata**: Optional object for additional context

#### **1.3 Fallback Response Format**
```json
{
  "textResponse": "Your analysis without tools",
  "useTools": false,
  "reason": "Tools not needed for this analysis type"
}
```

### **2. Error Handling & Resilience**

#### **2.1 JSON Parsing Failures**
```javascript
// BaseCard.jsx - Enhanced error handling
try {
  const parsedResponse = JSON.parse(aiResponse);
  
  if (parsedResponse.textResponse && parsedResponse.toolActions) {
    // Process tool-aware response
    return await processToolAwareResponse(parsedResponse, questionData);
  } else {
    // Valid JSON but missing required fields
    console.warn('Incomplete tool-aware response:', parsedResponse);
    return await processFallbackResponse(aiResponse, questionData);
  }
} catch (parseError) {
  console.warn('JSON parsing failed, using fallback:', parseError);
  return await processFallbackResponse(aiResponse, questionData);
}
```

#### **2.2 Tool Execution Failures**
```javascript
// PowerGridToolExecutor.js - Resilience pattern
const executePowerGridTools = async (toolActions, map, updateToolFeedback) => {
  const results = [];
  const errors = [];
  
  for (const action of toolActions) {
    try {
      const result = await executeSingleTool(action, map, updateToolFeedback);
      results.push({ tool: action.tool, success: true, data: result });
    } catch (error) {
      console.error(`Tool ${action.tool} failed:`, error);
      errors.push({ tool: action.tool, error: error.message });
      
      // Continue with other tools even if one fails
      updateToolFeedback({
        isActive: true,
        tool: action.tool,
        status: `❌ ${action.tool} execution failed`,
        progress: 100,
        details: `Error: ${error.message}. Continuing with other tools...`
      });
    }
  }
  
  return { results, errors, hasFailures: errors.length > 0 };
};
```

#### **2.3 Claude API Failure Handling**
```javascript
// BaseCard.jsx - API resilience
const handleAIQuery = async (questionData) => {
  try {
    // Primary Claude API call
    const response = await fetch('http://localhost:3001/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Claude API Error ${response.status}`);
    }
    
    return await processClaudeResponse(response);
  } catch (error) {
    console.error('Claude API failed:', error);
    
    // Fallback to Perplexity if available
    if (window.perplexityAvailable) {
      console.log('🔄 Falling back to Perplexity tool...');
      return await fallbackToPerplexity(questionData);
    }
    
    // Final fallback to cached response or error message
    return await handleCompleteFailure(questionData, error);
  }
};
```

### **3. Tool Integration Specifications**

#### **3.1 SERP Tool Integration**
```javascript
// PowerGridToolExecutor.js - SERP integration
const executePowerGridSERP = async (map, updateToolFeedback) => {
  // Step 1: Initialize tool feedback
  updateToolFeedback({
    isActive: true,
    tool: 'serp',
    status: '🔋 Initializing power infrastructure analysis...',
    progress: 10,
    details: 'Preparing SERP queries for Whitney, TX area'
  });
  
  // Step 2: Define power-specific queries
  const powerQueries = [
    'power plants near Whitney TX',
    'electric utilities Bosque County Texas',
    'electrical substations Whitney TX',
    'ERCOT transmission Whitney Texas',
    'power grid reliability Bosque County'
  ];
  
  // Step 3: Execute SERP with custom queries
  const serpResults = await executeSerpWithCustomQueries(
    powerQueries, 
    { lat: 31.9315, lng: -97.347 }, // Whitney coordinates
    map, 
    updateToolFeedback
  );
  
  // Step 4: Process and categorize results
  const categorizedResults = categorizePowerInfrastructure(serpResults);
  
  // Step 5: Update map with results
  await addPowerInfrastructureToMap(categorizedResults, map);
  
  return {
    success: true,
    data: categorizedResults,
    mapLayers: ['serp-power-infrastructure', 'serp-search-radius']
  };
};
```

#### **3.2 Map Integration Details**
```javascript
// Map integration utilities
const addPowerInfrastructureToMap = async (infrastructureData, map) => {
  // Add search radius visualization
  const searchRadius = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-97.347, 31.9315]
    },
    properties: {
      radius: 3, // 3-mile radius
      tool: 'serp',
      query: 'power infrastructure'
    }
  };
  
  // Add infrastructure markers
  const markers = infrastructureData.map(facility => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [facility.longitude, facility.latitude]
    },
    properties: {
      name: facility.name,
      type: facility.category,
      rating: facility.rating,
      address: facility.address,
      tool: 'serp'
    }
  }));
  
  // Update map sources and layers
  if (map.current) {
    // Add or update sources
    if (map.current.getSource('serp-power-infrastructure')) {
      map.current.getSource('serp-power-infrastructure').setData({
        type: 'FeatureCollection',
        features: markers
      });
    } else {
      map.current.addSource('serp-power-infrastructure', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: markers }
      });
    }
    
    // Add or update layers
    if (!map.current.getLayer('serp-power-markers')) {
      map.current.addLayer({
        id: 'serp-power-markers',
        type: 'circle',
        source: 'serp-power-infrastructure',
        paint: {
          'circle-radius': 8,
          'circle-color': '#8b5cf6',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
    }
  }
};
```

### **4. Performance & Optimization**

#### **4.1 Response Time Targets**
- **Claude API**: < 5 seconds for tool-aware responses
- **Tool Execution**: < 10 seconds for SERP data retrieval
- **Map Updates**: < 2 seconds for visualization
- **Total User Experience**: < 15 seconds end-to-end

#### **4.2 Caching Strategy**
```javascript
// Enhanced caching for tool-aware responses
const cacheKey = `power_grid_${questionData.id}_${Date.now()}`;
const cacheData = {
  claudeResponse: aiResponse,
  toolResults: toolExecutionResults,
  mapState: currentMapState,
  timestamp: Date.now(),
  ttl: 300000 // 5 minutes
};

setResponseCache(prev => ({
  ...prev,
  [cacheKey]: cacheData
}));
```

#### **4.3 Async Tool Execution**
```javascript
// Parallel tool execution for multiple tools
const executeMultipleTools = async (toolActions, map, updateToolFeedback) => {
  const toolPromises = toolActions.map(action => 
    executeSingleTool(action, map, updateToolFeedback)
  );
  
  try {
    const results = await Promise.allSettled(toolPromises);
    return results.map((result, index) => ({
      tool: toolActions[index].tool,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : result.reason
    }));
  } catch (error) {
    console.error('Multiple tool execution failed:', error);
    throw error;
  }
};
```

### **5. Monitoring & Debugging**

#### **5.1 Comprehensive Logging**
```javascript
// Enhanced logging for tool-aware operations
const logToolAwareOperation = (operation, data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    data,
    sessionId: window.sessionId || 'unknown',
    userId: window.userId || 'anonymous'
  };
  
  console.log('🔧 Tool-Aware Operation:', logEntry);
  
  // Send to monitoring service if available
  if (window.monitoringService) {
    window.monitoringService.log('tool_aware_operation', logEntry);
  }
};
```

#### **5.2 Performance Monitoring**
```javascript
// Performance tracking for tool orchestration
const trackToolOrchestrationPerformance = async (operation) => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    // Track performance metrics
    window.performanceMetrics = window.performanceMetrics || {};
    window.performanceMetrics.toolOrchestration = window.performanceMetrics.toolOrchestration || [];
    window.performanceMetrics.toolOrchestration.push({
      operation: operation.name,
      duration,
      success: true,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Track error performance
    window.performanceMetrics.toolOrchestration.push({
      operation: operation.name,
      duration,
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
    
    throw error;
  }
};
```

### **6. Security & Validation**

#### **6.1 Input Validation**
```javascript
// Validate tool actions before execution
const validateToolActions = (toolActions) => {
  const allowedTools = ['SERP', 'OSM', 'ALPHAEARTH'];
  const allowedQueryTypes = ['power', 'infrastructure', 'geographic', 'environmental'];
  
  return toolActions.every(action => {
    // Validate tool name
    if (!allowedTools.includes(action.tool)) {
      throw new Error(`Invalid tool: ${action.tool}`);
    }
    
    // Validate queries
    if (!Array.isArray(action.queries) || action.queries.length === 0) {
      throw new Error(`Invalid queries for tool ${action.tool}`);
    }
    
    // Validate query content
    const validQueries = action.queries.every(query => 
      typeof query === 'string' && query.length > 0 && query.length < 200
    );
    
    if (!validQueries) {
      throw new Error(`Invalid query content for tool ${action.tool}`);
    }
    
    return true;
  });
};
```

#### **6.2 Rate Limiting**
```javascript
// Rate limiting for tool execution
const toolExecutionRateLimiter = {
  lastExecution: {},
  minInterval: 2000, // 2 seconds between tool executions
  
  canExecute: function(toolName) {
    const now = Date.now();
    const lastTime = this.lastExecution[toolName] || 0;
    
    if (now - lastTime < this.minInterval) {
      return false;
    }
    
    this.lastExecution[toolName] = now;
    return true;
  }
};
```

---

## 🎯 **IMPLEMENTATION PRIORITIES**

### **Priority 1: Core Functionality (Must Have)**
1. Enhanced prompt for Power Grid question
2. JSON response parsing with fallback
3. Basic tool execution when LLM requests it
4. Backward compatibility preservation

### **Priority 2: User Experience (Should Have)**
1. Enhanced tool feedback for LLM-initiated actions
2. Tool result integration with text response
3. Error handling and recovery
4. Performance optimization

### **Priority 3: Advanced Features (Nice to Have)**
1. Dynamic SERP query generation based on LLM analysis
2. OSM integration for geographic context
3. Multi-tool coordination
4. Advanced response synthesis

---

## 🛠️ **AVAILABLE TOOLS FOR ORCHESTRATION**

### **1. OSM Tool (OpenStreetMap) - Green Circle**

#### **Current Capabilities**
- **Purpose**: Geographic data and site boundary analysis
- **Input**: Coordinates (lat/lng) for specific location
- **Process**: Perplexity API for coordinates → Overpass API → GeoJSON processing
- **Output**: Geographic features (buildings, roads, waterways, POIs, land use)
- **Search Radius**: 6km (hardcoded for Bosque County site)
- **Data Structure**: GeoJSON with categorized features

#### **Power Grid Relevance**
- **Primary Use**: Geographic context for power infrastructure
- **Expected Data**: Power lines, electrical facilities, transmission infrastructure
- **Site Analysis**: Data center site boundaries and surrounding geography
- **Zoning Context**: Land use patterns and regulatory context

#### **Orchestration Integration**
```javascript
// OSM tool orchestration example
{
  "tool": "OSM",
  "reason": "Need geographic context for power infrastructure analysis",
  "queries": ["power lines", "electrical facilities", "transmission infrastructure"],
  "coordinates": { "lat": 31.9315, "lng": -97.347 },
  "radius": 6,
  "expectedOutcome": "Geographic features and power infrastructure mapping"
}
```

#### **Enhancement Opportunities**
- **Dynamic Radius**: Adjust search radius based on question context
- **Custom POI Searches**: Target specific infrastructure types
- **Multi-Site Analysis**: Compare multiple data center locations
- **Historical Data**: Track infrastructure changes over time

---

### **2. SERP Tool (Search Engine Results) - Purple Circle**

#### **Current Capabilities**
- **Purpose**: Infrastructure and business intelligence search
- **Input**: Coordinates + predefined infrastructure queries
- **Process**: Perplexity API for coordinates → Multiple Google searches → Business data
- **Output**: Infrastructure facilities with ratings, addresses, contact info
- **Search Radius**: 3 miles (hardcoded)
- **Categories**: Power plants, data centers, utilities, industrial facilities

#### **Power Grid Relevance**
- **Primary Use**: Real-time power infrastructure data
- **Expected Queries**: 
  - "power plants near Whitney TX"
  - "electric utilities Bosque County Texas"
  - "ERCOT transmission lines Whitney"
  - "electrical substations Whitney TX"
- **Business Intelligence**: Competitor analysis, vendor discovery, market research

#### **Orchestration Integration**
```javascript
// SERP tool orchestration example
{
  "tool": "SERP",
  "reason": "Require real-time power infrastructure data for reliability analysis",
  "queries": [
    "power plants near Whitney TX",
    "electric utilities Bosque County Texas",
    "electrical substations Whitney TX",
    "ERCOT transmission Whitney Texas"
  ],
  "coordinates": { "lat": 31.9315, "lng": -97.347 },
  "radius": 3,
  "expectedOutcome": "Current power infrastructure facilities and ratings"
}
```

#### **Enhancement Opportunities**
- **Dynamic Queries**: Generate queries based on LLM analysis
- **Custom Search Radius**: Adjust based on infrastructure density
- **Category Filtering**: Focus on specific infrastructure types
- **Real-time Updates**: Monitor infrastructure changes

---

### **3. Perplexity Tool (AI Analysis) - Blue Circle**

#### **Current Capabilities**
- **Purpose**: Alternative AI analysis and insights
- **Input**: User questions or analysis requests
- **Process**: Perplexity AI API → Structured analysis → Insights
- **Output**: AI-generated analysis, recommendations, insights
- **Model**: Perplexity sonar-pro (available as tool option)
- **Integration**: Available in NestedCircleButton tool panel

#### **Power Grid Relevance**
- **Primary Use**: Alternative power grid analysis perspective
- **Expected Analysis**: 
  - Power grid reliability assessment
  - ERCOT grid stability analysis
  - Risk factor identification
  - Competitive landscape insights
- **Comparison Value**: Different perspective from Claude analysis

#### **Orchestration Integration**
```javascript
// Perplexity tool orchestration example
{
  "tool": "PERPLEXITY",
  "reason": "Alternative AI analysis for power grid reliability comparison",
  "queries": [
    "ERCOT grid stability Whitney TX 2024",
    "power grid reliability Bosque County Texas",
    "data center power requirements Whitney"
  ],
  "expectedOutcome": "Alternative AI perspective on power grid analysis",
  "comparison": "Compare with Claude analysis for comprehensive insights"
}
```

#### **Enhancement Opportunities**
- **Specialized Analysis**: Domain-specific power grid expertise
- **Real-time Data**: Access to current power grid information
- **Comparative Insights**: Side-by-side analysis with Claude
- **Specialized Queries**: Power industry-specific knowledge

---

### **4. Firecrawl Tool (Web Crawling) - Orange Circle**

#### **Current Capabilities**
- **Purpose**: Web crawling and content extraction
- **Input**: URLs or search queries for web content
- **Process**: Web crawling → Content extraction → Structured data
- **Output**: Extracted web content, articles, reports, data
- **Scope**: Public web content and accessible resources
- **Integration**: Available in NestedCircleButton tool panel

#### **Power Grid Relevance**
- **Primary Use**: Real-time power grid information and reports
- **Expected Content**:
  - ERCOT grid status reports
  - Power outage information
  - Regulatory updates
  - Industry news and analysis
- **Data Sources**: Government websites, utility reports, industry news

#### **Orchestration Integration**
```javascript
// Firecrawl tool orchestration example
{
  "tool": "FIRECRAWL",
  "reason": "Extract real-time power grid status and regulatory information",
  "queries": [
    "ERCOT grid status Whitney TX",
    "Bosque County power outages",
    "Texas power grid reliability reports",
    "ERCOT transmission capacity updates"
  ],
  "expectedOutcome": "Current power grid status and regulatory information",
  "dataTypes": ["status reports", "outage data", "regulatory updates", "industry news"]
}
```

#### **Enhancement Opportunities**
- **Real-time Monitoring**: Continuous power grid status updates
- **Regulatory Tracking**: Monitor permit and approval changes
- **Industry Intelligence**: Track power industry developments
- **Document Analysis**: Process PDF reports and regulatory documents

---

## 🔄 **TOOL ORCHESTRATION STRATEGIES**

### **Single Tool Orchestration**
```javascript
// Power Grid question with SERP tool only
{
  "textResponse": "Power grid reliability analysis...",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Need current power infrastructure data",
      "queries": ["power plants", "electric utilities"],
      "priority": "high"
    }
  ]
}
```

### **Multi-Tool Orchestration**
```javascript
// Power Grid question with multiple tools
{
  "textResponse": "Comprehensive power grid analysis...",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Current power infrastructure data",
      "queries": ["power plants", "electric utilities"],
      "priority": "high"
    },
    {
      "tool": "OSM",
      "reason": "Geographic context for infrastructure",
      "queries": ["power lines", "electrical facilities"],
      "priority": "medium"
    },
    {
      "tool": "FIRECRAWL",
      "reason": "Real-time grid status and regulatory updates",
      "queries": ["ERCOT status", "power outages"],
      "priority": "medium"
    }
  ]
}
```

### **Tool Comparison Orchestration**
```javascript
// Power Grid question with AI comparison
{
  "textResponse": "AI-powered power grid analysis...",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Infrastructure data for analysis",
      "queries": ["power infrastructure"],
      "priority": "high"
    },
    {
      "tool": "PERPLEXITY",
      "reason": "Alternative AI analysis for comparison",
      "queries": ["power grid reliability analysis"],
      "priority": "medium"
    }
  ]
}
```

---

## 📊 **TOOL SELECTION LOGIC**

### **Question-Based Tool Selection**
| Question Type | Primary Tool | Secondary Tools | Reasoning |
|---------------|--------------|-----------------|-----------|
| **Power Grid Reliability** | SERP | OSM, FIRECRAWL | Need infrastructure data + geographic context + real-time status |
| **Regulatory Approval** | FIRECRAWL | OSM | Need regulatory updates + zoning context |
| **Competitive Landscape** | SERP | FIRECRAWL | Need competitor data + industry news |
| **Site Analysis** | OSM | SERP | Need geographic features + nearby infrastructure |
| **Environmental Impact** | OSM | FIRECRAWL | Need land use data + environmental reports |

### **Tool Priority Matrix**
| Tool | Power Grid | Regulatory | Competitive | Site | Environmental |
|------|------------|------------|-------------|------|---------------|
| **SERP** | 🔴 High | 🟡 Medium | 🔴 High | 🟡 Medium | 🟡 Medium |
| **OSM** | 🟡 Medium | 🟡 Medium | 🟡 Low | 🔴 High | 🔴 High |
| **PERPLEXITY** | 🟡 Medium | 🟡 Medium | 🟡 Medium | 🟡 Low | 🟡 Low |
| **FIRECRAWL** | 🟡 Medium | 🔴 High | 🟡 Medium | 🟡 Low | 🟡 Medium |

**Legend**: 🔴 High Priority | 🟡 Medium Priority | 🟡 Low Priority

---

## 🎯 **IMPLEMENTATION CHECKLIST**

### **Week 1: Foundation (3-4 hours)**
- [ ] Create `getPowerGridPrompt()` function in BaseCard.jsx for Claude
- [ ] Add conditional prompt logic for power_reliability question
- [ ] Test enhanced Claude prompt generates JSON responses
- [ ] Add JSON parsing with fallback to existing flow
- [ ] Validate Claude API integration and backward compatibility

### **Week 2: Tool Integration (6-8 hours)**
- [ ] Create PowerGridToolExecutor.js utility
- [ ] Implement `executePowerGridSERP()` function
- [ ] Integrate tool executor with Claude-based BaseCard.jsx
- [ ] Add LLM-initiated tool feedback messages
- [ ] Test Claude → Tool orchestration workflow
- [ ] Verify Perplexity tool integration in NestedCircleButton

### **Week 3: Enhancement & Testing (4-6 hours)**
- [ ] Add tool result synthesis to Claude response
- [ ] Enhance tool feedback for multi-stage operations
- [ ] Test Claude vs Perplexity analysis capabilities
- [ ] Comprehensive testing of all scenarios
- [ ] Performance optimization and error handling
- [ ] Documentation and code cleanup

---

This tactical plan provides a focused, low-risk approach to validating the tool-aware LLM concept using a single, well-defined question while building toward the comprehensive system outlined in the main integration plan.
