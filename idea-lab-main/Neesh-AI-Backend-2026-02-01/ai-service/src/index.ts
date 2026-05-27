import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
import os from 'os';
const networkInterfaces = os.networkInterfaces();
const ips = Object.values(networkInterfaces).flat().filter(i => i?.family === 'IPv4' && !i.internal).map(i => i?.address);

console.log('[AI Service] Loaded ENV:', {
    PORT: process.env.PORT,
    DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not Set',
    RENDER_DISCOVERY_SERVICE: process.env.RENDER_DISCOVERY_SERVICE,
    INTERNAL_IPS: ips
});


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ─── Health Check ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Apply Security Middleware to all /internal routes
import { requireInternalAuth } from './middleware/auth';
app.use('/internal', requireInternalAuth);

import { ChatController } from './controllers/ChatController';
const chatController = new ChatController();

// Internal API routes
app.post('/internal/ingest/:projectId', (req, res) => chatController.ingestProject(req, res));
app.post('/internal/query', (req, res) => chatController.queryVectorStore(req, res));
app.post('/internal/chat', (req, res) => chatController.chatWithProject(req, res));

// Learning Loop Routes
import { LearningController } from './controllers/LearningController';
const learningController = new LearningController();
app.post('/internal/feedback', (req, res) => learningController.submitFeedback(req, res));
app.post('/internal/manual-answer', (req, res) => learningController.submitManualAnswer(req, res));
app.get('/internal/notifications/:projectId', (req, res) => learningController.getNotifications(req, res));

// Insight Routes
import { InsightController } from './controllers/InsightController';
const insightController = new InsightController();
app.get('/internal/projects/:projectId/health', (req, res) => insightController.getProjectHealth(req, res));
app.get('/internal/projects/:projectId/readiness', (req, res) => insightController.getReadiness(req, res));
app.get('/internal/projects/:projectId/risks', (req, res) => insightController.getRisks(req, res));


const server = app.listen(port as number, "0.0.0.0", () => {
    console.log(`AI Service running on port ${port}`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
const shutdown = (signal: string) => {
    console.log(`\n[AI Service] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('[AI Service] HTTP server closed.');
        process.exit(0);
    });
    // Force exit after 10s if connections don't close
    setTimeout(() => {
        console.error('[AI Service] Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Global Error Handling ──────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error('[AI Service] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[AI Service] Uncaught Exception:', error);
    // Optional: Graceful shutdown on error
    // shutdown('uncaughtException');
});
