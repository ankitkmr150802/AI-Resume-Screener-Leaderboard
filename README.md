# 📄 AI Resume Screener & Leaderboard

An automated ATS screening platform powered by Retrieval-Augmented Generation (RAG) and Google Gemini API. Evaluates individual resume matches, ranks multiple candidates on a live leaderboard, and enables context-aware candidate Q&A via a vector store.

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-2563EB?style=for-the-badge&logo=googlechrome&logoColor=white)](https://ai-resumescreen.web.app)
[![React](https://img.shields.io/badge/Frontend-React.js-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/Vector_DB-ChromaDB-FF6F00?style=for-the-badge)](https://www.trychroma.com/)

---

## ✨ Features

* **Single Candidate Match Analysis:** Generates an overall percentage match score along with structured **Key Strengths** and **Missing Gaps**.
* **Multi-Resume Leaderboard:** Compares and ranks multiple applicant resumes against a single Job Description to identify top candidates instantly.
* **Context-Aware Candidate Q&A:** RAG-powered interactive chatbot allowing recruiters to query candidate background using ChromaDB vector store.
* **Resilient API Key Rotation:** Automatic multi-key failover rotation with a deterministic keyword overlap fallback to ensure continuous availability.
* **Mobile-First Responsive Design:** Fully adaptive card layout with a sliding bottom-sheet chat drawer optimized for mobile, tablet, and desktop viewports.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, CSS3 (Flexbox/Grid, Responsive `dvh` layouts)
* **Backend:** FastAPI, Python, PyPDF
* **AI & NLP:** Google Gemini API (`gemini-3.6-flash`), LangChain Text Splitters
* **Vector Database:** ChromaDB

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v16+)
* **Python** (v3.10+)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn pypdf langchain-text-splitters chromadb python-dotenv google-genai

# Create .env file and add your Gemini API keys
echo "GEMINI_API_KEY1=your_api_key_1" > .env
echo "GEMINI_API_KEY2=your_api_key_2" >> .env

# Start the server
uvicorn main:app --reload
```

### 2. Frontend Setup

```bash
Bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```
