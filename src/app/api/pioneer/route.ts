// ─── API Route: Pioneer Fine-Tuning & Inference ─────────────────────
// POST /api/pioneer — run inference, manage datasets, training, evaluations
//
// Actions:
//   { action: "inference", text, schema, threshold? }
//   { action: "extract_jd", text }
//   { action: "list_datasets" }
//   { action: "create_dataset", name, samples, description? }
//   { action: "start_training", modelName, datasets, epochs?, learningRate? }
//   { action: "get_training", id }
//   { action: "list_training" }
//   { action: "run_evaluation", modelId, datasetName }
//   { action: "get_evaluation", id }
//   { action: "list_evaluations" }
//   { action: "health" }

import { NextRequest, NextResponse } from "next/server";
import * as pioneerService from "@/lib/services/pioneer-service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        switch (action) {
            // ─── Cloud Inference ─────────────────────────────────────
            case "inference": {
                const { text, schema, threshold } = body;
                if (!text || !schema) {
                    return NextResponse.json(
                        { success: false, error: "text and schema are required" },
                        { status: 400 }
                    );
                }
                const entities = await pioneerService.inference(text, schema, { threshold });
                return NextResponse.json({ success: true, data: { entities } });
            }

            case "multi_pass_inference": {
                const { text, passes } = body;
                if (!text || !passes) {
                    return NextResponse.json(
                        { success: false, error: "text and passes are required" },
                        { status: 400 }
                    );
                }
                const entities = await pioneerService.multiPassInference(text, passes);
                return NextResponse.json({ success: true, data: { entities } });
            }

            case "extract_jd": {
                const { text } = body;
                if (!text) {
                    return NextResponse.json(
                        { success: false, error: "text is required" },
                        { status: 400 }
                    );
                }
                const result = await pioneerService.extractJDSkillsCloud(text);
                return NextResponse.json({ success: true, data: result });
            }

            // ─── Dataset Management ──────────────────────────────────
            case "list_datasets": {
                const datasets = await pioneerService.listDatasets();
                return NextResponse.json({ success: true, data: { datasets } });
            }

            case "create_dataset": {
                const { name, samples, description } = body;
                if (!name || !samples) {
                    return NextResponse.json(
                        { success: false, error: "name and samples are required" },
                        { status: 400 }
                    );
                }
                const dataset = await pioneerService.createTrainingDataset(name, samples, description);
                return NextResponse.json({ success: true, data: { dataset } });
            }

            case "delete_dataset": {
                const { name } = body;
                if (!name) {
                    return NextResponse.json(
                        { success: false, error: "name is required" },
                        { status: 400 }
                    );
                }
                await pioneerService.deleteDataset(name);
                return NextResponse.json({ success: true, data: { deleted: name } });
            }

            // ─── Training ────────────────────────────────────────────
            case "start_training": {
                const { modelName, datasets, epochs, learningRate } = body;
                if (!modelName || !datasets) {
                    return NextResponse.json(
                        { success: false, error: "modelName and datasets are required" },
                        { status: 400 }
                    );
                }
                const job = await pioneerService.startTraining({
                    modelName,
                    datasets,
                    epochs,
                    learningRate,
                });
                return NextResponse.json({ success: true, data: { job } });
            }

            case "get_training": {
                const { id } = body;
                if (!id) {
                    return NextResponse.json(
                        { success: false, error: "id is required" },
                        { status: 400 }
                    );
                }
                const job = await pioneerService.getTrainingJob(id);
                return NextResponse.json({ success: true, data: { job } });
            }

            case "list_training": {
                const jobs = await pioneerService.listTrainingJobs();
                return NextResponse.json({ success: true, data: { jobs } });
            }

            case "stop_training": {
                const { id } = body;
                if (!id) {
                    return NextResponse.json(
                        { success: false, error: "id is required" },
                        { status: 400 }
                    );
                }
                await pioneerService.stopTraining(id);
                return NextResponse.json({ success: true, data: { stopped: id } });
            }

            // ─── Evaluations ─────────────────────────────────────────
            case "run_evaluation": {
                const { modelId, datasetName } = body;
                if (!modelId || !datasetName) {
                    return NextResponse.json(
                        { success: false, error: "modelId and datasetName are required" },
                        { status: 400 }
                    );
                }
                const evaluation = await pioneerService.runEvaluation(modelId, datasetName);
                return NextResponse.json({ success: true, data: { evaluation } });
            }

            case "get_evaluation": {
                const { id } = body;
                if (!id) {
                    return NextResponse.json(
                        { success: false, error: "id is required" },
                        { status: 400 }
                    );
                }
                const evaluation = await pioneerService.getEvaluation(id);
                return NextResponse.json({ success: true, data: { evaluation } });
            }

            case "list_evaluations": {
                const evaluations = await pioneerService.listEvaluations();
                return NextResponse.json({ success: true, data: { evaluations } });
            }

            // ─── Full Pipeline ───────────────────────────────────────
            case "run_pipeline": {
                const { datasetName, modelName, trainingData, epochs } = body;
                if (!datasetName || !modelName || !trainingData) {
                    return NextResponse.json(
                        { success: false, error: "datasetName, modelName, and trainingData are required" },
                        { status: 400 }
                    );
                }
                const result = await pioneerService.runFineTuningPipeline({
                    datasetName,
                    modelName,
                    trainingData,
                    epochs,
                });
                return NextResponse.json({ success: true, data: result });
            }

            // ─── Deployments ─────────────────────────────────────────
            case "list_deployments": {
                const deployments = await pioneerService.listDeployments();
                return NextResponse.json({ success: true, data: { deployments } });
            }

            // ─── Health ──────────────────────────────────────────────
            case "health": {
                const health = await pioneerService.checkHealth();
                return NextResponse.json({ success: true, data: health });
            }

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (err) {
        console.error("[API] Pioneer error:", err);
        return NextResponse.json(
            { success: false, error: `Pioneer API error: ${err}` },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const health = await pioneerService.checkHealth();
        return NextResponse.json({ success: true, data: health });
    } catch (err) {
        return NextResponse.json(
            { success: false, error: `Health check failed: ${err}` },
            { status: 500 }
        );
    }
}
