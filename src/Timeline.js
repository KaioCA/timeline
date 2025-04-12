import React, { useState, useCallback, useRef, useEffect } from 'react';
import { assignLanes } from './assignLanes';
import './Timeline.css';

const Timeline = ({ items: initialItems }) => {
  // Define card colors at the top
  const cardColors = [
    '#4a90e2', // Blue
    '#50c878', // Green
    '#f39c12', // Orange
    '#e74c3c', // Red
    '#9b59b6'  // Purple
  ];

  const [items, setItems] = useState(() => {
    // Check if initialItems are provided and use them if available
    if (initialItems && initialItems.length > 0) {
      return initialItems.slice(0, 3);
    }
    
    // Otherwise, create 3 default items in different lanes and months
    const currentYear = new Date().getFullYear();
    return [
      {
        id: '1',
        name: 'Task 1',
        start: `${currentYear}-01-01`, // January start
        end: `${currentYear}-01-31`, // January end
        lane: 0, // First lane
        color: cardColors[0]
      },
      {
        id: '2',
        name: 'Task 2',
        start: `${currentYear}-04-01`, // April start
        end: `${currentYear}-04-30`, // April end
        lane: 1, // Second lane
        color: cardColors[1]
      },
      {
        id: '3',
        name: 'Task 3',
        start: `${currentYear}-07-01`, // July start
        end: `${currentYear}-07-31`, // July end
        lane: 2, // Third lane
        color: cardColors[2]
      }
    ];
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizeHandle, setResizeHandle] = useState(null); // 'left' or 'right'
  const [moveHandle, setMoveHandle] = useState(null); // 'top' or 'bottom'
  const timelineRef = useRef(null);
  const isDragging = useRef(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Create a fixed number of lanes
  const totalLanesCount = 5; // Or whatever number of lanes you want
  const fixedLanes = Array.from({ length: totalLanesCount }, (_, i) => i);

  // Set the minDate to the start of the year and maxDate to the end of the year
  const minDate = new Date(new Date().getFullYear(), 0, 1); // January 1st
  const maxDate = new Date(new Date().getFullYear(), 11, 31); // December 31st
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

  // Adjust the width calculation to display 3 months at 100% zoom
  const monthsToDisplay = 3;
  const daysInThreeMonths = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24) / 12 * monthsToDisplay);

  // Função para gerar as marcas de data no eixo de tempo
  const generateTimeAxis = () => {
    const dates = [];
    const currentDate = new Date(minDate);
    
    while (currentDate <= maxDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Agrupa as datas por mês para mostrar apenas uma marca por mês
    const months = {};
    dates.forEach(date => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months[monthKey]) {
        months[monthKey] = date;
      }
    });

    return Object.values(months);
  };

  const timeAxisDates = generateTimeAxis();

  // Função para lidar com o zoom
  const handleZoom = useCallback((delta) => {
    setZoomLevel(prevZoom => {
      const newZoom = Math.max(0.5, Math.min(3, prevZoom + delta));
      return newZoom;
    });
  }, []);

  // Função para lidar com a rolagem
  const handleScroll = useCallback((e) => {
    setScrollPosition(e.target.scrollLeft);
  }, []);

  // Função para calcular a data baseada na posição X
  const getDateFromPosition = useCallback((x) => {
    if (!timelineRef.current) return null;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeX = x - rect.left;
    const percentage = relativeX / rect.width;
    const daysFromStart = Math.round(percentage * totalDays);
    const newDate = new Date(minDate);
    newDate.setDate(newDate.getDate() + daysFromStart);
    return newDate;
  }, [minDate, totalDays]);

  // Função para formatar a data como YYYY-MM-DD
  const formatDate = useCallback((date) => {
    return date.toISOString().split('T')[0];
  }, []);

  // Funções de drag and drop personalizadas
  const handleMouseDown = useCallback((e, item) => {
    if (e.button !== 0) return; // Apenas botão esquerdo do mouse
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    
    setDraggingItem(item);
    setDragStartX(e.clientX);
    setDragStartDate(new Date(item.start));
    setDragOffset(offsetX);
    isDragging.current = true;
    
    // If we're clicking on the main body of the item (not a handle),
    // enable entire item movement (both horizontal and vertical)
    const target = e.target;
    if (!target.classList.contains('timeline-item-resize-handle') && 
        !target.classList.contains('timeline-item-move-handle')) {
      setMoveHandle('body'); // Use 'body' to indicate we're moving the whole item
    }
    
    e.currentTarget.classList.add('dragging');
    e.preventDefault();
  }, []);

  const handleResizeStart = useCallback((e, item, handle) => {
    e.stopPropagation();
    setResizeHandle(handle);
    setDraggingItem(item);
    setDragStartX(e.clientX);
    setDragStartDate(handle === 'left' ? new Date(item.start) : new Date(item.end));
    isDragging.current = true;
  }, []);

  const handleMoveStart = useCallback((e, item, handle) => {
    e.stopPropagation();
    setMoveHandle(handle);
    setDraggingItem(item);
    isDragging.current = true;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !draggingItem || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    
    // Always calculate the lane based on Y position
    const relativeY = e.clientY - rect.top;
    const timelineHeight = rect.height;
    const laneHeight = timelineHeight / totalLanesCount;
    const newLane = Math.max(0, Math.min(totalLanesCount - 1, Math.floor(relativeY / laneHeight)));
    
    // Get date for horizontal movement
    const newDate = getDateFromPosition(e.clientX - dragOffset);
    
    let updatedItem = { ...draggingItem };
    let hasChanges = false;

    // Handle resize operation
    if (resizeHandle && newDate) {
      const hoursDiff = Math.round((newDate - dragStartDate) / (1000 * 60 * 60));
      
      if (resizeHandle === 'left') {
        const newStartDate = new Date(dragStartDate.getTime() + hoursDiff * 60 * 60 * 1000);
        if (newStartDate < new Date(draggingItem.end)) {
          updatedItem.start = formatDate(newStartDate);
          hasChanges = true;
        }
      } else {
        const newEndDate = new Date(dragStartDate.getTime() + hoursDiff * 60 * 60 * 1000);
        if (newEndDate > new Date(draggingItem.start)) {
          updatedItem.end = formatDate(newEndDate);
          hasChanges = true;
        }
      }
    } 
    // Handle move operation (either with handles or whole body)
    else if (moveHandle) {
      // Always check for lane changes when moving
      if (newLane !== draggingItem.lane) {
        updatedItem.lane = newLane;
        hasChanges = true;
      }
      
      // If we're moving the whole item (not just vertically with handles),
      // also update horizontal position
      if (moveHandle === 'body' && newDate) {
        const hoursDiff = Math.round((newDate - dragStartDate) / (1000 * 60 * 60));
        const newStartDate = new Date(dragStartDate);
        newStartDate.setHours(newStartDate.getHours() + hoursDiff);
        
        const newEndDate = new Date(draggingItem.end);
        newEndDate.setHours(newEndDate.getHours() + hoursDiff);

        updatedItem.start = formatDate(newStartDate);
        updatedItem.end = formatDate(newEndDate);
        hasChanges = true;
      }
    } 
    // Default case - just horizontal movement
    else if (newDate) {
      const hoursDiff = Math.round((newDate - dragStartDate) / (1000 * 60 * 60));
      const newStartDate = new Date(dragStartDate);
      newStartDate.setHours(newStartDate.getHours() + hoursDiff);
      
      const newEndDate = new Date(draggingItem.end);
      newEndDate.setHours(newEndDate.getHours() + hoursDiff);

      updatedItem.start = formatDate(newStartDate);
      updatedItem.end = formatDate(newEndDate);
      hasChanges = true;
    }

    // Update the items state if there are changes
    if (hasChanges) {
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === draggingItem.id ? updatedItem : item
        ).sort((a, b) => new Date(a.start) - new Date(b.start))
      );
    }
  }, [draggingItem, dragStartDate, dragOffset, resizeHandle, moveHandle, getDateFromPosition, formatDate, totalLanesCount]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    setDraggingItem(null);
    setResizeHandle(null);
    setMoveHandle(null);
    setDragStartX(0);
    setDragStartDate(null);
    setDragOffset(0);
    
    document.querySelectorAll('.timeline-item.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
  }, []);

  // Adiciona e remove event listeners para mouse move e up
  useEffect(() => {
    if (isDragging.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleLaneClick = useCallback((e) => {
    if (e.target.classList.contains('timeline-item') || 
        e.target.closest('.timeline-item') || 
        e.target.classList.contains('timeline-item-resize-handle') ||
        e.target.classList.contains('timeline-item-move-handle')) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top;
    
    // Define grid dimensions
    const totalLanes = 5; // Set this to the actual number of lanes you want
    const timelineHeight = timelineRef.current ? timelineRef.current.clientHeight : 300; // Default height if ref is not available
    const laneHeight = timelineHeight / totalLanes;
    const cellWidth = rect.width / totalDays; // Width of each cell based on total days

    // Calculate grid position
    const clickedLane = Math.floor(y / laneHeight);
    const daysFromStart = Math.floor(x / cellWidth);


    // Calculate date based on grid position
    const clickedDate = new Date(minDate);
    clickedDate.setDate(clickedDate.getDate() + daysFromStart);
    
    if (!clickedDate) return;

    // Create a new item that spans the entire month
    // Get the first day of the month
    const startDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
    
    // Get the last day of the month
    const endDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth() + 1, 0);

    // Check if there's already a card in this lane for this month
    const hasOverlappingCard = items.some(item => {
      // Check if item is in the same lane
      if (item.lane !== clickedLane) return false;
      
      const itemStart = new Date(item.start);
      const itemEnd = new Date(item.end);
      
      // Check if the date ranges overlap
      return (
        (startDate <= itemEnd && endDate >= itemStart) || // New card overlaps with existing card
        (itemStart <= endDate && itemEnd >= startDate)    // Existing card overlaps with new card
      );
    });

    // If there's already a card in this lane and month, don't create a new one
    if (hasOverlappingCard) {
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      name: 'New Item',
      start: formatDate(startDate),
      end: formatDate(endDate),
      lane: clickedLane,
      color: cardColors[Math.floor(Math.random() * cardColors.length)] // Assign random color
    };

    setItems(prevItems => {
      const updatedItems = [...prevItems, newItem];
      return updatedItems.sort((a, b) => new Date(a.start) - new Date(b.start));
    });
  }, [minDate, totalDays, zoomLevel, formatDate, items]);

  const handleRightClick = useCallback((e, itemId) => {
    e.preventDefault(); // Prevent the default context menu from appearing
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  const handleTitleDoubleClick = useCallback((e, item) => {
    e.stopPropagation();
    e.preventDefault(); // Add this to prevent other handlers
    setEditingItemId(item.id);
    setEditValue(item.name);
  }, []);

  const handleTitleChange = useCallback((e) => {
    setEditValue(e.target.value);
  }, []);

  const handleTitleKeyDown = useCallback((e, itemId) => {
    if (e.key === 'Enter') {
      // Save changes
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, name: editValue } 
            : item
        )
      );
      setEditingItemId(null);
    } else if (e.key === 'Escape') {
      // Cancel editing
      setEditingItemId(null);
    }
  }, [editValue]);

  const handleTitleBlur = useCallback((e, itemId) => {
    // Save changes when input loses focus
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, name: editValue } 
          : item
      )
    );
    setEditingItemId(null);
  }, [editValue]);

  // Add this helper to make sure clicks on the input don't propagate
  const handleInputClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);


  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2>Timeline</h2>
        <div className="zoom-controls">
          <button 
            onClick={() => handleZoom(-0.1)}
            className="zoom-button"
            aria-label="Zoom out"
          >
            -
          </button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button 
            onClick={() => handleZoom(0.1)}
            className="zoom-button"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
      
      <div className="timeline-wrapper" ref={timelineRef}>
        {/* Eixo de tempo */}
        <div className="timeline-axis-container">
          <div 
            className="timeline-axis"
            style={{ 
              transform: `scaleX(${zoomLevel})`,
              width: `${100 / zoomLevel}%`
            }}
          >
            {timeAxisDates.map((date, index) => {
              const daysFromStart = Math.ceil((date - minDate) / (1000 * 60 * 60 * 24));
              const position = (daysFromStart / totalDays) * 100;
              
              return (
                <div
                  key={index}
                  className="timeline-tick"
                  style={{ left: `${position}%` }}
                >
                  <div className="timeline-tick-label">
                    {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da timeline */}
        <div className="timeline-content-container">
          <div 
            className="timeline-content"
            onScroll={handleScroll}
            onClick={handleLaneClick}
            style={{ 
              transform: `scaleX(${zoomLevel})`,
              width: `${100 / zoomLevel}%`
            }}
          >
            {fixedLanes.map((laneIndex) => (
              <div 
                key={laneIndex} 
                className="timeline-lane"
              >
                {items.filter(item => item.lane === laneIndex).map((item) => {
                  const startDate = new Date(item.start);
                  const endDate = new Date(item.end);
                  const daysFromStart = Math.ceil((startDate - minDate) / (1000 * 60 * 60 * 24));
                  const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <div
                      key={item.id}
                      className={`timeline-item ${isDragging.current && draggingItem?.id === item.id ? 'dragging' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, item)}
                      onContextMenu={(e) => handleRightClick(e, item.id)}
                      style={{
                        left: `${(daysFromStart / totalDays) * 100}%`,
                        width: `${(duration / totalDays) * 100}%`,
                        cursor: moveHandle ? 'grabbing' : 'grab',
                        backgroundColor: item.color || cardColors[item.lane % cardColors.length] // Use item color or fallback to lane-based color
                      }}
                    >
                      <div 
                        className="timeline-item-resize-handle left"
                        onMouseDown={(e) => handleResizeStart(e, item, 'left')}
                      />
                      <div 
                        className="timeline-item-resize-handle right"
                        onMouseDown={(e) => handleResizeStart(e, item, 'right')}
                      />
                      <div 
                        className="timeline-item-move-handle top"
                        onMouseDown={(e) => handleMoveStart(e, item, 'top')}
                      />
                      <div 
                        className="timeline-item-move-handle bottom"
                        onMouseDown={(e) => handleMoveStart(e, item, 'bottom')}
                      />
                      <div className="timeline-item-content">
                        {editingItemId === item.id ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={handleTitleChange}
                            onKeyDown={(e) => handleTitleKeyDown(e, item.id)}
                            onBlur={(e) => handleTitleBlur(e, item.id)}
                            autoFocus
                            className="timeline-item-name-input"
                            onClick={handleInputClick}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="timeline-item-name"
                            onDoubleClick={(e) => handleTitleDoubleClick(e, item)}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {item.name}
                          </span>
                        )}
                        <span className="timeline-item-dates">
                          {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                          {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline; 