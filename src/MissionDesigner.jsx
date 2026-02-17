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

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const currentMissionIdRef = useRef(missionId || null);

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
    setSelectedBox(boxId);
    dragRef.current = {
      boxId,
      startX: e.clientX,
      startY: e.clientY,
      boxX: boxes.find((b) => b.id === boxId).x,
      boxY: boxes.find((b) => b.id === boxId).y,
    };
  };

  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (dragRef.current) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setBoxes(
        boxes.map((b) =>
          b.id === dragRef.current.boxId
            ? { ...b, x: dragRef.current.boxX + deltaX, y: dragRef.current.boxY + deltaY }
            : b
        )
      );
    }

    if (resizeRef.current) {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      setBoxes(
        boxes.map((b) =>
          b.id === resizeRef.current.boxId
            ? {
                ...b,
                width: Math.max(200, resizeRef.current.width + deltaX),
                height: Math.max(200, resizeRef.current.height + deltaY),
              }
            : b
        )
      );
    }
  };

  const handleCanvasMouseUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
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

    return {
      x: elementRect.right - canvasRect.left,
      y: elementRect.top - canvasRect.top + elementRect.height / 2,
    };
  };

  const currentEditingBox = boxes.find((b) => b.id === editingBoxId);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ color: '#6b7280', margin: 0 }}>Loading mission...</p>
      </div>
    );
  }

  return (
    <div className="app">
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

        <p className="toolbar-text">Drag to move • Click dots to connect • Click Edit to configure</p>
      </div>

      <div
        ref={canvasRef}
        className="canvas"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onClick={() => {
          setSelectedBox(null);
          setSelectedConnection(null);
        }}
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
                {(box.audio || box.extendedAudio) && (
                  <div className="audio-indicators">
                    {box.audio && (
                      <span className="audio-badge" title="Normal audio">
                        ♪
                      </span>
                    )}
                    {box.extendedAudio && (
                      <span className="audio-badge audio-badge-extended" title="Extended audio">
                        ♫
                      </span>
                    )}
                  </div>
                )}
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
    onSave({ label, image, audio, audioName, extendedAudio, extendedAudioName, question, options: options.filter((o) => o.text.trim()) });
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
