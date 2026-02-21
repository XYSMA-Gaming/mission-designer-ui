import React, { useState, useRef, useCallback, useEffect } from 'react';
import './ImageEditor.css';

const BUBBLE_TYPES = [
  { id: 'speech', label: 'Speech', icon: '💬' },
  { id: 'thought', label: 'Thought', icon: '💭' },
  { id: 'shout', label: 'Shout', icon: '💥' },
  { id: 'narration', label: 'Narration', icon: '📝' },
  { id: 'whisper', label: 'Whisper', icon: '🤫' },
];

const DEFAULT_BUBBLE = {
  width: 200,
  height: 120,
  text: 'Enter text...',
  fontSize: 16,
  tailDirection: 'bottom-left',
};

const TAIL_DIRECTIONS = [
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'none', label: 'None' },
];

function BubbleSVG({ type, width, height, tailDirection }) {
  const pad = 4;
  const svgW = width + pad * 2;
  const svgH = height + pad * 2 + (tailDirection !== 'none' ? 30 : 0);
  const rx = type === 'narration' ? 4 : 20;

  if (type === 'thought') {
    return (
      <svg className="ie-bubble-svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <rect
          x={pad} y={pad} width={width} height={height} rx={30}
          fill="white" stroke="black" strokeWidth="2.5"
        />
        {tailDirection !== 'none' && (() => {
          const isLeft = tailDirection.includes('left');
          const isTop = tailDirection.includes('top');
          const baseX = isLeft ? pad + 35 : pad + width - 35;
          const baseY = isTop ? pad : pad + height;
          const dir = isTop ? -1 : 1;
          return (
            <>
              <circle cx={baseX} cy={baseY + dir * 12} r={8} fill="white" stroke="black" strokeWidth="2.5" />
              <circle cx={baseX + (isLeft ? -8 : 8)} cy={baseY + dir * 26} r={5} fill="white" stroke="black" strokeWidth="2.5" />
            </>
          );
        })()}
      </svg>
    );
  }

  if (type === 'shout') {
    const cx = pad + width / 2;
    const cy = pad + height / 2;
    const points = 16;
    const outerRx = width / 2 + 8;
    const outerRy = height / 2 + 8;
    const innerRx = width / 2 - 6;
    const innerRy = height / 2 - 6;
    let d = '';
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const nextAngle = (Math.PI * 2 * (i + 0.5)) / points;
      const ox = cx + outerRx * Math.cos(angle);
      const oy = cy + outerRy * Math.sin(angle);
      const ix = cx + innerRx * Math.cos(nextAngle);
      const iy = cy + innerRy * Math.sin(nextAngle);
      d += (i === 0 ? 'M' : 'L') + `${ox},${oy} L${ix},${iy} `;
    }
    d += 'Z';
    return (
      <svg className="ie-bubble-svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <path d={d} fill="white" stroke="black" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }

  // speech, narration, whisper
  const strokeDash = type === 'whisper' ? '6,4' : 'none';
  return (
    <svg className="ie-bubble-svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <rect
        x={pad} y={pad} width={width} height={height} rx={rx}
        fill="white" stroke="black" strokeWidth="2.5"
        strokeDasharray={strokeDash}
      />
      {tailDirection !== 'none' && type !== 'narration' && (() => {
        const isLeft = tailDirection.includes('left');
        const isTop = tailDirection.includes('top');
        const baseX = isLeft ? pad + 30 : pad + width - 30;
        const baseY = isTop ? pad : pad + height;
        const dir = isTop ? -1 : 1;
        const tipX = baseX + (isLeft ? -15 : 15);
        const tipY = baseY + dir * 30;
        return (
          <polygon
            points={`${baseX - 10},${baseY} ${baseX + 10},${baseY} ${tipX},${tipY}`}
            fill="white" stroke="black" strokeWidth="2.5" strokeLinejoin="round"
          />
        );
      })()}
      {/* Cover the tail base overlap line */}
      {tailDirection !== 'none' && type !== 'narration' && (() => {
        const isLeft = tailDirection.includes('left');
        const isTop = tailDirection.includes('top');
        const baseX = isLeft ? pad + 30 : pad + width - 30;
        const baseY = isTop ? pad : pad + height;
        return (
          <line
            x1={baseX - 9} y1={baseY} x2={baseX + 9} y2={baseY}
            stroke="white" strokeWidth="3"
          />
        );
      })()}
    </svg>
  );
}

export default function ImageEditor({ onBack }) {
  const [image, setImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [bubbles, setBubbles] = useState([]);
  const [selectedBubbleId, setSelectedBubbleId] = useState(null);
  const [activeBubbleType, setActiveBubbleType] = useState('speech');
  const [saving, setSaving] = useState(false);

  const canvasAreaRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedBubble = bubbles.find((b) => b.id === selectedBubbleId);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
        setImage(ev.target.result);
        setBubbles([]);
        setSelectedBubbleId(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const addBubble = () => {
    if (!image) return;
    const newBubble = {
      id: Date.now(),
      type: activeBubbleType,
      x: Math.random() * (imageSize.width - DEFAULT_BUBBLE.width - 40) + 20,
      y: Math.random() * (imageSize.height - DEFAULT_BUBBLE.height - 40) + 20,
      width: DEFAULT_BUBBLE.width,
      height: DEFAULT_BUBBLE.height,
      text: DEFAULT_BUBBLE.text,
      fontSize: DEFAULT_BUBBLE.fontSize,
      tailDirection: activeBubbleType === 'narration' ? 'none' : DEFAULT_BUBBLE.tailDirection,
      fontWeight: activeBubbleType === 'shout' ? 'bold' : 'normal',
      fontStyle: activeBubbleType === 'whisper' ? 'italic' : 'normal',
    };
    setBubbles((prev) => [...prev, newBubble]);
    setSelectedBubbleId(newBubble.id);
  };

  const updateBubble = (id, updates) => {
    setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const deleteBubble = (id) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
    if (selectedBubbleId === id) setSelectedBubbleId(null);
  };

  // --- Drag ---
  const handleBubbleMouseDown = (e, bubbleId) => {
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    const bubble = bubbles.find((b) => b.id === bubbleId);
    if (!bubble) return;
    setSelectedBubbleId(bubbleId);
    const canvasRect = canvasAreaRef.current.getBoundingClientRect();
    const scale = canvasRect.width / imageSize.width;
    dragRef.current = {
      id: bubbleId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: bubble.x,
      startY: bubble.y,
      scale,
    };
  };

  const handleResizeMouseDown = (e, bubbleId) => {
    e.preventDefault();
    e.stopPropagation();
    const bubble = bubbles.find((b) => b.id === bubbleId);
    if (!bubble) return;
    const canvasRect = canvasAreaRef.current.getBoundingClientRect();
    const scale = canvasRect.width / imageSize.width;
    resizeRef.current = {
      id: bubbleId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: bubble.width,
      startHeight: bubble.height,
      scale,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragRef.current) {
        const { id, startMouseX, startMouseY, startX, startY, scale } = dragRef.current;
        const dx = (e.clientX - startMouseX) / scale;
        const dy = (e.clientY - startMouseY) / scale;
        updateBubble(id, {
          x: Math.max(0, Math.min(startX + dx, imageSize.width - 60)),
          y: Math.max(0, Math.min(startY + dy, imageSize.height - 40)),
        });
      }
      if (resizeRef.current) {
        const { id, startMouseX, startMouseY, startWidth, startHeight, scale } = resizeRef.current;
        const dx = (e.clientX - startMouseX) / scale;
        const dy = (e.clientY - startMouseY) / scale;
        updateBubble(id, {
          width: Math.max(100, startWidth + dx),
          height: Math.max(60, startHeight + dy),
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [imageSize]);

  // --- Save / Export ---
  const handleSave = useCallback(async () => {
    if (!image) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageSize.width;
      canvas.height = imageSize.height;
      const ctx = canvas.getContext('2d');

      // Draw the base image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = image;
      });
      ctx.drawImage(img, 0, 0);

      // Draw each bubble
      for (const bubble of bubbles) {
        drawBubbleToCanvas(ctx, bubble);
      }

      // Download
      const link = document.createElement('a');
      link.download = 'comic-image.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Error saving image: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [image, imageSize, bubbles]);

  const handleCanvasClick = (e) => {
    if (e.target === canvasAreaRef.current || e.target.tagName === 'IMG') {
      setSelectedBubbleId(null);
    }
  };

  return (
    <div className="ie-container">
      {/* Toolbar */}
      <div className="ie-toolbar">
        <div className="ie-toolbar-left">
          <button className="ie-back-btn" onClick={onBack}>
            ← Back
          </button>
          <span className="ie-title">Comic Image Editor</span>
        </div>
        <div className="ie-toolbar-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button className="ie-tool-btn" onClick={() => fileInputRef.current?.click()}>
            Select Image
          </button>
          <div className="ie-separator" />
          {BUBBLE_TYPES.map((bt) => (
            <button
              key={bt.id}
              className={`ie-tool-btn ${activeBubbleType === bt.id ? 'ie-tool-active' : ''}`}
              onClick={() => setActiveBubbleType(bt.id)}
              title={bt.label}
            >
              {bt.icon} {bt.label}
            </button>
          ))}
          <button className="ie-add-btn" onClick={addBubble} disabled={!image}>
            + Add Bubble
          </button>
        </div>
        <div className="ie-toolbar-right">
          <button
            className="ie-save-btn"
            onClick={handleSave}
            disabled={!image || saving}
          >
            {saving ? 'Saving...' : 'Save Image'}
          </button>
        </div>
      </div>

      <div className="ie-workspace">
        {/* Canvas area */}
        <div className="ie-canvas-wrapper">
          {!image ? (
            <div className="ie-placeholder" onClick={() => fileInputRef.current?.click()}>
              <div className="ie-placeholder-icon">🖼</div>
              <h3>Select an image to start editing</h3>
              <p>Click here or use the "Select Image" button above</p>
            </div>
          ) : (
            <div
              className="ie-canvas"
              ref={canvasAreaRef}
              onClick={handleCanvasClick}
              style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }}
            >
              <img
                src={image}
                alt="Editor canvas"
                className="ie-canvas-image"
                draggable={false}
              />
              {bubbles.map((bubble) => (
                <div
                  key={bubble.id}
                  className={`ie-bubble ${selectedBubbleId === bubble.id ? 'ie-bubble-selected' : ''}`}
                  style={{
                    left: `${(bubble.x / imageSize.width) * 100}%`,
                    top: `${(bubble.y / imageSize.height) * 100}%`,
                    width: `${(bubble.width / imageSize.width) * 100}%`,
                    height: `${(bubble.height / imageSize.height) * 100}%`,
                  }}
                  onMouseDown={(e) => handleBubbleMouseDown(e, bubble.id)}
                >
                  <BubbleSVG
                    type={bubble.type}
                    width={bubble.width}
                    height={bubble.height}
                    tailDirection={bubble.tailDirection}
                  />
                  <div className="ie-bubble-text-container">
                    <textarea
                      className="ie-bubble-textarea"
                      value={bubble.text}
                      onChange={(e) => updateBubble(bubble.id, { text: e.target.value })}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBubbleId(bubble.id);
                      }}
                      style={{
                        fontSize: `${bubble.fontSize}px`,
                        fontWeight: bubble.fontWeight,
                        fontStyle: bubble.fontStyle,
                      }}
                    />
                  </div>
                  {selectedBubbleId === bubble.id && (
                    <div
                      className="ie-resize-handle"
                      onMouseDown={(e) => handleResizeMouseDown(e, bubble.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {selectedBubble && (
          <div className="ie-props-panel">
            <h3 className="ie-props-title">Bubble Properties</h3>

            <div className="ie-prop-group">
              <label className="ie-prop-label">Type</label>
              <select
                className="ie-prop-select"
                value={selectedBubble.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const updates = { type: newType };
                  if (newType === 'narration') updates.tailDirection = 'none';
                  if (newType === 'shout') updates.fontWeight = 'bold';
                  else if (newType === 'whisper') { updates.fontStyle = 'italic'; updates.fontWeight = 'normal'; }
                  else { updates.fontWeight = 'normal'; updates.fontStyle = 'normal'; }
                  updateBubble(selectedBubble.id, updates);
                }}
              >
                {BUBBLE_TYPES.map((bt) => (
                  <option key={bt.id} value={bt.id}>{bt.label}</option>
                ))}
              </select>
            </div>

            <div className="ie-prop-group">
              <label className="ie-prop-label">Tail Direction</label>
              <select
                className="ie-prop-select"
                value={selectedBubble.tailDirection}
                onChange={(e) => updateBubble(selectedBubble.id, { tailDirection: e.target.value })}
                disabled={selectedBubble.type === 'narration'}
              >
                {TAIL_DIRECTIONS.map((td) => (
                  <option key={td.id} value={td.id}>{td.label}</option>
                ))}
              </select>
            </div>

            <div className="ie-prop-group">
              <label className="ie-prop-label">Font Size: {selectedBubble.fontSize}px</label>
              <input
                className="ie-prop-range"
                type="range"
                min="10"
                max="48"
                value={selectedBubble.fontSize}
                onChange={(e) => updateBubble(selectedBubble.id, { fontSize: parseInt(e.target.value) })}
              />
            </div>

            <div className="ie-prop-group">
              <label className="ie-prop-label">Style</label>
              <div className="ie-prop-row">
                <button
                  className={`ie-style-btn ${selectedBubble.fontWeight === 'bold' ? 'ie-style-active' : ''}`}
                  onClick={() => updateBubble(selectedBubble.id, {
                    fontWeight: selectedBubble.fontWeight === 'bold' ? 'normal' : 'bold'
                  })}
                >
                  B
                </button>
                <button
                  className={`ie-style-btn ${selectedBubble.fontStyle === 'italic' ? 'ie-style-active' : ''}`}
                  onClick={() => updateBubble(selectedBubble.id, {
                    fontStyle: selectedBubble.fontStyle === 'italic' ? 'normal' : 'italic'
                  })}
                  style={{ fontStyle: 'italic' }}
                >
                  I
                </button>
              </div>
            </div>

            <div className="ie-prop-group">
              <label className="ie-prop-label">Text</label>
              <textarea
                className="ie-prop-textarea"
                value={selectedBubble.text}
                onChange={(e) => updateBubble(selectedBubble.id, { text: e.target.value })}
                rows={4}
              />
            </div>

            <button
              className="ie-delete-bubble-btn"
              onClick={() => deleteBubble(selectedBubble.id)}
            >
              Delete Bubble
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Canvas rendering for export ---
function drawBubbleToCanvas(ctx, bubble) {
  const { x, y, width, height, type, text, fontSize, tailDirection, fontWeight, fontStyle } = bubble;
  const pad = 4;

  ctx.save();
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  if (type === 'thought') {
    // Rounded rect
    drawRoundedRect(ctx, x + pad, y + pad, width, height, 30);
    ctx.fill();
    ctx.stroke();
    // Thought dots
    if (tailDirection !== 'none') {
      const isLeft = tailDirection.includes('left');
      const isTop = tailDirection.includes('top');
      const baseX = isLeft ? x + pad + 35 : x + pad + width - 35;
      const baseY = isTop ? y + pad : y + pad + height;
      const dir = isTop ? -1 : 1;
      ctx.beginPath();
      ctx.arc(baseX, baseY + dir * 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(baseX + (isLeft ? -8 : 8), baseY + dir * 26, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (type === 'shout') {
    // Starburst
    const cx = x + pad + width / 2;
    const cy = y + pad + height / 2;
    const points = 16;
    const outerRx = width / 2 + 8;
    const outerRy = height / 2 + 8;
    const innerRx = width / 2 - 6;
    const innerRy = height / 2 - 6;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const nextAngle = (Math.PI * 2 * (i + 0.5)) / points;
      const ox = cx + outerRx * Math.cos(angle);
      const oy = cy + outerRy * Math.sin(angle);
      const ix = cx + innerRx * Math.cos(nextAngle);
      const iy = cy + innerRy * Math.sin(nextAngle);
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // speech, narration, whisper
    const rx = type === 'narration' ? 4 : 20;
    if (type === 'whisper') {
      ctx.setLineDash([6, 4]);
    }
    drawRoundedRect(ctx, x + pad, y + pad, width, height, rx);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Tail
    if (tailDirection !== 'none' && type !== 'narration') {
      const isLeft = tailDirection.includes('left');
      const isTop = tailDirection.includes('top');
      const baseX = isLeft ? x + pad + 30 : x + pad + width - 30;
      const baseY = isTop ? y + pad : y + pad + height;
      const dir = isTop ? -1 : 1;
      const tipX = baseX + (isLeft ? -15 : 15);
      const tipY = baseY + dir * 30;

      // White fill to cover border, then redraw tail
      ctx.beginPath();
      ctx.moveTo(baseX - 10, baseY);
      ctx.lineTo(baseX + 10, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cover the base line overlap
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(baseX - 9, baseY);
      ctx.lineTo(baseX + 9, baseY);
      ctx.stroke();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2.5;
    }
  }

  // Draw text
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontParts = [];
  if (fontStyle === 'italic') fontParts.push('italic');
  if (fontWeight === 'bold') fontParts.push('bold');
  fontParts.push(`${fontSize}px`);
  fontParts.push('sans-serif');
  ctx.font = fontParts.join(' ');

  const textX = x + pad + width / 2;
  const textY = y + pad + height / 2;
  const maxWidth = width - 24;

  wrapText(ctx, text, textX, textY, maxWidth, fontSize * 1.25);

  ctx.restore();
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, centerY, maxWidth, lineHeight) {
  const lines = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  const totalH = lines.length * lineHeight;
  const startY = centerY - totalH / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight, maxWidth);
  }
}
