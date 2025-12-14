/**
 * Content Script - Detects text selection and communicates with side panel
 */

(function() {
  'use strict';

  let selectedText = '';
  let isExtensionActive = false;

  // Check if side panel is open
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'check-active') {
      sendResponse({ active: isExtensionActive });
    } else if (message.type === 'set-active') {
      isExtensionActive = message.active;
    }
  });

  // Listen for text selection with delay to ensure selection is complete
  let selectionTimeout;
  document.addEventListener('mouseup', () => {
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(handleTextSelection, 100);
  });
  document.addEventListener('keyup', (e) => {
    // Only handle if Shift/Ctrl/Cmd is used for selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(handleTextSelection, 100);
    }
  });

  function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text.length > 0 && text.length < 1000) { // Limit to reasonable length
      selectedText = text;
      showAddTaskButton(selection);
    } else {
      hideAddTaskButton();
    }
  }

  function showAddTaskButton(selection) {
    // Remove existing button if any
    hideAddTaskButton();

    // Get selection range
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Create floating button
    const button = document.createElement('div');
    button.id = 'daily-planner-add-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      <span>할 일로 추가</span>
    `;
    
    // Style the button
    Object.assign(button.style, {
      position: 'fixed',
      top: `${rect.top + window.scrollY - 40}px`,
      left: `${rect.left + window.scrollX + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      backgroundColor: 'rgba(18, 18, 20, 0.95)',
      backdropFilter: 'blur(16px) saturate(180%)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      zIndex: '999999',
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 15px rgba(100, 100, 255, 0.15)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'auto'
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(-50%) translateY(-2px)';
      button.style.boxShadow = '0px 6px 16px rgba(0, 0, 0, 0.4), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 20px rgba(100, 100, 255, 0.25)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(-50%)';
      button.style.boxShadow = '0px 4px 12px rgba(0, 0, 0, 0.3), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 15px rgba(100, 100, 255, 0.15)';
    });

    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Store selected text in storage for side panel to read
      chrome.storage.local.set({
        selectedText: selectedText,
        selectedTextUrl: window.location.href,
        selectedTextTitle: document.title
      }).then(() => {
        // Also try to open side panel
        chrome.runtime.sendMessage({
          type: 'open-side-panel'
        }).catch(() => {
          // Ignore errors - side panel might already be open
        });
      });

      // Hide button
      hideAddTaskButton();
      
      // Clear selection
      if (selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
    });

    document.body.appendChild(button);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (document.getElementById('daily-planner-add-btn')) {
        hideAddTaskButton();
      }
    }, 5000);
  }

  function hideAddTaskButton() {
    const button = document.getElementById('daily-planner-add-btn');
    if (button) {
      button.remove();
    }
  }

  // Hide button when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#daily-planner-add-btn')) {
      hideAddTaskButton();
    }
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    hideAddTaskButton();
  });
})();

