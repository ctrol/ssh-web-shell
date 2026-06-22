(function () {
  // Terminal
  var term = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    lineHeight: 1.3,
    convertEol: true,
    scrollback: 5000,
    theme: {
      background: '#050810',
      foreground: '#c9d1d9',
      cursor: '#3b82f6',
      cursorAccent: '#050810',
      selectionBackground: 'rgba(59, 130, 246, 0.3)',
      black: '#0a0e17',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#e2e8f0',
      brightBlack: '#64748b',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde047',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff'
    }
  });

  var fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  try {
    var webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(webLinksAddon);
  } catch (e) {}

  term.open(document.getElementById('terminal'));

  var resizeTerminal = function () {
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

  // DOM elements
  var connBadge = document.getElementById('connBadge');
  var statusDot = document.getElementById('statusDot');
  var statusText = document.getElementById('statusText');
  var connectBtn = document.getElementById('connectBtn');
  var disconnectBtn = document.getElementById('disconnectBtn');
  var loginForm = document.getElementById('loginForm');
  var fieldPassword = document.getElementById('fieldPassword');
  var fieldKey = document.getElementById('fieldKey');
  var sidebar = document.getElementById('sidebar');
  var mainEl = document.querySelector('.main');
  var terminalTitle = document.getElementById('terminalTitle');
  var expandSidebarBtn = document.getElementById('expandSidebarBtn');
  var authTabs = document.querySelectorAll('.auth-tab');

  var ws = null;
  var connected = false;
  var currentHost = '';
  var currentUser = '';

  // Auth tabs
  authTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      authTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      if (tab.dataset.auth === 'password') {
        fieldPassword.classList.remove('hidden');
        fieldKey.classList.add('hidden');
      } else {
        fieldPassword.classList.add('hidden');
        fieldKey.classList.remove('hidden');
      }
    });
  });

  // Status helpers
  var setStatus = function (state, text) {
    connBadge.className = 'conn-badge ' + state;
    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
  };

  var setConnectedUI = function (isConnecting) {
    connected = isConnecting;
    connectBtn.disabled = isConnecting;
    disconnectBtn.disabled = !isConnecting;
  };

  // Sidebar collapse/expand
  var collapseSidebar = function () {
    sidebar.classList.add('collapsed');
    expandSidebarBtn.style.display = '';
    mainEl.classList.add('connected');
    resizeTerminal();
  };

  var expandSidebar = function () {
    sidebar.classList.remove('collapsed');
    expandSidebarBtn.style.display = '';
    mainEl.classList.remove('connected');
    resizeTerminal();
  };

  expandSidebarBtn.addEventListener('click', function () {
    if (sidebar.classList.contains('collapsed')) {
      expandSidebar();
    } else {
      collapseSidebar();
    }
  });

  term.onData(function (data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: data }));
    }
  });

  // Welcome message
  var writeWelcome = function () {
    term.reset();
    term.writeln('\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m                   \x1b[1mSSH Web Shell\x1b[0m                              \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m         网页版 SSH 终端  ·  Node.js + xterm.js              \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('  \x1b[90m在左侧填写服务器信息后点击 "连接服务器" 开始操作\x1b[0m');
    term.writeln('  \x1b[90m支持密码认证和私钥认证，连接后可直接使用所有 Shell 命令\x1b[0m');
    term.writeln('');
  };
  writeWelcome();

  // Form submit
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    if (connected) return;

    var host = document.getElementById('host').value.trim();
    var port = document.getElementById('port').value.trim();
    var username = document.getElementById('username').value.trim();
    var useKey = document.querySelector('.auth-tab.active').dataset.auth === 'key';
    var password = document.getElementById('password').value;
    var privateKey = document.getElementById('privateKey').value.trim();
    var passphrase = document.getElementById('passphrase').value;

    if (!host || !username) {
      term.writeln('\x1b[31m[错误] 请填写主机地址和用户名\x1b[0m');
      return;
    }

    currentHost = host;
    currentUser = username;

    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + location.host + '/ws';

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      term.writeln('\x1b[31m[错误] WebSocket 创建失败\x1b[0m');
      return;
    }

    setStatus('connecting', '连接中...');
    setConnectedUI(true);
    connectBtn.classList.add('loading');
    connectBtn.textContent = ' ';
    term.reset();
    term.writeln('\x1b[36m[状态]\x1b[0m 正在连接到 \x1b[1m' + username + '@' + host + ':' + port + '\x1b[0m ...');
    term.writeln('');

    ws.onopen = function () {
      var msg = {
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
      var parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch (e) {
        term.write(event.data);
        return;
      }

      switch (parsed.type) {
        case 'connected':
          setStatus('on', username + '@' + host);
          terminalTitle.textContent = username + '@' + host;
          collapseSidebar();
          term.writeln('');
          break;

        case 'disconnected':
          setStatus('off', '未连接');
          setConnectedUI(false);
          connectBtn.classList.remove('loading');
          connectBtn.textContent = '连接服务器';
          expandSidebar();
          term.writeln('');
          term.writeln('\x1b[33m[断开]\x1b[0m ' + parsed.message);
          term.writeln('');
          terminalTitle.textContent = 'SSH Terminal';
          ws = null;
          break;

        case 'error':
          setStatus('error', '连接失败');
          setConnectedUI(false);
          connectBtn.classList.remove('loading');
          connectBtn.textContent = '连接服务器';
          term.writeln('\r\n\x1b[31m[错误]\x1b[0m ' + parsed.message);
          term.writeln('');
          ws = null;
          break;

        case 'status':
          term.writeln('\x1b[90m[信息]\x1b[0m ' + parsed.message);
          break;

        case 'data':
          term.write(parsed.data);
          break;

        default:
          if (parsed.data) term.write(parsed.data);
      }
    };

    ws.onerror = function () {
      setStatus('error', '连接失败');
      setConnectedUI(false);
      connectBtn.classList.remove('loading');
      connectBtn.textContent = '连接服务器';
      term.writeln('\r\n\x1b[31m[错误]\x1b[0m 无法连接到本地服务器，请确认服务已启动');
      term.writeln('');
    };

    ws.onclose = function () {
      if (connected) {
        setStatus('off', '未连接');
        setConnectedUI(false);
        connectBtn.classList.remove('loading');
        connectBtn.textContent = '连接服务器';
        expandSidebar();
        term.writeln('\r\n\x1b[33m[状态]\x1b[0m 连接已关闭');
        terminalTitle.textContent = 'SSH Terminal';
      }
      ws = null;
    };
  });

  // Disconnect button
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
