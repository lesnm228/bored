import { ProjectConfig, WorkspaceSettings, LogEntry } from '../types';

export const initialProjects: ProjectConfig[] = [
  {
    id: 'proj-eagle-engine',
    name: 'Eagle Engine Core',
    tagline: 'High-throughput async event processor & streaming pipeline',
    description: 'A mission-critical event router and distributed worker framework designed for low-latency batch jobs and real-time streams.',
    framework: 'Node.js / Express / TypeScript',
    version: '1.4.2',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    lastActive: Date.now() - 1000 * 60 * 12,
    branch: 'main',
    repoUrl: 'github.com/production/eagle-engine-core',
    environment: 'development',
    healthScore: 98,
    envVariables: [
      { key: 'PORT', value: '3000', isSecret: false },
      { key: 'NODE_ENV', value: 'development', isSecret: false },
      { key: 'REDIS_CLUSTER_URL', value: 'redis://redis-cluster.internal:6379', isSecret: true },
      { key: 'EVENT_STREAM_KEY', value: 'ak_live_89f0293da8bc12e', isSecret: true },
      { key: 'MAX_CONCURRENCY', value: '64', isSecret: false },
      { key: 'CIRCUIT_BREAKER_TIMEOUT_MS', value: '5000', isSecret: false },
    ],
    files: [
      {
        id: 'f-1',
        path: 'src/index.ts',
        name: 'index.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000 * 60 * 15,
        content: `import express, { Request, Response } from 'express';
import { StreamRouter } from './router/streamRouter';
import { HealthChecker } from './services/healthChecker';
import { MetricsCollector } from './services/metrics';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Core Subsystems
const metrics = new MetricsCollector();
const health = new HealthChecker();
const streamRouter = new StreamRouter(metrics);

app.get('/health', async (_req: Request, res: Response) => {
  const status = await health.check();
  res.status(status.healthy ? 200 : 503).json(status);
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.json(metrics.getSnapshot());
});

app.use('/api/v1/stream', streamRouter.getExpressRouter());

app.listen(PORT, () => {
  console.log(\`⚡ Eagle Engine Core running on port \${PORT}\`);
  metrics.recordStartup();
});
`,
      },
      {
        id: 'f-2',
        path: 'src/router/streamRouter.ts',
        name: 'streamRouter.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000 * 60 * 45,
        content: `import { Router, Request, Response } from 'express';
import { MetricsCollector } from '../services/metrics';

export interface EventPayload {
  id: string;
  channel: string;
  data: Record<string, unknown>;
  timestamp: number;
  priority?: 'high' | 'normal' | 'low';
}

export class StreamRouter {
  private router: Router;
  private metrics: MetricsCollector;
  private queue: EventPayload[] = [];

  constructor(metrics: MetricsCollector) {
    this.router = Router();
    this.metrics = metrics;
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/publish', (req: Request, res: Response) => {
      const { channel, data, priority } = req.body;

      if (!channel || !data) {
        res.status(400).json({ error: 'channel and data fields are required' });
        return;
      }

      const event: EventPayload = {
        id: \`evt_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`,
        channel,
        data,
        priority: priority || 'normal',
        timestamp: Date.now()
      };

      this.queue.push(event);
      this.metrics.incrementIngestCount();

      res.status(202).json({
        accepted: true,
        eventId: event.id,
        queuedAt: event.timestamp,
      });
    });

    this.router.get('/queue/stats', (_req: Request, res: Response) => {
      res.json({
        depth: this.queue.length,
        throughput: this.metrics.getIngestRate(),
      });
    });
  }

  public getExpressRouter(): Router {
    return this.router;
  }
}
`,
      },
      {
        id: 'f-3',
        path: 'src/services/healthChecker.ts',
        name: 'healthChecker.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000 * 60 * 120,
        content: `export interface HealthReport {
  healthy: boolean;
  timestamp: number;
  uptimeSeconds: number;
  memoryUsageMb: number;
  dependencies: {
    redis: 'connected' | 'degraded' | 'disconnected';
    database: 'connected' | 'degraded' | 'disconnected';
  };
}

export class HealthChecker {
  private startTime = Date.now();

  public async check(): Promise<HealthReport> {
    const memory = process.memoryUsage();
    return {
      healthy: true,
      timestamp: Date.now(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
      dependencies: {
        redis: 'connected',
        database: 'connected',
      },
    };
  }
}
`,
      },
      {
        id: 'f-4',
        path: 'src/services/metrics.ts',
        name: 'metrics.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000 * 60 * 90,
        content: `export class MetricsCollector {
  private ingestCount = 0;
  private startTime = Date.now();
  private latencyHistory: number[] = [];

  public recordStartup(): void {
    this.startTime = Date.now();
  }

  public incrementIngestCount(): void {
    this.ingestCount++;
  }

  public recordLatency(durationMs: number): void {
    this.latencyHistory.push(durationMs);
    if (this.latencyHistory.length > 500) {
      this.latencyHistory.shift();
    }
  }

  public getIngestRate(): number {
    const elapsedSeconds = Math.max(1, (Date.now() - this.startTime) / 1000);
    return Math.round((this.ingestCount / elapsedSeconds) * 100) / 100;
  }

  public getSnapshot() {
    const avgLatency = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length)
      : 2.4;

    return {
      totalIngested: this.ingestCount,
      ratePerSec: this.getIngestRate(),
      p95LatencyMs: avgLatency * 1.8,
      avgLatencyMs: avgLatency,
      activeWorkers: 12,
    };
  }
}
`,
      },
      {
        id: 'f-5',
        path: 'package.json',
        name: 'package.json',
        language: 'json',
        lastModified: Date.now() - 1000 * 60 * 300,
        content: `{
  "name": "eagle-engine-core",
  "version": "1.4.2",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/ --ext .ts"
  },
  "dependencies": {
    "express": "^4.21.2",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@typescript-eslint/eslint-plugin": "^8.26.0",
    "@typescript-eslint/parser": "^8.26.0",
    "eslint": "^8.57.1",
    "tsx": "^4.21.0",
    "typescript": "^5.8.2",
    "vitest": "^2.0.0"
  }
}
`,
      },
      {
        id: 'f-6',
        path: 'README.md',
        name: 'README.md',
        language: 'markdown',
        lastModified: Date.now() - 1000 * 60 * 300,
        content: `# Eagle Engine Core

Eagle Engine Core is an ultra-fast event router engineered for sub-millisecond dispatch and streaming telemetry.

## Features
- **High Concurrency**: Handles 50k+ events/sec with minimal memory footprint.
- **Fail-Safe Circuit Breaker**: Automatic backpressure regulation.
- **Dynamic Routing**: Channel-based priority queues.
- **Telemetry Ready**: Real-time metrics and dependency health endpoints.
`,
      },
    ],
    tasks: [
      {
        id: 'task-101',
        title: 'Implement sliding-window rate limiting on /publish',
        description: 'Add token bucket rate limiter to prevent ingestion spikes from exceeding cluster memory buffers.',
        status: 'completed',
        priority: 'high',
        assignedTo: 'builder-agent',
        targetFiles: ['src/router/streamRouter.ts'],
        createdAt: Date.now() - 1000 * 60 * 180,
        completedAt: Date.now() - 1000 * 60 * 45,
        subtasks: [
          { id: 'sub-1', title: 'Define RateLimitConfig interface', completed: true },
          { id: 'sub-2', title: 'Implement Redis sliding window counter', completed: true },
          { id: 'sub-3', title: 'Add HTTP 429 Too Many Requests response handler', completed: true },
        ],
      },
      {
        id: 'task-102',
        title: 'Add JWT Signature verification middleware',
        description: 'Enforce asymmetric RS256 token verification on all inbound event streams.',
        status: 'in_progress',
        priority: 'critical',
        assignedTo: 'builder-agent',
        targetFiles: ['src/index.ts', 'src/middleware/auth.ts'],
        createdAt: Date.now() - 1000 * 60 * 60,
        subtasks: [
          { id: 'sub-4', title: 'Create AuthMiddleware class with key cache', completed: true },
          { id: 'sub-5', title: 'Integrate JWKS endpoint validation', completed: false },
          { id: 'sub-6', title: 'Write unit tests for invalid signatures', completed: false },
        ],
      },
      {
        id: 'task-103',
        title: 'Optimize batch payload serialization',
        description: 'Benchmark MessagePack vs JSON serialization for 10KB+ event payloads.',
        status: 'pending',
        priority: 'medium',
        assignedTo: 'builder-agent',
        targetFiles: ['src/services/metrics.ts'],
        createdAt: Date.now() - 1000 * 60 * 30,
        subtasks: [
          { id: 'sub-7', title: 'Set up Benchmark harness', completed: false },
          { id: 'sub-8', title: 'Measure heap allocation and GC pressure', completed: false },
        ],
      },
    ],
    tests: [
      {
        id: 'test-1',
        name: 'should return 200 and healthy status on GET /health',
        file: 'test/health.test.ts',
        suite: 'Health Check Suite',
        status: 'passed',
        durationMs: 14,
        lastRun: Date.now() - 1000 * 60 * 20,
      },
      {
        id: 'test-2',
        name: 'should enqueue valid payload and return eventId on POST /publish',
        file: 'test/router.test.ts',
        suite: 'Stream Router Suite',
        status: 'passed',
        durationMs: 22,
        lastRun: Date.now() - 1000 * 60 * 20,
      },
      {
        id: 'test-3',
        name: 'should reject request when channel or data is missing',
        file: 'test/router.test.ts',
        suite: 'Stream Router Suite',
        status: 'passed',
        durationMs: 18,
        lastRun: Date.now() - 1000 * 60 * 20,
      },
      {
        id: 'test-4',
        name: 'should track accurate p95 latency and ingest throughput',
        file: 'test/metrics.test.ts',
        suite: 'Metrics Collector Suite',
        status: 'passed',
        durationMs: 31,
        lastRun: Date.now() - 1000 * 60 * 20,
      },
      {
        id: 'test-5',
        name: 'should verify RS256 token authorization headers',
        file: 'test/auth.test.ts',
        suite: 'Security & Auth Suite',
        status: 'idle',
        durationMs: 0,
      },
    ],
    deployments: [
      {
        id: 'dep-1002',
        environment: 'staging',
        version: 'v1.4.2-rc.1',
        commitHash: '8f93e1a',
        status: 'active',
        deployedAt: Date.now() - 1000 * 60 * 60 * 5,
        url: 'https://staging-eagle-engine.internal.run.app',
        author: 'Builder Agent',
        branch: 'main',
        buildDurationSec: 42,
        logs: [
          '[BUILD] Step 1/4: Resolving TypeScript dependencies...',
          '[BUILD] Step 2/4: Compiling target ES2022 bundle...',
          '[BUILD] Step 3/4: Executing test suite (4/4 passed)...',
          '[DEPLOY] Deploying container image to Cloud Run staging...',
          '[SUCCESS] Routing 100% traffic to revision eagle-engine-v1-4-2',
        ],
      },
      {
        id: 'dep-1001',
        environment: 'production',
        version: 'v1.4.1',
        commitHash: '3a18ef2',
        status: 'active',
        deployedAt: Date.now() - 1000 * 60 * 60 * 48,
        url: 'https://api.eagle-engine.network',
        author: 'Kelvin (Owner)',
        branch: 'main',
        buildDurationSec: 54,
        logs: [
          '[BUILD] Production pipeline initiated',
          '[TESTS] 18 passed across 4 test suites',
          '[RELEASE] Tagged v1.4.1 [verified signature]',
          '[DEPLOY] Live traffic switch verified healthy (0.00% error rate)',
        ],
      },
    ],
    history: [
      {
        id: 'hist-1',
        timestamp: Date.now() - 1000 * 60 * 45,
        type: 'agent_instruction',
        title: 'Rate limiter implementation completed',
        description: 'Agent implemented sliding window buffer and error response headers.',
        author: 'Builder Agent',
        diff: [{ file: 'src/router/streamRouter.ts', added: 28, removed: 4 }],
      },
      {
        id: 'hist-2',
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
        type: 'deployment',
        title: 'Deployed v1.4.2-rc.1 to Staging',
        description: 'Successful staging deployment via automated builder pipeline.',
        author: 'Builder Agent',
      },
      {
        id: 'hist-3',
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
        type: 'test_run',
        title: 'Full test suite passed (4/4)',
        description: 'Automated test verification completed in 85ms.',
        author: 'Test Runner',
      },
    ],
  },
  {
    id: 'proj-neural-pipeline',
    name: 'Neural Pipeline Gateway',
    tagline: 'Autonomous data transformer and schema validator',
    description: 'Extracts, validates, and routes unstructured payloads to microservices with strict schema enforcement.',
    framework: 'React / Vite / TypeScript',
    version: '0.9.8',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    lastActive: Date.now() - 1000 * 60 * 120,
    branch: 'feature/schema-v2',
    environment: 'development',
    healthScore: 94,
    envVariables: [
      { key: 'VITE_API_ENDPOINT', value: 'https://api.neural-gateway.internal', isSecret: false },
      { key: 'VITE_LOG_LEVEL', value: 'debug', isSecret: false },
      { key: 'GATEWAY_SECRET', value: 'gw_sec_78ab41cd99e', isSecret: true },
    ],
    files: [
      {
        id: 'f-201',
        path: 'src/schema/validator.ts',
        name: 'validator.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000 * 60 * 180,
        content: `export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
}

export class SchemaValidator {
  public validate(data: Record<string, unknown>, rules: ValidationRule[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const rule of rules) {
      if (rule.required && (data[rule.field] === undefined || data[rule.field] === null)) {
        errors.push(\`Missing required field: \${rule.field}\`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
`,
      },
      {
        id: 'f-202',
        path: 'package.json',
        name: 'package.json',
        language: 'json',
        lastModified: Date.now() - 1000 * 60 * 600,
        content: `{
  "name": "neural-pipeline-gateway",
  "version": "0.9.8",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  }
}
`,
      },
    ],
    tasks: [
      {
        id: 'task-201',
        title: 'Add nested object schema validation',
        description: 'Support recursive tree validation for deep JSON payloads.',
        status: 'pending',
        priority: 'high',
        assignedTo: 'builder-agent',
        createdAt: Date.now() - 1000 * 60 * 150,
      },
    ],
    tests: [
      {
        id: 'test-201',
        name: 'should validate standard flat JSON schema',
        file: 'test/validator.test.ts',
        suite: 'Validator Suite',
        status: 'passed',
        durationMs: 12,
        lastRun: Date.now() - 1000 * 60 * 180,
      },
    ],
    deployments: [],
    history: [],
  },
];

export const initialWorkspaceSettings: WorkspaceSettings = {
  theme: 'dark-navy',
  autonomyLevel: 'semi_autonomous',
  maxStepBudget: 15,
  autoRunTests: true,
  autoFormatCode: true,
  strictTypeValidation: true,
  telemetryEnabled: true,
  notificationSound: true,
  apiKeyConfigured: true,
  customInstructions: 'Prioritize type safety, clean modular architecture, rigorous unit tests, and production resilience.',
};

export const defaultSettings = initialWorkspaceSettings;

export const sampleInitialLogs: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: Date.now() - 1000 * 60 * 15,
    level: 'info',
    source: 'system',
    message: 'Builder Board core workstation initialized in dark navy environment.',
  },
  {
    id: 'log-2',
    timestamp: Date.now() - 1000 * 60 * 14,
    level: 'agent',
    source: 'agent',
    message: 'Autonomous Builder Agent standing by. Project "Eagle Engine Core" loaded with 6 files, 3 tasks, and 5 tests.',
  },
  {
    id: 'log-3',
    timestamp: Date.now() - 1000 * 60 * 12,
    level: 'debug',
    source: 'compiler',
    message: 'Virtual filesystem watcher connected. TypeScript compiler ready.',
  },
];
