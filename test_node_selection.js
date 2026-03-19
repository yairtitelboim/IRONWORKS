// Test the node selection functionality with summary generation
const testData = {
  "nodeLevel": `Below is a structured reliability analysis for each specified infrastructure node near Whitney, Texas, using only the required public data sources. Where plant-level data is unavailable, regional Texas data from EIA, ERCOT, or FERC is provided as instructed.

---

## NODE 1: **Bosque Power Co LLC**
- **Type:** Power Plant (Natural Gas, Combined Cycle) [EIA-860]
- **EIA Plant ID:** 78242 [EIA Power Plant Data]
- **Current Status:** Operational [EIA-860]

**1. POWER SCORE:** 9/10  
- **Nameplate Capacity:** 800 MW [EIA-860, 2023]  
- **Recent Generation:** 5,200,000 MWh (2023) [EIA State Electricity Data]  
- **Capacity Factor:** 74.2% (2023, Texas NGCC average) [EIA Electric Power Monthly]  
- **Source Link:** https://www.eia.gov/electricity/data/eia860/  
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 8/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Directly connected to ERCOT transmission grid [FERC Market Oversight]  
- **Reliability Metrics:** Texas NGCC plants report forced outage rates <3% [EIA State Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 345 kV lines connect to ERCOT backbone [EIA Transmission Data]  
- **Voltage Level:** 345 kV [FERC Transmission Studies]  
- **Available Capacity:** North zone surplus >5,000 MW (2024) [ERCOT Resource Adequacy]  
- **Regional Load:** North zone peak ~24,000 MW (2023) [EIA State Data]  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]  
- **Fuel Dependencies:** Natural gas, dual-fuel capability [EIA Fuel Data]  
- **Weather Resilience:** Upgrades post-2021 winter event [FERC Reliability Studies]  
- **Maintenance History:** Scheduled annual maintenance, no extended forced outages [EIA Plant Data]  
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone, high reserve margin [ERCOT Load Zone Data]  
- **Transmission Planning:** Ongoing upgrades for North Texas [FERC Regional Studies]  
- **Infrastructure Investment:** Recent filings for capacity expansion [Texas PUC Filings]  
- **Regional Generation Mix:** 48% natural gas, 23% wind, 18% coal, 11% other (2023) [EIA State Data]  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** High, with significant surplus in North zone [EIA Generation Data]  
- **Transmission Redundancy:** Multiple 345 kV paths [FERC Transmission Studies]  
- **Reliability Standards:** Meets ERCOT and PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Strong, with low forced outage rates [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

---

## NODE 2: **Hill County Water Supply Corporation**
- **Type:** Electric Utility (Distribution) [EIA-860]
- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources
- **Current Status:** Operational [Texas PUC Supply Chain Map]

**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **Nameplate Capacity:** N/A  
- **Recent Generation:** N/A  
- **Capacity Factor:** N/A  
- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**2. STABILITY SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Distribution-level, receives power from ERCOT grid [FERC Market Oversight]  
- **Reliability Metrics:** N/A  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** Receives from regional substations [EIA Transmission Data]  
- **Voltage Level:** Distribution (typically 12–25 kV) [FERC Transmission Studies]  
- **Available Capacity:** N/A  
- **Regional Load:** Hill County peak ~150 MW (2023, regional estimate) [EIA State Data]  
- **Source Link:** https://www.eia.gov/electricity/data/state/  
- **Last Updated:** October 2023

**4. RELIABILITY METRICS:**  
- **Historical Outages:** Not reported at utility level [EIA Plant Operations]  
- **Fuel Dependencies:** N/A  
- **Weather Resilience:** Subject to ERCOT and PUC weatherization rules [FERC Reliability Studies]  
- **Maintenance History:** N/A  
- **Source Links:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Covered by ERCOT North zone planning [FERC Regional Studies]  
- **Infrastructure Investment:** PUC filings for distribution upgrades [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** Dependent on upstream transmission and substation reliability [EIA Generation Data]  
- **Transmission Redundancy:** Limited at distribution level [FERC Transmission Studies]  
- **Reliability Standards:** Subject to PUC and ERCOT rules [Texas PUC Compliance]  
- **Grid Stability:** Follows regional trends [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024`
};

// Copy the exact functions from the frontend
function generateSummaryResponse(response) {
    const sections = response.split('## NODE');
    const header = sections[0] || '';
    const nodes = sections.slice(1);
    
    let summary = '## 🎯 Critical Infrastructure Summary\n\n';
    summary += '*High-value insights from Perplexity analysis*\n\n';
    
    nodes.forEach((node, index) => {
        const nodeName = node.split('\n')[0].replace(/^## NODE \d+:\s*\*\*/, '').replace(/\*\*$/, '').trim();
        const nodeType = extractNodeType(node);
        const criticalData = extractCriticalData(node);
        
        summary += `### ${index + 1}. ${nodeName}\n`;
        summary += `**Type:** ${nodeType}\n\n`;
        
        // Core performance metrics
        if (criticalData.powerScore) {
            summary += `**⚡ Power Score:** ${criticalData.powerScore}\n`;
        }
        if (criticalData.stabilityScore) {
            summary += `**🔧 Stability Score:** ${criticalData.stabilityScore}\n`;
        }
        
        // Capacity and generation data
        if (criticalData.capacity) {
            summary += `**📊 Nameplate Capacity:** ${criticalData.capacity}\n`;
        }
        if (criticalData.capacityFactor) {
            summary += `**📈 Capacity Factor:** ${criticalData.capacityFactor}\n`;
        }
        if (criticalData.recentGeneration) {
            summary += `**⚡ Recent Generation:** ${criticalData.recentGeneration}\n`;
        }
        
        // Transmission infrastructure
        if (criticalData.voltageLevel) {
            summary += `**⚡ Voltage Level:** ${criticalData.voltageLevel}\n`;
        }
        if (criticalData.transmissionLines) {
            summary += `**🔌 Transmission Lines:** ${criticalData.transmissionLines}\n`;
        }
        if (criticalData.availableCapacity) {
            summary += `**📊 Available Capacity:** ${criticalData.availableCapacity}\n`;
        }
        if (criticalData.regionalLoad) {
            summary += `**🏭 Regional Load:** ${criticalData.regionalLoad}\n`;
        }
        
        // Grid integration
        if (criticalData.ercotZone) {
            summary += `**🌐 ERCOT Zone:** ${criticalData.ercotZone}\n`;
        }
        if (criticalData.availability) {
            summary += `**✅ Power Availability:** ${criticalData.availability}\n`;
        }
        if (criticalData.redundancy) {
            summary += `**🔄 Transmission Redundancy:** ${criticalData.redundancy}\n`;
        }
        
        // Risk assessment
        if (criticalData.riskFactors) {
            summary += `**⚠️ Weather Resilience:** ${criticalData.riskFactors}\n`;
        }
        
        summary += '\n---\n\n';
    });
    
    return summary;
}

function extractNodeType(node) {
    const typeMatch = node.match(/\*\*Type:\*\*\s*(.+?)\s*\[/);
    return typeMatch ? typeMatch[1].trim() : 'Unknown';
}

function extractCriticalData(node) {
    const data = {};
    const nodeText = node.toLowerCase();
    
    // Extract power score
    const powerMatch = node.match(/\*\*1\. POWER SCORE:\*\*\s*(\d+\/\d+)/);
    if (powerMatch) data.powerScore = powerMatch[1];
    
    // Extract stability score
    const stabilityMatch = node.match(/\*\*2\. STABILITY SCORE:\*\*\s*(\d+\/\d+)/);
    if (stabilityMatch) data.stabilityScore = stabilityMatch[1];
    
    // Extract capacity
    const capacityMatch = node.match(/\*\*Nameplate Capacity:\*\*\s*([^\n]+)/);
    if (capacityMatch) data.capacity = capacityMatch[1].trim();
    
    // Extract voltage level
    const voltageMatch = node.match(/\*\*Voltage Level:\*\*\s*([^\n]+)/);
    if (voltageMatch) data.voltageLevel = voltageMatch[1].trim();
    
    // Extract transmission lines
    const transmissionMatch = node.match(/\*\*Transmission Lines:\*\*\s*([^\n]+)/);
    if (transmissionMatch) data.transmissionLines = transmissionMatch[1].trim();
    
    // Extract ERCOT zone
    const ercotMatch = node.match(/\*\*ERCOT Zone:\*\*\s*([^\n]+)/);
    if (ercotMatch) data.ercotZone = ercotMatch[1].trim();
    
    // Extract power availability
    const availabilityMatch = node.match(/\*\*Power Availability:\*\*\s*([^\n]+)/);
    if (availabilityMatch) data.availability = availabilityMatch[1].trim();
    
    // Extract transmission redundancy
    const redundancyMatch = node.match(/\*\*Transmission Redundancy:\*\*\s*([^\n]+)/);
    if (redundancyMatch) data.redundancy = redundancyMatch[1].trim();
    
    // Extract available capacity (transmission queue depth)
    const availableCapacityMatch = node.match(/\*\*Available Capacity:\*\*\s*([^\n]+)/);
    if (availableCapacityMatch) data.availableCapacity = availableCapacityMatch[1].trim();
    
    // Extract regional load
    const regionalLoadMatch = node.match(/\*\*Regional Load:\*\*\s*([^\n]+)/);
    if (regionalLoadMatch) data.regionalLoad = regionalLoadMatch[1].trim();
    
    // Extract capacity factor
    const capacityFactorMatch = node.match(/\*\*Capacity Factor:\*\*\s*([^\n]+)/);
    if (capacityFactorMatch) data.capacityFactor = capacityFactorMatch[1].trim();
    
    // Extract recent generation
    const generationMatch = node.match(/\*\*Recent Generation:\*\*\s*([^\n]+)/);
    if (generationMatch) data.recentGeneration = generationMatch[1].trim();
    
    // Extract key risk factors
    const riskMatch = node.match(/\*\*Weather Resilience:\*\*\s*([^\n]+)/);
    if (riskMatch) data.riskFactors = riskMatch[1].trim();
    
    return data;
}

// Simulate node selection
function simulateNodeSelection(nodeNumber) {
    console.log(`🧪 Testing Node ${nodeNumber} Selection\n`);
    
    const sections = testData.nodeLevel.split('## NODE');
    const header = sections[0] || '';
    const nodes = sections.slice(1);
    
    if (nodeNumber <= nodes.length) {
        const selectedNodeText = '## NODE' + nodes[nodeNumber - 1];
        console.log(`✅ Selected Node ${nodeNumber} text:`, selectedNodeText.substring(0, 100) + '...');
        
        // Use the ALL category summary for the selected node
        const summary = generateSummaryResponse(selectedNodeText);
        console.log('\n📊 Generated Summary:');
        console.log(summary);
        
        console.log('\n🔍 Summary Analysis:');
        const nodeCount = (summary.match(/### \d+\./g) || []).length;
        console.log(`   Found ${nodeCount} nodes in summary`);
        
        const powerScores = (summary.match(/\*\*⚡ Power Score:\*\*/g) || []).length;
        const stabilityScores = (summary.match(/\*\*🔧 Stability Score:\*\*/g) || []).length;
        const capacities = (summary.match(/\*\*📊 Nameplate Capacity:\*\*/g) || []).length;
        const availableCapacities = (summary.match(/\*\*📊 Available Capacity:\*\*/g) || []).length;
        
        console.log(`   Power Scores: ${powerScores}`);
        console.log(`   Stability Scores: ${stabilityScores}`);
        console.log(`   Nameplate Capacities: ${capacities}`);
        console.log(`   Available Capacities: ${availableCapacities}`);
        
        return summary;
    } else {
        console.log(`❌ Node ${nodeNumber} not found`);
        return null;
    }
}

console.log('🧪 Testing Node Selection with Summary Generation\n');

// Test selecting individual nodes
console.log('=== Testing Node 1 Selection ===');
const node1Summary = simulateNodeSelection(1);

console.log('\n=== Testing Node 2 Selection ===');
const node2Summary = simulateNodeSelection(2);

console.log('\n✅ Node selection test completed!');
