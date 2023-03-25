const { execFile } = require('node:child_process');

execFile('git', ['tag', '-f', 'vX'], (error, stdout, stderr) => {
  if (error) {
    throw error;
  }
  console.log(stdout);
});

execFile('git', ['push', '-f', 'origin', 'vX'], (error, stdout, stderr) => {
    if (error) {
      throw error;
    }
    console.log(stdout);
  });