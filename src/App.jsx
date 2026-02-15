import React, { useState, useRef } from 'react';
import './App.css';

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [connectingFromOption, setConnectingFromOption] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editingBoxId, setEditingBoxId] = useState(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const optionPositionsRef = useRef({});
  const fileInputRef = useRef(null);

  const exportJSON = () => {
    const data = {
      boxes,
      connections,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowchart-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importJSON = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result);
        if (data.boxes && data.connections) {
          setBoxes(data.boxes);
          setConnections(data.connections);
          setSelectedBox(null);
          setSelectedConnection(null);
        } else {
          alert('Invalid file format. Expected boxes and connections.');
        }
      } catch (error) {
        alert('Error parsing JSON file: ' + error.message);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      boxX: boxes.find(b => b.id === boxId).x,
      boxY: boxes.find(b => b.id === boxId).y,
    };
  };

  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (dragRef.current) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setBoxes(
        boxes.map(b =>
          b.id === dragRef.current.boxId
            ? {
                ...b,
                x: dragRef.current.boxX + deltaX,
                y: dragRef.current.boxY + deltaY,
              }
            : b
        )
      );
    }

    if (resizeRef.current) {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      setBoxes(
        boxes.map(b =>
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
      // connectingFromOption should be optionId, connecting is boxId
      const fromData = connectingFromOption ? { boxId: connecting, optionId: connectingFromOption } : { boxId: connecting, optionId: null };
      const exists = connections.some(
        c => c.fromBoxId === fromData.boxId && c.fromOptionId === fromData.optionId && c.toBoxId === toBoxId
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
    setBoxes(boxes.filter(b => b.id !== boxId));
    setConnections(
      connections.filter(c => c.fromBoxId !== boxId && c.toBoxId !== boxId)
    );
    setSelectedBox(null);
  };

  const deleteConnection = (connId) => {
    setConnections(connections.filter(c => c.id !== connId));
  };

  const updateBox = (boxId, updates) => {
    setBoxes(boxes.map(b => (b.id === boxId ? { ...b, ...updates } : b)));
  };

  // Helper function to calculate Y position for an option
  const getOptionYPosition = (box, optionIndex) => {
    const imageHeight = box.image ? (box.width * 9) / 16 : 0;
    const contentPadding = 12;
    const labelHeight = 20;
    const questionHeight = box.question ? 40 : 0;
    const optionStartY = imageHeight + contentPadding + labelHeight + questionHeight + contentPadding;
    const optionHeight = 30;
    return box.y + optionStartY + (optionIndex * optionHeight) + optionHeight / 2;
  };

  // Get actual option position from DOM
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

  const currentEditingBox = boxes.find(b => b.id === editingBoxId);

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={addBox} className="btn-primary">
          + Add Screen
        </button>
        <button 
          onClick={() => {
            if (selectedBox) {
              setBoxes(boxes.filter(b => b.id !== selectedBox));
              setConnections(connections.filter(c => c.fromBoxId !== selectedBox && c.toBoxId !== selectedBox));
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
        <button onClick={exportJSON} className="btn-secondary">
          📥 Export
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
          📤 Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={importJSON}
          style={{ display: 'none' }}
        />
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
              setBoxes(boxes.filter(b => b.id !== selectedBox));
              setConnections(connections.filter(c => c.fromBoxId !== selectedBox && c.toBoxId !== selectedBox));
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
          {/* Draw connections */}
          {connections.map(conn => {
            const fromBox = boxes.find(b => b.id === conn.fromBoxId);
            const toBox = boxes.find(b => b.id === conn.toBoxId);
            
            if (!fromBox || !toBox) return null;

            let fromY = fromBox.y + fromBox.height / 2;

            // If connecting from an option, try to get actual position from DOM
            if (conn.fromOptionId !== null) {
              const optionIndex = fromBox.options.findIndex(opt => opt.id === conn.fromOptionId);
              if (optionIndex !== -1) {
                const actualPos = getActualOptionPosition(conn.fromBoxId, optionIndex);
                if (actualPos) {
                  fromY = actualPos.y;
                } else {
                  fromY = getOptionYPosition(fromBox, optionIndex);
                }
              }
            }

            const from = {
              x: fromBox.x + fromBox.width,
              y: fromY,
            };
            const to = {
              x: toBox.x,
              y: toBox.y + toBox.height / 2,
            };

            // Bezier curve path with more pronounced curves
            const distance = to.x - from.x;
            const cx = from.x + (distance * 0.4);
            const cy = (from.y + to.y) / 2 + (Math.abs(from.y - to.y) * 0.3);
            const path = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;

            return (
              <g key={conn.id} style={{ cursor: 'pointer' }} onClick={(e) => {
                e.stopPropagation();
                setSelectedConnection(conn.id);
              }}>
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

          {/* Drawing connection line */}
          {connecting && (
            (() => {
              const fromBox = boxes.find(b => b.id === connecting);
              if (!fromBox) return null;
              
              let fromY = fromBox.y + fromBox.height / 2;
              
              // If connecting from an option, try to get actual position from DOM
              if (connectingFromOption) {
                const optionIndex = fromBox.options.findIndex(opt => opt.id === connectingFromOption);
                if (optionIndex !== -1) {
                  const actualPos = getActualOptionPosition(connecting, optionIndex);
                  if (actualPos) {
                    fromY = actualPos.y;
                  } else {
                    fromY = getOptionYPosition(fromBox, optionIndex);
                  }
                }
              }
              
              const from = {
                x: fromBox.x + fromBox.width,
                y: fromY,
              };
              const distance = mousePos.x - from.x;
              const cx = from.x + (distance * 0.4);
              const cy = (from.y + mousePos.y) / 2 + (Math.abs(from.y - mousePos.y) * 0.3);
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
            })()
          )}
        </svg>

        {/* Render boxes */}
        {boxes.map(box => (
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
              <div className="screen-label">{box.label}</div>
              {box.question && (
                <div className="screen-question">{box.question}</div>
              )}
              
              {box.options.length > 0 && (
                <div className="screen-options-list">
                  {box.options.map((option, index) => (
                    <div
                      key={option.id}
                      data-option-id={`${box.id}-${index}`}
                      className={`option-item ${connecting && connectingFromOption !== option.id ? 'can-connect' : ''} ${connectingFromOption === option.id ? 'connecting' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (connecting && connectingFromOption !== option.id) {
                          completeConnection(box.id);
                        }
                      }}
                    >
                      <div className="option-text">{option.text}</div>
                      <div
                        className={`option-connection-point ${connecting === box.id && connectingFromOption === option.id ? 'active' : ''}`}
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

            {/* Connection point - right side */}
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

            {/* Resize handle */}
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

      {/* Edit Dialog */}
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

function EditDialog({ box, onSave, onClose }) {
  const [label, setLabel] = useState(box.label);
  const [image, setImage] = useState(box.image);
  const [imageData, setImageData] = useState(null);
  const [question, setQuestion] = useState(box.question);
  const [options, setOptions] = useState(box.options);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Store the absolute path
      setImage(file.path || file.webkitRelativePath || file.name);
      
      // For display preview, read as data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageData(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index].text = value;
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
    onSave({
      label,
      image,
      question,
      options: options.filter(o => o.text.trim()),
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Screen</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
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
              {(imageData || image) && (
                <div className="image-preview">
                  <img src={imageData || image} alt="Preview" />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() => {
                      setImage(null);
                      setImageData(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-upload"
                onClick={() => fileInputRef.current.click()}
              >
                {image || imageData ? 'Change Image' : 'Upload Image'}
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
            <button
              type="button"
              className="btn-add-option"
              onClick={handleAddOption}
            >
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
