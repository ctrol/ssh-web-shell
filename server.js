const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  let sshClient = null;
  let stream = null;
  let connected = false;

  const send = (type, data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
    }
  };

  const cleanup = () => {
    if (stream) {
      try { stream.end(); } catch (e) {}
      stream = null;
    }
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
      sshClient = null;
    }
    connected = false;
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }

    if (msg.type === 'connect') {
      const { host, port = 22, username, password, privateKey, passphrase } = msg;

      if (connected) {
        send('error', { message: 'Already connected' });
        return;
      }

      sshClient = new Client();

      sshClient.on('ready', () => {
        connected = true;
        send('connected', { message: `Connected to ${username}@${host}:${port}` });

        sshClient.shell({
          term: 'xterm-256color',
          cols: msg.cols || 80,
          rows: msg.rows || 24,
        }, (err, s) => {
          if (err) {
            send('error', { message: 'Failed to open shell: ' + err.message });
            cleanup();
            return;
          }
          stream = s;

          stream.on('data', (chunk) => {
            send('data', { data: chunk.toString('binary') });
          });

          stream.on('close', () => {
            send('disconnected', { message: 'Session closed' });
            cleanup();
          });

          stream.stderr.on('data', (chunk) => {
            send('data', { data: chunk.toString('binary') });
          });
        });
      });

      sshClient.on('error', (err) => {
        send('error', { message: err.message || 'SSH connection error' });
        cleanup();
      });

      sshClient.on('end', () => {
        send('disconnected', { message: 'Connection ended' });
        cleanup();
      });

      try {
        const connConfig = {
          host,
          port: Number(port) || 22,
          username,
          readyTimeout: 20000,
          keepaliveInterval: 30000,
        };

        if (privateKey && privateKey.trim()) {
          connConfig.privateKey = privateKey;
          if (passphrase) connConfig.passphrase = passphrase;
        } else if (password) {
          connConfig.password = password;
        } else {
          connConfig.tryKeyboard = true;
          connConfig.password = '';
        }

        send('status', { message: 'Connecting...' });
        sshClient.connect(connConfig);
      } catch (err) {
        send('error', { message: 'Failed to initialize connection: ' + err.message });
        cleanup();
      }
    } else if (msg.type === 'data') {
      if (stream) {
        stream.write(msg.data);
      }
    } else if (msg.type === 'resize') {
      if (stream) {
        stream.setWindow(parseInt(msg.rows) || 24, parseInt(msg.cols) || 80, 0, 0);
      }
    } else if (msg.type === 'disconnect') {
      send('disconnected', { message: 'Disconnected by user' });
      cleanup();
    }
  });

  ws.on('close', () => {
    cleanup();
  });

  ws.on('error', () => {
    cleanup();
  });
});

server.listen(PORT, () => {
  console.log(`SSH Web Shell running at http://localhost:${PORT}`);
});
