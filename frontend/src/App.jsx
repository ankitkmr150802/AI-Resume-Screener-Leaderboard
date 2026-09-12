import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'leaderboard'
  
  // Single Candidate State
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // Leaderboard State
  const [multiResumes, setMultiResumes] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [multiLoading, setMultiLoading] = useState(false);

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleResumeChange = (e) => setResumeFile(e.target.files[0]);
  const handleJdChange = (e) => setJdFile(e.target.files[0]);
  const handleMultiResumeChange = (e) => setMultiResumes(Array.from(e.target.files));

  // Feature 1: "Try Demo" Button
  const handleTryDemo = () => {
    setActiveTab('single');
    setAnalysis({
      candidate_name: "Demo_Candidate_Resume.pdf",
      score: 88,
      strengths: [
        "Strong experience with Node.js, Express, and React (MERN Stack)",
        "Direct hands-on experience with Google Gemini API & Vector RAG pipeline",
        "Proficient in Python and Deep Learning model architecture"
      ],
      gaps: [
        "No direct TypeScript experience listed in project work",
        "Lacks formal AWS cloud deployment certifications"
      ]
    });
  };

  // Single Analysis Call
  const handleAnalyze = async () => {
    if (!resumeFile || !jdFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jd', jdFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      alert('Error analyzing document. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Feature 2: Multi-Resume Leaderboard Call
  const handleMultiAnalyze = async () => {
    if (multiResumes.length === 0 || !jdFile) return;
    setMultiLoading(true);
    const formData = new FormData();
    multiResumes.forEach((file) => formData.append('resumes', file));
    formData.append('jd', jdFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze-multi', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Leaderboard analysis failed');
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      alert('Failed to analyze candidate leaderboard.');
    } finally {
      setMultiLoading(false);
    }
  };

  // Feature 3: Download Match Report (PDF Export)
  const downloadPDFReport = (data) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Candidate Evaluation Report", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Candidate File: ${data.candidate_name || 'Resume'}`, 20, 32);
    doc.text(`Match Score: ${data.score}%`, 20, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Key Strengths:", 20, 52);
    doc.setFont("helvetica", "normal");
    let y = 60;
    data.strengths.forEach((s) => {
      doc.text(`- ${s}`, 25, y);
      y += 8;
    });

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Missing Gaps:", 20, y);
    doc.setFont("helvetica", "normal");
    y += 8;
    data.gaps.forEach((g) => {
      doc.text(`- ${g}`, 25, y);
      y += 8;
    });

    doc.save(`${data.candidate_name || 'candidate'}_evaluation.pdf`);
  };

  // Chat Call
  const handleAskQuestion = async () => {
    if (!question.trim() || chatLoading) return;
    const userMessage = question;
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setQuestion('');
    setChatLoading(true);

    try {
      const response = await fetch(`http://127.0.0.1:8000/chat?question=${encodeURIComponent(userMessage)}`, {
        method: 'POST',
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Error fetching AI response.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="main-card">
        
        {/* Header */}
        <div className="brand-header-container">
          <div className="brand-header">
            <svg className="brand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h1 className="title">AI Resume Screener & Leaderboard</h1>
          </div>
          <button className="btn-demo" onClick={handleTryDemo}>⚡ Try Instant Demo</button>
        </div>
        <p className="subtitle">Automated candidate matching and multi-resume ranking powered by RAG</p>

        {/* Mode Switcher */}
        <div className="tab-switcher">
          <button className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`} onClick={() => setActiveTab('single')}>
            Single Candidate Analysis
          </button>
          <button className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
            🏆 Multi-Resume Leaderboard
          </button>
        </div>

        {/* SINGLE CANDIDATE TAB */}
        {activeTab === 'single' && (
          <>
            <div className="upload-grid">
              <div className="dropzone">
                <div className="dropzone-title">Upload Resume</div>
                <div className="dropzone-subtext">PDF format accepted</div>
                <label className="btn-secondary">
                  Select File
                  <input type="file" accept=".pdf" onChange={handleResumeChange} hidden />
                </label>
                {resumeFile && <span className="file-status-badge">✓ {resumeFile.name}</span>}
              </div>

              <div className="dropzone">
                <div className="dropzone-title">Upload Job Description</div>
                <div className="dropzone-subtext">PDF format accepted</div>
                <label className="btn-secondary">
                  Select File
                  <input type="file" accept=".pdf" onChange={handleJdChange} hidden />
                </label>
                {jdFile && <span className="file-status-badge">✓ {jdFile.name}</span>}
              </div>
            </div>

            <button className="btn-primary" disabled={!resumeFile || !jdFile || loading} onClick={handleAnalyze}>
              {loading ? 'Analyzing Candidate...' : 'Analyze Candidate Match'}
            </button>

            {analysis && (
              <div className="dashboard-grid">
                <div className="score-card">
                  <h3>Match Score</h3>
                  <svg viewBox="0 0 36 36" className="circle-chart">
                    <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="circle" strokeDasharray={`${analysis.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <text x="18" y="20.35" className="percentage">{analysis.score}%</text>
                  </svg>
                  <button className="btn-download" onClick={() => downloadPDFReport(analysis)}>
                    📄 Export PDF Report
                  </button>
                </div>

                <div className="insights-card">
                  <h3>Key Evaluation Insights</h3>
                  <div className="insights-grid">
                    <div className="insight-box strengths">
                      <h4>Key Strengths</h4>
                      <ul>
                        {analysis.strengths?.map((item, idx) => (
                          <li key={idx}><span>✓</span> {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="insight-box gaps">
                      <h4>Missing Gaps</h4>
                      <ul>
                        {analysis.gaps?.map((item, idx) => (
                          <li key={idx}><span>✕</span> {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <>
            <div className="upload-grid">
              <div className="dropzone">
                <div className="dropzone-title">Upload Resumes (Multiple)</div>
                <div className="dropzone-subtext">Select 2 to 5 candidate PDFs</div>
                <label className="btn-secondary">
                  Select Files
                  <input type="file" accept=".pdf" multiple onChange={handleMultiResumeChange} hidden />
                </label>
                {multiResumes.length > 0 && <span className="file-status-badge">✓ {multiResumes.length} Files Selected</span>}
              </div>

              <div className="dropzone">
                <div className="dropzone-title">Upload Job Description</div>
                <div className="dropzone-subtext">Target position PDF</div>
                <label className="btn-secondary">
                  Select File
                  <input type="file" accept=".pdf" onChange={handleJdChange} hidden />
                </label>
                {jdFile && <span className="file-status-badge">✓ {jdFile.name}</span>}
              </div>
            </div>

            <button className="btn-primary" disabled={multiResumes.length === 0 || !jdFile || multiLoading} onClick={handleMultiAnalyze}>
              {multiLoading ? 'Ranking Candidates...' : 'Rank Candidates Leaderboard'}
            </button>

            {leaderboard.length > 0 && (
              <div className="leaderboard-list">
                <h3>Candidate Leaderboard</h3>
                {leaderboard.map((item, index) => (
                  <div key={index} className={`leaderboard-item rank-${index + 1}`}>
                    <div className="rank-badge">
                      {index === 0 ? '🏆 Rank 1' : index === 1 ? '🥈 Rank 2' : index === 2 ? '🥉 Rank 3' : `#${index + 1}`}
                    </div>
                    <div className="candidate-info">
                      <h4>{item.candidate_name || `Candidate ${index + 1}`}</h4>
                      <p>Strengths: {item.strengths?.[0]}</p>
                    </div>
                    <div className="rank-score-badge">{item.score}% Match</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Chat Trigger */}
      {analysis && activeTab === 'single' && (
        <button className="floating-chat-btn" onClick={() => setIsChatOpen(true)}>
          💬 Ask Candidate Q&A
        </button>
      )}

      {/* Chat Overlay */}
      {isChatOpen && (
        <div className="chat-backdrop" onClick={() => setIsChatOpen(false)}>
          <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <h3>Candidate Q&A Assistant</h3>
              <button className="close-btn" onClick={() => setIsChatOpen(false)}>✕</button>
            </div>
            <div className="chat-body">
              {messages.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                  Ask questions about candidate's skills, degree, or experience.
                </p>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.sender}`}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ))}
              {chatLoading && <div className="chat-message ai">Searching resume...</div>}
            </div>
            <div className="chat-footer">
              <input 
                type="text" 
                placeholder="e.g. Does candidate have a CS degree?" 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <button onClick={handleAskQuestion} disabled={chatLoading}>
                {chatLoading ? '...' : 'Ask'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;