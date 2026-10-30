# Cognita AI — Backend

**"Understand Your Thinking. Improve Your Reasoning."**

An AI-powered cognitive assessment and adaptive learning system inspired by six Mīmāṃsā reasoning principles. This is the **backend** — a FastAPI application that provides the API consumed by the separately-created React + Vite frontend.

---

## Architecture

```
React + Vite + JavaScript (frontend, separate project)
        ↓
FastAPI (this backend)
        ↓
 ┌───────────────┬─────────────────┐
 ↓               ↓                 ↓
MongoDB Atlas    RAG              OpenAI
                 ↓
        Sentence Transformers (embeddings)
                 ↓
              ChromaDB (vector store)
                 ↓
             LlamaIndex (retrieval)
```

- **MongoDB Atlas** stores users, assessments, cognitive profiles, and training progress.
- **RAG** (Sentence Transformers → ChromaDB → LlamaIndex) provides reasoning knowledge retrieval.
- **OpenAI** evaluates answers, generates training questions, and writes profile summaries.
- **Demo mode** works without datasets or an OpenAI key — demo questions and deterministic fallbacks are used.

---

## Six Cognitive Dimensions

| Dimension | Sanskrit | Skill | Dataset |
|-----------|----------|-------|---------|
| anumana | Anumāna | Logical / inferential reasoning | LogiQA 2.0 |
| arthapatti | Arthāpatti | Abductive reasoning / problem solving | ART |
| upamana | Upamāna | Analogical reasoning | AnaloBench |
| pratyaksha | Pratyakṣa | Observation / visual reasoning | VisReason |
| shabda | Śabda | Reading comprehension / interpretation | RACE |
| anupalabdhi | Anupalabdhi | Absence / contradiction / elimination reasoning | LogiQA / NLI |

These are modern reasoning datasets mapped to Mīmāṃsā-inspired cognitive dimensions. They are **not** traditional Mīmāṃsā datasets.

---

## Folder Structure

```
backend/
├── main.py            # FastAPI app, CORS, routers, health, startup/shutdown
├── config.py          # Environment settings
├── database.py        # MongoDB connection and collections
├── models.py          # Pydantic request/response models
├── auth.py            # Password hashing, JWT, current-user dependency
├── scoring.py         # Response, skill, and overall scoring engine
├── questions.py       # Central cognitive mapping, demo questions, helpers
├── ingest.py          # Dataset ingestion into ChromaDB
│
├── routes/
│   ├── auth.py        # Register, login, me
│   ├── assessment.py  # Pre-assessment start and submit
│   ├── training.py    # Adaptive training generate and submit
│   └── progress.py    # Profile, progress, post-assessment
│
├── services/
│   ├── ai.py          # OpenAI evaluation, question generation, summaries
│   └── rag.py         # ChromaDB + LlamaIndex + Sentence Transformers
│
├── data/
│   └── demo_questions.json   # 12 demo questions (2 per dimension)
│
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Setup

### 1. Python

Install Python 3.11 or 3.12 from [python.org](https://www.python.org/downloads/).

### 2. Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Requirements

```bash
pip install -r requirements.txt
```

### 4. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user.
3. Whitelist your IP address.
4. Copy the connection string.

Set it in `.env`:
```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

### 5. OpenAI Configuration

Get an API key from [platform.openai.com](https://platform.openai.com/api-keys).

Set it in `.env`:
```
OPENAI_API_KEY=sk-...
```

If the key is missing, the backend runs in fallback mode (deterministic evaluation without AI).

### 6. JWT Configuration

Generate a long random secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Set it in `.env`:
```
JWT_SECRET=your_generated_secret_here
```

The backend will not start without `JWT_SECRET`.

### 7. Create .env

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

---

## Running the Backend

```bash
uvicorn main:app --reload
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

---

## Demo Mode

The backend works immediately without real datasets:

- **Demo questions** (12 questions, 2 per dimension) are loaded from `data/demo_questions.json`.
- **MongoDB** still stores real student accounts and assessment results.
- **OpenAI** is used when the API key is present; otherwise deterministic fallbacks are used.
- **RAG** is used when ChromaDB is populated; otherwise demo questions are used.
- Fallbacks never claim to be AI-generated.

---

## Dataset Placement

Download datasets manually and place them under `backend/data/`:

```
backend/data/
├── logiqa/        → anumana
├── art/           → arthapatti
├── analogbench/   → upamana
├── visreason/     → pratyaksha
├── race/          → shabda
└── nli/           → anupalabdhi
```

Supported formats: `.json`, `.jsonl`, `.csv`

Each record should contain (field names are flexible):
- `question` / `text` / `passage` — the question text
- `options` / `choices` — list of answer options
- `correct_answer` / `answer` / `label` — the correct answer

---

## RAG Ingestion

After placing datasets, run:

```bash
python ingest.py
```

The script will:
1. Detect available files in each dataset folder
2. Read supported formats
3. Normalize records
4. Assign cognitive category and metadata
5. Create embeddings with Sentence Transformers
6. Store in ChromaDB at `./chroma_db/`

Missing datasets produce a warning and the script continues with available ones.

---

## Connecting the React Frontend

In the frontend project, create a `.env` file:

```
VITE_API_URL=http://localhost:8000
```

The frontend API client reads `VITE_API_URL` and prepends it to all endpoint paths.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | Bearer | Current user |
| POST | `/api/assessment/start` | Bearer | Start pre-assessment |
| POST | `/api/assessment/submit` | Bearer | Submit pre-assessment |
| GET | `/api/profile` | Bearer | Cognitive profile |
| POST | `/api/training/generate` | Bearer | Generate training question |
| POST | `/api/training/submit` | Bearer | Submit training answer |
| GET | `/api/progress` | Bearer | Progress summary |
| POST | `/api/post-assessment/submit` | Bearer | Submit post-assessment |
| GET | `/api/health` | — | Health check |

---

## Scoring

Each response is scored as:

```
0.60 × correctness + 0.20 × reasoning_quality + 0.10 × relevance + 0.10 × understanding
```

- If objectively incorrect, `correctness_score = 0` (the LLM cannot override this).
- Skill scores = average of response scores per dimension.
- Overall score = average of assessed dimension scores.

Skill levels: 0–39 Beginner, 40–59 Developing, 60–79 Proficient, 80–100 Strong.

---

## Security

- Passwords are hashed with bcrypt — never stored in plaintext.
- JWT tokens carry `user_id`, `email`, and expiration.
- User identity is always derived from the JWT, never from frontend-supplied user IDs.
- Users can only access their own records.
- `password_hash`, MongoDB URI, OpenAI key, and JWT secret are never returned in responses.
- Correct answers are never sent to the frontend before submission.
