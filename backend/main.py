import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load GEMINI_API_KEY from .env
load_dotenv()

app = FastAPI(title="Flow Visualizer Backend")

# Initialize Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Define what the extension should send us
class AnalyzeRequest(BaseModel):
    code: str

# Define the exact JSON structure we want from the AI
class AnalysisResponse(BaseModel):
    # Explicitly ask for the mathematical notation
    bigO: str = Field(
        description="The time complexity in Big O notation (e.g., 'O(n)', 'O(1)', 'O(n log n)'). Do not use descriptions like 'linear' or 'constant'."
    )
    
    # You can keep 'complexity' for the qualitative score if you want
    complexity: str = Field(
        description="A qualitative assessment of the complexity (e.g., 'Low', 'Medium', 'High')."
    )
    
    description: str = Field(
        description="A brief explanation (1-2 sentences) of why this time complexity applies to the code."
    )

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(request: AnalyzeRequest):
    try:
        # Prompt telling Gemini exactly how to behave
        prompt = f"Analyze the time complexity, for example: O(n) or O(n^2) and purpose of this code: {request.code}"
        
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnalysisResponse, # Enforces our Pydantic structure
            )
        )

        if not response.text:
            raise HTTPException(status_code=500, detail="Empty response from AI")

        # response.text is already valid JSON because of our config
        import json
        return json.loads(response.text)

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Flow Visualizer Backend is running",
        "docs": "/docs"
    }
    
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)