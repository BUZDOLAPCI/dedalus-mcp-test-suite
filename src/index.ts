#!/usr/bin/env node

/**
 * Dedalus MCP Server Test Suite
 *
 * A test suite for validating that Dedalus MCP servers are working correctly.
 * Reads server configuration from servers.json and runs end-to-end tests.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

import type { TestSuiteConfig, SuiteResults, GlobalConfig } from './types.js';
import { MCPTestRunner } from './runner.js';
import { Reporter } from './reporter.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG: GlobalConfig = {
  model: 'openai/gpt-4o-mini',
  maxSteps: 5,
  defaultTimeout: 60000,
  verbose: false,
};

async function loadConfig(): Promise<TestSuiteConfig> {
  const configPath = join(__dirname, '..', 'servers.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as TestSuiteConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Configuration file not found at ${configPath}. ` +
        'Please create a servers.json file with your MCP server configurations.'
      );
    }
    throw error;
  }
}

function parseArgs(): { verbose: boolean; server?: string; help: boolean } {
  const args = process.argv.slice(2);
  const result = { verbose: false, server: undefined as string | undefined, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-v' || arg === '--verbose') {
      result.verbose = true;
    } else if (arg === '-s' || arg === '--server') {
      result.server = args[++i];
    } else if (arg === '-h' || arg === '--help') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
${chalk.bold.cyan('Dedalus MCP Server Test Suite')}

${chalk.bold('Usage:')}
  npm test [options]

${chalk.bold('Options:')}
  -v, --verbose       Enable verbose output
  -s, --server <id>   Run tests only for a specific server ID
  -h, --help          Show this help message

${chalk.bold('Configuration:')}
  Edit ${chalk.cyan('servers.json')} to configure which MCP servers to test.
  Set ${chalk.cyan('DEDALUS_API_KEY')} environment variable for authentication.

${chalk.bold('Example:')}
  npm test                           # Run all tests
  npm test -- -v                     # Run with verbose output
  npm test -- -s marketplace-crawler # Run tests for specific server
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Check for API key
  if (!process.env.DEDALUS_API_KEY) {
    console.error(chalk.red('\nError: DEDALUS_API_KEY environment variable is not set.'));
    console.error(chalk.dim('Set it in your .env file or export it in your shell.\n'));
    process.exit(1);
  }

  const reporter = new Reporter(args.verbose);
  reporter.printHeader();

  try {
    // Load configuration
    const config = await loadConfig();
    const globalConfig: GlobalConfig = {
      ...DEFAULT_CONFIG,
      ...config.config,
      verbose: args.verbose || config.config?.verbose || false,
    };

    // Filter servers if specific server requested
    let servers = config.servers;
    if (args.server) {
      servers = servers.filter((s) => s.id === args.server);
      if (servers.length === 0) {
        reporter.printError(`Server with ID "${args.server}" not found in configuration.`);
        console.log(chalk.dim('Available servers:'));
        config.servers.forEach((s) => {
          console.log(chalk.dim(`  - ${s.id}: ${s.name}`));
        });
        process.exit(1);
      }
    }

    // Count enabled servers and tests
    const enabledServers = servers.filter((s) => s.enabled !== false);
    const totalTests = enabledServers.reduce((sum, s) => sum + s.tests.length, 0);

    reporter.printInfo(`Found ${enabledServers.length} server(s) with ${totalTests} test(s)`);
    reporter.printInfo(`Using model: ${globalConfig.model}`);

    // Create runner and execute tests
    const runner = new MCPTestRunner(globalConfig);
    const startTime = Date.now();
    const serverResults = await runner.runAllTests(servers);
    const totalDuration = Date.now() - startTime;

    // Calculate overall results
    const suiteResults: SuiteResults = {
      servers: serverResults,
      totalServers: serverResults.length,
      totalTests: serverResults.reduce((sum, s) => sum + s.totalTests, 0),
      totalPassed: serverResults.reduce((sum, s) => sum + s.passed, 0),
      totalFailed: serverResults.reduce((sum, s) => sum + s.failed, 0),
      totalSkipped: serverResults.reduce((sum, s) => sum + s.skipped, 0),
      totalDuration,
      timestamp: new Date().toISOString(),
    };

    // Print final summary
    reporter.printSuiteSummary(suiteResults);

    // Exit with appropriate code
    process.exit(suiteResults.totalFailed > 0 ? 1 : 0);
  } catch (error) {
    reporter.printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
