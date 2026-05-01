
// ─── ANIMATED BACKGROUND NETWORK ───
const bgCanvas = document.getElementById('canvas-bg');
const bgCtx = bgCanvas.getContext('2d');

function resizeBg() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeBg();
window.addEventListener('resize', resizeBg);

const nodes = [];
const NUM_NODES = 55;

for (let i = 0; i < NUM_NODES; i++) {
  nodes.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1,
    pulse: Math.random() * Math.PI * 2
  });
}

function drawBg(ts) {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  
  const t = ts * 0.001;
  
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > bgCanvas.width) n.vx *= -1;
    if (n.y < 0 || n.y > bgCanvas.height) n.vy *= -1;
    n.pulse += 0.02;
    
    for (let j = i + 1; j < nodes.length; j++) {
      const m = nodes[j];
      const dx = m.x - n.x;
      const dy = m.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const alpha = (1 - dist / 150) * 0.25;
        bgCtx.beginPath();
        bgCtx.moveTo(n.x, n.y);
        bgCtx.lineTo(m.x, m.y);
        bgCtx.strokeStyle = `rgba(0,229,255,${alpha})`;
        bgCtx.lineWidth = 0.5;
        bgCtx.stroke();
      }
    }
    
    const pulse = (Math.sin(n.pulse) + 1) * 0.5;
    bgCtx.beginPath();
    bgCtx.arc(n.x, n.y, n.r + pulse, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(0,229,255,${0.4 + pulse * 0.4})`;
    bgCtx.fill();
  }
  requestAnimationFrame(drawBg);
}
requestAnimationFrame(drawBg);

// ─── TOPOLOGY DEMO CANVAS ───
const topoCanvas = document.getElementById('topology-canvas');
const topoCtx = topoCanvas.getContext('2d');

function resizeTopo() {
  topoCanvas.width = topoCanvas.offsetWidth;
  topoCanvas.height = topoCanvas.offsetHeight;
}
resizeTopo();
window.addEventListener('resize', resizeTopo);

const topo = {
  nodes: [],
  packets: [],
  time: 0
};

function initTopo() {
  const W = topoCanvas.width;
  const H = topoCanvas.height;
  const cx = W / 2;
  
  topo.nodes = [
    // Internet/Cloud
    { id: 'internet', label: 'Internet', x: cx, y: 45, type: 'cloud', color: '#00e5ff' },
    // ISPs
    { id: 'isp1', label: 'ISP1', x: cx - 200, y: 100, type: 'tower', color: '#00e5ff' },
    { id: 'isp2', label: 'ISP2', x: cx + 200, y: 100, type: 'tower', color: '#00e5ff' },
    // Firewall
    { id: 'fw', label: 'Firewall', x: cx, y: 160, type: 'firewall', color: '#ff6d00' },
    // Router
    { id: 'router', label: 'Router', x: cx, y: 230, type: 'router', color: '#1e88e5' },
    // Switches
    { id: 'sw1', label: 'Switch1', x: cx - 180, y: 310, type: 'switch', color: '#00e5ff' },
    { id: 'sw2', label: 'Switch2', x: cx + 180, y: 310, type: 'switch', color: '#00e5ff' },
    // Endpoints
    { id: 'pc1', label: 'PC', x: cx - 280, y: 390, type: 'pc', color: '#00ff9d' },
    { id: 'cam', label: 'Cam', x: cx - 140, y: 390, type: 'camera', color: '#00ff9d' },
    { id: 'ap', label: 'AP', x: cx + 100, y: 390, type: 'ap', color: '#ffd600' },
    { id: 'server', label: 'Server', x: cx + 240, y: 390, type: 'server', color: '#00e5ff' },
    // Laptop via AP
    { id: 'laptop', label: 'Laptop', x: cx + 60, y: 460, type: 'laptop', color: '#ffd600' },
  ];

  topo.edges = [
    ['internet','isp1'], ['internet','isp2'],
    ['isp1','fw'], ['isp2','fw'],
    ['fw','router'],
    ['router','sw1'], ['router','sw2'],
    ['sw1','pc1'], ['sw1','cam'],
    ['sw2','ap'], ['sw2','server'],
    ['ap','laptop'],
  ];
}

initTopo();

const packetColors = ['#00e5ff','#00ff9d','#ff6d00','#ffd600'];

function spawnPacket() {
  const edges = topo.edges;
  const edge = edges[Math.floor(Math.random() * edges.length)];
  const src = topo.nodes.find(n => n.id === edge[0]);
  const dst = topo.nodes.find(n => n.id === edge[1]);
  if (!src || !dst) return;
  topo.packets.push({
    sx: src.x, sy: src.y,
    ex: dst.x, ey: dst.y,
    progress: 0,
    speed: 0.015 + Math.random() * 0.02,
    color: packetColors[Math.floor(Math.random() * packetColors.length)],
    reverse: Math.random() > 0.5
  });
}

function drawTopo() {
  if (!topoCanvas.width) { requestAnimationFrame(drawTopo); return; }
  const ctx = topoCtx;
  const W = topoCanvas.width;
  const H = topoCanvas.height;
  ctx.clearRect(0, 0, W, H);

  topo.time += 0.016;
  if (Math.random() < 0.12) spawnPacket();

  // Draw edges
  topo.edges.forEach(([a, b]) => {
    const na = topo.nodes.find(n => n.id === a);
    const nb = topo.nodes.find(n => n.id === b);
    if (!na || !nb) return;
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = 'rgba(0,229,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw packets
  topo.packets = topo.packets.filter(p => p.progress <= 1);
  topo.packets.forEach(p => {
    p.progress += p.speed;
    const t = p.reverse ? 1 - p.progress : p.progress;
    const x = p.sx + (p.ex - p.sx) * t;
    const y = p.sy + (p.ey - p.sy) * t;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw nodes
  topo.nodes.forEach(node => {
    const pulse = (Math.sin(topo.time * 2 + node.x * 0.01) + 1) * 0.5;
    
    // glow ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, 14 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = node.color + '22';
    ctx.lineWidth = 2;
    ctx.stroke();

    // node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1520';
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // icon inside
    ctx.fillStyle = node.color;
    ctx.font = `11px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons = { cloud:'☁', tower:'📡', firewall:'🛡', router:'⬡', switch:'⬛', pc:'💻', camera:'📷', ap:'📶', server:'🖥', laptop:'💻' };
    ctx.fillText(icons[node.type] || '●', node.x, node.y);

    // label
    ctx.fillStyle = '#78909c';
    ctx.font = '10px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, node.x, node.y + 14);
  });

  // IP addresses overlaid
  ctx.fillStyle = 'rgba(0,229,255,0.5)';
  ctx.font = '9px Share Tech Mono, monospace';
  ctx.textAlign = 'left';
  const ips = [
    [topo.nodes[3].x + 14, topo.nodes[3].y - 4, '10.0.1.1'],
    [topo.nodes[4].x + 14, topo.nodes[4].y - 4, '192.168.1.1'],
    [topo.nodes[5].x + 14, topo.nodes[5].y - 4, '192.168.1.10'],
  ];
  ips.forEach(([x, y, ip]) => ctx.fillText(ip, x, y));

  requestAnimationFrame(drawTopo);
}
setTimeout(() => {
  resizeTopo();
  initTopo();
  drawTopo();
}, 200);

// ─── LIVE METRICS UPDATE ───
setInterval(() => {
  const thpt = (9300 + Math.random() * 200).toFixed(1);
  const lat = (1.5 + Math.random() * 0.8).toFixed(1);
  const el1 = document.getElementById('thpt');
  const el2 = document.getElementById('lat');
  if (el1) el1.textContent = thpt;
  if (el2) el2.textContent = lat + 'ms';
}, 1500);

// ─── SCROLL ANIMATIONS ───
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .scenario-card, .stat-item, .faq-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
