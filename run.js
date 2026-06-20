/**
 * Multi-Runner for WhatsApp Marketing Platform
 * Runs both the Next.js Frontend and Express Backend concurrently with unified env mapping
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI Terminal Colors for Wow factor
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

// Branded Startup Header
console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}    ⚡  WHATSAPP MARKETING PLATFORM CONCURRENT RUNNER  ⚡               ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

// 1. Parse and load root .env
const envVars = {};
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log(`${colors.bold}${colors.green}✓ Environment: ${colors.reset}Found root .env file. Parsing variables...`);
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex > 0) {
      const key = trimmed.slice(0, separatorIndex).trim();
      let val = trimmed.slice(separatorIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
      // Inject into current process env
      process.env[key] = val;
    }
  });
  console.log(`${colors.green}✓ Configuration: ${colors.reset}Successfully loaded ${colors.bold}${Object.keys(envVars).length}${colors.reset} variables from root .env.\n`);
} else {
  console.log(`${colors.bold}${colors.yellow}⚠ Warning: .env file not found at root!${colors.reset}`);
  console.log(`${colors.dim}Creating standard environment fallback...${colors.reset}`);
}

// 2. Validate node_modules in both frontend and backend
const verifyNodeModules = (dir) => {
  const nodeModulesPath = path.join(__dirname, dir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`${colors.bold}${colors.red}❌ Error: node_modules not found in the "${dir}" folder!${colors.reset}`);
    console.log(`${colors.yellow}👉 Please run "npm install" inside the "${dir}" directory to set up dependencies.${colors.reset}\n`);
    return false;
  }
  return true;
};

const backendReady = verifyNodeModules('backend');
const frontendReady = verifyNodeModules('frontend');

if (!backendReady || !frontendReady) {
  console.log(`${colors.bold}${colors.red}Startup aborted due to missing dependencies.${colors.reset}\n`);
  process.exit(1);
}

// Prepare execution environment - Pass standard and force colors for Chalk / Next.js
const runnerEnv = {
  ...process.env,
  FORCE_COLOR: '1',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Stream handling with clean prefixing and colorization
function formatStdout(stream, prefix, colorCode) {
  let pendingData = '';
  
  stream.on('data', (chunk) => {
    pendingData += chunk.toString();
    const lines = pendingData.split(/\r?\n/);
    pendingData = lines.pop(); // Keep the last partial line in buffer

    lines.forEach((line) => {
      // Avoid printing duplicate empty lines
      if (line.trim() === '') return;
      console.log(`${colorCode}${prefix}${colors.reset} ${line}`);
    });
  });

  stream.on('end', () => {
    if (pendingData.trim()) {
      console.log(`${colorCode}${prefix}${colors.reset} ${pendingData}`);
    }
  });
}

let backendProc = null;
let frontendProc = null;

// 3. Start Backend
console.log(`${colors.bold}${colors.magenta}[Backend]${colors.reset} Spawning Express API server (npm run dev)...`);
backendProc = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true,
  env: runnerEnv
});

formatStdout(backendProc.stdout, '[Backend]', colors.magenta);
formatStdout(backendProc.stderr, '[Backend][Error]', colors.red);

// 4. Start Frontend
const frontendEnv = { ...runnerEnv, NODE_ENV: 'production' };
delete frontendEnv.PORT; // Delete backend's PORT to let Next.js use port 3000

const startFrontendServer = () => {
  console.log(`${colors.bold}${colors.green}[Frontend]${colors.reset} Starting Next.js production server (npm run start)...`);
  frontendProc = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    env: frontendEnv
  });

  formatStdout(frontendProc.stdout, '[Frontend]', colors.green);
  formatStdout(frontendProc.stderr, '[Frontend][Error]', colors.red);

  frontendProc.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`\n${colors.bold}${colors.red}❌ Frontend service stopped unexpectedly with code ${code}${colors.reset}`);
      handleShutdown('Frontend Crash');
    }
  });
};

if (process.env.SKIP_BUILD === 'true') {
  console.log(`${colors.bold}${colors.green}[Frontend]${colors.reset} SKIP_BUILD is enabled. Skipping compilation build...`);
  // Start server directly after a tiny delay to let backend bind ports first
  setTimeout(startFrontendServer, 1000);
} else {
  // Clean Next.js cache folder before building to prevent pages-manifest.json lock issues on Windows
  const nextCachePath = path.join(__dirname, 'frontend', '.next');
  if (fs.existsSync(nextCachePath)) {
    try {
      fs.rmSync(nextCachePath, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  console.log(`${colors.bold}${colors.green}[Frontend]${colors.reset} Building Next.js application (npm run build)...`);
  const buildProc = spawn('npm', ['run', 'build'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    env: frontendEnv
  });

  formatStdout(buildProc.stdout, '[Frontend-Build]', colors.green);
  formatStdout(buildProc.stderr, '[Frontend-Build][Error]', colors.red);

  buildProc.on('exit', (code) => {
    if (code !== 0) {
      console.log(`\n${colors.bold}${colors.red}❌ Frontend build failed with code ${code}. Halting startup...${colors.reset}`);
      handleShutdown('Frontend Build Failure');
      return;
    }
    startFrontendServer();
  });
}

// 5. Graceful shutdown handler
let shuttingDown = false;
function handleShutdown(trigger) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n\n${colors.bold}${colors.yellow}🛑  Shutdown signal received via ${trigger}. Halting all processes...${colors.reset}`);

  let processesKilled = 0;
  const targetKills = 2;

  const finalize = () => {
    processesKilled++;
    if (processesKilled === targetKills) {
      console.log(`\n${colors.bold}${colors.green}✨ Both servers stopped successfully. Clean exit achieved!${colors.reset}\n`);
      process.exit(0);
    }
  };

  // Kill backend process tree
  if (backendProc && !backendProc.killed) {
    if (process.platform === 'win32') {
      // Windows process tree kill to ensure nodemon and child node instances die
      spawn('taskkill', ['/pid', backendProc.pid, '/f', '/t'], { shell: true }).on('exit', finalize);
    } else {
      backendProc.kill('SIGTERM');
      finalize();
    }
  } else {
    finalize();
  }

  // Kill frontend process tree
  if (frontendProc && !frontendProc.killed) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', frontendProc.pid, '/f', '/t'], { shell: true }).on('exit', finalize);
    } else {
      frontendProc.kill('SIGTERM');
      finalize();
    }
  } else {
    finalize();
  }

  // Timeout safety
  setTimeout(() => {
    console.log(`${colors.bold}${colors.red}⚠ Standard shutdown timed out. Forcing termination...${colors.reset}`);
    process.exit(1);
  }, 4000);
}

// Listen for termination signals
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle unexpected child crashes
backendProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.log(`\n${colors.bold}${colors.red}❌ Backend service stopped unexpectedly with code ${code}${colors.reset}`);
    handleShutdown('Backend Crash');
  }
});
