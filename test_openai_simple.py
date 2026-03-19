#!/usr/bin/env python3
import os
import json
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Get API key
api_key = os.environ.get("OPENROUTER_API_KEY2")
print(f"API key found: {'Yes' if api_key else 'No'}")

if api_key:
    # Set up the OpenAI client with OpenRouter key
    openai.api_key = api_key
    # For OpenRouter, we need to use a supported model
    model_name = "gpt-3.5-turbo" # Less expensive model for testing
    
    try:
        print(f"Testing API call with model: {model_name}")
        response = openai.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Extract the zone codes from: R1 ZONE is residential, C2 ZONE is commercial"}
            ],
            max_tokens=100
        )
        print("API call successful!")
        print(f"Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"Error: {e}")
