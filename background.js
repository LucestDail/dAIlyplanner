/**
 * Background Service Worker
 * Handles extension lifecycle and message routing
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open-side-panel') {
    // Open side panel
    chrome.sidePanel.open({ windowId: sender.tab?.windowId });
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('dAIly Planner extension installed');
});

