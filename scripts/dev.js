const { spawn } = require('child_process');

// Remove the problematic env var that causes Electron to run as plain Node
delete process.env.ELECTRON_RUN_AS_NODE;

const child = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
