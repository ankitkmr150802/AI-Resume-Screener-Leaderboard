from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb
import io
import json
from google import genai
import os
from dotenv import load_dotenv
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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ai_client = genai.Client(api_key=GEMINI_API_KEY)
chroma_client = chromadb.Client()
resume_collection = chroma_client.get_or_create_collection(name="resume_chunks")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf_file = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_file)
    extracted_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            extracted_text += text + "\n"
    return extracted_text

@app.post("/analyze")
async def analyze_documents(
    resume: UploadFile = File(...),
    jd: UploadFile = File(...)
):
    try:
        resume_bytes = await resume.read()
        jd_bytes = await jd.read()
        resume_text = extract_text_from_pdf(resume_bytes)
        jd_text = extract_text_from_pdf(jd_bytes)

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
        chunks = text_splitter.split_text(resume_text)

        global resume_collection
        try:
            chroma_client.delete_collection("resume_chunks")
        except Exception:
            pass
        resume_collection = chroma_client.get_or_create_collection(name="resume_chunks")
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        resume_collection.add(documents=chunks, ids=ids)

        prompt = f"""
        Compare the resume with the Job Description.
        Return ONLY a JSON object like this:
        {{
          "candidate_name": "{resume.filename}",
          "score": 80,
          "strengths": ["Good skills", "Relevant experience"],
          "gaps": ["Missing certification"]
        }}

        RESUME: {resume_text[:2000]}
        JD: {jd_text[:2000]}
        """

        response = ai_client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )

        raw_text = response.text or ""
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-multi")
async def analyze_multiple_resumes(
    resumes: List[UploadFile] = File(...),
    jd: UploadFile = File(...)
):
    try:
        jd_bytes = await jd.read()
        jd_text = extract_text_from_pdf(jd_bytes)
        candidates_result = []

        for resume in resumes:
            resume_bytes = await resume.read()
            resume_text = extract_text_from_pdf(resume_bytes)

            prompt = f"""
            Compare resume with Job Description.
            Return ONLY a JSON object:
            {{
              "candidate_name": "{resume.filename}",
              "score": 85,
              "strengths": ["Key skill 1", "Key skill 2"],
              "gaps": ["Missing gap 1"]
            }}

            RESUME: {resume_text[:2000]}
            JD: {jd_text[:2000]}
            """

            response = ai_client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
            )
            raw_text = response.text or ""
            clean_json = raw_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            candidates_result.append(data)

        # High score to low score sorting
        candidates_result.sort(key=lambda x: x.get("score", 0), reverse=True)
        return candidates_result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

        response = ai_client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )
        
        raw_text = response.text or ""
        return {"answer": raw_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))