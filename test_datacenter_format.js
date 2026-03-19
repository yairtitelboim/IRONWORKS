// Test the new data center developer-focused format
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
- **Last Updated:** August 2024

---

## NODE 3: **Oncor Electric Delivery**
- **Type:** Electric Utility (Transmission & Distribution) [EIA-860]
- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources
- **Current Status:** Operational [Texas PUC Supply Chain Map]

**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **Nameplate Capacity:** N/A  
- **Recent Generation:** N/A  
- **Capacity Factor:** N/A  
- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**2. STABILITY SCORE:** 9/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Major ERCOT transmission operator [FERC Market Oversight]  
- **Reliability Metrics:** Meets NERC/PUC reliability standards [EIA Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 138 kV, 345 kV lines in region [EIA Transmission Data]  
- **Voltage Level:** 138/345 kV [FERC Transmission Studies]  
- **Available Capacity:** North zone surplus >5,000 MW [ERCOT Resource Adequacy]  
- **Regional Load:** See Node 1  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major transmission outages reported 2022–2024 [ERCOT Outage Data]  
- **Fuel Dependencies:** N/A  
- **Weather Resilience:** Hardened post-2021 [FERC Reliability Studies]  
- **Maintenance History:** Routine, per ERCOT filings [EIA Plant Data]  
- **Source Links:** https://www.ercot.com/news/reports, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** August 2024

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Ongoing upgrades [FERC Regional Studies]  
- **Infrastructure Investment:** Major PUC filings for grid modernization [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** High, with robust transmission [EIA Generation Data]  
- **Transmission Redundancy:** Multiple high-voltage paths [FERC Transmission Studies]  
- **Reliability Standards:** Meets/exceeds ERCOT/PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Strong [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

---

## NODE 4: **Lake Whitney Power Plant**
- **Type:** Power Plant (Hydroelectric) [EIA-860]
- **EIA Plant ID:** 6414 [EIA Power Plant Data][4]
- **Current Status:** Operational [EIA-860][4]

**1. POWER SCORE:** 6/10  
- **Nameplate Capacity:** 48 MW [EIA-860][4]  
- **Recent Generation:** ~120,000 MWh (2023, hydro estimate) [EIA State Electricity Data]  
- **Capacity Factor:** 28.5% (2023, Texas hydro average) [EIA Electric Power Monthly]  
- **Source Link:** https://www.eia.gov/electricity/data/eia860/  
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 7/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Direct tie to ERCOT grid [FERC Market Oversight]  
- **Reliability Metrics:** Hydro plants have low forced outage rates (<2%) [EIA Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 69 kV/138 kV lines to regional substations [EIA Transmission Data]  
- **Voltage Level:** 69/138 kV [FERC Transmission Studies]  
- **Available Capacity:** Small relative to regional load [ERCOT Resource Adequacy]  
- **Regional Load:** See Node 1  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations][4]  
- **Fuel Dependencies:** Water inflow (hydro) [EIA Fuel Data][4]  
- **Weather Resilience:** Subject to drought risk [FERC Reliability Studies]  
- **Maintenance History:** Routine, per USACE schedule [EIA Plant Data][4]  
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Minor role in regional planning [FERC Regional Studies]  
- **Infrastructure Investment:** Limited, focused on maintenance [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** Limited, not primary supply [EIA Generation Data][4]  
- **Transmission Redundancy:** Supported by larger grid [FERC Transmission Studies]  
- **Reliability Standards:** Meets ERCOT/PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Stable, but not a major contributor [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024`
};

// Copy the new functions from the frontend
function generateSummaryResponse(response) {
    const sections = response.split('## NODE');
    const header = sections[0] || '';
    const nodes = sections.slice(1);
    
    let summary = '## 🏢 Data Center Site Analysis\n\n';
    summary += '*Critical infrastructure assessment for site feasibility*\n\n';
    
    // Create comparison table
    summary += '| Node | Type | Power Score | Capacity | Availability | Voltage | Risk Level |\n';
    summary += '|------|------|-------------|----------|--------------|---------|------------|\n';
    
    const nodeData = [];
    
    nodes.forEach((node, index) => {
        const nodeName = node.split('\n')[0].replace(/^## NODE \d+:\s*\*\*/, '').replace(/\*\*$/, '').trim();
        const nodeType = extractNodeType(node);
        const criticalData = extractCriticalData(node);
        
        // Extract key values for table
        const powerScore = criticalData.powerScore || 'N/A';
        const capacity = extractCapacityValue(criticalData.capacity);
        const availability = extractAvailabilityLevel(criticalData.availability);
        const voltage = extractVoltageValue(criticalData.voltageLevel);
        const riskLevel = extractRiskLevel(criticalData.riskFactors);
        
        // Add to table
        summary += `| **${nodeName}** | ${getTypeAbbreviation(nodeType)} | ${powerScore} | ${capacity} | ${availability} | ${voltage} | ${riskLevel} |\n`;
        
        // Store for detailed analysis
        nodeData.push({
            name: nodeName,
            type: nodeType,
            data: criticalData,
            powerScore: powerScore,
            capacity: capacity,
            availability: availability,
            voltage: voltage,
            riskLevel: riskLevel
        });
    });
    
    // Add key insights
    summary += '\n## 🎯 Key Insights for Data Center Development\n\n';
    
    // Find best power source
    const bestPowerNode = nodeData.reduce((best, node) => {
        const currentScore = parseFloat(node.powerScore.split('/')[0]) || 0;
        const bestScore = parseFloat(best.powerScore.split('/')[0]) || 0;
        return currentScore > bestScore ? node : best;
    }, nodeData[0]);
    
    if (bestPowerNode) {
        summary += `**🔋 Primary Power Source:** ${bestPowerNode.name} (${bestPowerNode.powerScore} power score)\n`;
    }
    
    // Find best transmission
    const transmissionNodes = nodeData.filter(node => 
        node.type.toLowerCase().includes('transmission') || 
        node.voltage.includes('345') || 
        node.voltage.includes('138')
    );
    
    if (transmissionNodes.length > 0) {
        summary += `**⚡ Transmission Access:** ${transmissionNodes.length} high-voltage connection(s) available\n`;
    }
    
    // Calculate total available capacity
    const totalCapacity = nodeData.reduce((total, node) => {
        const capacity = parseFloat(node.capacity.replace(/[^\d.]/g, '')) || 0;
        return total + capacity;
    }, 0);
    
    if (totalCapacity > 0) {
        summary += `**📊 Total Available Capacity:** ~${totalCapacity.toFixed(0)} MW\n`;
    }
    
    // Risk assessment
    const highRiskNodes = nodeData.filter(node => node.riskLevel === '🔴 High');
    const mediumRiskNodes = nodeData.filter(node => node.riskLevel === '🟡 Medium');
    
    if (highRiskNodes.length > 0) {
        summary += `**⚠️ Risk Alert:** ${highRiskNodes.length} high-risk infrastructure component(s)\n`;
    } else if (mediumRiskNodes.length > 0) {
        summary += `**⚠️ Risk Status:** ${mediumRiskNodes.length} medium-risk component(s) - manageable\n`;
    } else {
        summary += `**✅ Risk Status:** Low risk infrastructure profile\n`;
    }
    
    // Site recommendation
    summary += '\n## 📋 Site Recommendation\n\n';
    
    const viableNodes = nodeData.filter(node => {
        const powerScore = parseFloat(node.powerScore.split('/')[0]) || 0;
        return powerScore >= 7 || node.availability.includes('High') || node.voltage.includes('345');
    });
    
    if (viableNodes.length >= 2) {
        summary += '**✅ VIABLE SITE** - Multiple reliable power sources and transmission access\n';
    } else if (viableNodes.length === 1) {
        summary += '**⚠️ MARGINAL SITE** - Limited redundancy, consider backup options\n';
    } else {
        summary += '**❌ HIGH RISK SITE** - Insufficient reliable infrastructure\n';
    }
    
    return summary;
}

// Helper functions
function getTypeAbbreviation(type) {
    if (type.includes('Power Plant')) return 'PWR';
    if (type.includes('Transmission')) return 'TXM';
    if (type.includes('Distribution')) return 'DST';
    if (type.includes('Utility')) return 'UTL';
    return 'OTH';
}

function extractCapacityValue(capacity) {
    if (!capacity || capacity.includes('N/A')) return 'N/A';
    const match = capacity.match(/(\d+(?:,\d+)*)\s*MW/);
    return match ? `${match[1]} MW` : capacity.split('[')[0].trim();
}

function extractAvailabilityLevel(availability) {
    if (!availability) return 'Unknown';
    if (availability.toLowerCase().includes('high')) return '🟢 High';
    if (availability.toLowerCase().includes('limited') || availability.toLowerCase().includes('dependent')) return '🟡 Limited';
    return '🔴 Low';
}

function extractVoltageValue(voltage) {
    if (!voltage) return 'N/A';
    const match = voltage.match(/(\d+(?:\/\d+)?)\s*kV/);
    return match ? `${match[1]} kV` : voltage.split('[')[0].trim();
}

function extractRiskLevel(riskFactors) {
    if (!riskFactors) return '🟢 Low';
    const risk = riskFactors.toLowerCase();
    if (risk.includes('drought') || risk.includes('outage') || risk.includes('weatherization')) return '🔴 High';
    if (risk.includes('upgrades') || risk.includes('hardened')) return '🟡 Medium';
    return '🟢 Low';
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

console.log('🏢 Testing Data Center Developer Format\n');

const summary = generateSummaryResponse(testData.nodeLevel);

console.log('✅ Generated Data Center Site Analysis:');
console.log(summary);

console.log('\n🔍 Analysis:');
const tableRows = (summary.match(/\|.*\|/g) || []).length - 2; // Subtract header and separator
console.log(`   Table rows: ${tableRows}`);

const insights = (summary.match(/\*\*.*:\*\*/g) || []).length;
console.log(`   Key insights: ${insights}`);

const recommendation = summary.includes('VIABLE SITE') ? 'VIABLE' : 
                      summary.includes('MARGINAL SITE') ? 'MARGINAL' : 
                      summary.includes('HIGH RISK SITE') ? 'HIGH RISK' : 'Unknown';
console.log(`   Site recommendation: ${recommendation}`);

console.log('\n✅ Data center format test completed!');
