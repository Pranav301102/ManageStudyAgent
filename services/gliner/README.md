# GLiNER Microservice

Zero-shot Named Entity Recognition service for extracting skills, technologies, algorithms, and data structures from interview transcripts, code, and job descriptions.

Uses the [GLiNER](https://github.com/urchade/GLiNER) Python package — a local model, **no external API required**.

## Quick Start

### Local (Python)

```bash
cd services/gliner
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The service starts on `http://localhost:8080`.

### Docker

```bash
docker build -t gliner-service .
docker run -p 8080:8080 gliner-service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GLINER_MODEL` | `urchade/gliner_medium-v2.1` | HuggingFace model name |
| `GLINER_PORT` | `8080` | Server port |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allowed origin |
| `LOG_LEVEL` | `INFO` | Logging level |

## API

### `GET /health`

Health check — confirms model is loaded.

```json
{ "status": "ok", "model": "urchade/gliner_medium-v2.1", "ready": true }
```

### `POST /predict`

Extract entities from a single text.

```json
{
  "text": "I built a REST API with FastAPI and deployed it on Kubernetes",
  "labels": ["framework", "technology", "cloud_service"],
  "threshold": 0.4
}
```

Response:

```json
{
  "entities": [
    { "text": "REST", "label": "technology", "score": 0.92 },
    { "text": "FastAPI", "label": "framework", "score": 0.97 },
    { "text": "Kubernetes", "label": "technology", "score": 0.95 }
  ],
  "model": "urchade/gliner_medium-v2.1",
  "text_length": 62
}
```

### `POST /batch`

Extract entities from multiple texts in one call.

```json
{
  "texts": ["I know Python and React", "Experience with DFS and BFS"],
  "labels": ["programming_language", "framework", "algorithm"],
  "threshold": 0.4
}
```

## Integration

The Next.js app connects to this service via the `GLINER_API_URL` env var (defaults to `http://localhost:8080`). The client code is in `src/lib/services/gliner-service.ts`.
