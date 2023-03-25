const { execFile } = require('node:child_process');
const child = execFile('git', ['tag', '-l'], (error, stdout, stderr) => {
  if (error) {
    throw error;
  }
  console.log(stdout);
});