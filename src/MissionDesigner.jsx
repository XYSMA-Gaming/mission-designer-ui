import React, { useState, useRef, useEffect } from 'react';
import { api } from './api';
import './App.css';

export default function MissionDesigner({ missionId, onBack }) {
  const [missionTitle, setMissionTitle] = useState('New Mission');
  const [missionDescription, setMissionDescription] = useState('');
  const [boxes, setBoxes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [connectingFromOption, setConnectingFromOption] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editingBoxId, setEditingBoxId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const currentMissionIdRef = useRef(missionId || null);
  const panRef = useRef(null);
  const panMovedRef = useRef(false);
  const spaceDownRef = useRef(false);
  // Keep latest scale/offset in refs so native event handlers always read
  // fresh values without needing to be re-registered on every state change.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  // Helpers that update both state (for rendering) and refs (for event handlers)
  // synchronously so rapid events never read stale values.
  const applyScale = (newScale) => {
    scaleRef.current = newScale;
    setScale(newScale);
  };
  const applyOffset = (newOffset) => {
    offsetRef.current = newOffset;
    setOffset(newOffset);
  };

  // Wheel zoom — registered as non-passive so we can preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.min(Math.max(currentScale * factor, 0.1), 5);
      // Keep the point under the cursor fixed in world space
      const newOffset = {
        x: mouseX - (mouseX - currentOffset.x) * (newScale / currentScale),
        y: mouseY - (mouseY - currentOffset.y) * (newScale / currentScale),
      };
      // Update refs first so any immediately-following events get fresh values
      scaleRef.current = newScale;
      offsetRef.current = newOffset;
      setScale(newScale);
      setOffset(newOffset);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Space key — activates pan mode (pan anywhere by holding Space + drag)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't hijack typing
      e.preventDefault();
      if (!spaceDownRef.current) {
        spaceDownRef.current = true;
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code !== 'Space') return;
      spaceDownRef.current = false;
      setSpaceDown(false);
      panRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Load mission from server
  useEffect(() => {
    if (!missionId) return;
    setLoading(true);
    api.getMission(missionId)
      .then(({ mission }) => {
        setMissionTitle(mission.title);
        setMissionDescription(mission.description || '');
        setBoxes((mission.data && mission.data.boxes) || []);
        setConnections((mission.data && mission.data.connections) || []);
        currentMissionIdRef.current = mission.id;
      })
      .catch((err) => alert('Error loading mission: ' + err.message))
      .finally(() => setLoading(false));
  }, [missionId]);

  const handleSave = async () => {
    if (!missionTitle.trim()) {
      alert('Please enter a mission title');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await api.saveMission({
        id: currentMissionIdRef.current,
        title: missionTitle.trim(),
        description: missionDescription.trim(),
        data: { boxes, connections },
      });
      if (!currentMissionIdRef.current) {
        currentMissionIdRef.current = result.id;
      }
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      alert('Error saving mission: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addBox = () => {
    const newBox = {
      id: Date.now(),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 400,
      height: 500,
      label: `Screen ${boxes.length + 1}`,
      checkpoint: false,
      image: null,
      audio: null,
      audioName: null,
      extendedAudio: null,
      extendedAudioName: null,
      question: '',
      options: [
        { id: Date.now() + 1, text: 'Option 1' },
        { id: Date.now() + 2, text: 'Option 2' },
      ],
    };
    setBoxes([...boxes, newBox]);
  };

  const handleMouseDown = (e, boxId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Space held → pan mode even when clicking on a box
    if (spaceDownRef.current) {
      panMovedRef.current = false;
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offsetRef.current.x,
        startOffsetY: offsetRef.current.y,
      };
      return;
    }
    setSelectedBox(boxId);
    dragRef.current = {
      boxId,
      startX: e.clientX,
      startY: e.clientY,
      boxX: boxes.find((b) => b.id === boxId).x,
      boxY: boxes.find((b) => b.id === boxId).y,
    };
  };

  const handleCanvasPanStart = (e) => {
    if (e.button !== 0) return;
    if (!spaceDownRef.current) return; // only pan when Space is held
    panMovedRef.current = false;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetRef.current.x,
      startOffsetY: offsetRef.current.y,
    };
  };

  const handleCanvasClick = () => {
    if (panMovedRef.current) return; // was a pan drag, not a tap
    setSelectedBox(null);
    setSelectedConnection(null);
  };

  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Always read from refs so values are never stale during rapid events
    const currentScale = scaleRef.current;
    const currentOffset = offsetRef.current;

    // Mouse position in world (canvas) coordinates
    setMousePos({
      x: (e.clientX - rect.left - currentOffset.x) / currentScale,
      y: (e.clientY - rect.top - currentOffset.y) / currentScale,
    });

    // Pan takes priority over drag/resize
    if (panRef.current && !dragRef.current && !resizeRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMovedRef.current = true;
      const newOffset = { x: panRef.current.startOffsetX + dx, y: panRef.current.startOffsetY + dy };
      // Update ref immediately so subsequent events in the same frame get the fresh offset
      offsetRef.current = newOffset;
      setOffset(newOffset);
      return;
    }

    if (dragRef.current) {
      // Divide screen-pixel delta by scale to get world-pixel delta
      const deltaX = (e.clientX - dragRef.current.startX) / currentScale;
      const deltaY = (e.clientY - dragRef.current.startY) / currentScale;
      const { boxId, boxX, boxY } = dragRef.current;
      setBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? { ...b, x: boxX + deltaX, y: boxY + deltaY }
            : b
        )
      );
    }

    if (resizeRef.current) {
      const deltaX = (e.clientX - resizeRef.current.startX) / currentScale;
      const deltaY = (e.clientY - resizeRef.current.startY) / currentScale;
      const { boxId, width, height } = resizeRef.current;
      setBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? {
                ...b,
                width: Math.max(200, width + deltaX),
                height: Math.max(200, height + deltaY),
              }
            : b
        )
      );
    }
  };

  const handleCanvasMouseUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
    panRef.current = null;
  };

  const completeConnection = (toBoxId) => {
    if (connecting && connecting !== toBoxId) {
      const fromData = connectingFromOption
        ? { boxId: connecting, optionId: connectingFromOption }
        : { boxId: connecting, optionId: null };
      const exists = connections.some(
        (c) =>
          c.fromBoxId === fromData.boxId &&
          c.fromOptionId === fromData.optionId &&
          c.toBoxId === toBoxId
      );
      if (!exists) {
        setConnections([
          ...connections,
          { id: Date.now(), fromBoxId: fromData.boxId, fromOptionId: fromData.optionId, toBoxId },
        ]);
      }
    }
    setConnecting(null);
    setConnectingFromOption(null);
  };

  const deleteBox = (boxId) => {
    setBoxes(boxes.filter((b) => b.id !== boxId));
    setConnections(connections.filter((c) => c.fromBoxId !== boxId && c.toBoxId !== boxId));
    setSelectedBox(null);
  };

  const deleteConnection = (connId) => {
    setConnections(connections.filter((c) => c.id !== connId));
  };

  const updateBox = (boxId, updates) => {
    setBoxes(boxes.map((b) => (b.id === boxId ? { ...b, ...updates } : b)));
  };

  const getOptionYPosition = (box, optionIndex) => {
    const imageHeight = box.image ? (box.width * 9) / 16 : 0;
    const contentPadding = 12;
    const labelHeight = 20;
    const questionHeight = box.question ? 40 : 0;
    const optionStartY = imageHeight + contentPadding + labelHeight + questionHeight + contentPadding;
    const optionHeight = 30;
    return box.y + optionStartY + optionIndex * optionHeight + optionHeight / 2;
  };

  const getActualOptionPosition = (boxId, optionIndex) => {
    const key = `${boxId}-${optionIndex}`;
    const element = document.querySelector(`[data-option-id="${key}"]`);
    if (!element || !canvasRef.current) return null;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const elementRect = element.querySelector('[data-connection-point]')?.getBoundingClientRect();
    if (!elementRect) return null;

    // getBoundingClientRect returns screen coords (post-transform).
    // Use refs so this is always accurate even mid-animation.
    const s = scaleRef.current;
    const o = offsetRef.current;
    return {
      x: (elementRect.right - canvasRect.left - o.x) / s,
      y: (elementRect.top - canvasRect.top + elementRect.height / 2 - o.y) / s,
    };
  };

  const currentEditingBox = boxes.find((b) => b.id === editingBoxId);

  return (
    <div className="app">
      {/* Loading overlay — canvas stays mounted so the wheel listener is never lost */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Loading mission...</p>
        </div>
      )}
      <div className="toolbar">
        <button className="btn-back" onClick={onBack} title="Back to Admin Panel">
          ← Back
        </button>

        <div className="mission-title-group">
          <input
            className="mission-title-input"
            type="text"
            value={missionTitle}
            onChange={(e) => setMissionTitle(e.target.value)}
            placeholder="Mission title..."
          />
          <input
            className="mission-desc-input"
            type="text"
            value={missionDescription}
            onChange={(e) => setMissionDescription(e.target.value)}
            placeholder="Short description (optional)"
          />
        </div>

        <div className="toolbar-divider" />

        <button onClick={addBox} className="btn-primary">
          + Add Screen
        </button>
        <button
          onClick={() => {
            if (selectedBox) {
              setBoxes(boxes.filter((b) => b.id !== selectedBox));
              setConnections(
                connections.filter(
                  (c) => c.fromBoxId !== selectedBox && c.toBoxId !== selectedBox
                )
              );
              setSelectedBox(null);
            } else if (selectedConnection) {
              deleteConnection(selectedConnection);
              setSelectedConnection(null);
            }
          }}
          className="btn-danger"
          disabled={!selectedBox && !selectedConnection}
        >
          🗑️ Delete
        </button>

        <div className="toolbar-divider" />

        <button onClick={handleSave} className="btn-save-mission" disabled={saving}>
          {saving ? 'Saving...' : '💾 Save'}
        </button>
        {saveMsg && <span className="save-status">{saveMsg}</span>}

        <div className="toolbar-divider" />

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => applyScale(Math.max(0.1, +(scaleRef.current / 1.25).toFixed(2)))}>−</button>
          <button
            className="zoom-pct"
            onClick={() => { applyScale(1); applyOffset({ x: 0, y: 0 }); }}
            title="Reset zoom and position"
          >
            {Math.round(scale * 100)}%
          </button>
          <button className="zoom-btn" onClick={() => applyScale(Math.min(5, +(scaleRef.current * 1.25).toFixed(2)))}>+</button>
        </div>

        <p className="toolbar-text">Scroll to zoom • Hold Space + drag to pan • Click dots to connect</p>
      </div>

      <div
        ref={canvasRef}
        className={`canvas${spaceDown ? ' pan-mode' : ''}`}
        onMouseDown={handleCanvasPanStart}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onClick={handleCanvasClick}
        onKeyDown={(e) => {
          if (e.key === 'Delete') {
            if (selectedBox) {
              setBoxes(boxes.filter((b) => b.id !== selectedBox));
              setConnections(
                connections.filter(
                  (c) => c.fromBoxId !== selectedBox && c.toBoxId !== selectedBox
                )
              );
              setSelectedBox(null);
            } else if (selectedConnection) {
              deleteConnection(selectedConnection);
              setSelectedConnection(null);
            }
          }
        }}
        tabIndex="0"
      >
        {/* Everything inside is in world (canvas) coordinate space */}
        <div
          className="canvas-world"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
        <svg className="connections-svg">
          {connections.map((conn) => {
            const fromBox = boxes.find((b) => b.id === conn.fromBoxId);
            const toBox = boxes.find((b) => b.id === conn.toBoxId);
            if (!fromBox || !toBox) return null;

            let fromY = fromBox.y + fromBox.height / 2;
            if (conn.fromOptionId !== null) {
              const optionIndex = fromBox.options.findIndex((opt) => opt.id === conn.fromOptionId);
              if (optionIndex !== -1) {
                const actualPos = getActualOptionPosition(conn.fromBoxId, optionIndex);
                fromY = actualPos ? actualPos.y : getOptionYPosition(fromBox, optionIndex);
              }
            }

            const from = { x: fromBox.x + fromBox.width, y: fromY };
            const to = { x: toBox.x, y: toBox.y + toBox.height / 2 };
            const distance = to.x - from.x;
            const cx = from.x + distance * 0.4;
            const cy = (from.y + to.y) / 2 + Math.abs(from.y - to.y) * 0.3;
            const path = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;

            return (
              <g
                key={conn.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedConnection(conn.id);
                }}
              >
                <path
                  d={path}
                  stroke={selectedConnection === conn.id ? '#ef4444' : '#64748b'}
                  strokeWidth={selectedConnection === conn.id ? 3 : 2}
                  fill="none"
                  style={{ pointerEvents: 'stroke' }}
                />
                <polygon
                  points={`${to.x},${to.y} ${to.x - 8},${to.y - 5} ${to.x - 8},${to.y + 5}`}
                  fill={selectedConnection === conn.id ? '#ef4444' : '#64748b'}
                  style={{ pointerEvents: 'auto' }}
                />
              </g>
            );
          })}

          {connecting &&
            (() => {
              const fromBox = boxes.find((b) => b.id === connecting);
              if (!fromBox) return null;

              let fromY = fromBox.y + fromBox.height / 2;
              if (connectingFromOption) {
                const optionIndex = fromBox.options.findIndex(
                  (opt) => opt.id === connectingFromOption
                );
                if (optionIndex !== -1) {
                  const actualPos = getActualOptionPosition(connecting, optionIndex);
                  fromY = actualPos ? actualPos.y : getOptionYPosition(fromBox, optionIndex);
                }
              }

              const from = { x: fromBox.x + fromBox.width, y: fromY };
              const distance = mousePos.x - from.x;
              const cx = from.x + distance * 0.4;
              const cy =
                (from.y + mousePos.y) / 2 + Math.abs(from.y - mousePos.y) * 0.3;
              const path = `M ${from.x} ${from.y} Q ${cx} ${cy} ${mousePos.x} ${mousePos.y}`;
              return (
                <path
                  d={path}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5,5"
                />
              );
            })()}
        </svg>

        {boxes.map((box) => (
          <div
            key={box.id}
            className={`box ${selectedBox === box.id ? 'selected' : ''}`}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onMouseDown={(e) => handleMouseDown(e, box.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (connecting && connecting !== box.id) {
                completeConnection(box.id);
              }
            }}
          >
            {box.image && (
              <div className="box-image">
                <img src={box.image} alt="Screen" />
              </div>
            )}

            <div className="box-content">
              <div className="screen-label-row">
                <div className="screen-label">{box.label}</div>
                <div className="box-badges">
                  {box.checkpoint && (
                    <span className="checkpoint-badge" title="Checkpoint">✓</span>
                  )}
                  {(box.audio || box.extendedAudio) && (
                    <div className="audio-indicators">
                      {box.audio && (
                        <span className="audio-badge" title="Normal audio">♪</span>
                      )}
                      {box.extendedAudio && (
                        <span className="audio-badge audio-badge-extended" title="Extended audio">♫</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {box.question && <div className="screen-question">{box.question}</div>}

              {box.options.length > 0 && (
                <div className="screen-options-list">
                  {box.options.map((option, index) => (
                    <div
                      key={option.id}
                      data-option-id={`${box.id}-${index}`}
                      className={`option-item ${
                        connecting && connectingFromOption !== option.id ? 'can-connect' : ''
                      } ${connectingFromOption === option.id ? 'connecting' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (connecting && connectingFromOption !== option.id) {
                          completeConnection(box.id);
                        }
                      }}
                    >
                      <div className="option-text">{option.text}</div>
                      <div
                        className={`option-connection-point ${
                          connecting === box.id && connectingFromOption === option.id ? 'active' : ''
                        }`}
                        data-connection-point
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (connecting === box.id && connectingFromOption === option.id) {
                            setConnecting(null);
                            setConnectingFromOption(null);
                          } else {
                            setConnecting(box.id);
                            setConnectingFromOption(option.id);
                          }
                        }}
                        title="Connect from this option"
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedBox === box.id && (
                <div className="box-controls-inline">
                  <button
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBoxId(box.id);
                    }}
                    title="Edit screen"
                  >
                    ✎ Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBox(box.id);
                    }}
                    title="Delete screen"
                  >
                    ✕ Delete
                  </button>
                </div>
              )}
            </div>

            <div
              className={`connection-point ${connecting === box.id ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (connecting === box.id) {
                  setConnecting(null);
                } else {
                  setConnecting(box.id);
                }
              }}
              title="Click to connect"
            />

            <div
              className="resize-handle"
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedBox(box.id);
                resizeRef.current = {
                  boxId: box.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  width: box.width,
                  height: box.height,
                };
              }}
              title="Drag to resize"
            />
          </div>
        ))}
        </div> {/* /canvas-world */}
      </div>

      {editingBoxId && currentEditingBox && (
        <EditDialog
          box={currentEditingBox}
          onSave={(updates) => {
            updateBox(editingBoxId, updates);
            setEditingBoxId(null);
          }}
          onClose={() => setEditingBoxId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditDialog – file uploads go to the server
// ---------------------------------------------------------------------------
function EditDialog({ box, onSave, onClose }) {
  const [label, setLabel] = useState(box.label);
  const [checkpoint, setCheckpoint] = useState(box.checkpoint || false);
  const [image, setImage] = useState(box.image);
  const [audio, setAudio] = useState(box.audio || null);
  const [audioName, setAudioName] = useState(box.audioName || null);
  const [extendedAudio, setExtendedAudio] = useState(box.extendedAudio || null);
  const [extendedAudioName, setExtendedAudioName] = useState(box.extendedAudioName || null);
  const [question, setQuestion] = useState(box.question);
  const [options, setOptions] = useState(box.options);

  const [imageUploading, setImageUploading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [extAudioUploading, setExtAudioUploading] = useState(false);

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const extendedAudioInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const data = await api.uploadImage(file);
      setImage(data.url);
    } catch (err) {
      alert('Image upload failed: ' + err.message);
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAudioUploading(true);
    try {
      const data = await api.uploadAudio(file);
      setAudio(data.url);
      setAudioName(data.name || file.name);
    } catch (err) {
      alert('Audio upload failed: ' + err.message);
    } finally {
      setAudioUploading(false);
      e.target.value = '';
    }
  };

  const handleExtendedAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExtAudioUploading(true);
    try {
      const data = await api.uploadAudio(file);
      setExtendedAudio(data.url);
      setExtendedAudioName(data.name || file.name);
    } catch (err) {
      alert('Extended audio upload failed: ' + err.message);
    } finally {
      setExtAudioUploading(false);
      e.target.value = '';
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text: value };
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, { id: Date.now(), text: `Option ${options.length + 1}` }]);
  };

  const handleRemoveOption = (index) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    onSave({ label, checkpoint, image, audio, audioName, extendedAudio, extendedAudioName, question, options: options.filter((o) => o.text.trim()) });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Screen</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          {/* Screen Label */}
          <div className="form-group">
            <label>Screen Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Welcome Screen"
            />
          </div>

          {/* Checkpoint */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={checkpoint}
                onChange={(e) => setCheckpoint(e.target.checked)}
              />
              Checkpoint
            </label>
          </div>

          {/* Image Upload */}
          <div className="form-group">
            <label>Screen Image</label>
            <div className="image-upload">
              {image && (
                <div className="image-preview">
                  <img src={image} alt="Preview" />
                  <button type="button" className="remove-image" onClick={() => setImage(null)}>
                    Remove
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-upload"
                onClick={() => fileInputRef.current.click()}
                disabled={imageUploading}
              >
                {imageUploading ? 'Uploading...' : image ? 'Change Image' : 'Upload Image'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Normal Audio */}
          <div className="form-group">
            <label>Normal Audio</label>
            <div className="audio-upload">
              {audio && (
                <div className="audio-preview">
                  <span className="audio-icon">♪</span>
                  <span className="audio-filename">{audioName || 'Audio file'}</span>
                  <button
                    type="button"
                    className="remove-audio"
                    onClick={() => { setAudio(null); setAudioName(null); }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-upload"
                onClick={() => audioInputRef.current.click()}
                disabled={audioUploading}
              >
                {audioUploading ? 'Uploading...' : audio ? 'Change Audio' : 'Upload Audio'}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Extended Audio */}
          <div className="form-group">
            <label>Extended Audio</label>
            <div className="audio-upload">
              {extendedAudio && (
                <div className="audio-preview">
                  <span className="audio-icon">♪</span>
                  <span className="audio-filename">{extendedAudioName || 'Audio file'}</span>
                  <button
                    type="button"
                    className="remove-audio"
                    onClick={() => { setExtendedAudio(null); setExtendedAudioName(null); }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-upload"
                onClick={() => extendedAudioInputRef.current.click()}
                disabled={extAudioUploading}
              >
                {extAudioUploading
                  ? 'Uploading...'
                  : extendedAudio
                  ? 'Change Extended Audio'
                  : 'Upload Extended Audio'}
              </button>
              <input
                ref={extendedAudioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleExtendedAudioUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="form-group">
            <label>Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter the question for this screen"
              rows="3"
            />
          </div>

          {/* Options */}
          <div className="form-group">
            <label>Options (Answers)</label>
            <div className="options-list">
              {options.map((option, index) => (
                <div key={option.id} className="option-item">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      className="remove-option"
                      onClick={() => handleRemoveOption(index)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="btn-add-option" onClick={handleAddOption}>
              + Add Option
            </button>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
