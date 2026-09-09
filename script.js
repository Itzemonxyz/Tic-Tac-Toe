(() => {
  // DOM Elements
  const boardEl = document.getElementById('board');
  const cells = document.querySelectorAll('.cell');
  const statusText = document.getElementById('status-text');
  const modeSelect = document.getElementById('mode-select');
  const soundBtn = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');
  const resetRoundBtn = document.getElementById('reset-round-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreTiesEl = document.getElementById('score-ties');
  const labelO = document.getElementById('label-o');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // Audio Context (Synthesizer)
  let audioCtx = null;
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, delay = 0) {
    if (isMuted || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const startTime = audioCtx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      // Audio playback fails silently if restricted
    }
  }

  function playSound(name) {
    initAudio();
    if (isMuted) return;

    if (name === 'move-x') {
      playTone(523.25, 'sine', 0.12); // C5
    } else if (name === 'move-o') {
      playTone(659.25, 'sine', 0.12); // E5
    } else if (name === 'win') {
      playTone(523.25, 'triangle', 0.15, 0);
      playTone(659.25, 'triangle', 0.15, 0.12);
      playTone(783.99, 'triangle', 0.25, 0.24);
      playTone(1046.50, 'triangle', 0.45, 0.36);
    } else if (name === 'draw') {
      playTone(400, 'sawtooth', 0.15, 0);
      playTone(330, 'sawtooth', 0.25, 0.15);
    } else if (name === 'click') {
      playTone(440, 'sine', 0.08);
    }
  }

  // Sound Toggle
  soundBtn.addEventListener('click', () => {
    initAudio();
    isMuted = !isMuted;
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
    soundBtn.title = isMuted ? 'Unmute Sound' : 'Mute Sound';
  });

  // Game State
  const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  let board = Array(9).fill('');
  let currentPlayer = 'X';
  let isGameActive = true;
  let scores = { X: 0, O: 0, ties: 0 };
  let isAiThinking = false;

  // Confetti System
  const ctx = confettiCanvas.getContext('2d');
  let confettiParticles = [];
  let confettiAnimationId = null;

  function resizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  function triggerConfetti() {
    confettiParticles = [];
    const colors = ['#38bdf8', '#f43f5e', '#facc15', '#a855f7', '#4ade80'];
    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        opacity: 1
      });
    }

    if (!confettiAnimationId) {
      animateConfetti();
    }
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    confettiParticles.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.012;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();

      if (p.opacity <= 0 || p.y > window.innerHeight) {
        confettiParticles.splice(index, 1);
      }
    });

    if (confettiParticles.length > 0) {
      confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiAnimationId = null;
    }
  }

  // Update UI Status
  function updateStatus(text, type = 'normal') {
    statusText.innerHTML = `<span class="turn-indicator ${type}">${text}</span>`;
  }

  function updateScoreboard() {
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreTiesEl.textContent = scores.ties;
  }

  // Check Game Winner or Draw
  function checkWinner(boardState) {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (
        boardState[a] &&
        boardState[a] === boardState[b] &&
        boardState[a] === boardState[c]
      ) {
        return { winner: boardState[a], line: combo };
      }
    }
    if (boardState.every(cell => cell !== '')) {
      return { winner: 'tie' };
    }
    return null;
  }

  // Handle Cell Move
  function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase());
    cell.disabled = true;

    playSound(player === 'X' ? 'move-x' : 'move-o');

    const result = checkWinner(board);

    if (result) {
      isGameActive = false;
      if (result.winner === 'tie') {
        scores.ties++;
        updateStatus("It's a Draw! 🤝", 'x-turn');
        playSound('draw');
      } else {
        scores[result.winner]++;
        const winnerName = (result.winner === 'X' || modeSelect.value === 'pvp')
          ? `Player ${result.winner}`
          : 'AI';
        updateStatus(`${winnerName} Wins! 🎉`, 'winner');
        result.line.forEach(idx => cells[idx].classList.add('winning'));
        triggerConfetti();
        playSound('win');
      }
      updateScoreboard();
      return;
    }

    // Switch player
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    const nextPlayerText = (currentPlayer === 'O' && modeSelect.value !== 'pvp')
      ? "AI is thinking..."
      : `Player ${currentPlayer}'s turn`;
    updateStatus(nextPlayerText, currentPlayer === 'X' ? 'x-turn' : 'o-turn');

    // Trigger AI if applicable
    if (isGameActive && currentPlayer === 'O' && modeSelect.value !== 'pvp') {
      isAiThinking = true;
      cells.forEach(c => c.disabled = true);
      setTimeout(() => {
        aiTurn();
        isAiThinking = false;
        if (isGameActive) {
          cells.forEach((c, i) => {
            if (!board[i]) c.disabled = false;
          });
        }
      }, 450);
    }
  }

  // AI Logic
  function aiTurn() {
    if (!isGameActive) return;

    let moveIndex;
    const mode = modeSelect.value;

    if (mode === 'pve-easy') {
      const availableMoves = board
        .map((val, idx) => (val === '' ? idx : null))
        .filter(val => val !== null);
      moveIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else {
      // Minimax for Unbeatable AI
      moveIndex = getBestMove(board);
    }

    if (moveIndex !== undefined && moveIndex !== null) {
      makeMove(moveIndex, 'O');
    }
  }

  function getBestMove(currentBoard) {
    let bestScore = -Infinity;
    let move = null;

    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === '') {
        currentBoard[i] = 'O';
        const score = minimax(currentBoard, 0, false);
        currentBoard[i] = '';
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  function minimax(boardState, depth, isMaximizing) {
    const res = checkWinner(boardState);
    if (res) {
      if (res.winner === 'O') return 10 - depth;
      if (res.winner === 'X') return depth - 10;
      if (res.winner === 'tie') return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === '') {
          boardState[i] = 'O';
          const score = minimax(boardState, depth + 1, false);
          boardState[i] = '';
          maxScore = Math.max(score, maxScore);
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === '') {
          boardState[i] = 'X';
          const score = minimax(boardState, depth + 1, true);
          boardState[i] = '';
          minScore = Math.min(score, minScore);
        }
      }
      return minScore;
    }
  }

  // Cell Click Listener
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
      initAudio();
      const index = parseInt(e.target.dataset.index, 10);
      if (board[index] === '' && isGameActive && !isAiThinking) {
        makeMove(index, currentPlayer);
      }
    });
  });

  // Next Round Button
  function resetRound() {
    playSound('click');
    board = Array(9).fill('');
    currentPlayer = 'X';
    isGameActive = true;
    isAiThinking = false;

    cells.forEach(cell => {
      cell.textContent = '';
      cell.className = 'cell';
      cell.disabled = false;
    });

    updateStatus("Player X's turn", 'x-turn');
  }

  resetRoundBtn.addEventListener('click', resetRound);

  // Restart Game / Reset Scores
  restartGameBtn.addEventListener('click', () => {
    playSound('click');
    scores = { X: 0, O: 0, ties: 0 };
    updateScoreboard();
    resetRound();
  });

  // Mode Selection Changed
  modeSelect.addEventListener('change', () => {
    playSound('click');
    const isPvp = modeSelect.value === 'pvp';
    labelO.textContent = isPvp ? 'PLAYER (O)' : 'AI (O)';
    resetRound();
  });

  // Initial setup
  updateStatus("Player X's turn", 'x-turn');
  updateScoreboard();
})();
