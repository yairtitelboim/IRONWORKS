import os
import json
import logging
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DocumentAnalyzer:
    def __init__(self):
        """Initialize the DocumentAnalyzer with OpenAI client."""
        api_key = os.getenv('OPENAI_KEY')
        if not api_key:
            raise ValueError("OPENAI_KEY environment variable is required")
        self.client = OpenAI(api_key=api_key)

    def analyze_document(self, text: str) -> dict:
        """Analyze the document content and determine its relevance and focus areas."""
        try:
            prompt = f"""Analyze this planning document and extract key information about its relevance to 15-minute city planning.
            Focus on identifying areas that discuss:
            - Development potential
            - Infrastructure capacity
            - Transit accessibility
            - Amenity locations
            - Adaptive reuse opportunities

            Return a JSON object with the following structure:
            {{
                "docType": "Type of planning document",
                "fifteenMinCityRelevance": "Score from 1-5",
                "focusAreas": ["List of main focus areas"],
                "keyAreas": ["List of specific geographic areas mentioned"],
                "mappableData": {{
                    "hasGeographicBoundaries": true/false,
                    "hasInfrastructureMetrics": true/false,
                    "hasTransitData": true/false,
                    "hasDevelopmentPotential": true/false,
                    "hasAmenityLocations": true/false
                }}
            }}

            Document text:
            {text[:4000]}  # Limit text to avoid token limits
            """

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an urban planning expert analyzing documents for 15-minute city potential."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Error analyzing document: {str(e)}")
            return None

    def extract_mappable_data(self, text: str, analysis: dict) -> dict:
        """Extract specific mappable data points from the document."""
        try:
            prompt = f"""Extract mappable data points from this planning document.
            Focus on concrete, location-specific information that can be displayed on a map.

            Return a JSON object with the following structure:
            {{
                "developmentAreas": [
                    {{
                        "name": "Area name/description",
                        "description": "Development details",
                        "potentialType": "Type of potential development"
                    }}
                ],
                "infrastructureCapacity": [
                    {{
                        "area": "Area description",
                        "metricType": "Type of infrastructure",
                        "value": "Capacity value or description"
                    }}
                ],
                "transitAccess": [
                    {{
                        "location": "Location description",
                        "type": "Type of transit",
                        "metrics": "Access metrics or description"
                    }}
                ],
                "amenities": [
                    {{
                        "type": "Type of amenity",
                        "location": "Location description",
                        "status": "Existing or planned"
                    }}
                ],
                "adaptiveReuse": [
                    {{
                        "area": "Area description",
                        "potential": "Reuse potential description",
                        "constraints": "Any limitations or requirements"
                    }}
                ]
            }}

            Document text:
            {text[:4000]}  # Limit text to avoid token limits
            """

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an urban planning expert extracting mappable data points."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Error extracting mappable data: {str(e)}")
            return None 