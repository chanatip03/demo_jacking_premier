"use client";

import { useEffect, useRef, useCallback } from "react";

interface RobotMapProps {
  serverIP: string;
}

export function RobotMap({ serverIP }: RobotMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // We mount the entire canvas logic once via a self-contained script
  // that we inject into a dedicated script tag (avoids React re-render conflicts
  // with the imperative canvas/animation-frame/WebSocket code).
  const initCalled = useRef(false);

  const getScriptContent = useCallback(
    () => `
(function() {
  // ─── Config ───────────────────────────────────────────────────────────────
  const serverIP = ${JSON.stringify(serverIP)};
  const port   = (serverIP === 'localhost' || serverIP === '192.168.1.101') ? 5001 : 5010;
  const wsport = (serverIP === 'localhost' || serverIP === '192.168.1.101') ? 5002 : 5011;

  const MAP_API    = 'http://' + serverIP + ':' + port + '/download_currentlymap';
  const ROBOT_API  = 'http://' + serverIP + ':' + port + '/robot_location';
  const CHASSIS_API= 'http://' + serverIP + ':' + port + '/chassis';

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  const canvas         = document.getElementById('amr-map-canvas');
  const ctx            = canvas.getContext('2d');
  const loadingOverlay = document.getElementById('amr-loading-overlay');
  const loadingText    = document.getElementById('amr-loading-text');

  // ─── State ────────────────────────────────────────────────────────────────
  let mapData = null, robotData = null;
  let chassisData = { head: 0.34, tail: 0.28, width: 0.56 };
  let minX=0, minY=0, maxX=0, maxY=0, baseScale=1, baseOffsetX=0, baseOffsetY=0;
  // CSS-pixel size of the canvas box (NOT the same as canvas.width/height,
  // which are scaled by devicePixelRatio — see calculateMapBounds()).
  let cssWidth=0, cssHeight=0, dpr=1;
  let cameraZoom=1, cameraX=0, cameraY=0;
  let isDragging=false, lastMousePos={x:0,y:0};
  let auraProgress=0, lastFrameTime=0;
  let isFocusRobot=false, isShowGrid=false, isShowPointCloud=false;
  let pcCanvas=null, pcCtx=null, pcScale=50, pcCurrentIndex=0, isPcRendered=false;
  let isShowLaser=false, laserData=null, latestLaserBuffer=null, ws=null;
  let isActionMode=false, hoveredPointName=null;
  let animFrameId=null;
  let resizeObserver=null;

  // multi-touch (pinch-zoom / two-finger pan) state
  let activePointers = new Map(); // pointerId -> {x,y}
  let pinchStartDistance = null, pinchStartZoom = 1, pinchStartMid = {x:0,y:0}, pinchStartCamera = {x:0,y:0};

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function showLoading(text) {
    loadingText.innerText = text || 'Loading map…';
    loadingOverlay.style.display = 'flex';
  }
  function hideLoading() { loadingOverlay.style.display = 'none'; }

  function toggleBtn(id) {
    const btn = document.getElementById(id);
    const active = btn.classList.toggle('amr-btn-active');
    return active;
  }

  // ─── Button handlers ──────────────────────────────────────────────────────
  document.getElementById('amr-btn-action').onclick = function() {
    isActionMode = !isActionMode;
    this.classList.toggle('amr-btn-active', isActionMode);
    canvas.style.cursor = isActionMode ? 'crosshair' : 'grab';
    if (!isActionMode) hoveredPointName = null;
  };
  document.getElementById('amr-btn-laser').onclick = function() {
    isShowLaser = !isShowLaser;
    this.classList.toggle('amr-btn-active', isShowLaser);
  };
  document.getElementById('amr-btn-pointcloud').onclick = function() {
    isShowPointCloud = !isShowPointCloud;
    this.classList.toggle('amr-btn-active', isShowPointCloud);
  };
  document.getElementById('amr-btn-focus').onclick = function() {
    isFocusRobot = !isFocusRobot;
    this.classList.toggle('amr-btn-active', isFocusRobot);
    if (isFocusRobot) cameraZoom = 3;
  };
  document.getElementById('amr-btn-grid').onclick = function() {
    isShowGrid = !isShowGrid;
    this.classList.toggle('amr-btn-active', isShowGrid);
  };
  document.getElementById('amr-btn-reset').onclick = resetView;
  function handleKeyDown(e) {
    if (e.key === 'Escape' && isActionMode) {
      isActionMode = false;
      document.getElementById('amr-btn-action').classList.remove('amr-btn-active');
      canvas.style.cursor = 'grab';
      hoveredPointName = null;
    }
  }
  function handleWindowMouseUp() { isDragging = false; }
  function handleWindowTouchEnd() {
    isDragging = false;
    pinchStartDistance = null;
    activePointers.clear();
  }
  function handleWindowResize() {
    if (mapData) { calculateMapBounds(); if (!isFocusRobot) zoomToPoints(); }
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mouseup', handleWindowMouseUp);
  window.addEventListener('touchend', handleWindowTouchEnd);
  window.addEventListener('resize', handleWindowResize);

  let resizePending = false;
  if (canvas.parentElement && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(() => {
        resizePending = false;
        if (mapData) { calculateMapBounds(); if (!isFocusRobot) zoomToPoints(); }
      });
    });
    resizeObserver.observe(canvas.parentElement);
  }

  // ─── Mouse / Touch (scoped to canvas; removed automatically when the
  //     canvas element itself is unmounted, so these are safe as-is) ────────
  // ─── Mouse / Touch ───────────────────────────────────────────────────────
canvas.addEventListener('pointerdown', (e) => {
  // รับเฉพาะ mouse ซ้าย หรือ touch
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  canvas.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (isFocusRobot) {
    resetFocusMode();
  }

  if (activePointers.size === 2) {
    // เริ่ม pinch: หยุด single-finger drag ไว้ก่อน
    isDragging = false;
    const pts = Array.from(activePointers.values());
    pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    pinchStartZoom = cameraZoom;
    pinchStartMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    pinchStartCamera = { x: cameraX, y: cameraY };
  } else if (activePointers.size === 1) {
    isDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) {
    if (!isDragging) simulateHover(e.clientX, e.clientY);
    return;
  }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size >= 2 && pinchStartDistance) {
    const pts = Array.from(activePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

    let newZoom = pinchStartZoom * (dist / pinchStartDistance);
    newZoom = Math.max(0.1, Math.min(20, newZoom));

    const rect = canvas.getBoundingClientRect();
    const factor = newZoom / pinchStartZoom;
    // ซูมรอบจุดกึ่งกลางตอนเริ่ม pinch แล้วเลื่อนตามการขยับของจุดกึ่งกลางสองนิ้ว (two-finger pan)
    cameraX = (pinchStartMid.x - rect.left) - ((pinchStartMid.x - rect.left) - pinchStartCamera.x) * factor + (mid.x - pinchStartMid.x);
    cameraY = (pinchStartMid.y - rect.top)  - ((pinchStartMid.y - rect.top)  - pinchStartCamera.y) * factor + (mid.y - pinchStartMid.y);
    cameraZoom = newZoom;
    return;
  }

  if (!isDragging) {
    // ไม่ลาก = แค่ hover
    simulateHover(e.clientX, e.clientY);
    return;
  }

  cameraX += e.clientX - lastMousePos.x;
  cameraY += e.clientY - lastMousePos.y;

  lastMousePos = {
    x: e.clientX,
    y: e.clientY,
  };
});

function releasePointer(e) {
  activePointers.delete(e.pointerId);
  if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  if (activePointers.size === 1) {
    // เหลือนิ้วเดียว กลับไป drag ปกติโดยไม่ให้ภาพกระโดด
    const remaining = Array.from(activePointers.values())[0];
    isDragging = true;
    lastMousePos = { x: remaining.x, y: remaining.y };
    pinchStartDistance = null;
  } else {
    isDragging = false;
    pinchStartDistance = null;
  }
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

// Mouse wheel = zoom
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();

    applyZoom(
      e.clientX,
      e.clientY,
      1 + ((e.deltaY > 0 ? -1 : 1) * 0.1)
    );
  },
  { passive: false }
);

  canvas.addEventListener('click', async (e) => {
    if (isActionMode && hoveredPointName) {
      let targetPOI = hoveredPointName;
      isActionMode = false;
      document.getElementById('amr-btn-action').classList.remove('amr-btn-active');
      canvas.style.cursor = 'grab';
      try {
        await fetch('http://' + serverIP + ':' + port + '/navigation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ POI: targetPOI })
        });
      } catch(err) { console.error('Navigation error:', err); }
    }
  });

  // ─── Camera helpers ───────────────────────────────────────────────────────
  function applyZoom(clientX, clientY, factor) {
    const rect = canvas.getBoundingClientRect();
    cameraX = (clientX - rect.left) - ((clientX - rect.left) - cameraX) * factor;
    cameraY = (clientY - rect.top)  - ((clientY - rect.top)  - cameraY) * factor;
    cameraZoom *= factor;
  }
  function applyZoomAbsolute(clientX, clientY, newZoom) {
    if (newZoom < 0.1 || newZoom > 20) return;
    const rect = canvas.getBoundingClientRect();
    let factor = newZoom / cameraZoom;
    cameraX = (clientX - rect.left) - ((clientX - rect.left) - cameraX) * factor;
    cameraY = (clientY - rect.top)  - ((clientY - rect.top)  - cameraY) * factor;
    cameraZoom = newZoom;
  }
  function resetFocusMode() {
    isFocusRobot = false;
    document.getElementById('amr-btn-focus').classList.remove('amr-btn-active');
  }
  function resetView() {
    isFocusRobot = false;
    document.getElementById('amr-btn-focus').classList.remove('amr-btn-active');
    calculateMapBounds(); zoomToPoints();
  }

  // ─── Coordinate transform ─────────────────────────────────────────────────
  function transformPoint(worldX, worldY) {
    return {
      cx: ((worldX - minX) * baseScale + baseOffsetX) * cameraZoom + cameraX,
      cy: (cssHeight - ((worldY - minY) * baseScale + baseOffsetY)) * cameraZoom + cameraY
    };
  }

  // ─── Map bounds & zoom ────────────────────────────────────────────────────
  function calculateMapBounds() {
    if (!mapData) return;
    let aMinX=Infinity, aMaxX=-Infinity, aMinY=Infinity, aMaxY=-Infinity;
    if (mapData.header?.minPos) {
      aMinX=mapData.header.minPos.x; aMinY=mapData.header.minPos.y;
      aMaxX=mapData.header.maxPos.x; aMaxY=mapData.header.maxPos.y;
    } else {
      function cb(x,y){if(x<aMinX)aMinX=x;if(x>aMaxX)aMaxX=x;if(y<aMinY)aMinY=y;if(y>aMaxY)aMaxY=y;}
      (mapData.advancedPointList||[]).forEach(pt=>{if(pt.pos?.x!==undefined)cb(pt.pos.x,pt.pos.y);});
      if(aMinX===Infinity){aMinX=-10;aMaxX=10;aMinY=-10;aMaxY=10;}
    }
    let maxR=Math.max(chassisData.head,chassisData.tail,chassisData.width/2);
    let pad=maxR+2.0;
    let mX=Math.max((aMaxX-aMinX)*0.05,pad), mY=Math.max((aMaxY-aMinY)*0.05,pad);
    minX=aMinX-mX; maxX=aMaxX+mX; minY=aMinY-mY; maxY=aMaxY+mY;

    // ใช้ getBoundingClientRect() แทน offsetWidth/offsetHeight — บนมือถือที่มี
    // dynamic viewport / DPR แปลกๆ (เช่น Z Flip) ค่านี้แม่นกว่าและตรงกับสิ่งที่
    // ผู้ใช้เห็นจริงบนจอ
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (window.__AMR_DEBUG__ !== false) {
      console.log('[RobotMap] canvas size', { width, height, dpr: window.devicePixelRatio, rect });
    }

    // จอเล็ก / container ยัง layout ไม่นิ่ง → width/height อาจเป็น 0 ชั่วคราว
    // ถ้าปล่อยผ่านไปเลยจะได้ baseScale = Infinity/NaN แล้วไม่มีอะไรมา retry ทำให้
    // canvas ว่างเปล่าตลอดไป จึงรอเฟรมถัดไปแล้วลองคำนวณใหม่แทน
    if (width <= 0 || height <= 0) {
      requestAnimationFrame(() => {
        calculateMapBounds();
        if (!isFocusRobot) zoomToPoints();
      });
      return;
    }

    cssWidth = width; cssHeight = height;
    dpr = window.devicePixelRatio || 1;
    // canvas.width/height ต้องเป็น physical pixel (CSS size * DPR) เพื่อความคมชัด
    // บนจอ high-DPI (รวมถึง Z Flip 6) แล้วใช้ setTransform ให้โค้ดวาดทั้งหมดยังคง
    // คิดเป็นหน่วย CSS pixel เหมือนเดิมโดยไม่ต้องแก้ทุกจุดที่วาด
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scaleX=(width-30)/(maxX-minX), scaleY=(height-30)/(maxY-minY);
    baseScale=Math.min(scaleX,scaleY);
    baseOffsetX=(width-((maxX-minX)*baseScale))/2;
    baseOffsetY=(height-((maxY-minY)*baseScale))/2;
  }

  function zoomToPoints() {
    if (!mapData) return;
    let pMinX=Infinity,pMaxX=-Infinity,pMinY=Infinity,pMaxY=-Infinity;
    function cp(x,y){if(x<pMinX)pMinX=x;if(x>pMaxX)pMaxX=x;if(y<pMinY)pMinY=y;if(y>pMaxY)pMaxY=y;}
    (mapData.advancedPointList||[]).forEach(pt=>{if(pt.pos?.x!==undefined)cp(pt.pos.x,pt.pos.y);});
    (mapData.advancedCurveList||[]).forEach(c=>{
      if(c.startPos?.pos?.x!==undefined)cp(c.startPos.pos.x,c.startPos.pos.y);
      if(c.endPos?.pos?.x!==undefined)cp(c.endPos.pos.x,c.endPos.pos.y);
    });
    if(pMinX===Infinity){cameraZoom=1;cameraX=0;cameraY=0;return;}
    let pad=Math.max(chassisData.head,chassisData.tail,chassisData.width/2)+2.0;
    pMinX-=pad;pMaxX+=pad;pMinY-=pad;pMaxY+=pad;
    let bxMin=(pMinX-minX)*baseScale+baseOffsetX, bxMax=(pMaxX-minX)*baseScale+baseOffsetX;
    let byMin=cssHeight-((pMaxY-minY)*baseScale+baseOffsetY), byMax=cssHeight-((pMinY-minY)*baseScale+baseOffsetY);
    let p=40;
    let zX=(cssWidth-p*2)/(bxMax-bxMin), zY=(cssHeight-p*2)/(byMax-byMin);
    cameraZoom=Math.max(1,Math.min(zX,zY));
    let cX=(bxMin+bxMax)/2, cY=(byMin+byMax)/2;
    cameraX=(cssWidth/2)-(cX*cameraZoom);
    cameraY=(cssHeight/2)-(cY*cameraZoom);
  }

  // ─── Hover detection ──────────────────────────────────────────────────────
  function simulateHover(clientX, clientY) {
    if (!isActionMode || !mapData) return;
    const rect = canvas.getBoundingClientRect();
    let mouseX = clientX - rect.left, mouseY = clientY - rect.top;
    let pList = mapData.advancedPointList || mapData.pointList || [];
    let snap = Math.max(15, 20 * cameraZoom);
    hoveredPointName = null;
    for (let pt of pList) {
      if (pt.pos?.x === undefined) continue;
      const { cx, cy } = transformPoint(pt.pos.x, pt.pos.y);
      if (Math.hypot(cx - mouseX, cy - mouseY) < snap) {
        hoveredPointName = pt.instanceName || pt.name; break;
      }
    }
  }

  // ─── Point Cloud ──────────────────────────────────────────────────────────
  function startBackgroundPcCache() {
    if (!mapData?.normalPosList?.length || !mapData.header) return;
    pcCanvas = document.createElement('canvas');
    pcCtx = pcCanvas.getContext('2d');
    let pMinX=mapData.header.minPos.x, pMaxX=mapData.header.maxPos.x;
    let pMinY=mapData.header.minPos.y, pMaxY=mapData.header.maxPos.y;
    pcCanvas.bounds = { minX:pMinX, maxX:pMaxX, minY:pMinY, maxY:pMaxY };
    let w=pMaxX-pMinX, h=pMaxY-pMinY;
    pcScale=50; if(w*pcScale>4000)pcScale=4000/w; if(h*pcScale>4000)pcScale=4000/h;
    pcCanvas.width=w*pcScale; pcCanvas.height=h*pcScale;
    pcCurrentIndex=0; isPcRendered=false;
    requestAnimationFrame(processPcChunk);
  }
  function processPcChunk() {
    if (!mapData?.normalPosList) return;
    let total=mapData.normalPosList.length, end=Math.min(pcCurrentIndex+5000,total);
    pcCtx.fillStyle='#bdc3c7'; pcCtx.beginPath();
    for (let i=pcCurrentIndex; i<end; i++) {
      let pt=mapData.normalPosList[i];
      let px=(pt.x-pcCanvas.bounds.minX)*pcScale, py=(pcCanvas.bounds.maxY-pt.y)*pcScale;
      pcCtx.rect(px-1.5,py-1.5,3,3);
    }
    pcCtx.fill(); pcCurrentIndex=end;
    if (pcCurrentIndex<total) requestAnimationFrame(processPcChunk);
    else isPcRendered=true;
  }

  // ─── Laser WebSocket ──────────────────────────────────────────────────────
  function connectLaserWS() {
    ws = new WebSocket('ws://' + serverIP + ':' + wsport);
    ws.onmessage = (e) => {
      try { latestLaserBuffer = JSON.parse(e.data.replace(/Infinity/g,'999').replace(/NaN/g,'null')); } catch(err){}
    };
    ws.onclose = () => setTimeout(connectLaserWS, 3000);
  }

  // ─── Robot data polling ───────────────────────────────────────────────────
  async function fetchRobotLocation() {
    try {
      const res = await fetch(ROBOT_API);
      if (!res.ok) { console.warn('[RobotMap] robot_location not ok:', res.status); return; }
      robotData = await res.json();
      if (latestLaserBuffer) laserData = latestLaserBuffer;
      updateFooterUI();
    } catch(e) {
      console.warn('[RobotMap] robot_location fetch failed:', e);
    }
  }

  function updateFooterUI() {
    if (!robotData) return;
    // confidence
    let conf = robotData.confidence || 0;
    let confEl = document.getElementById('amr-ui-confidence');
    if (confEl) {
      confEl.innerText = conf.toFixed(2);
      confEl.className = 'amr-conf ' + (conf < 0.5 ? 'amr-conf-red' : conf < 0.8 ? 'amr-conf-yellow' : 'amr-conf-green');
    }
    // emergency
    let emgEl = document.getElementById('amr-ui-emergency');
    if (emgEl) {
      emgEl.innerText = robotData.is_emergency ? '🔴' : '🟢';
      emgEl.className = 'amr-emg ' + (robotData.is_emergency ? 'amr-emg-on' : 'amr-emg-off');
    }
    // blocked
    let blkEl = document.getElementById('amr-ui-blocked');
    if (blkEl) blkEl.innerText = robotData.is_blocked === 'Unblocked' ? 'Unblocked' : 'Blocked: ' + robotData.is_blocked;
    // battery
    let battPct = Math.round((robotData.battery_percentage || 0) * 100);
    let battEl = document.getElementById('amr-ui-battery');
    if (battEl) battEl.innerText = battPct + '%';
    let fillEl = document.getElementById('amr-ui-batt-fill');
    if (fillEl) {
      fillEl.style.width = battPct + '%';
      fillEl.className = 'amr-batt-level' + (battPct <= 20 ? ' low' : battPct <= 50 ? ' med' : '');
    }
    let boltEl = document.getElementById('amr-ui-charging-bolt');
    if (boltEl) boltEl.style.display = robotData.charging ? 'block' : 'none';
  }

  // ─── Draw helpers ─────────────────────────────────────────────────────────
  function drawPointCloudFromBitmap() {
    let b=pcCanvas.bounds;
    let tl=transformPoint(b.minX,b.maxY), br=transformPoint(b.maxX,b.minY);
    ctx.drawImage(pcCanvas,tl.cx,tl.cy,br.cx-tl.cx,br.cy-tl.cy);
  }

  function drawGrid() {
    let sX=Math.floor(minX)-2, eX=Math.ceil(maxX)+2, sY=Math.floor(minY)-2, eY=Math.ceil(maxY)+2;
    ctx.beginPath(); ctx.strokeStyle='rgba(150,150,150,0.6)'; ctx.lineWidth=1.5;
    for(let x=sX;x<=eX;x++){let p1=transformPoint(x,sY),p2=transformPoint(x,eY);ctx.moveTo(p1.cx,p1.cy);ctx.lineTo(p2.cx,p2.cy);}
    for(let y=sY;y<=eY;y++){let p1=transformPoint(sX,y),p2=transformPoint(eX,y);ctx.moveTo(p1.cx,p1.cy);ctx.lineTo(p2.cx,p2.cy);}
    ctx.stroke();
  }

  function drawOrigin() {
    const {cx,cy}=transformPoint(0,0); const z=cameraZoom;
    const aL=10*z,tL=3*z,aS=2*z;
    ctx.strokeStyle='#ff0000'; ctx.fillStyle='#ff0000'; ctx.lineWidth=0.5*z;
    ctx.beginPath(); ctx.moveTo(cx-tL,cy); ctx.lineTo(cx+aL,cy);
    ctx.moveTo(cx,cy+tL); ctx.lineTo(cx,cy-aL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+aL+aS,cy); ctx.lineTo(cx+aL,cy-aS); ctx.lineTo(cx+aL,cy+aS); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx,cy-aL-aS); ctx.lineTo(cx-aS,cy-aL); ctx.lineTo(cx+aS,cy-aL); ctx.closePath(); ctx.fill();
  }

  function drawAreas() {
    const al=mapData.advancedAreaList||mapData.areaList; if(!al)return;
    ctx.fillStyle='rgba(255,235,59,0.35)'; ctx.strokeStyle='rgba(0,250,0,0.9)'; ctx.lineWidth=0.5*cameraZoom;
    al.forEach(area=>{
      if(area.posGroup?.length){
        ctx.beginPath(); let mX=-Infinity, mY=Infinity;
        area.posGroup.forEach((p,i)=>{
          const {cx,cy}=transformPoint(p.x??p.pos?.x??0,p.y??p.pos?.y??0);
          if(cx>mX)mX=cx; if(cy<mY)mY=cy;
          if(i===0)ctx.moveTo(cx,cy); else ctx.lineTo(cx,cy);
        });
        ctx.closePath(); ctx.setLineDash([1*cameraZoom,1*cameraZoom]); ctx.stroke();
        if(area.desc){try{ctx.fillStyle='#cc7a00';ctx.font='bold '+Math.max(6,3*cameraZoom)+'px Arial';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(decodeURIComponent(escape(atob(area.desc))),mX-(5*cameraZoom),mY+(5*cameraZoom));}catch(e){}}
      }
    });
    ctx.setLineDash([]);
  }

  function drawCurves() {
    const cl=mapData.advancedCurveList||mapData.curveList; if(!cl)return;
    let routes=[],rm=new Map();
    cl.forEach(c=>{
      let sx=c.startPos?.x??c.startPos?.pos?.x??0, sy=c.startPos?.y??c.startPos?.pos?.y??0;
      let ex=c.endPos?.x??c.endPos?.pos?.x??0, ey=c.endPos?.y??c.endPos?.pos?.y??0;
      if(sx===undefined)return;
      let dir=0;
      if(c.property&&Array.isArray(c.property)){let dp=c.property.find(p=>p.key==='direction');if(dp?.int32Value!==undefined)dir=dp.int32Value;}
      let fK=sx.toFixed(2)+','+sy.toFixed(2)+'->'+ex.toFixed(2)+','+ey.toFixed(2);
      let bK=ex.toFixed(2)+','+ey.toFixed(2)+'->'+sx.toFixed(2)+','+sy.toFixed(2);
      if(rm.has(bK)){let r=rm.get(bK);r.isBidirectional=true;r.backwardDirection=dir;}
      else if(!rm.has(fK)){let n={curve:c,sx,sy,ex,ey,isBidirectional:false,forwardDirection:dir,backwardDirection:0};rm.set(fK,n);routes.push(n);}
    });
    ctx.strokeStyle='rgba(194,219,52,0.5)'; ctx.lineWidth=1*cameraZoom; ctx.setLineDash([2*cameraZoom,1*cameraZoom]);
    routes.forEach(r=>{
      let pts=[];
      if(r.curve.className==='NURBS6'&&r.curve.controlPos1&&r.curve.controlPos4){
        let cp1x=r.curve.controlPos1.x??r.curve.controlPos1.pos?.x,cp1y=r.curve.controlPos1.y??r.curve.controlPos1.pos?.y;
        let cp2x=r.curve.controlPos2.x??r.curve.controlPos2.pos?.x,cp2y=r.curve.controlPos2.y??r.curve.controlPos2.pos?.y;
        let cp3x=r.curve.controlPos3.x??r.curve.controlPos3.pos?.x,cp3y=r.curve.controlPos3.y??r.curve.controlPos3.pos?.y;
        let cp4x=r.curve.controlPos4.x??r.curve.controlPos4.pos?.x,cp4y=r.curve.controlPos4.y??r.curve.controlPos4.pos?.y;
        if(cp1x!==undefined){for(let t=0;t<=1.001;t+=0.05){let u=1-t;let x=Math.pow(u,5)*r.sx+5*Math.pow(u,4)*t*cp1x+10*Math.pow(u,3)*t*t*cp2x+10*u*u*Math.pow(t,3)*cp3x+5*u*Math.pow(t,4)*cp4x+Math.pow(t,5)*r.ex;let y=Math.pow(u,5)*r.sy+5*Math.pow(u,4)*t*cp1y+10*Math.pow(u,3)*t*t*cp2y+10*u*u*Math.pow(t,3)*cp3y+5*u*Math.pow(t,4)*cp4y+Math.pow(t,5)*r.ey;pts.push(transformPoint(x,y));}}
      } else if((r.curve.className==='DegenerateBezier'||r.curve.className==='BezierCurve')&&r.curve.controlPos1){
        let cp1x=r.curve.controlPos1?.x??r.curve.controlPos1?.pos?.x,cp1y=r.curve.controlPos1?.y??r.curve.controlPos1?.pos?.y;
        let cp2x=r.curve.controlPos2?.x??r.curve.controlPos2?.pos?.x,cp2y=r.curve.controlPos2?.y??r.curve.controlPos2?.pos?.y;
        if(cp1x!==undefined&&cp2x!==undefined){let w=4.5;let m0x=(cp1x-r.sx)*w,m0y=(cp1y-r.sy)*w,m3x=(r.ex-cp2x)*w,m3y=(r.ey-cp2y)*w;for(let t=0;t<=1.001;t+=0.02){let t2=t*t,t3=t2*t;let h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;pts.push(transformPoint(h00*r.sx+h10*m0x+h01*r.ex+h11*m3x,h00*r.sy+h10*m0y+h01*r.ey+h11*m3y));}}
        else if(cp1x!==undefined){for(let t=0;t<=1.001;t+=0.02){let u=1-t;pts.push(transformPoint(u*u*r.sx+2*u*t*cp1x+t*t*r.ex,u*u*r.sy+2*u*t*cp1y+t*t*r.ey));}}
      }
      if(pts.length===0){pts.push(transformPoint(r.sx,r.sy));pts.push(transformPoint(r.ex,r.ey));}
      ctx.beginPath();ctx.moveTo(pts[0].cx,pts[0].cy);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].cx,pts[i].cy);ctx.stroke();
      let tLen=0,lens=[0];for(let i=0;i<pts.length-1;i++){tLen+=Math.hypot(pts[i+1].cx-pts[i].cx,pts[i+1].cy-pts[i].cy);lens.push(tLen);}
      function getAt(d){if(d<=0)return{...pts[0],angle:Math.atan2(pts[1].cy-pts[0].cy,pts[1].cx-pts[0].cx)};if(d>=tLen)return{...pts[pts.length-1],angle:Math.atan2(pts[pts.length-1].cy-pts[pts.length-2].cy,pts[pts.length-1].cx-pts[pts.length-2].cx)};for(let i=0;i<pts.length-1;i++){if(d>=lens[i]&&d<=lens[i+1]){let rat=(lens[i+1]-lens[i])===0?0:(d-lens[i])/(lens[i+1]-lens[i]);return{cx:pts[i].cx+(pts[i+1].cx-pts[i].cx)*rat,cy:pts[i].cy+(pts[i+1].cy-pts[i].cy)*rat,angle:Math.atan2(pts[i+1].cy-pts[i].cy,pts[i+1].cx-pts[i].cx)};}}return{cx:pts[0].cx,cy:pts[0].cy,angle:0};}
      ctx.save();ctx.setLineDash([]);ctx.fillStyle='rgba(201,81,97,0.9)';
      function arrow(cx,cy,a){ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.beginPath();let s=Math.max(3,3*cameraZoom);ctx.moveTo(s,0);ctx.lineTo(-s,s/1.5);ctx.lineTo(-s/1.5,0);ctx.lineTo(-s,-s/1.5);ctx.closePath();ctx.fill();ctx.restore();}
      if(r.isBidirectional){let off=Math.max(3,3*cameraZoom);let p1=getAt(tLen/2-off),p2=getAt(tLen/2+off);arrow(p2.cx,p2.cy,p2.angle);arrow(p1.cx,p1.cy,p1.angle+Math.PI);}
      else{let p=getAt(tLen*0.5);arrow(p.cx,p.cy,p.angle);}
      ctx.restore();
    });
    ctx.setLineDash([]);
  }

  function drawPoints() {
    const pl=mapData.advancedPointList||mapData.pointList; if(!pl)return;
    let ppm=baseScale*cameraZoom;
    let hPx=chassisData.head*ppm,tPx=chassisData.tail*ppm,wPx=chassisData.width*ppm,hwPx=wPx/2;
    let rotR=Math.sqrt(Math.pow(Math.max(hPx,tPx),2)+Math.pow(hwPx,2));
    pl.forEach(pt=>{
      if(pt.pos?.x===undefined)return;
      const {cx,cy}=transformPoint(pt.pos.x,pt.pos.y);
      let fC='rgba(255,162,100,0.4)',sC='#27ae60aa';
      if(pt.className==='ActionPoint'||pt.className==='ChargePoint'){fC='rgb(0,230,64,0.4)';sC='#f39c12aa';}
      ctx.beginPath();ctx.arc(cx,cy,rotR,0,Math.PI*2);ctx.strokeStyle='#bdc3c7';ctx.lineWidth=0.5*cameraZoom;ctx.setLineDash([0.5*cameraZoom,0.5*cameraZoom]);ctx.stroke();ctx.setLineDash([]);
      ctx.save();ctx.translate(cx,cy);
      let dir=pt.dir!==undefined&&!pt.ignoreDir?-pt.dir:0;ctx.rotate(dir);
      ctx.beginPath();ctx.rect(-tPx,-hwPx,hPx+tPx,wPx);ctx.setLineDash([2*cameraZoom,1*cameraZoom]);ctx.fillStyle=fC;ctx.fill();ctx.strokeStyle=sC;ctx.lineWidth=0.5*cameraZoom;ctx.stroke();ctx.setLineDash([]);ctx.restore();
      let name=pt.instanceName||pt.name||'';
      if(name){ctx.fillStyle='#2c3e50';ctx.font='bold '+Math.max(8,4*cameraZoom)+'px Arial';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(name,cx,cy+rotR+(4*cameraZoom));}
      if(isActionMode&&hoveredPointName===name){ctx.beginPath();ctx.arc(cx,cy,rotR+(4*cameraZoom),0,Math.PI*2);ctx.strokeStyle='#3498db';ctx.lineWidth=2*cameraZoom;ctx.stroke();}
    });
  }

  function drawRobot() {
    if (!robotData) return;
    const {cx,cy}=transformPoint(robotData.x,robotData.y);
    let ppm=baseScale*cameraZoom,hPx=chassisData.head*ppm,tPx=chassisData.tail*ppm,wPx=chassisData.width*ppm,hwPx=wPx/2;
    let rotR=Math.sqrt(Math.pow(Math.max(hPx,tPx),2)+Math.pow(hwPx,2));
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-robotData.angle*(Math.PI/180));
    ctx.beginPath();ctx.arc(0,0,rotR,0,Math.PI*2);ctx.strokeStyle='rgba(81,195,251,0.6)';ctx.lineWidth=0.5*cameraZoom;ctx.setLineDash([4*cameraZoom,4*cameraZoom]);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.rect(-tPx,-hwPx,hPx+tPx,wPx);ctx.fillStyle='rgba(139,69,19,0.2)';ctx.fill();ctx.lineWidth=Math.max(2,0.5*cameraZoom);ctx.setLineDash([2*cameraZoom,1*cameraZoom,2*cameraZoom]);ctx.strokeStyle='#8B4513';ctx.stroke();ctx.setLineDash([]);
    let aT=hPx*0.8,aB=-tPx*0.5,aS=hwPx*0.6;
    ctx.beginPath();ctx.moveTo(aT,0);ctx.lineTo(aB,aS);ctx.lineTo(aB*0.5,0);ctx.lineTo(aB,-aS);ctx.closePath();ctx.fillStyle='#e74c3c';ctx.fill();ctx.strokeStyle='#c0392b';ctx.lineWidth=1.5;ctx.stroke();
    if(robotData.jack_status?.jack_state===1){let lPad=0.2*ppm;ctx.beginPath();ctx.rect(-tPx-lPad,-hwPx-lPad,(hPx+tPx)+(lPad*2),wPx+(lPad*2));ctx.fillStyle='rgba(52,152,219,0.4)';ctx.fill();ctx.strokeStyle='rgba(41,128,185,0.8)';ctx.lineWidth=Math.max(1.5,2*cameraZoom);ctx.setLineDash([6*cameraZoom,4*cameraZoom]);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();
  }

  function drawLaser() {
    if(!laserData?.lasers||!robotData)return;
    let ptSz=Math.max(0.5,1*cameraZoom),hSz=ptSz/2;
    let rRad=robotData.angle*(Math.PI/180),cosR=Math.cos(rRad),sinR=Math.sin(rRad);
    for(let laser of laserData.lasers){
      if(!laser.beams||!laser.install_info?.length)continue;
      let inst=laser.install_info[0],lx=inst.x,ly=inst.y,lYaw=inst.yaw,up=inst.upside;
      let maxR=laser.device_info?.length?laser.device_info[0].max_range:40;
      let wLx=robotData.x+(lx*cosR-ly*sinR),wLy=robotData.y+(lx*sinR+ly*cosR);
      let orig=transformPoint(wLx,wLy);
      let valids=[],segs=[],cur=[];
      for(let b of laser.beams){
        if(!b.valid||b.dist<=0||!isFinite(b.dist)||b.dist>maxR){if(cur.length){segs.push(cur);cur=[];}continue;}
        let bA=up?b.angle:-b.angle,locR=(lYaw+bA)*(Math.PI/180);
        let rfX=lx+(b.dist*Math.cos(locR)),rfY=ly+(b.dist*Math.sin(locR));
        let wX=robotData.x+(rfX*cosR-rfY*sinR),wY=robotData.y+(rfX*sinR+rfY*cosR);
        let p=transformPoint(wX,wY);cur.push(p);valids.push({p,rssi:b.rssi});
      }
      if(cur.length)segs.push(cur);
      for(let seg of segs){ctx.beginPath();ctx.moveTo(orig.cx,orig.cy);for(let p of seg)ctx.lineTo(p.cx,p.cy);ctx.closePath();ctx.strokeStyle='rgba(100,200,255,0.4)';ctx.lineWidth=Math.max(0.5,0.5*cameraZoom);ctx.stroke();ctx.fillStyle='rgba(100,200,255,0.08)';ctx.fill();}
      for(let v of valids){let l=Math.max(0,80-(v.rssi/255*80));ctx.fillStyle='hsl(250,100%,'+l+'%)';ctx.fillRect(v.p.cx-hSz,v.p.cy-hSz,ptSz,ptSz);}
    }
  }

  function drawNavigationPath() {
    if(!robotData?.navigation_status?.target_point)return;
    if(robotData.navigation_status.running_status===0)return;
    let target=robotData.navigation_status.target_point;
    if(target.x===undefined||target.y===undefined)return;
    if(robotData.jack_status&&(robotData.jack_status.jack_state===0||robotData.jack_status.jack_state===2)){
      let cp=transformPoint(robotData.x,robotData.y),t=performance.now()/1000,ar=Math.max(15,20*cameraZoom);
      ctx.save();ctx.translate(cp.cx,cp.cy);ctx.rotate(t*3);ctx.beginPath();ctx.arc(0,0,ar,0,Math.PI*2);ctx.strokeStyle='rgba(231,76,60,0.9)';ctx.lineWidth=Math.max(2,3*cameraZoom);ctx.setLineDash([8*cameraZoom,6*cameraZoom]);ctx.stroke();ctx.restore();return;
    }
    let drawPts=[{x:robotData.x,y:robotData.y},{x:target.x,y:target.y}];
    let cPts=drawPts.map(p=>transformPoint(p.x,p.y));if(cPts.length<2)return;
    ctx.save();
    let ppm=baseScale*cameraZoom,pw=chassisData.width?(chassisData.width*ppm):(15*cameraZoom);
    ctx.beginPath();for(let i=0;i<cPts.length;i++){if(i===0)ctx.moveTo(cPts[i].cx,cPts[i].cy);else ctx.lineTo(cPts[i].cx,cPts[i].cy);}
    ctx.strokeStyle='rgba(231,76,60,0.15)';ctx.lineWidth=pw;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    let time=performance.now()/1000;ctx.beginPath();for(let i=0;i<cPts.length;i++){if(i===0)ctx.moveTo(cPts[i].cx,cPts[i].cy);else ctx.lineTo(cPts[i].cx,cPts[i].cy);}
    ctx.strokeStyle='rgba(231,220,60,0.4)';ctx.lineWidth=pw*0.4;ctx.shadowColor='rgba(231,220,60,0.3)';ctx.shadowBlur=8*cameraZoom;
    let dL=Math.max(15,25*cameraZoom),gL=Math.max(30,45*cameraZoom);ctx.setLineDash([dL,gL]);ctx.lineDashOffset=-(time*50*cameraZoom);ctx.stroke();
    ctx.restore();
    let ep=cPts[cPts.length-1],tr=Math.max(10,13*cameraZoom),t2=performance.now()/1000;
    ctx.save();ctx.translate(ep.cx,ep.cy);ctx.rotate(t2*2);ctx.beginPath();ctx.arc(0,0,tr,0,Math.PI*2);ctx.strokeStyle='rgba(241,196,15,0.8)';ctx.lineWidth=2*cameraZoom;ctx.setLineDash([6*cameraZoom,4*cameraZoom]);ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.arc(ep.cx,ep.cy,3*cameraZoom,0,Math.PI*2);ctx.fillStyle='rgba(241,196,15,1)';ctx.fill();
  }

  // ─── Main draw ────────────────────────────────────────────────────────────
  function draw() {
    if (!mapData) return;
    if (isFocusRobot && robotData) {
      let bCx=(robotData.x-minX)*baseScale+baseOffsetX, bCy=cssHeight-((robotData.y-minY)*baseScale+baseOffsetY);
      cameraX=(cssWidth/2)-(bCx*cameraZoom); cameraY=(cssHeight/2)-(bCy*cameraZoom);
    }
    // canvas.width/height คือ physical pixel (คูณ dpr แล้ว) ส่วน ctx ถูก
    // setTransform(dpr,...) ไว้ ดังนั้นพิกัดที่ใช้กับ ctx ต้องเป็นหน่วย CSS
    // pixel (cssWidth/cssHeight) ไม่ใช่ canvas.width/height ดิบๆ
    ctx.clearRect(0,0,cssWidth,cssHeight);
    if(isShowGrid)drawGrid();
    drawOrigin();
    if(isShowPointCloud&&pcCanvas&&isPcRendered)drawPointCloudFromBitmap();
    drawAreas();drawCurves();drawPoints();drawRobot();drawNavigationPath();
    if(isShowLaser)drawLaser();
  }

  function renderLoop(ts) {
    if(!lastFrameTime)lastFrameTime=ts;
    auraProgress+=(ts-lastFrameTime)/1500; lastFrameTime=ts;
    if(auraProgress>1)auraProgress-=1;
    draw();
    animFrameId=requestAnimationFrame(renderLoop);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function showFatalError(msg) {
    console.error('[RobotMap]', msg);
    loadingText.innerText = msg;
    loadingOverlay.style.display = 'flex';
    // swap spinner styling so it reads as an error, not a stuck loader
    const spinner = loadingOverlay.querySelector('div');
    if (spinner) spinner.style.display = 'none';
  }

  async function init() {
    showLoading('Loading map…');
    try {
      const cr = await fetch(CHASSIS_API);
      if (cr.ok) {
        const cd = await cr.json();
        if (cd.head !== undefined) chassisData = cd;
      } else {
        console.warn('[RobotMap] chassis fetch not ok:', cr.status, CHASSIS_API);
      }
    } catch (e) {
      // Non-fatal — chassis has sane defaults — but surface it so it's
      // visible instead of silently swallowed.
      console.warn('[RobotMap] chassis fetch failed:', e, CHASSIS_API);
    }

    setTimeout(async () => {
      try {
        const mr = await fetch(MAP_API);
        if (!mr.ok) {
          showFatalError('Map load failed: HTTP ' + mr.status + ' — ' + MAP_API);
          return;
        }
        const mj = await mr.json();
        if (!mj.success) {
          showFatalError('Map API returned success:false — ' + (mj.message || JSON.stringify(mj)));
          return;
        }
        mapData = typeof mj.robot_response_json === 'string'
          ? JSON.parse(mj.robot_response_json)
          : mj.robot_response_json;

        if (!mapData) {
          showFatalError('Map response had no robot_response_json payload');
          return;
        }

        calculateMapBounds();
        zoomToPoints();
        startBackgroundPcCache();
        fetchRobotLocation();
        setInterval(fetchRobotLocation, 1000);
        connectLaserWS();
        requestAnimationFrame(renderLoop);
        hideLoading();
      } catch (e) {
        // This is the case that used to fail completely silently: network
        // error, CORS block, JSON parse error, mixed-content block, etc.
        // Surfacing it is the whole point of this change.
        showFatalError('Map load error: ' + (e && e.message ? e.message : String(e)) + ' — ' + MAP_API);
      }
    }, 100);
  }

  // store cleanup handle on window for React unmount.
  // Also tears down the window-level listeners and the ResizeObserver
  // registered above, so remounting this component (e.g. on reconnect)
  // never leaves stale listeners referencing a removed canvas behind.
  window.__amrMapCleanup = () => {
    if(animFrameId)cancelAnimationFrame(animFrameId);
    if(ws)ws.close();
    if(resizeObserver)resizeObserver.disconnect();
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    window.removeEventListener('touchend', handleWindowTouchEnd);
    window.removeEventListener('resize', handleWindowResize);
  };

  init();
})();
`,
    [serverIP],
  );

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;

    const tag = document.createElement("script");
    tag.id = "amr-map-script";
    tag.text = getScriptContent();
    document.body.appendChild(tag);

    return () => {
      if (typeof window.__amrMapCleanup === "function") {
        window.__amrMapCleanup();
        window.__amrMapCleanup = undefined;
      }
      document.getElementById("amr-map-script")?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Canvas area */}
      <div className="relative min-h-0 flex-1 bg-[#fafafa] overflow-hidden">
        {/* Loading overlay */}
        <div
          id="amr-loading-overlay"
          style={{ display: "none" }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90"
        >
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          <p
            id="amr-loading-text"
            className="text-sm font-semibold text-gray-600"
          >
            Loading map…
          </p>
        </div>

        {/* Map canvas — absolute so its internal buffer resizing can never
            feed back into (and inflate) the flex parent's box size */}
        <canvas
          ref={canvasRef}
          id="amr-map-canvas"
          className="absolute inset-0 block h-full w-full cursor-grab"
          style={{ touchAction: "none" }}
        />

        {/* Overlay control buttons */}
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {[
            {
              id: "amr-btn-action",
              title: "Navigate to POI",
              svg: (
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13C19 5.13 15.87 2 12 2ZM12 11.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
              ),
              fill: true,
            },
            {
              id: "amr-btn-laser",
              title: "Real-time Laser",
              svg: (
                <>
                  <path d="M12 12v.01" strokeWidth={4} />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                  <path d="M8.46 15.54a5 5 0 0 1 0-7.07" />
                </>
              ),
              fill: false,
            },
            {
              id: "amr-btn-pointcloud",
              title: "Point Cloud",
              svg: (
                <>
                  <circle cx={5} cy={5} r={2} />
                  <circle cx={12} cy={4} r={2} />
                  <circle cx={19} cy={6} r={2} />
                  <circle cx={4} cy={12} r={2} />
                  <circle cx={13} cy={12} r={2} />
                  <circle cx={20} cy={13} r={2} />
                  <circle cx={6} cy={19} r={2} />
                  <circle cx={11} cy={18} r={2} />
                  <circle cx={18} cy={20} r={2} />
                </>
              ),
              fill: true,
            },
            {
              id: "amr-btn-focus",
              title: "Follow Robot",
              svg: (
                <>
                  <circle cx={12} cy={12} r={4} />
                  <path d="M12 2v4" />
                  <path d="M12 18v4" />
                  <path d="M2 12h4" />
                  <path d="M18 12h4" />
                </>
              ),
              fill: false,
            },
            {
              id: "amr-btn-grid",
              title: "Grid",
              svg: (
                <>
                  <rect x={3} y={3} width={18} height={18} rx={2} />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                </>
              ),
              fill: false,
            },
            {
              id: "amr-btn-reset",
              title: "Reset View",
              svg: (
                <>
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </>
              ),
              fill: false,
            },
          ].map((btn) => (
            <button
              type="button"
              key={btn.id}
              id={btn.id}
              title={btn.title}
              className="amr-ctrl-btn flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md transition-colors hover:bg-gray-100 [&.amr-btn-active]:border-blue-400 [&.amr-btn-active]:bg-blue-500 [&.amr-btn-active]:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill={btn.fill ? "currentColor" : "none"}
                stroke={btn.fill ? undefined : "currentColor"}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {btn.svg}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Inline styles for dynamic classes that Tailwind can't purge */}
      <style>{`
        .amr-conf-red    { background:#e74c3c; color:#fff; }
        .amr-conf-yellow { background:#f1c40f; color:#333; }
        .amr-conf-green  { background:#2ecc71; color:#fff; }
        .amr-emg-on  { background:#e74c3c; color:#fff; box-shadow:0 0 8px rgba(231,76,60,.6); }
        .amr-emg-off { background:#7f8c8d; color:#fff; }
        .amr-batt-level.low { background:#e74c3c; }
        .amr-batt-level.med { background:#f1c40f; }
      `}</style>
    </div>
  );
}

// Augment window type for cleanup handle
declare global {
  interface Window {
    __amrMapCleanup?: () => void;
  }
}
