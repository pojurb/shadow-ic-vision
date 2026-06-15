#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPTS_DIR = __dirname;
const args = process.argv.slice(2);
const command = args[0];
const restArgs = args.slice(1);

const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

function showHelp() {
  console.log(`
${CYAN}============================================${RESET}
${CYAN}  Project Living Thesis - Script Runner${RESET}
${CYAN}============================================${RESET}

${YELLOW}USAGE:${RESET}
  node scripts/run.js <command> [options]

${YELLOW}COMMANDS:${RESET}
  calc <mode> [options]     Run financial calculation
  parse <vertical>          Parse input files from inputs/ folder
  update-state              Update Portfolio_Master_State.md
  check                     Run environment health check
  qa [fixture] [options]     Run the canonical browser QA harness
  help                      Show this help message

${YELLOW}EXAMPLES:${RESET}
  node scripts/run.js calc bep --fixed=500000000 --price=150000 --variable=80000
  node scripts/run.js parse stocks
  node scripts/run.js update-state
  node scripts/run.js check
  node scripts/run.js qa
`);
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

let scriptPath = null;
let nodeArgs = [];

if (command === 'calc') {
  if (restArgs.length < 1) {
    console.error(`${RED}Error: Missing calculation mode.${RESET}`);
    showHelp();
    process.exit(1);
  }
  const mode = restArgs[0];
  const calcArgs = restArgs.slice(1);
  
  scriptPath = mode === 'options' ? path.join(SCRIPTS_DIR, 'sandbox', 'options_pricing.js') : path.join(SCRIPTS_DIR, 'sandbox', 'financial_calc.js');
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${RED}Script not found: ${scriptPath}${RESET}`);
    process.exit(1);
  }
  
  console.log(`\n${GREEN}-> Running calc: ${mode}${RESET}`);
  if (calcArgs.length > 0) {
    console.log(`${GRAY}  Args: ${calcArgs.join(' ')}${RESET}`);
  }
  console.log('');
  
  nodeArgs = [scriptPath, `--mode=${mode}`, ...calcArgs];

} else if (command === 'parse') {
  if (restArgs.length < 1) {
    console.error(`${RED}Error: Missing vertical parameter (stocks, startups, or conventional_biz).${RESET}`);
    showHelp();
    process.exit(1);
  }
  const vertical = restArgs[0];
  scriptPath = path.join(SCRIPTS_DIR, 'ingestion', 'parse_inputs.js');
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${RED}Script not found: ${scriptPath}${RESET}`);
    process.exit(1);
  }
  
  console.log(`\n${GREEN}-> Parsing inputs/${vertical}/${RESET}\n`);
  nodeArgs = [scriptPath, `--vertical=${vertical}`, ...restArgs.slice(1)];

} else if (command === 'update-state') {
  scriptPath = path.join(SCRIPTS_DIR, 'portfolio', 'update_state.js');
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${RED}Script not found: ${scriptPath}${RESET}`);
    process.exit(1);
  }
  
  console.log(`\n${GREEN}Updating Portfolio_Master_State.md...${RESET}\n`);
  nodeArgs = [scriptPath, ...restArgs];

} else if (command === 'check') {
  scriptPath = path.join(SCRIPTS_DIR, 'health_check.js');
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${RED}Script not found: ${scriptPath}${RESET}`);
    process.exit(1);
  }
  
  nodeArgs = [scriptPath, ...restArgs];

} else if (command === 'qa') {
  scriptPath = path.join(SCRIPTS_DIR, 'qa', 'browser_qa.js');

  if (!fs.existsSync(scriptPath)) {
    console.error(`${RED}Script not found: ${scriptPath}${RESET}`);
    process.exit(1);
  }

  console.log(`\n${GREEN}Running browser QA harness...${RESET}\n`);
  nodeArgs = [scriptPath, ...restArgs];

} else {
  console.error(`${RED}Unknown command: ${command}${RESET}`);
  showHelp();
  process.exit(1);
}

// Execute the requested script
const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
if (result.error) {
  console.error(`${RED}Failed to start node process. Is Node.js installed?${RESET}`);
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status !== null ? result.status : 1);
