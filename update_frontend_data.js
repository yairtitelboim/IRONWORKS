const fs = require('fs');

// Read the complete test data from our test file
const testDataContent = `const testData = {
  "nodeLevel": \`Below is a structured reliability analysis for each specified infrastructure node near Whitney, Texas, using only the required public data sources. Where plant-level data is unavailable, regional Texas data from EIA, ERCOT, or FERC is provided as instructed.

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
- **Last Updated:** August 2024\`,
  "siteLevel": "# SITE-LEVEL STRATEGIC ANALYSIS\\n\\n## 1. POWER SCORE: 8/10\\n**Overall Site Power Capacity:** Based on node-level analysis\\n- **Primary Generation:** Multiple power plants identified\\n- **Capacity Factor:** Varies by facility type\\n- **Source:** [EIA State Data](https://www.eia.gov/electricity/data/state/)\\n\\n## 2. STABILITY SCORE: 8/10\\n**Grid Integration Status:** ERCOT North Zone integration\\n- **ERCOT Zone:** North Zone (high reliability)\\n- **Grid Integration:** Connected to ERCOT transmission grid\\n- **Reliability Metrics:** Based on individual facility analysis\\n- **Source:** [ERCOT Reports](https://www.ercot.com/news/reports)\\n\\n## 3. TRANSMISSION CAPACITY\\n**Transmission Infrastructure:** Multiple voltage levels\\n- **Primary Lines:** 345 kV and 138 kV network\\n- **Available Capacity:** Regional surplus capacity\\n- **Regional Load:** North Zone peak capacity\\n- **Source:** [FERC Texas Market Overview](https://www.ferc.gov/market-oversight/markets-electricity)\\n\\n## 4. ERCOT INTEGRATION\\n**Grid Connection:** ERCOT North Zone\\n- **Reliability:** High reliability zone\\n- **Transmission Planning:** Ongoing upgrades\\n- **Source:** [ERCOT Load Zone Data](https://www.ercot.com/news/reports)\\n\\n## 5. RISK ASSESSMENT\\n**Weather Resilience:** Post-2021 winter hardening\\n- **Transmission Redundancy:** Multiple high-voltage paths\\n- **Reliability Standards:** Meets ERCOT/PUC standards\\n- **Source:** [FERC Reliability Studies](https://www.ferc.gov/market-oversight/markets-electricity)\\n\\n## 6. REDUNDANCY VALUE\\n**Power Availability:** High with significant surplus\\n- **Transmission Redundancy:** Multiple 345 kV paths\\n- **Grid Stability:** Strong with low forced outage rates\\n- **Source:** [ERCOT System Reports](https://www.ercot.com/news/reports)\\n\\n**STRATEGIC RECOMMENDATIONS:**\\n1. **Primary Power Source:** Bosque Power Co LLC (800 MW, 9/10 power score)\\n2. **Transmission Access:** Oncor Electric Delivery (345 kV/138 kV)\\n3. **Backup Options:** Lake Whitney Power Plant (48 MW hydro)\\n4. **Risk Mitigation:** Multiple transmission paths provide redundancy\\n5. **Site Viability:** High - multiple reliable power sources and transmission access",
  "citations": [
    "1. https://www.eia.gov/electricity/data/eia860/",
    "2. https://www.ercot.com/news/reports",
    "3. https://www.ferc.gov/market-oversight/markets-electricity",
    "4. https://www.puc.texas.gov/"
  ]
};`;

// Read the current frontend file
let frontendContent = fs.readFileSync('test_frontend.html', 'utf8');

// Find and replace the testData section
const testDataRegex = /const testData = \{[\s\S]*?\};/;
const updatedContent = frontendContent.replace(testDataRegex, testDataContent);

// Write the updated content back
fs.writeFileSync('test_frontend.html', updatedContent);

console.log('✅ Updated frontend with complete test data (4 nodes)');
console.log('🔄 Refresh your browser to see the updated table');
