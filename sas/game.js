import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// --- Firebase 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyBc3aB342Yp0hjLLj4hw0xJ-s8hOU_OmMg",
  authDomain: "saskitchen-rank-96f61.firebaseapp.com",
  projectId: "saskitchen-rank-96f61",
  storageBucket: "saskitchen-rank-96f61.firebasestorage.app",
  messagingSenderId: "785643491182",
  appId: "1:785643491182:web:fc195dbaa79a6eee047b7f"
};

let app, auth, db;
let currentUser = null;
let isConfigured = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // [뱀꼬리 로직] 로그인 실패해도 무시하고 진행
    signInAnonymously(auth).then(() => {
        console.log("Firebase: 익명 로그인 성공");
    }).catch((error) => {
        console.warn("Firebase: 로그인 실패. 비로그인 모드로 진행합니다.", error);
    });

    onAuthStateChanged(auth, (user) => { currentUser = user; });
    isConfigured = true;
} catch (e) {
    console.error("Firebase Init Error:", e);
}

const appId = 'landwar-titan-v1';

// --- 리더보드 로직 ---
const rankForm = document.getElementById("rankForm");
const rankNameInput = document.getElementById("rankNameInput");
const submitRankBtn = document.getElementById("submitRankBtn");
const rankListArea = document.getElementById("rankListArea");
const showRankBtn = document.getElementById("showRankBtn");
const closeRankBtn = document.getElementById("closeRankBtn");

async function saveScore(name, score, stage) {
  if (!isConfigured) { alert("서버 설정 오류"); return; }
  try {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'landwar_scores'), {
      name: name,
      score: score,
      stage: stage,
      timestamp: Date.now()
    });
    alert("점수가 등록되었습니다!");
    showLeaderboard();
  } catch (e) {
    console.error("Error adding document: ", e);
    if (e.code === 'permission-denied') {
         alert("점수 등록 실패: 서버 권한이 필요합니다.");
    } else {
         alert("점수 등록 실패: " + e.message);
    }
  }
}

async function getLeaderboard() {
    if (!isConfigured) return [];
    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'landwar_scores'));
        const scores = [];
        querySnapshot.forEach((doc) => { scores.push(doc.data()); });
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, 20);
    } catch (e) {
        console.error("Error getting documents: ", e);
        return [];
    }
}

async function showLeaderboard() {
    const overlay = document.getElementById("overlay");
    const overlayTitle = document.getElementById("overlayTitle");
    const overlaySub = document.getElementById("overlaySub");
    const overlayRestart = document.getElementById("overlayRestart");

    overlayTitle.textContent = "🏆 TOP 20 랭킹";
    overlaySub.textContent = "불러오는 중...";
    rankForm.style.display = "none";
    overlayRestart.style.display = "none";
    closeRankBtn.style.display = "inline-block";
    overlay.style.display = "flex";
    
    const scores = await getLeaderboard();
    
    overlaySub.textContent = "";
    rankListArea.innerHTML = "";
    rankListArea.style.display = "block";

    if (!isConfigured) {
        rankListArea.innerHTML = "<div style='text-align:center; color:#f87171;'>서버 설정 오류</div>";
    } else if (scores.length === 0) {
        rankListArea.innerHTML = "<div style='text-align:center; color:#94a3b8;'>기록이 없습니다.</div>";
    } else {
        scores.forEach((s, i) => {
            const div = document.createElement("div");
            div.className = "rank-item";
            div.innerHTML = `<span>${i+1}</span> <span class="r-name">${s.name}</span> <span class="r-score">${s.score}</span>`;
            rankListArea.appendChild(div);
        });
    }
}

submitRankBtn.addEventListener("click", () => {
    const name = rankNameInput.value.trim();
    if (!name) { alert("이름을 입력해주세요."); return; }
    saveScore(name, window.gameScore, window.gameStage);
});
showRankBtn.addEventListener("click", () => showLeaderboard());
closeRankBtn.addEventListener("click", () => {
    document.getElementById("overlay").style.display = "none";
    rankListArea.style.display = "none";
    closeRankBtn.style.display = "none";
    document.getElementById("overlayRestart").style.display = "inline-block";
});

// --- 게임 로직 ---
(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = canvas.width;
  bgCanvas.height = canvas.height;
  const bgCtx = bgCanvas.getContext("2d");
  let revealImage = new Image();
  const loadingMsg = document.getElementById("loadingMsg");

  const bgm = document.getElementById("bgm");
  const muteBtn = document.getElementById("muteBtn");
  let isMuted = true, soundStarted = false;
  bgm.volume = 0.4; 

  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    if(isMuted) { bgm.pause(); muteBtn.textContent = "🔇"; } 
    else { bgm.play().catch(e => console.log(e)); muteBtn.textContent = "🔊"; }
  });
  function initAudio() {
    if (!soundStarted) {
      isMuted = false; muteBtn.textContent = "🔊";
      bgm.play().then(() => { soundStarted = true; }).catch(e => console.log(e));
    }
  }

  const cols = 80, rows = 80;
  const cellSize = canvas.width / cols;
  const TARGET_PERCENT = 80, MAX_LIVES = 3;
  const BASIC_SPEED = 5.0, BASIC_RADIUS = cellSize * 1.5; 
  const GIANT_SPEED = BASIC_SPEED / 5.0, GIANT_RADIUS = BASIC_RADIUS * 5.0; 

  const hudEls = {
      stage: document.getElementById("stage"),
      score: document.getElementById("score"),
      fill: document.getElementById("fill"),
      target: document.getElementById("target"),
      lives: document.getElementById("lives")
  };
  
  const overlayEls = {
      main: document.getElementById("overlay"),
      title: document.getElementById("overlayTitle"),
      sub: document.getElementById("overlaySub"),
      restart: document.getElementById("overlayRestart")
  };

  hudEls.target.textContent = TARGET_PERCENT;

  let board, player = { x: 1, y: 0, trail: [] }, enemies = [];
  let score = 0, lives = MAX_LIVES, stage = 1, running = false;
  window.gameScore = 0; window.gameStage = 1;

  const input = { x: 0, y: 0 };
  const keys = { w: false, a: false, s: false, d: false };

  function loadRandomImage() {
    loadingMsg.style.display = "block";
    revealImage = new Image();
    revealImage.crossOrigin = "Anonymous";
    revealImage.src = `https://picsum.photos/640/640?random=${Math.random()}`;
    revealImage.onload = () => { loadingMsg.style.display = "none"; renderStaticBoard(); };
    revealImage.onerror = () => { loadingMsg.style.display = "none"; };
  }

  function renderStaticBoard() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = "#000";
    bgCtx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (board[y][x] === 1) bgCtx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    bgCtx.fill();
    bgCtx.globalCompositeOperation = 'source-in';
    if (revealImage.complete && revealImage.naturalWidth > 0) bgCtx.drawImage(revealImage, 0, 0, bgCanvas.width, bgCanvas.height);
    else { bgCtx.fillStyle = "#10b981"; bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height); }
    bgCtx.globalCompositeOperation = 'source-over';
    bgCtx.strokeStyle = "rgba(255,255,255,0.05)"; bgCtx.lineWidth = 0.5;
    bgCtx.beginPath();
    for(let x=0; x<=cols; x+=5) { bgCtx.moveTo(x*cellSize, 0); bgCtx.lineTo(x*cellSize, bgCanvas.height); }
    for(let y=0; y<=rows; y+=5) { bgCtx.moveTo(0, y*cellSize); bgCtx.lineTo(bgCanvas.width, y*cellSize); }
    bgCtx.stroke();
  }

  function updateInputVector() {
    let kx = 0, ky = 0;
    if (keys.a) kx -= 1; if (keys.d) kx += 1;
    if (keys.w) ky -= 1; if (keys.s) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      input.x = kx / len; input.y = ky / len;
    } 
  }
  function bindInputEvents() {
    window.addEventListener("keydown", e => {
      initAudio(); const k = e.key.toLowerCase();
      if(k === 'w' || k === 'arrowup') keys.w = true;
      if(k === 'a' || k === 'arrowleft') keys.a = true;
      if(k === 's' || k === 'arrowdown') keys.s = true;
      if(k === 'd' || k === 'arrowright') keys.d = true;
      updateInputVector();
    });
    window.addEventListener("keyup", e => {
      const k = e.key.toLowerCase();
      if(k === 'w' || k === 'arrowup') keys.w = false;
      if(k === 'a' || k === 'arrowleft') keys.a = false;
      if(k === 's' || k === 'arrowdown') keys.s = false;
      if(k === 'd' || k === 'arrowright') keys.d = false;
      if (!keys.w && !keys.a && !keys.s && !keys.d) {
         if(document.querySelector(".stick-base").getAttribute("data-active") !== "true") { input.x=0; input.y=0; }
      } else updateInputVector();
    });
  }

  function bindJoystick() {
    const base = document.querySelector(".stick-base");
    const handle = document.getElementById("stickHandle");
    let rect, dragging = false;
    const updateStick = (cx, cy) => {
      const r = base.getBoundingClientRect();
      const dx = cx - (r.left + r.width/2), dy = cy - (r.top + r.height/2);
      const dist = Math.hypot(dx, dy);
      if (dist < 10) { input.x=0; input.y=0; handle.style.transform = `translate(-50%, -50%)`; return; }
      const angle = Math.atan2(dy, dx);
      input.x = Math.cos(angle); input.y = Math.sin(angle);
      const v = Math.min(dist, r.width/2);
      handle.style.transform = `translate(calc(-50% + ${Math.cos(angle)*v}px), calc(-50% + ${Math.sin(angle)*v}px))`;
    };
    const start = (e) => { initAudio(); dragging = true; base.setAttribute("data-active", "true"); updateStick(e.touches?e.touches[0].clientX:e.clientX, e.touches?e.touches[0].clientY:e.clientY); };
    const move = (e) => { if(dragging) { e.preventDefault(); updateStick(e.touches?e.touches[0].clientX:e.clientX, e.touches?e.touches[0].clientY:e.clientY); } };
    const end = () => { dragging = false; base.setAttribute("data-active", "false"); input.x=0; input.y=0; handle.style.transform = `translate(-50%, -50%)`; };
    base.addEventListener("mousedown", start); window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    base.addEventListener("touchstart", start, {passive:false}); window.addEventListener("touchmove", move, {passive:false}); window.addEventListener("touchend", end);
  }

  function createEmptyBoard() {
    const b = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) row.push(1);
        else row.push(0);
      }
      b.push(row);
    }
    return b;
  }

  function setupStage(s, hardReset) {
    if(hardReset) { score = 0; lives = MAX_LIVES; }
    window.gameScore = score; window.gameStage = s;
    board = createEmptyBoard();
    player.x = cols / 2; player.y = 0; player.trail = []; player.drawing = false;
    spawnEnemies(s); loadRandomImage(); updateHUD(0);
  }

  function spawnEnemies(s) {
    enemies = [];
    let bC = (s===1)?1:(s===2)?2:(s===3)?5:(5+(s-3));
    let gC = (s===1)?0:(s===2)?1:(s===3)?2:(2+Math.floor((s-3)/2));
    for(let i=0; i<gC; i++) createEnemy('giant');
    for(let i=0; i<bC; i++) createEnemy('basic');
  }
  function createEnemy(type) {
    const angle = Math.random() * Math.PI * 2;
    const isG = (type === 'giant');
    enemies.push({
        type: type, 
        x: (canvas.width/2) + (Math.random()-0.5)*300,
        y: (canvas.height/2) + (Math.random()-0.5)*300,
        vx: Math.cos(angle) * (isG?GIANT_SPEED:BASIC_SPEED),
        vy: Math.sin(angle) * (isG?GIANT_SPEED:BASIC_SPEED),
        baseSpeed: isG?GIANT_SPEED:BASIC_SPEED,
        radius: isG?GIANT_RADIUS:BASIC_RADIUS,
        rotation: 0, rotationDir: 1
    });
  }

  function markPath(x0, y0, x1, y1) {
     let gx0=Math.floor(x0+0.5), gy0=Math.floor(y0+0.5), gx1=Math.floor(x1+0.5), gy1=Math.floor(y1+0.5);
     const dx=Math.abs(gx1-gx0), dy=Math.abs(gy1-gy0), sx=(gx0<gx1)?1:-1, sy=(gy0<gy1)?1:-1;
     let err=dx-dy, loop=0;
     while(loop++ < 200) {
        if(gx0>=0 && gx0<cols && gy0>=0 && gy0<rows && board[gy0][gx0]===0) {
           board[gy0][gx0] = 2; player.trail.push({x:gx0, y:gy0});
        }
        if (gx0===gx1 && gy0===gy1) break;
        const e2=2*err;
        if (e2>-dy) { err-=dy; gx0+=sx; } if (e2<dx) { err+=dx; gy0+=sy; }
     }
  }

  function updatePlayer() {
    if (input.x === 0 && input.y === 0) return;
    const nx = player.x + input.x * BASIC_SPEED * 0.1;
    const ny = player.y + input.y * BASIC_SPEED * 0.1;
    const ngx = Math.floor(nx+0.5), ngy = Math.floor(ny+0.5);
    if (ngx < 0 || ngx >= cols || ngy < 0 || ngy >= rows) return;

    if (!player.drawing) {
       if (board[ngy][ngx] === 1) { player.x=nx; player.y=ny; }
       else {
         player.drawing = true; player.trail = []; 
         markPath(player.x, player.y, nx, ny); player.x=nx; player.y=ny;
       }
    } else {
       markPath(player.x, player.y, nx, ny); player.x=nx; player.y=ny;
       if (board[ngy][ngx] === 1) completeFill();
       else if (board[ngy][ngx] === 2) {
         if (player.trail.findIndex(t=>t.x===ngx&&t.y===ngy) < player.trail.length - 5) loseLife();
       }
    }
  }

  function updateEnemies() {
    for(let i=0; i<enemies.length; i++) {
        for(let j=i+1; j<enemies.length; j++) {
            const e1=enemies[i], e2=enemies[j];
            const dx=e2.x-e1.x, dy=e2.y-e1.y, dist=Math.max(Math.hypot(dx,dy), 0.001);
            const minD = e1.radius+e2.radius;
            if (dist < minD) {
                const overlap=minD-dist, nx=dx/dist, ny=dy/dist;
                e1.x-=nx*overlap*0.5; e1.y-=ny*overlap*0.5;
                e2.x+=nx*overlap*0.5; e2.y+=ny*overlap*0.5;
                // 간단한 탄성 충돌
                const v1n = e1.vx*nx+e1.vy*ny, v2n = e2.vx*nx+e2.vy*ny;
                e1.vx+=(v2n-v1n)*nx; e1.vy+=(v2n-v1n)*ny;
                e2.vx+=(v1n-v2n)*nx; e2.vy+=(v1n-v2n)*ny;
                applyRandomSpeed(e1); applyRandomSpeed(e2);
            }
        }
    }
    enemies.forEach(e => {
      if(e.type==='giant') e.rotation += 0.02 * e.rotationDir;
      e.x+=e.vx; 
      if(checkCol(e)) { e.x-=e.vx; e.vx=-e.vx; applyRandomSpeed(e); if(e.type==='giant') e.rotationDir*=-1; }
      e.y+=e.vy;
      if(checkCol(e)) { e.y-=e.vy; e.vy=-e.vy; applyRandomSpeed(e); if(e.type==='giant') e.rotationDir*=-1; }
    });
  }
  function checkCol(e) {
    const sx=Math.floor((e.x-e.radius)/cellSize), ex=Math.floor((e.x+e.radius)/cellSize);
    const sy=Math.floor((e.y-e.radius)/cellSize), ey=Math.floor((e.y+e.radius)/cellSize);
    if (sx>=cols || ex<0 || sy>=rows || ey<0) return true;
    for (let y=sy; y<=ey; y++) {
      for (let x=sx; x<=ex; x++) {
        if (x<0||x>=cols||y<0||y>=rows || board[y][x]===1) {
          const cx=x*cellSize, cy=y*cellSize;
          const clX = Math.max(cx, Math.min(e.x, cx+cellSize));
          const clY = Math.max(cy, Math.min(e.y, cy+cellSize));
          if ((e.x-clX)**2 + (e.y-clY)**2 < e.radius**2) {
            if(e.type==='giant' && x>=0 && x<cols && y>=0 && y<rows && board[y][x]===1) {
               board[y][x]=0; renderStaticBoard();
            }
            return true;
          }
        }
      }
    }
    return false;
  }
  function applyRandomSpeed(e) {
     const a = Math.atan2(e.vy, e.vx), s = e.baseSpeed * (0.8+Math.random()*0.4);
     e.vx = Math.cos(a)*s; e.vy = Math.sin(a)*s;
  }

  function checkCollisions() {
    if (!player.drawing) return;
    const px = player.x * cellSize, py = player.y * cellSize;
    for (const e of enemies) {
      if (Math.hypot(e.x-px, e.y-py) < e.radius+cellSize) { loseLife(); return; }
      for (const t of player.trail) {
         if (Math.hypot(e.x-(t.x*cellSize+cellSize/2), e.y-(t.y*cellSize+cellSize/2)) < e.radius+cellSize/2) { loseLife(); return; }
      }
    }
  }

  function completeFill() {
    player.trail.forEach(p => board[p.y][p.x] = 1);
    player.drawing = false; player.trail = [];
    // 영역 채우기 (BFS)
    const visited = Array(rows).fill(0).map(()=>Array(cols).fill(false)), regions = [];
    for(let y=0; y<rows; y++){
      for(let x=0; x<cols; x++){
         if(board[y][x]===0 && !visited[y][x]) {
            const pts = []; let q = [{x,y}]; visited[y][x]=true; pts.push({x,y});
            let head=0;
            while(head<q.length){
               const c=q[head++];
               [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
                  const nx=c.x+dx, ny=c.y+dy;
                  if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&board[ny][nx]===0&&!visited[ny][nx]){
                     visited[ny][nx]=true; q.push({x:nx,y:ny}); pts.push({x:nx,y:ny});
                  }
               });
            }
            regions.push(pts);
         }
      }
    }
    // 가장 큰 영역만 남기고 다 채움
    if (regions.length > 1) {
        regions.sort((a, b) => b.length - a.length); 
        for(let i=1; i<regions.length; i++) {
            regions[i].forEach(p => board[p.y][p.x] = 1);
            score += regions[i].length * 10;
        }
    }
    renderStaticBoard();
    const initE = enemies.length;
    enemies = enemies.filter(e => {
       const gx = Math.floor(e.x/cellSize), gy = Math.floor(e.y/cellSize);
       return (gy>=0 && gy<rows && gx>=0 && gx<cols && board[gy][gx]===0);
    });
    if(initE > enemies.length) score += (initE - enemies.length) * 500;
    
    const pct = getFillPercent();
    updateHUD(pct);
    if (pct >= TARGET_PERCENT) {
      running = false;
      showOverlay(`STAGE ${stage} CLEAR!`, "완벽합니다!", () => {
         stage++; setupStage(stage, false);
         overlayEls.main.style.display = "none"; running = true;
      });
    }
  }

  function getFillPercent() {
    let f=0;
    for(let y=1; y<rows-1; y++) for(let x=1; x<cols-1; x++) if(board[y][x]===1) f++;
    return (f / ((cols-2)*(rows-2))) * 100;
  }

  function loseLife() {
    lives--;
    player.trail.forEach(p => board[p.y][p.x] = 0);
    player.trail = []; player.drawing = false;
    player.x = cols/2; player.y = 0;
    updateHUD(getFillPercent());
    if (lives <= 0) {
      running = false;
      overlayEls.title.textContent = "GAME OVER";
      overlayEls.sub.textContent = `최종 점수: ${score}\n명예의 전당에 이름을 남기세요!`;
      rankForm.style.display = "flex";
      rankListArea.style.display = "none"; 
      closeRankBtn.style.display = "none";
      overlayEls.restart.style.display = "inline-block";
      overlayEls.restart.textContent = "등록 안 함"; 
      overlayEls.main.style.display = "flex";
      overlayEls.restart.onclick = () => location.reload();
    }
  }

  function updateHUD(pct) {
    hudEls.fill.textContent = pct.toFixed(1);
    hudEls.score.textContent = score;
    hudEls.lives.textContent = lives;
    hudEls.stage.textContent = stage;
    window.gameScore = score; window.gameStage = stage;
  }

  function showOverlay(title, sub, cb) {
    overlayEls.title.textContent = title; overlayEls.sub.textContent = sub;
    rankForm.style.display = "none"; rankListArea.style.display = "none";
    closeRankBtn.style.display = "none"; overlayEls.restart.style.display = "inline-block";
    overlayEls.restart.textContent = "다음"; overlayEls.main.style.display = "flex";
    overlayEls.restart.onclick = cb;
  }

  function loop() {
    if(running) { updatePlayer(); updateEnemies(); checkCollisions(); }
    draw(); requestAnimationFrame(loop);
  }
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(bgCanvas,0,0);
    const px = player.x*cellSize, py = player.y*cellSize;
    if (player.drawing) {
       ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = cellSize; ctx.lineCap = "round"; ctx.lineJoin = "round";
       ctx.beginPath();
       if(player.trail.length > 0) {
         ctx.moveTo(player.trail[0].x*cellSize+cellSize/2, player.trail[0].y*cellSize+cellSize/2);
         for(let i=1; i<player.trail.length; i++) ctx.lineTo(player.trail[i].x*cellSize+cellSize/2, player.trail[i].y*cellSize+cellSize/2);
         ctx.lineTo(px+cellSize/2, py+cellSize/2);
       }
       ctx.stroke();
    }
    ctx.fillStyle = "#38bdf8"; ctx.beginPath();
    ctx.arc(px+cellSize/2, py+cellSize/2, cellSize*0.8, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();

    for(const e of enemies) {
       if (e.type === 'giant') {
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rotation);
          ctx.beginPath();
          for(let i=0; i<10; i++) {
             const th = (i*2*Math.PI)/10;
             if(i===0) ctx.moveTo(Math.cos(th)*e.radius, Math.sin(th)*e.radius);
             else ctx.lineTo(Math.cos(th)*e.radius, Math.sin(th)*e.radius);
          }
          ctx.closePath(); ctx.fillStyle = "#a855f7"; ctx.fill(); ctx.lineWidth=4; ctx.strokeStyle="#e9d5ff"; ctx.stroke();
          ctx.rotate(-e.rotation); ctx.fillStyle = "#fff"; ctx.beginPath();
          ctx.arc(-e.radius/3, -e.radius/3, e.radius/5, 0, Math.PI*2);
          ctx.arc(e.radius/3, -e.radius/3, e.radius/5, 0, Math.PI*2);
          ctx.fill(); ctx.restore();
       } else {
          ctx.fillStyle = "#f87171"; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.beginPath();
          ctx.arc(e.x-e.radius/3, e.y-e.radius/3, e.radius/4, 0, Math.PI*2);
          ctx.arc(e.x+e.radius/3, e.y-e.radius/3, e.radius/4, 0, Math.PI*2);
          ctx.fill();
       }
    }
  }

  bindInputEvents(); bindJoystick();
  document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("startLayer").style.display = "none";
    setupStage(1, true); running = true; loop();
  });
  document.getElementById("restartBtn").addEventListener("click", () => location.reload());
})();