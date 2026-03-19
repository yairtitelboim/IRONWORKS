#!/usr/bin/env python3
"""
Test the MCP API response to see what importance_tier values are actually returned.
This helps diagnose why all markers appear the same color.
"""

import json
import requests
from collections import Counter

def test_api_query(facility_key, category, radius_km=100):
    """Test an API query and analyze the response"""
    url = "http://localhost:3001/api/mcp/search"
    
    query = f"{category} within {radius_km}km of {facility_key}"
    
    payload = {
        "query": query,
        "facility": facility_key
    }
    
    print(f"\n{'='*80}")
    print(f"Testing: {query}")
    print(f"{'='*80}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        features = data.get('features', [])
        
        print(f"\n📊 Total features returned: {len(features)}")
        
        if not features:
            print("⚠️ No features returned")
            return
        
        # Analyze tier distribution
        importance_tiers = Counter()
        strategic_tiers = Counter()
        importance_scores = []
        strategic_scores = []
        
        # Sample features
        samples = []
        
        for i, feature in enumerate(features[:20]):  # First 20
            props = feature.get('properties', {})
            
            importance_tier = props.get('importance_tier')
            strategic_tier = props.get('strategic_tier')
            importance_score = props.get('importance')
            strategic_score = props.get('strategic_score')
            
            if importance_tier:
                importance_tiers[importance_tier] += 1
            if strategic_tier:
                strategic_tiers[strategic_tier] += 1
            if importance_score is not None:
                importance_scores.append(float(importance_score))
            if strategic_score is not None:
                strategic_scores.append(float(strategic_score))
            
            samples.append({
                'name': props.get('name', 'Unnamed'),
                'importance_tier': importance_tier,
                'strategic_tier': strategic_tier,
                'importance': importance_score,
                'strategic_score': strategic_score,
                'category': props.get('category'),
                'distance_m': props.get('distance_m')
            })
        
        print(f"\n🎯 Importance Tier Distribution (from server.js):")
        if importance_tiers:
            for tier, count in importance_tiers.most_common():
                pct = (count / len(features)) * 100
                print(f"  {tier:12s}: {count:4d} ({pct:5.1f}%)")
        else:
            print("  ⚠️ No importance_tier values found!")
        
        print(f"\n📈 Strategic Tier Distribution (from OSM cache):")
        if strategic_tiers:
            for tier, count in strategic_tiers.most_common():
                pct = (count / len(features)) * 100
                print(f"  {tier:12s}: {count:4d} ({pct:5.1f}%)")
        else:
            print("  ⚠️ No strategic_tier values found!")
        
        if importance_scores:
            print(f"\n📊 Importance Score Statistics:")
            print(f"  Min:    {min(importance_scores):.1f}")
            print(f"  Max:    {max(importance_scores):.1f}")
            print(f"  Avg:    {sum(importance_scores)/len(importance_scores):.1f}")
        
        print(f"\n🔍 Sample Features (first 10):")
        for i, sample in enumerate(samples[:10]):
            print(f"\n  [{i+1}] {sample['name']}")
            print(f"      Importance Tier: {sample['importance_tier']} (score: {sample['importance']})")
            print(f"      Strategic Tier:  {sample['strategic_tier']} (score: {sample['strategic_score']})")
            print(f"      Category: {sample['category']}, Distance: {sample['distance_m']}m")
        
        # Check for issues
        print(f"\n⚠️ Potential Issues:")
        issues = []
        
        if not importance_tiers:
            issues.append("  - No importance_tier values in API response!")
        
        if len(importance_tiers) == 1:
            tier = list(importance_tiers.keys())[0]
            issues.append(f"  - ALL features have the same tier: '{tier}' (no color variation)")
        
        if importance_tiers.get('critical', 0) == len(features):
            issues.append("  - ALL features are 'critical' tier (all will be brightest color)")
        
        if not issues:
            print("  ✅ Tier distribution looks good")
        else:
            for issue in issues:
                print(issue)
        
    except requests.exceptions.RequestException as e:
        print(f"❌ API request failed: {e}")
        print("   Make sure the server is running on http://localhost:3001")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Test multiple queries"""
    print("🔍 Testing MCP API Response - Importance Tier Analysis")
    print("=" * 80)
    
    # Test queries
    test_cases = [
        ("three_mile_island_pa", "substation", 100),
        ("three_mile_island_pa", "water", 30),
        ("susquehanna_nuclear_pa", "substation", 100),
        ("susquehanna_nuclear_pa", "water", 30),
    ]
    
    for facility_key, category, radius_km in test_cases:
        test_api_query(facility_key, category, radius_km)
    
    print(f"\n{'='*80}")
    print("✅ Testing complete")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()



