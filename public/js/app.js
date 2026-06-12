(function () {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    convertEol: true,
    scrollback: 5000,
    theme: {
      background: '#000000',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      cursorAccent: '#000000',
      selectionBackground: 'rgba(88, 166, 255, 0.3)'
    }
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  try {
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(webLinksAddon);
  } catch (e) {}

  term.open(document.getElementById('terminal'));

  const resizeTerminal = function () {
    try { fitAddon.fit(); } catch (e) {}
  };
  resizeTerminal();

  window.addEventListener('resize', function () {
    resizeTerminal();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    }
  });

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const loginForm = document.getElementById('loginForm');
  const authType = document.getElementById('authType');
  const fieldPassword = document.querySelector('.field-password');
  const fieldKey = document.querySelector('.field-key');

  let ws = null;
  let connected = false;

  authType.addEventListener('change', function () {
    if (authType.value === 'password') {
      fieldPassword.classList.remove('hidden');
      fieldKey.classList.add('hidden');
    } else {
      fieldPassword.classList.add('hidden');
      fieldKey.classList.remove('hidden');
    }
  });

  const setStatus = function (state, text) {
    statusDot.className = 'status-dot status-' + state;
    statusText.textContent = text;
  };

  const setConnectedUI = function (isConnecting) {
    connected = isConnecting;
    connectBtn.disabled = isConnecting;
    disconnectBtn.disabled = !isConnecting;
  };

  term.onData(function (data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: data }));
    }
  });

  const writeWelcome = function () {
    term.reset();
    term.writeln('\x1b[36m============================================================\x1b[0m');
    term.writeln('\x1b[36m              SSH Web Shell  v1.0\x1b[0m');
    term.writeln('\x1b[36m============================================================\x1b[0m');
    term.writeln('');
    term.writeln('  在左侧输入服务器信息后点击 "连接"');
    term.writeln('');
  };

  writeWelcome();

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    if (connected) return;

    const host = document.getElementById('host').value.trim();
    const port = document.getElementById('port').value.trim();
    const username = document.getElementById('username').value.trim();
    const useKey = authType.value === 'key';
    const password = document.getElementById('password').value;
    const privateKey = document.getElementById('privateKey').value.trim();
    const passphrase = document.getElementById('passphrase').value;

    if (!host || !username) {
      term.writeln('\x1b[31m[错误] 请填写完整的连接信息\x1b[0m');
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = proto + '//' + location.host + '/ws';

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      term.writeln('\x1b[31m[错误] WebSocket 创建失败\x1b[0m');
      return;
    }

    setStatus('connecting', '连接中...');
    setConnectedUI(true);
    connectBtn.textContent = '连接中...';
    term.reset();
    term.writeln('\x1b[33m[状态] 正在连接到 ' + username + '@' + host + ':' + port + ' ...\x1b[0m');

    ws.onopen = function () {
      const msg = {
        type: 'connect',
        host: host,
        port: port,
        username: username,
        cols: term.cols,
        rows: term.rows
      };

      if (useKey) {
        msg.privateKey = privateKey;
        if (passphrase) msg.passphrase = passphrase;
      } else {
        msg.password = password;
      }

      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = function (event) {
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch (e) {
        term.write(event.data);
        return;
      }

      switch (parsed.type) {
        case 'connected':
          setStatus('on', '已连接: ' + username + '@' + host);
          term.writeln('');
          break;
        case 'disconnected':
          setStatus('off', '未连接');
          setConnectedUI(false);
          connectBtn.textContent = '连接';
          term.writeln('');
          term.writeln('\x1b[33m[状态] ' + parsed.message + '\x1b[0m');
          term.writeln('');
          ws = null;
          break;
        case 'error':
          setStatus('error', '连接错误');
          setConnectedUI(false);
          connectBtn.textContent = '连接';
          term.writeln('\r\n\x1b[31m[错误] ' + parsed.message + '\x1b[0m');
          term.writeln('');
          ws = null;
          break;
        case 'status':
          term.writeln('\x1b[90m[信息] ' + parsed.message + '\x1b[0m');
          break;
        case 'data':
          term.write(parsed.data);
          break;
        default:
          if (parsed.data) term.write(parsed.data);
      }
    };

    ws.onerror = function () {
      setStatus('error', 'WebSocket 错误');
      setConnectedUI(false);
      connectBtn.textContent = '连接';
      term.writeln('\r\n\x1b[31m[错误] 无法连接到本地服务器\x1b[0m');
    };

    ws.onclose = function () {
      if (connected) {
        setStatus('off', '未连接');
        setConnectedUI(false);
        connectBtn.textContent = '连接';
        term.writeln('\r\n\x1b[33m[状态] 连接已关闭\x1b[0m');
      }
      ws = null;
    };
  });

  disconnectBtn.addEventListener('click', function () {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'disconnect' })); } catch (e) {}
      ws.close();
    }
  });

  window.addEventListener('beforeunload', function () {
    if (ws) ws.close();
  });
})();
