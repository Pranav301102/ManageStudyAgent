"""
GLiNER Microservice — Zero-Shot Named Entity Recognition
=========================================================
A lightweight FastAPI service that wraps the GLiNER Python package
for real-time, zero-shot entity extraction from interview transcripts,
code content, and job descriptions.

Runs on port 8080 by default.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from gliner import GLiNER

# ─── Config ──────────────────────────────────────────────────────────

MODEL_NAME = os.getenv("GLINER_MODEL", "urchade/gliner_medium-v2.1")
HOST = os.getenv("GLINER_HOST", "0.0.0.0")
PORT = int(os.getenv("GLINER_PORT", "8080"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gliner-service")

# ─── Model Singleton ────────────────────────────────────────────────

model: Optional[GLiNER] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the GLiNER model once at startup."""
    global model
    logger.info("Loading GLiNER model: %s", MODEL_NAME)
    model = GLiNER.from_pretrained(MODEL_NAME)
    logger.info("GLiNER model loaded successfully")
    yield
    logger.info("Shutting down GLiNER service")


# ─── FastAPI App ─────────────────────────────────────────────────────

app = FastAPI(
    title="GLiNER Microservice",
    description="Zero-shot NER for skill/entity extraction from interview content",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ─────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Request body for the /predict endpoint."""
    text: str = Field(..., min_length=1, description="Text to extract entities from")
    labels: list[str] = Field(
        default=[
            "programming_language",
            "framework",
            "algorithm",
            "data_structure",
            "design_pattern",
            "technology",
            "database",
            "cloud_service",
            "concept",
            "methodology",
        ],
        description="Entity type labels for zero-shot extraction",
    )
    threshold: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for entity detection",
    )


class Entity(BaseModel):
    text: str
    label: str
    score: float


class PredictResponse(BaseModel):
    entities: list[Entity]
    model: str
    text_length: int


class BatchPredictRequest(BaseModel):
    """Batch extraction across multiple texts."""
    texts: list[str] = Field(..., min_length=1, max_length=50)
    labels: list[str] = Field(
        default=[
            "programming_language",
            "framework",
            "algorithm",
            "data_structure",
            "technology",
        ],
    )
    threshold: float = Field(default=0.4, ge=0.0, le=1.0)


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]


class HealthResponse(BaseModel):
    status: str
    model: str
    ready: bool


# ─── Routes ──────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check — confirms the model is loaded and ready."""
    return HealthResponse(
        status="ok" if model is not None else "loading",
        model=MODEL_NAME,
        ready=model is not None,
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Extract named entities from a single text.

    The Next.js frontend calls this endpoint via the gliner-service.ts client.
    Returns structured entities with confidence scores.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        raw_entities = model.predict_entities(
            req.text,
            req.labels,
            threshold=req.threshold,
        )

        entities = [
            Entity(
                text=ent["text"],
                label=ent["label"],
                score=round(ent["score"], 4),
            )
            for ent in raw_entities
        ]

        # Deduplicate: keep highest-scoring occurrence of each (text, label) pair
        seen: dict[tuple[str, str], Entity] = {}
        for ent in entities:
            key = (ent.text.lower(), ent.label)
            if key not in seen or ent.score > seen[key].score:
                seen[key] = ent
        entities = list(seen.values())

        logger.info(
            "Extracted %d entities from %d chars (labels=%s)",
            len(entities),
            len(req.text),
            req.labels,
        )

        return PredictResponse(
            entities=entities,
            model=MODEL_NAME,
            text_length=len(req.text),
        )

    except Exception as e:
        logger.error("Prediction failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post("/batch", response_model=BatchPredictResponse)
async def batch_predict(req: BatchPredictRequest):
    """
    Extract entities from multiple texts in one call.

    Useful for processing full interview transcripts split by question,
    or multiple JD sections simultaneously.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    results = []
    for text in req.texts:
        try:
            raw_entities = model.predict_entities(
                text,
                req.labels,
                threshold=req.threshold,
            )

            entities = [
                Entity(
                    text=ent["text"],
                    label=ent["label"],
                    score=round(ent["score"], 4),
                )
                for ent in raw_entities
            ]

            results.append(
                PredictResponse(
                    entities=entities,
                    model=MODEL_NAME,
                    text_length=len(text),
                )
            )
        except Exception as e:
            logger.error("Batch prediction failed for text: %s", e)
            results.append(
                PredictResponse(entities=[], model=MODEL_NAME, text_length=len(text))
            )

    logger.info("Batch processed %d texts", len(req.texts))
    return BatchPredictResponse(results=results)


# ─── Entrypoint ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
