/* Retro Tetris - Dark minimalist UI + SFX */
(function(){
  const COLS = 10;
  const ROWS = 20;
  const CELL = 24;
  const DROP_MS_START = 600;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const resetBtn = document.getElementById("reset");

  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  const COLORS = {
    I: "#3DD6ED",
    J: "#21A1F1",
    L: "#F5A524",
    O: "#F7C948",
    S: "#2BCB77",
    T: "#B07CC6",
    Z: "#F86A6A"
  };
  const BOARD_BG = "#2b2f33";
  const GRID = "rgba(255,255,255,0.06)";

  // Simple Web Audio SFX
  const sfx = {
    ctx: null,
    enabled: true,
    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    },
    beep(freq=440, duration=0.08, type='square', gain=0.04, when=0){
      if(!this.enabled) return;
      this.ensure();
      if(!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now+duration);
      osc.start(now); osc.stop(now+duration+0.02);
    },
    rotate(){ this.beep(660,0.06,'square',0.05); },
    lock(){ this.beep(220,0.09,'sawtooth',0.05); },
    clear(lines){ for(let i=0;i<lines;i++){ this.beep(520+i*140,0.08,'triangle',0.06,i*0.06); } },
    level(){ this.beep(880,0.10,'triangle',0.06); this.beep(1175,0.10,'triangle',0.06,0.08); },
    over(){ this.beep(300,0.18,'sawtooth',0.05); this.beep(180,0.25,'sawtooth',0.05,0.16); }
  };

  function createMatrix(w,h,fill=0){
    const m = [];
    for(let y=0;y<h;y++){ m.push(Array(w).fill(fill)); }
    return m;
  }

  // Tetromino definitions (1s)
  const TETROMINOS = {
    I: [[1,1,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0]],
    T: [[0,1,0],[1,1,1]],
    Z: [[1,1,0],[0,1,1]]
  };
  const TYPES = Object.keys(TETROMINOS);

  function clone(mat){ return mat.map(r=>r.slice()); }
  function rotate(mat){
    const w = mat[0].length, h = mat.length;
    const res = createMatrix(h,w);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ res[x][h-1-y] = mat[y][x]; }
    return res;
  }

  function randomPiece(){
    const type = TYPES[(Math.random()*TYPES.length)|0];
    const matrix = clone(TETROMINOS[type]);
    return {type, color: COLORS[type], matrix, x: Math.floor((COLS - matrix[0].length)/2), y: -1};
  }

  const state = {
    board: createMatrix(COLS, ROWS, 0), // 0 or color string
    piece: null,
    score: 0,
    level: 1,
    lines: 0,
    dropMs: DROP_MS_START,
    timer: null,
    running: false,
    gameOver: false
  };

  function reset(){
    state.board = createMatrix(COLS, ROWS, 0);
    state.piece = randomPiece();
    state.score = 0;
    state.level = 1;
    state.lines = 0;
    state.dropMs = DROP_MS_START;
    state.gameOver = false;
    updateHUD();
    draw();
  }

  function start(){
    if(state.running) return;
    if(!state.piece) state.piece = randomPiece();
    state.running = true;
    tick();
  }

  function tick(){
    clearInterval(state.timer);
    state.timer = setInterval(step, state.dropMs);
  }

  function pause(){
    if(!state.running) return;
    clearInterval(state.timer);
    state.timer = null;
    state.running = false;
  }

  function onLock(){
    state.score += 10;
    sfx.lock();
  }

  function maybeLevelUp(){
    const newLevel = 1 + Math.floor(state.lines / 10);
    if(newLevel !== state.level){
      state.level = newLevel;
      state.dropMs = Math.max(120, DROP_MS_START - (state.level-1)*50);
      sfx.level();
      if(state.running) tick();
    }
  }

  function step(){
    if(state.gameOver) return;
    if(!move(0,1)){
      merge();
      onLock();
      const cleared = sweep();
      if(cleared>0){ state.score += cleared*100; state.lines += cleared; sfx.clear(cleared); maybeLevelUp(); }
      updateHUD();
      state.piece = randomPiece();
      if(collide(state.piece.matrix, state.piece.x, state.piece.y)){
        state.gameOver = true;
        sfx.over();
        pause();
      }
    }
    draw();
  }

  function move(dx,dy){
    const p = state.piece;
    if(!p) return false;
    if(!collide(p.matrix, p.x+dx, p.y+dy)){ p.x+=dx; p.y+=dy; return true; }
    return false;
  }

  function hardDrop(){
    let moved=false;
    while(move(0,1)) { moved=true; }
    if(moved){ step(); }
  }

  function tryRotate(){
    const p = state.piece;
    const rotated = rotate(p.matrix);
    if(!collide(rotated, p.x, p.y)){ p.matrix = rotated; sfx.rotate(); return; }
    for(const shift of [-1,1,-2,2]){
      if(!collide(rotated, p.x+shift, p.y)){ p.x += shift; p.matrix = rotated; sfx.rotate(); return; }
    }
  }

  function collide(matrix, offX, offY){
    for(let y=0;y<matrix.length;y++){
      for(let x=0;x<matrix[0].length;x++){
        if(matrix[y][x]){
          const nx = offX + x;
          const ny = offY + y;
          if(ny < 0) continue;
          if(nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if(state.board[ny][nx] !== 0) return true;
        }
      }
    }
    return false;
  }

  function merge(){
    const p = state.piece;
    for(let y=0;y<p.matrix.length;y++) for(let x=0;x<p.matrix[0].length;x++){
      if(p.matrix[y][x]){
        const nx = p.x + x;
        const ny = p.y + y;
        if(ny>=0) state.board[ny][nx] = p.color;
      }
    }
  }

  function sweep(){
    let cleared = 0;
    for(let y=ROWS-1;y>=0;){
      if(state.board[y].every(v=>v!==0)){
        state.board.splice(y,1);
        state.board.unshift(Array(COLS).fill(0));
        cleared++;
      } else { y--; }
    }
    return cleared;
  }

  function updateHUD(){
    scoreEl.textContent = String(state.score);
    if(levelEl) levelEl.textContent = String(state.level);
  }

  function clearCanvas(){
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function draw(){
    clearCanvas();
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      const v = state.board[y][x];
      if(v!==0) drawCell(x,y,v); else drawEmpty(x,y);
    }
    if(state.piece){
      const p = state.piece;
      for(let y=0;y<p.matrix.length;y++) for(let x=0;x<p.matrix[0].length;x++){
        if(p.matrix[y][x]){
          const nx = p.x + x;
          const ny = p.y + y;
          if(ny>=0) drawCell(nx,ny,p.color);
        }
      }
    }
    ctx.strokeStyle = GRID;
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }

    if(state.gameOver){
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "#e7ecef";
      ctx.font = "bold 22px ui-sans-serif, system-ui, -apple-system";
      ctx.textAlign = "center";
      ctx.fillText("Game Over — Press Reset", canvas.width/2, canvas.height/2);
    }
  }

  function drawEmpty(cx,cy){
    const x = cx*CELL, y = cy*CELL, r = CELL;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(x,y,r,r);
  }

  function drawCell(cx,cy,color){
    const x = cx*CELL, y = cy*CELL, r = CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x+1,y+1,r-2,r-2);
    const g = ctx.createLinearGradient(x,y,x,y+r);
    g.addColorStop(0,"rgba(255,255,255,0.20)");
    g.addColorStop(1,"rgba(0,0,0,0.15)");
    ctx.fillStyle = g;
    ctx.fillRect(x+1,y+1,r-2,r-2);
  }

  // Controls
  document.addEventListener("keydown", (e)=>{
    if(["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," ","Spacebar"].includes(e.key)) e.preventDefault();
    sfx.ensure();
    if(state.gameOver) return;
    if(!state.piece) return;
    switch(e.key){
      case "ArrowLeft": move(-1,0); draw(); break;
      case "ArrowRight": move(1,0); draw(); break;
      case "ArrowDown": move(0,1); draw(); break;
      case "ArrowUp": tryRotate(); draw(); break;
      case " ": case "Spacebar": hardDrop(); break;
    }
  }, { passive: false });

  startBtn.addEventListener("click", ()=>{ sfx.ensure(); if(state.gameOver) reset(); start(); });
  pauseBtn.addEventListener("click", ()=>{ sfx.ensure(); state.running ? pause() : start(); });
  resetBtn.addEventListener("click", ()=>{ pause(); reset(); });

  // bootstrap
  reset();
})();
