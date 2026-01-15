/**
 * Console reporter for test results
 */

import chalk from 'chalk';
import type { TestResult, ServerTestResults, SuiteResults } from './types.js';

const SYMBOLS = {
  pass: chalk.green('✓'),
  fail: chalk.red('✗'),
  skip: chalk.yellow('○'),
  bullet: chalk.dim('•'),
  arrow: chalk.dim('→'),
};

export class Reporter {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  printHeader(): void {
    console.log();
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('           Dedalus MCP Server Test Suite                '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log();
  }

  printServerStart(serverName: string, mcpServer: string): void {
    console.log(chalk.bold.white(`\n▸ Testing: ${serverName}`));
    console.log(chalk.dim(`  Server: ${mcpServer}`));
    console.log();
  }

  printTestStart(testName: string): void {
    if (this.verbose) {
      console.log(chalk.dim(`  Running: ${testName}...`));
    }
  }

  printTestResult(result: TestResult): void {
    const symbol = result.passed ? SYMBOLS.pass : SYMBOLS.fail;
    const duration = chalk.dim(`(${result.duration}ms)`);

    console.log(`  ${symbol} ${result.testName} ${duration}`);

    if (result.toolsCalled.length > 0) {
      console.log(chalk.dim(`    ${SYMBOLS.arrow} Tools called: ${result.toolsCalled.join(', ')}`));
    }

    if (!result.passed && result.error) {
      console.log(chalk.red(`    ${SYMBOLS.bullet} Error: ${result.error}`));
    }

    if (this.verbose && result.finalOutput) {
      const truncated = result.finalOutput.length > 200
        ? result.finalOutput.substring(0, 200) + '...'
        : result.finalOutput;
      console.log(chalk.dim(`    ${SYMBOLS.bullet} Output: ${truncated}`));
    }
  }

  printServerSummary(results: ServerTestResults): void {
    const passedColor = results.passed === results.totalTests ? chalk.green : chalk.yellow;

    console.log();
    console.log(chalk.dim('  ─────────────────────────────────────'));
    console.log(
      `  ${passedColor(`${results.passed}/${results.totalTests} tests passed`)} ` +
      chalk.dim(`in ${results.duration}ms`)
    );

    if (results.failed > 0) {
      console.log(chalk.red(`  ${results.failed} test(s) failed`));
    }
  }

  printSuiteSummary(results: SuiteResults): void {
    console.log();
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                    Test Summary                        '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log();

    // Server breakdown
    for (const server of results.servers) {
      const status = server.failed === 0
        ? chalk.green('PASS')
        : chalk.red('FAIL');
      console.log(`  ${status} ${server.serverName} (${server.passed}/${server.totalTests})`);
    }

    console.log();
    console.log(chalk.dim('─────────────────────────────────────────────────────────'));
    console.log();

    // Overall summary
    const allPassed = results.totalFailed === 0;
    const summaryColor = allPassed ? chalk.green : chalk.red;

    console.log(`  Servers:  ${results.totalServers}`);
    console.log(`  Tests:    ${results.totalTests}`);
    console.log(summaryColor(`  Passed:   ${results.totalPassed}`));

    if (results.totalFailed > 0) {
      console.log(chalk.red(`  Failed:   ${results.totalFailed}`));
    }

    if (results.totalSkipped > 0) {
      console.log(chalk.yellow(`  Skipped:  ${results.totalSkipped}`));
    }

    console.log(`  Duration: ${results.totalDuration}ms`);
    console.log();

    // Final status
    if (allPassed) {
      console.log(chalk.bold.green('  ✓ All tests passed!'));
    } else {
      console.log(chalk.bold.red(`  ✗ ${results.totalFailed} test(s) failed`));
    }

    console.log();
  }

  printError(message: string): void {
    console.log(chalk.red(`\n  Error: ${message}\n`));
  }

  printWarning(message: string): void {
    console.log(chalk.yellow(`\n  Warning: ${message}\n`));
  }

  printInfo(message: string): void {
    console.log(chalk.dim(`  ${message}`));
  }
}
