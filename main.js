/* Retro Tetris - LEGO style grayscale render */
(function(){
  const COLS = 10;
  const ROWS = 20;
  const CELL = 24;
  const DROP_MS = 600;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const resetBtn = document.getElementById("reset");

  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  const SHADES = ["#000000", "#1f1f1f", "#3a3a3a", "#585858", "#7a7a7a", "#9c9c9c"];

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
    const shade = 1 + ((Math.random()* (SHADES.length-1))|0);
    return {type, matrix, x: Math.floor((COLS - matrix[0].length)/2), y: -1, shade};
  }

  const state = {
    board: createMatrix(COLS, ROWS, 0),
    piece: null,
    score: 0,
    timer: null,
    running: false,
    gameOver: false
  };

  function reset(){
    state.board = createMatrix(COLS, ROWS, 0);
    state.piece = randomPiece();
    state.score = 0;
    state.gameOver = false;
    updateScore();
    draw();
  }

  function start(){
    if(state.running) return;
    if(!state.piece) state.piece = randomPiece();
    state.running = true;
    state.timer = setInterval(step, DROP_MS);
  }

  function pause(){
    if(!state.running) return;
    clearInterval(state.timer);
    state.timer = null;
    state.running = false;
  }

  function step(){
    if(state.gameOver) return;
    if(!move(0,1)){
      merge();
      const cleared = sweep();
      if(cleared>0){ state.score += cleared*100; updateScore(); }
      state.piece = randomPiece();
      if(collide(state.piece.matrix, state.piece.x, state.piece.y)){
        state.gameOver = true;
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
    let n=0;
    while(move(0,1)) { n++; }
    if(n>0){ state.score += n; updateScore(); }
  }

  function tryRotate(){
    const p = state.piece;
    const rotated = rotate(p.matrix);
    if(!collide(rotated, p.x, p.y)){ p.matrix = rotated; return; }
    // simple wall kick: try shifts
    for(const shift of [-1,1,-2,2]){
      if(!collide(rotated, p.x+shift, p.y)){ p.x += shift; p.matrix = rotated; return; }
    }
  }

  function collide(matrix, offX, offY){
    for(let y=0;y<matrix.length;y++){
      for(let x=0;x<matrix[0].length;x++){
        if(matrix[y][x]){
          const nx = offX + x;
          const ny = offY + y;
          if(ny < 0) continue; // allow above top
          if(nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if(state.board[ny][nx] !== 0) return true;
        }
      }
    }
    return false;
  }

  function merge(){
    const p = state.piece;
    for(let y=0;y<p.matrix.length;y++){
      for(let x=0;x<p.matrix[0].length;x++){
        if(p.matrix[y][x]){
          const nx = p.x + x;
          const ny = p.y + y;
          if(ny>=0) state.board[ny][nx] = p.shade;
        }
      }
    }
  }

  function sweep(){
    let cleared = 0;
    for(let y=ROWS-1;y>=0;){
      if(state.board[y].every(v=>v!==0)){
        const row = state.board.splice(y,1)[0];
        state.board.unshift(Array(COLS).fill(0));
        cleared++;
      } else { y--; }
    }
    return cleared;
  }

  function updateScore(){ scoreEl.textContent = String(state.score); }

  function clearCanvas(){
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function draw(){
    clearCanvas();
    // grid studs background to match LEGO look
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const v = state.board[y][x];
        if(v!==0){ drawCell(x,y, SHADES[v]); }
        else {
          // faint base cells
          drawCellBase(x,y,"#cfcfcf");
        }
      }
    }
    if(state.piece){
      const p = state.piece;
      for(let y=0;y<p.matrix.length;y++){
        for(let x=0;x<p.matrix[0].length;x++){
          if(p.matrix[y][x]){
            const nx = p.x + x;
            const ny = p.y + y;
            if(ny>=0) drawCell(nx,ny, SHADES[p.shade]);
          }
        }
      }
    }
    // grid lines for retro feel
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }

    if(state.gameOver){
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Game Over - Reset to play", canvas.width/2, canvas.height/2);
    }
  }

  function drawCellBase(cx,cy,color){
    const x = cx*CELL; const y = cy*CELL; const r = CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x,y,r,r);
    // subtle bevel
    const g = ctx.createLinearGradient(x,y,x+r,y+r);
    g.addColorStop(0,"rgba(255,255,255,0.25)");
    g.addColorStop(1,"rgba(0,0,0,0.15)");
    ctx.fillStyle = g; ctx.fillRect(x,y,r,r);
    // stud shadow only
    const rg = ctx.createRadialGradient(x+r*0.35,y+r*0.35,r*0.1, x+r*0.35,y+r*0.35,r*0.45);
    rg.addColorStop(0,"rgba(255,255,255,0.25)");
    rg.addColorStop(0.7,"rgba(0,0,0,0.10)");
    rg.addColorStop(1,"rgba(0,0,0,0.20)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x+r*0.35,y+r*0.35,r*0.28,0,Math.PI*2); ctx.fill();
  }

  function drawCell(cx,cy,color){
    const x = cx*CELL; const y = cy*CELL; const r = CELL;
    // base tile
    ctx.fillStyle = color;
    ctx.fillRect(x,y,r,r);
    // bevel
    const g = ctx.createLinearGradient(x,y,x+r,y+r);
    g.addColorStop(0,"rgba(255,255,255,0.20)");
    g.addColorStop(1,"rgba(0,0,0,0.30)");
    ctx.fillStyle = g; ctx.fillRect(x,y,r,r);
    // stud
    const h = ctx.createRadialGradient(x+r*0.35,y+r*0.35,r*0.08, x+r*0.35,y+r*0.35,r*0.45);
    h.addColorStop(0,"rgba(255,255,255,0.55)");
    h.addColorStop(0.6,"rgba(0,0,0,0.15)");
    h.addColorStop(1,"rgba(0,0,0,0.35)");
    ctx.fillStyle = h;
    ctx.beginPath(); ctx.arc(x+r*0.35,y+r*0.35,r*0.28,0,Math.PI*2); ctx.fill();
  }

  // Controls
  document.addEventListener("keydown", (e)=>{
    if(state.gameOver) return;
    if(!state.piece) return;
    switch(e.key){
      case "ArrowLeft": move(-1,0); draw(); break;
      case "ArrowRight": move(1,0); draw(); break;
      case "ArrowDown": if(move(0,1)){ state.score += 1; updateScore(); draw(); } break;
      case "ArrowUp": tryRotate(); draw(); break;
      case " ": hardDrop(); draw(); break;
    }
  });

  startBtn.addEventListener("click", ()=>{ if(state.gameOver) reset(); start(); });
  pauseBtn.addEventListener("click", ()=>{ state.running ? pause() : start(); });
  resetBtn.addEventListener("click", ()=>{ pause(); reset(); });

  // bootstrap
  reset();
})();
