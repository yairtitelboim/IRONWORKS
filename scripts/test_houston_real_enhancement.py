#!/usr/bin/env python3
"""
Real test of Houston Commercial Properties Enhancement
Tests with 5 actual properties from the dataset
"""

import json
import os
import time
import requests
from typing import Dict, List, Optional
from datetime import datetime

def load_sample_properties(input_file: str, count: int = 5) -> List[Dict]:
    """Load sample properties from the JSON file"""
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
        return data.get('properties', [])[:count]
    except Exception as e:
        print(f"Error loading properties: {e}")
        return []

def create_enhancement_prompt(property_data: Dict) -> str:
    """Create a comprehensive prompt for property enhancement"""
    address = property_data.get('address', 'Unknown')
    price = property_data.get('price', 'Unknown')
    sqft = property_data.get('square_footage', 'Unknown')
    days_on_market = property_data.get('days_on_market', 'Unknown')
    year_built = property_data.get('year_built', 'Unknown')
    zip_code = property_data.get('zip_code', 'Unknown')
    
    prompt = f"""You are a Houston commercial real estate market intelligence analyst. Analyze this office building listing for comprehensive market context and strategic insights.

PROPERTY DETAILS:
- Address: {address}
- Price: {price}
- Square Footage: {sqft}
- Days on Market: {days_on_market}
- Year Built: {year_built}
- ZIP Code: {zip_code}

ANALYSIS FRAMEWORK - Provide deep market intelligence on:

1. **SELLER CONTEXT & MOTIVATION**:
   - Who is likely selling this property (owner type, company, individual)
   - Why they might be selling (financial distress, portfolio optimization, market timing, etc.)
   - Ownership history and previous transaction patterns
   - Seller's market position and strategy

2. **MARKET IMPACT ANALYSIS**:
   - How this sale affects surrounding property values and market dynamics
   - Impact on local office market supply/demand
   - Neighborhood development trends and future outlook
   - Competitive positioning vs. similar properties

3. **CONVERSION POTENTIAL**:
   - Office-to-residential conversion feasibility and challenges
   - Zoning analysis and regulatory requirements
   - Parking implications and potential solutions
   - Structural and infrastructure considerations

4. **ECONOMIC CONTEXT**:
   - Current Houston office market conditions in this submarket
   - Price per sqft analysis vs. market averages
   - Absorption rates and vacancy trends
   - Future development pipeline impact

5. **STRATEGIC OPPORTUNITIES**:
   - Potential buyers and their motivations
   - Investment strategies that could work for this property
   - Timing considerations for purchase/sale
   - Risk factors and mitigation strategies

REQUIRED OUTPUT FORMAT - Return JSON with this exact structure:

{{
  "property_address": "{address}",
  "market_intelligence": {{
    "seller_context": {{
      "likely_seller_type": "Description of seller type",
      "motivation_for_sale": "Why they're selling",
      "ownership_history": "Previous ownership patterns",
      "market_position": "Seller's position in market"
    }},
    "market_impact": {{
      "surrounding_property_impact": "How sale affects nearby properties",
      "supply_demand_impact": "Effect on local office market",
      "neighborhood_trends": "Development trends in area",
      "competitive_positioning": "How it compares to similar properties"
    }},
    "conversion_analysis": {{
      "residential_conversion_feasibility": "High/Medium/Low with reasoning",
      "zoning_requirements": "Zoning analysis and requirements",
      "parking_implications": "Parking challenges and solutions",
      "structural_considerations": "Building structure for conversion"
    }},
    "economic_context": {{
      "submarket_performance": "Current market conditions in area",
      "price_analysis": "Price per sqft vs. market average",
      "absorption_vacancy": "Current absorption and vacancy rates",
      "future_pipeline_impact": "Upcoming developments affecting area"
    }},
    "strategic_opportunities": {{
      "potential_buyers": "Types of buyers likely interested",
      "investment_strategies": "Viable investment approaches",
      "timing_considerations": "Optimal timing for transaction",
      "risk_factors": "Key risks and mitigation strategies"
    }}
  }},
  "market_insights": {{
    "key_opportunities": "Top 3 opportunities for this property",
    "major_risks": "Top 3 risks to consider",
    "market_timing": "Assessment of current market timing",
    "strategic_recommendations": "Specific recommendations for buyers/sellers"
  }},
  "data_sources": [
    "Specific URLs or sources used for analysis"
  ]
}}

CRITICAL REQUIREMENTS:
- Focus on Houston-specific market conditions and trends
- Provide specific, actionable insights
- Include measurable data where possible
- Consider current office market challenges (remote work, etc.)
- Analyze conversion potential in context of Houston's development patterns
- Connect property characteristics to market opportunities

Search for specific Houston commercial real estate data, zoning information, market reports, and development trends."""

    return prompt

def call_perplexity_api(api_key: str, prompt: str) -> Optional[Dict]:
    """Call Perplexity API with retry logic"""
    base_url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    for attempt in range(3):
        try:
            payload = {
                "model": "sonar-pro",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 2000,
                "temperature": 0.1,
                "return_citations": True
            }
            
            response = requests.post(
                base_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"API error {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)  # Exponential backoff
                
    return None

def parse_enhancement_response(response: Dict) -> Optional[Dict]:
    """Parse and extract enhancement data from API response"""
    try:
        content = response['choices'][0]['message']['content']
        citations = response.get('citations', [])
        
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            enhancement_data = json.loads(json_match.group())
            enhancement_data['citations'] = citations
            return enhancement_data
        else:
            print("No JSON found in response")
            return None
            
    except Exception as e:
        print(f"Error parsing response: {e}")
        return None

def test_houston_enhancement():
    """Test the enhancement with 5 real properties"""
    
    # Check for API key
    api_key = os.getenv('PRP') or os.getenv('PERPLEXITY_API_KEY')
    if not api_key:
        print("❌ No Perplexity API key found. Please set PRP or PERPLEXITY_API_KEY environment variable.")
        print("You can set it with: export PRP='your_api_key_here'")
        return
    
    print(f"🔑 API Key found: {api_key[:10]}...")
    
    # Load sample properties
    input_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/public/houston_commercial_properties_smart_enhanced.json"
    properties = load_sample_properties(input_file, 5)
    
    if not properties:
        print("❌ No properties loaded")
        return
    
    print(f"🏢 Testing with {len(properties)} properties")
    print("=" * 60)
    
    results = []
    
    for i, property_data in enumerate(properties, 1):
        print(f"\n🏢 PROPERTY {i}: {property_data.get('address', 'Unknown')}")
        print("-" * 50)
        
        # Create prompt
        prompt = create_enhancement_prompt(property_data)
        print(f"📝 Prompt length: {len(prompt)} characters")
        
        # Call API
        print("📡 Calling Perplexity API...")
        start_time = time.time()
        
        response = call_perplexity_api(api_key, prompt)
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response:
            print(f"✅ Response received in {duration:.1f}s")
            
            # Parse response
            enhancement = parse_enhancement_response(response)
            
            if enhancement:
                print("✅ Enhancement data parsed successfully")
                
                # Store result
                result = {
                    'property': property_data,
                    'enhancement': enhancement,
                    'processing_time': duration,
                    'enhanced_at': datetime.now().isoformat()
                }
                results.append(result)
                
                # Show key insights
                if 'market_intelligence' in enhancement:
                    mi = enhancement['market_intelligence']
                    print(f"🏢 Seller Type: {mi.get('seller_context', {}).get('likely_seller_type', 'N/A')}")
                    print(f"💰 Price Analysis: {mi.get('economic_context', {}).get('price_analysis', 'N/A')}")
                    print(f"🏠 Conversion Feasibility: {mi.get('conversion_analysis', {}).get('residential_conversion_feasibility', 'N/A')}")
                
            else:
                print("❌ Failed to parse enhancement data")
                results.append({
                    'property': property_data,
                    'error': 'Failed to parse enhancement data',
                    'raw_response': response,
                    'enhanced_at': datetime.now().isoformat()
                })
        else:
            print("❌ API call failed")
            results.append({
                'property': property_data,
                'error': 'API call failed',
                'enhanced_at': datetime.now().isoformat()
            })
        
        # Rate limiting
        if i < len(properties):
            print("⏳ Waiting 3 seconds before next property...")
            time.sleep(3)
    
    # Save results
    output_file = "/Users/yairtitelboim/Documents/Kernel/ALLAPPS/HOU_FIFA/scripts/houston_enhancement_test_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            'test_metadata': {
                'tested_at': datetime.now().isoformat(),
                'total_properties': len(properties),
                'successful_enhancements': len([r for r in results if 'enhancement' in r]),
                'failed_enhancements': len([r for r in results if 'error' in r])
            },
            'results': results
        }, f, indent=2)
    
    print(f"\n🎯 TEST SUMMARY")
    print("=" * 30)
    successful = len([r for r in results if 'enhancement' in r])
    failed = len([r for r in results if 'error' in r])
    print(f"✅ Successful enhancements: {successful}")
    print(f"❌ Failed enhancements: {failed}")
    print(f"📁 Results saved to: {output_file}")
    
    # Show sample enhancement
    if successful > 0:
        print(f"\n📊 SAMPLE ENHANCEMENT:")
        sample = next(r for r in results if 'enhancement' in r)
        print(json.dumps(sample['enhancement'], indent=2)[:1000] + "...")

if __name__ == "__main__":
    test_houston_enhancement()
