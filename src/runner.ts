/**
 * Test runner for MCP servers using the Dedalus SDK
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';
import { RunResult } from 'dedalus-labs/lib/runner/index.js';
import type {
  TestCase,
  ServerConfig,
  GlobalConfig,
  TestResult,
  ServerTestResults,
  ToolResult,
} from './types.js';
import { Reporter } from './reporter.js';

const DEFAULT_CONFIG: GlobalConfig = {
  model: 'openai/gpt-4o-mini',
  maxSteps: 5,
  defaultTimeout: 60000,
  verbose: false,
};

export class MCPTestRunner {
  private client: Dedalus;
  private runner: DedalusRunner;
  private config: GlobalConfig;
  private reporter: Reporter;

  constructor(config: Partial<GlobalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Dedalus();
    this.runner = new DedalusRunner(this.client, this.config.verbose);
    this.reporter = new Reporter(this.config.verbose);
  }

  /**
   * Run a single test case against an MCP server
   */
  async runTest(
    test: TestCase,
    serverConfig: ServerConfig
  ): Promise<TestResult> {
    const startTime = Date.now();
    const timeout = test.timeout ?? this.config.defaultTimeout;

    this.reporter.printTestStart(test.name);

    try {
      // Run the test with the MCP server (with retry for transient errors)
      if (this.config.verbose) {
        console.log(`    [DEBUG] Calling Dedalus API with MCP server: ${serverConfig.mcpServer}`);
      }

      const maxRetries = 2;
      let lastError: Error | null = null;
      let result: RunResult | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0 && this.config.verbose) {
            console.log(`    [DEBUG] Retry attempt ${attempt}/${maxRetries}...`);
          }

          result = await this.runner.run({
            input: test.input,
            model: this.config.model,
            mcpServers: [serverConfig.mcpServer],
            maxSteps: this.config.maxSteps,
            verbose: this.config.verbose,
            debug: this.config.verbose,
          }) as RunResult;

          break; // Success, exit retry loop
        } catch (err: any) {
          lastError = err;
          // Retry on 5xx errors
          if (err?.status >= 500 && attempt < maxRetries) {
            if (this.config.verbose) {
              console.log(`    [DEBUG] API error ${err.status}, retrying in ${2 * (attempt + 1)}s...`);
            }
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }

      if (!result) {
        throw lastError || new Error('Unknown error');
      }

      const duration = Date.now() - startTime;

      // Extract tool information from the result
      const toolsCalled: string[] = result.toolsCalled ?? [];
      const toolResults: ToolResult[] = (result.toolResults ?? []).map((tr: any) => ({
        name: tr.name,
        result: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        step: tr.step,
        error: tr.error,
      }));

      // Check for errors in tool results
      const hasToolErrors = toolResults.some((tr) => tr.error);

      // Validate expected patterns
      let passed = true;
      let error: string | undefined;

      // Check for a valid response
      if (!result.finalOutput || result.finalOutput.trim() === '') {
        passed = false;
        error = 'No output received from the MCP server';
      }

      // Check expected tool pattern (only if specified and tools were called)
      // Note: Some MCP servers execute tools server-side without reporting them
      if (passed && test.expectedToolPattern && toolsCalled.length > 0) {
        const pattern = new RegExp(test.expectedToolPattern, 'i');
        const matchedTool = toolsCalled.some((tool) => pattern.test(tool));
        if (!matchedTool) {
          passed = false;
          error = `Expected tool matching pattern "${test.expectedToolPattern}" was not called. Tools called: ${toolsCalled.join(', ')}`;
        }
      }

      // Check expected output pattern
      if (passed && test.expectedOutputPattern && result.finalOutput) {
        const pattern = new RegExp(test.expectedOutputPattern, 'i');
        if (!pattern.test(result.finalOutput)) {
          passed = false;
          error = `Output did not match expected pattern "${test.expectedOutputPattern}"`;
        }
      }

      // Check for tool execution errors
      if (passed && hasToolErrors) {
        passed = false;
        const errorTool = toolResults.find((tr) => tr.error);
        error = `Tool "${errorTool?.name}" failed: ${errorTool?.error}`;
      }

      const testResult: TestResult = {
        testName: test.name,
        serverName: serverConfig.name,
        serverId: serverConfig.id,
        passed,
        duration,
        toolsCalled,
        toolResults,
        finalOutput: result.finalOutput,
        error,
        expectedToolPattern: test.expectedToolPattern,
        expectedOutputPattern: test.expectedOutputPattern,
      };

      this.reporter.printTestResult(testResult);
      return testResult;
    } catch (err: any) {
      const duration = Date.now() - startTime;

      // Parse error message for better display
      let errorMessage: string;
      if (err?.status) {
        // API error
        errorMessage = `API Error ${err.status}: ${err.message?.split('\n')[0] || 'Unknown error'}`;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = String(err);
      }

      const testResult: TestResult = {
        testName: test.name,
        serverName: serverConfig.name,
        serverId: serverConfig.id,
        passed: false,
        duration,
        toolsCalled: [],
        toolResults: [],
        error: errorMessage,
        expectedToolPattern: test.expectedToolPattern,
        expectedOutputPattern: test.expectedOutputPattern,
      };

      this.reporter.printTestResult(testResult);
      return testResult;
    }
  }

  /**
   * Run all tests for a single server
   */
  async runServerTests(serverConfig: ServerConfig): Promise<ServerTestResults> {
    const startTime = Date.now();

    this.reporter.printServerStart(serverConfig.name, serverConfig.mcpServer);

    const results: TestResult[] = [];

    for (const test of serverConfig.tests) {
      const result = await this.runTest(test, serverConfig);
      results.push(result);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    const serverResults: ServerTestResults = {
      serverId: serverConfig.id,
      serverName: serverConfig.name,
      mcpServer: serverConfig.mcpServer,
      results,
      totalTests: results.length,
      passed,
      failed,
      skipped: 0,
      duration,
    };

    this.reporter.printServerSummary(serverResults);
    return serverResults;
  }

  /**
   * Run tests for multiple servers
   */
  async runAllTests(servers: ServerConfig[]): Promise<ServerTestResults[]> {
    const enabledServers = servers.filter((s) => s.enabled !== false);

    if (enabledServers.length === 0) {
      this.reporter.printWarning('No enabled servers to test');
      return [];
    }

    const results: ServerTestResults[] = [];

    for (const server of enabledServers) {
      const serverResults = await this.runServerTests(server);
      results.push(serverResults);
    }

    return results;
  }
}
