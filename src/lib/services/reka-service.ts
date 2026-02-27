// ─── Reka Vision Service — Multimodal Whiteboard Analysis ────────────
// Sends whiteboard snapshots to Reka Vision API for spatial reasoning,
// architectural analysis, and contextual feedback during system design interviews.

import { config } from "../config";
import { RekaVisionAnalysis } from "../types";

const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.reka.apiKey}`,
});

/**
 * Analyze a whiteboard snapshot using Reka Vision API.
 * Returns a structured description of the architecture/diagram.
 */
export async function analyzeWhiteboard(
    imageBase64: string,
    context: string
): Promise<RekaVisionAnalysis> {
    try {
        const res = await fetch(`${config.reka.baseUrl}/chat`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
                model: "reka-flash",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `You are an expert system design interviewer analyzing a candidate's whiteboard drawing. Context: ${context}\n\nAnalyze this whiteboard and return JSON with:\n- "description": what the candidate has drawn\n- "detectedPatterns": array of architecture patterns visible (e.g. "load balancer", "microservices", "message queue")\n- "suggestions": array of things missing or improvements needed\n\nRespond ONLY with valid JSON.`,
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 500,
            }),
        });

        if (!res.ok) throw new Error(`Reka API error: ${res.status}`);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "{}";

        try {
            const parsed = JSON.parse(content);
            return {
                description: parsed.description || "Unable to parse whiteboard",
                detectedPatterns: parsed.detectedPatterns || [],
                suggestions: parsed.suggestions || [],
                timestamp: Date.now(),
            };
        } catch {
            return {
                description: content,
                detectedPatterns: [],
                suggestions: [],
                timestamp: Date.now(),
            };
        }
    } catch (err) {
        console.warn("[Reka] Whiteboard analysis failed:", err);
        return {
            description: "Analysis unavailable",
            detectedPatterns: [],
            suggestions: [],
            timestamp: Date.now(),
        };
    }
}

/**
 * Analyze a webcam frame for facial expression (optional feature).
 * Detects confusion, stress, or engagement to adjust interviewer tone.
 */
export async function analyzeFacialExpression(
    imageBase64: string
): Promise<{ emotion: string; confidence: number }> {
    try {
        const res = await fetch(`${config.reka.baseUrl}/chat`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
                model: "reka-flash",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: 'Analyze this webcam image of a person in a technical interview. What is their emotional state? Respond with JSON: {"emotion": "focused|confused|stressed|confident|engaged", "confidence": 0.0-1.0}',
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 100,
            }),
        });

        if (!res.ok) throw new Error(`Reka facial analysis failed: ${res.status}`);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        try {
            return JSON.parse(content);
        } catch {
            return { emotion: "unknown", confidence: 0 };
        }
    } catch (err) {
        console.warn("[Reka] Facial analysis failed:", err);
        return { emotion: "unknown", confidence: 0 };
    }
}
