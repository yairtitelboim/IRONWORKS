import json
import logging
from pathlib import Path
from datetime import datetime
from tqdm import tqdm
import spacy
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('coherence_analysis.log'),
        logging.StreamHandler()
    ]
)

class CoherenceAnalyzer:
    def __init__(self):
        logging.info("Loading NLP model...")
        self.nlp = spacy.load("en_core_web_md")
        self.results = []
        self.filtered_geojsons = {}
        
    def calculate_coherence_score(self, name, description):
        # Process the texts
        name_doc = self.nlp(name.lower())
        desc_doc = self.nlp(description.lower())
        
        # Get document vectors
        if name_doc.vector_norm and desc_doc.vector_norm:
            similarity = name_doc.similarity(desc_doc)
            # Convert similarity to 1-10 scale
            score = round((similarity * 5) + 5, 2)
            return max(1, min(10, score))  # Ensure score is between 1 and 10
        return 1  # Default low score if vectors cannot be computed

    def analyze_file(self, file_path):
        logging.info(f"Processing file: {file_path}")
        
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        features = data.get('features', [])
        logging.info(f"Found {len(features)} features to analyze")
        
        # Store original GeoJSON structure
        filtered_data = data.copy()
        filtered_data['features'] = []
        
        for feature in tqdm(features, desc=f"Analyzing {Path(file_path).name}"):
            properties = feature.get('properties', {})
            name = properties.get('name', '')
            description = properties.get('description', '')
            
            if name and description:
                score = self.calculate_coherence_score(name, description)
                result = {
                    'file': Path(file_path).name,
                    'name': name,
                    'score': score,
                }
                self.results.append(result)
                
                # Only keep features with score >= 5
                if score >= 5:
                    filtered_data['features'].append(feature)
                else:
                    logging.warning(f"Low coherence score ({score}) for: {name}")
        
        # Store filtered GeoJSON
        self.filtered_geojsons[file_path] = filtered_data

    def save_filtered_geojsons(self):
        for file_path, filtered_data in self.filtered_geojsons.items():
            original_path = Path(file_path)
            filtered_path = original_path.parent / f"{original_path.stem}_filtered{original_path.suffix}"
            
            with open(filtered_path, 'w') as f:
                json.dump(filtered_data, f, indent=2)
            
            original_count = len(self.filtered_geojsons[file_path].get('features', []))
            filtered_count = len(filtered_data.get('features', []))
            removed_count = original_count - filtered_count
            
            logging.info(f"Created filtered file: {filtered_path}")
            logging.info(f"Removed {removed_count} low coherence items from {original_path.name}")

    def generate_report(self):
        if not self.results:
            logging.warning("No results to report!")
            return
        
        scores = [r['score'] for r in self.results]
        avg_score = np.mean(scores)
        low_coherence = len([s for s in scores if s < 5])
        
        report = f"""
Coherence Analysis Report
========================
Total items analyzed: {len(self.results)}
Average coherence score: {avg_score:.2f}
Items with low coherence (<5): {low_coherence}
        """
        
        logging.info(report)
        
        # Save detailed results
        with open('coherence_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'total_analyzed': len(self.results),
                    'average_score': avg_score,
                    'low_coherence_count': low_coherence
                },
                'detailed_results': self.results
            }, f, indent=2)

def main():
    analyzer = CoherenceAnalyzer()
    
    files = [
        'public/processed_planning_docs/enriched/development_potential.geojson',
        'public/processed_planning_docs/enriched/adaptive_reuse.geojson'
    ]
    
    for file_path in files:
        analyzer.analyze_file(file_path)
    
    analyzer.generate_report()
    analyzer.save_filtered_geojsons()

if __name__ == "__main__":
    main() 