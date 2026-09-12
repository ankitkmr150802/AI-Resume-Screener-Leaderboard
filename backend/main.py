from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb
import io
import json
import os
import re
from dotenv import load_dotenv
from google import genai
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# Collect all available keys
KEYS = [
    os.getenv("GEMINI_API_KEY1"),
    os.getenv("GEMINI_API_KEY2"),
    os.getenv("GEMINI_API_KEY3"),
]
# Filter out empty keys
API_KEYS = [k.strip() for k in KEYS if k and k.strip()]

chroma_client = chromadb.Client()
resume_collection = chroma_client.get_or_create_collection(name="resume_chunks")

def extract_text_from_pdf(file_bytes: bytes, filename: str = "document.pdf") -> str:
    """PDF validation and extraction with clean error catching."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        extracted_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        if not extracted_text.strip():
            raise ValueError("PDF contains no readable text.")
        return extracted_text
    except Exception:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file '{filename}'. Please upload a valid PDF document."
        )

def calculate_keyword_similarity(resume_text: str, jd_text: str) -> int:
    """Independent deterministic keyword score algorithm (Fallback)."""
    def get_words(text):
        return set(re.findall(r'\b[a-zA-Z]{3,}\b', text.lower()))
    
    resume_words = get_words(resume_text)
    jd_words = get_words(jd_text)
    
    if not jd_words:
        return 50
    
    overlap = resume_words.intersection(jd_words)
    score = int((len(overlap) / len(jd_words)) * 100)
    return min(max(score * 2, 25), 95)

def call_gemini_with_fallback(prompt: str) -> str:
    """Automatic Key Rotation across all configured API keys."""
    if not API_KEYS:
        raise HTTPException(status_code=500, detail="No Gemini API keys configured on server.")
    
    last_error = None
    for key in API_KEYS:
        try:
            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
            )
            if response.text:
                return response.text
        except Exception as e:
            err_msg = str(e)
            last_error = err_msg
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "API key" in err_msg:
                continue
            else:
                continue
    
    if last_error and ("429" in last_error or "RESOURCE_EXHAUSTED" in last_error):
        raise HTTPException(
            status_code=429, 
            detail="API limit crossed on all active keys. Please try again after 1 minute."
        )
    raise HTTPException(
        status_code=500, 
        detail=f"AI Service error: {last_error or 'Unable to generate response'}"
    )

@app.post("/analyze")
async def analyze_documents(
    resume: UploadFile = File(...),
    jd: UploadFile = File(...)
):
    resume_bytes = await resume.read()
    jd_bytes = await jd.read()
    
    # Safe filename fallbacks for type checking
    resume_filename = resume.filename or "resume.pdf"
    jd_filename = jd.filename or "jd.pdf"
    
    resume_text = extract_text_from_pdf(resume_bytes, resume_filename)
    jd_text = extract_text_from_pdf(jd_bytes, jd_filename)

    deterministic_score = calculate_keyword_similarity(resume_text, jd_text)

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    chunks = text_splitter.split_text(resume_text)

    global resume_collection
    try:
        chroma_client.delete_collection("resume_chunks")
    except Exception:
        pass
    resume_collection = chroma_client.get_or_create_collection(name="resume_chunks")
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    if chunks:
        resume_collection.add(documents=chunks, ids=ids)

    prompt = f"""
    Compare the resume with the Job Description.
    Return ONLY a JSON object like this:
    {{
      "candidate_name": "{resume_filename}",
      "score": {deterministic_score},
      "strengths": ["Good skills", "Relevant experience"],
      "gaps": ["Missing certification"]
    }}

    RESUME: {resume_text[:2000]}
    JD: {jd_text[:2000]}
    """

    try:
        raw_text = call_gemini_with_fallback(prompt)
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)
        if "score" not in parsed or not isinstance(parsed["score"], int):
            parsed["score"] = deterministic_score
        return parsed
    except HTTPException as e:
        if e.status_code == 429:
            return {
                "candidate_name": resume_filename,
                "score": deterministic_score,
                "strengths": ["Matched relevant domain keywords"],
                "gaps": ["API rate limit reached. Detailed AI breakdown paused temporarily."]
            }
        raise e

@app.post("/analyze-multi")
async def analyze_multiple_resumes(
    resumes: List[UploadFile] = File(...),
    jd: UploadFile = File(...)
):
    jd_bytes = await jd.read()
    jd_filename = jd.filename or "jd.pdf"
    jd_text = extract_text_from_pdf(jd_bytes, jd_filename)
    candidates_result = []

    for resume in resumes:
        resume_bytes = await resume.read()
        resume_filename = resume.filename or "resume.pdf"
        resume_text = extract_text_from_pdf(resume_bytes, resume_filename)
        deterministic_score = calculate_keyword_similarity(resume_text, jd_text)

        prompt = f"""
        Compare resume with Job Description.
        Return ONLY a JSON object:
        {{
          "candidate_name": "{resume_filename}",
          "score": {deterministic_score},
          "strengths": ["Key skill 1", "Key skill 2"],
          "gaps": ["Missing gap 1"]
        }}

        RESUME: {resume_text[:2000]}
        JD: {jd_text[:2000]}
        """

        try:
            raw_text = call_gemini_with_fallback(prompt)
            clean_json = raw_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            if "score" not in data or not isinstance(data["score"], int):
                data["score"] = deterministic_score
            candidates_result.append(data)
        except HTTPException as e:
            if e.status_code == 429:
                candidates_result.append({
                    "candidate_name": resume_filename,
                    "score": deterministic_score,
                    "strengths": ["Keyword overlap evaluation completed"],
                    "gaps": ["API rate limit hit during deep evaluation"]
                })
            else:
                raise e
        except Exception:
            candidates_result.append({
                "candidate_name": resume_filename,
                "score": deterministic_score,
                "strengths": ["Keyword analysis completed"],
                "gaps": ["AI insight generation failed"]
            })

    candidates_result.sort(key=lambda x: x.get("score", 0), reverse=True)
    return candidates_result

@app.post("/chat")
def chat_with_resume(question: str):
    try:
        results = resume_collection.query(query_texts=[question], n_results=3)
        retrieved_chunks = results['documents'][0] if results['documents'] else []
        context = "\n---\n".join(retrieved_chunks)

        prompt = f"""
        Answer based ONLY on context:
        CONTEXT: {context}
        QUESTION: {question}
        """

        raw_text = call_gemini_with_fallback(prompt)
        return {"answer": raw_text.strip()}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))