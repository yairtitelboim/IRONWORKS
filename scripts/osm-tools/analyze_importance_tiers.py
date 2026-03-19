#!/usr/bin/env python3
"""
Analyze importance tier distribution in OSM cache files.
Diagnostic script to understand why all markers appear the same color.
"""

import json
from pathlib import Path
from collections import Counter, defaultdict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OSM_CACHE_DIR = PROJECT_ROOT / "public" / "osm"

def analyze_file(filepath: Path):
    """Analyze a single OSM cache file"""
    print(f"\n{'='*80}")
    print(f"Analyzing: {filepath.name}")
    print(f"{'='*80}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return
    
    features = data.get('features', [])
    if not features:
        print("⚠️ No features found in file")
        return
    
    print(f"\n📊 Total features: {len(features)}")
    
    # Analyze strategic_tier distribution
    strategic_tiers = Counter()
    importance_tiers = Counter()
    strategic_scores = []
    importance_scores = []
    
    # Analyze by category
    category_tiers = defaultdict(lambda: Counter())
    category_scores = defaultdict(list)
    
    # Sample features for inspection
    sample_features = []
    
    for i, feature in enumerate(features):
        props = feature.get('properties', {})
        
        # Check strategic_tier (from OSM script)
        strategic_tier = props.get('strategic_tier')
        if strategic_tier:
            strategic_tiers[strategic_tier] += 1
        else:
            strategic_tiers['missing'] += 1
        
        # Check importance_tier (from server.js)
        importance_tier = props.get('importance_tier')
        if importance_tier:
            importance_tiers[strategic_tier] += 1
        else:
            importance_tiers['missing'] += 1
        
        # Collect scores
        strategic_score = props.get('strategic_score')
        if strategic_score is not None:
            strategic_scores.append(float(strategic_score))
        
        importance_score = props.get('importance')
        if importance_score is not None:
            importance_scores.append(float(importance_score))
        
        # Analyze by category
        category = props.get('category', 'unknown')
        if strategic_tier:
            category_tiers[category][str(strategic_tier)] += 1
        if strategic_score is not None:
            category_scores[category].append(float(strategic_score))
        
        # Collect sample features (first 5 of each tier)
        if strategic_tier and len(sample_features) < 20:
            if len([f for f in sample_features if f.get('strategic_tier') == strategic_tier]) < 5:
                sample_features.append({
                    'index': i,
                    'name': props.get('name', 'Unnamed'),
                    'category': category,
                    'strategic_tier': strategic_tier,
                    'strategic_score': strategic_score,
                    'importance_tier': importance_tier,
                    'importance': importance_score,
                    'tags': props.get('tags', {})
                })
    
    # Print strategic_tier distribution
    print(f"\n🎯 Strategic Tier Distribution (from OSM script):")
    if strategic_tiers:
        for tier, count in strategic_tiers.most_common():
            pct = (count / len(features)) * 100
            print(f"  {tier:12s}: {count:5d} ({pct:5.1f}%)")
    else:
        print("  ⚠️ No strategic_tier values found!")
    
    # Print importance_tier distribution
    print(f"\n📈 Importance Tier Distribution (from server.js):")
    if importance_tiers:
        for tier, count in importance_tiers.most_common():
            pct = (count / len(features)) * 100
            print(f"  {tier:12s}: {count:5d} ({pct:5.1f}%)")
    else:
        print("  ⚠️ No importance_tier values found!")
    
    # Print score statistics
    if strategic_scores:
        print(f"\n📊 Strategic Score Statistics:")
        print(f"  Min:    {min(strategic_scores):.1f}")
        print(f"  Max:    {max(strategic_scores):.1f}")
        print(f"  Avg:    {sum(strategic_scores)/len(strategic_scores):.1f}")
        print(f"  Median: {sorted(strategic_scores)[len(strategic_scores)//2]:.1f}")
    
    if importance_scores:
        print(f"\n📊 Importance Score Statistics:")
        print(f"  Min:    {min(importance_scores):.1f}")
        print(f"  Max:    {max(importance_scores):.1f}")
        print(f"  Avg:    {sum(importance_scores)/len(importance_scores):.1f}")
        print(f"  Median: {sorted(importance_scores)[len(importance_scores)//2]:.1f}")
    
    # Print category breakdown
    print(f"\n📂 Tier Distribution by Category:")
    for category in sorted(category_tiers.keys()):
        print(f"\n  {category}:")
        tier_counts = category_tiers[category]
        total = sum(tier_counts.values())
        for tier, count in tier_counts.most_common():
            pct = (count / total) * 100 if total > 0 else 0
            avg_score = sum(category_scores[category]) / len(category_scores[category]) if category_scores[category] else 0
            print(f"    {tier:12s}: {count:4d} ({pct:5.1f}%) - Avg score: {avg_score:.1f}")
    
    # Print sample features
    print(f"\n🔍 Sample Features (first 5 of each tier):")
    for sample in sample_features[:20]:
        print(f"\n  [{sample['index']}] {sample['name']}")
        print(f"      Category: {sample['category']}")
        print(f"      Strategic Tier: {sample['strategic_tier']} (score: {sample['strategic_score']})")
        print(f"      Importance Tier: {sample.get('importance_tier', 'N/A')} (score: {sample.get('importance', 'N/A')})")
        tags = sample.get('tags', {})
        if tags:
            relevant_tags = {k: v for k, v in tags.items() if k in ['power', 'voltage', 'man_made', 'amenity', 'waterway', 'natural', 'operator']}
            if relevant_tags:
                print(f"      Tags: {relevant_tags}")
    
    # Check for potential issues
    print(f"\n⚠️ Potential Issues:")
    issues = []
    
    if strategic_tiers['missing'] > 0:
        issues.append(f"  - {strategic_tiers['missing']} features missing strategic_tier")
    
    if strategic_tiers.get('critical', 0) == len(features):
        issues.append(f"  - ALL features are 'critical' tier (no variation)")
    
    if strategic_tiers.get('high', 0) == len(features):
        issues.append(f"  - ALL features are 'high' tier (no variation)")
    
    if strategic_tiers.get('medium', 0) == len(features):
        issues.append(f"  - ALL features are 'medium' tier (no variation)")
    
    if strategic_scores:
        score_range = max(strategic_scores) - min(strategic_scores)
        if score_range < 10:
            issues.append(f"  - Very narrow score range ({score_range:.1f}) - all features have similar scores")
    
    if not issues:
        print("  ✅ No obvious issues detected")
    else:
        for issue in issues:
            print(issue)

def main():
    """Analyze all PA nuclear OSM cache files"""
    print("🔍 Analyzing Importance Tier Distribution in OSM Cache Files")
    print("=" * 80)
    
    if not OSM_CACHE_DIR.exists():
        print(f"❌ OSM cache directory not found: {OSM_CACHE_DIR}")
        return
    
    # Find PA nuclear cache files
    pa_files = [
        OSM_CACHE_DIR / "pa_nuclear_tmi.json",
        OSM_CACHE_DIR / "pa_nuclear_susquehanna.json"
    ]
    
    found_files = [f for f in pa_files if f.exists()]
    
    if not found_files:
        print(f"⚠️ No PA nuclear cache files found in {OSM_CACHE_DIR}")
        print(f"   Looking for: {[f.name for f in pa_files]}")
        return
    
    for filepath in found_files:
        analyze_file(filepath)
    
    print(f"\n{'='*80}")
    print("✅ Analysis complete")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()



