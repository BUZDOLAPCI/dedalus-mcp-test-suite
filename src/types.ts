/**
 * Types for the MCP Test Suite
 */

export interface TestCase {
  name: string;
  description?: string;
  input: string;
  expectedToolPattern?: string;
  expectedOutputPattern?: string;
  timeout?: number;
}

export interface ServerConfig {
  id: string;
  name: string;
  mcpServer: string;
  enabled?: boolean;
  tests: TestCase[];
}

export interface GlobalConfig {
  model: string;
  maxSteps: number;
  defaultTimeout: number;
  verbose: boolean;
}

export interface TestSuiteConfig {
  servers: ServerConfig[];
  config?: Partial<GlobalConfig>;
}

export interface ToolResult {
  name: string;
  result: string;
  step: number;
  error?: string;
}

export interface TestResult {
  testName: string;
  serverName: string;
  serverId: string;
  passed: boolean;
  duration: number;
  toolsCalled: string[];
  toolResults: ToolResult[];
  finalOutput?: string;
  error?: string;
  expectedToolPattern?: string;
  expectedOutputPattern?: string;
}

export interface ServerTestResults {
  serverId: string;
  serverName: string;
  mcpServer: string;
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface SuiteResults {
  servers: ServerTestResults[];
  totalServers: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  timestamp: string;
}
