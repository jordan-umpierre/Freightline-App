const { execFile } = require('child_process')
const path = require('path')

function runSimulator(args = []) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'simulate-pings.js'), ...args],
      {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, API_URL: '' },
      },
      (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      }
    )
  })
}

test('simulator explains API connection failures with the attempted base URL', async () => {
  const result = await runSimulator(['--api', 'http://127.0.0.1:1', '--steps', '2', '--interval-ms', '100'])

  expect(result.error).not.toBeNull()
  expect(result.stderr).toContain('Could not reach API at http://127.0.0.1:1')
  expect(result.stderr).toContain('Use --api to point at a running local or deployed backend')
})
