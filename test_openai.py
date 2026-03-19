import os
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Get API key
api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY2")
print(f"API key found: {'Yes' if api_key else 'No'}")

if api_key:
    openai.api_key = api_key
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, world!"}
            ]
        )
        print("API call successful!")
        print(f"Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"Error: {e}")
