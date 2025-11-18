'use strict';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Array.at() polyfill for older browsers
 */
if (!Array.prototype.at) {
  Array.prototype.at = function (index) {
    // Convert negative index to positive
    if (index < 0) {
      index = this.length + index;
    }
    // Return undefined for out-of-bounds indices
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    return this[index];
  };
}

String.prototype.toTitleCase = function () {
  // 1. Lowercase the entire string first to handle pre-capitalized letters (e.g., "PyThOn")
  let s = this.toLowerCase();

  // 2. Use a Regular Expression to find the first character of every 'word'.
  //    The regex /\b\w/g matches:
  //    - \b: a word boundary (the position between a word character and a non-word character)
  //    - \w: a word character (a-z, A-Z, 0-9, including the underscore _)
  //    - /g: global flag, ensuring all matches are found, not just the first one.
  return s.replace(/\b\w/g, (char) => {
    // Replace the matched character with its uppercase version
    return char.toUpperCase();
  });
};

/**
 * Utility function to get nested object properties safely, since Polarity doesn't support optional chaining (?.)
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path to the property
 * @param {*} defaultValue - Default value if path doesn't exist
 * @param {boolean} createIfMissing - If true, creates the structure if it doesn't exist (default: false)
 * @returns {*} The value at the path or default value
 */
function getNested(obj, path, defaultValue = undefined, createIfMissing = false) {
  if (!obj || !path) {
    return defaultValue;
  }

  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (current && current[key] !== undefined) {
      current = current[key];
    } else {
      if (createIfMissing && i < keys.length - 1) {
        // Create intermediate objects
        current[key] = {};
        current = current[key];
      } else if (createIfMissing && i === keys.length - 1) {
        // Create final property with default value
        const finalValue = defaultValue !== undefined ? defaultValue : {};
        current[key] = finalValue;
        return current[key];
      } else {
        return defaultValue;
      }
    }
  }

  return current;
}

/**
 * Check if a value is an array
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an array
 */
function isArray(value) {
  return Array.isArray(value);
}

/**
 * Get element by ID with null safety
 * @param {string} id - Element ID
 * @returns {Element|null} The element or null if not found
 */
function byId(id) {
  return document.getElementById(id);
}

/**
 * Query selector with null safety
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element (optional)
 * @returns {Element|null} The element or null if not found
 */
function qs(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Query selector all helper
 * @param {string} sel - CSS selector
 * @param {Element} root - Root element to search in
 * @returns {Array} Array of found elements
 */
function qsa(sel, root = document) {
  return Array.prototype.slice.call(root.querySelectorAll(sel));
}

/**
 * Escape HTML characters
 * @param {string} s - String to escape
 * @returns {string} HTML-escaped string
 */
function htmlEscape(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

/**
 * Fallback copy text to clipboard for older browsers
 * @param {string} text - Text to copy
 * @returns {void}
 */
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      console.error('Fallback: Copy command failed');
    }
  } catch (err) {
    console.error('Fallback: Unable to copy', err);
  }
  document.body.removeChild(textArea);
}

/**
 * Format timestamp to "h:mm A MMM DD, YYYY" format (e.g., "1:53 PM Jun 20, 2025")
 * @param {string|number} timestamp - Timestamp (ISO string, Unix timestamp, etc.)
 * @returns {string} Formatted timestamp string
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';

  let date;
  if (typeof timestamp === 'number') {
    // Unix timestamp (milliseconds)
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    // ISO string or other date string
    date = new Date(timestamp);
  } else {
    return '';
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return '';
  }

  // Format: "1:53 PM Jun 20, 2025"
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return hours + ':' + minutesStr + ' ' + ampm + ' ' + month + ' ' + day + ', ' + year;
}

/**
 * Safe JSON parse with fallback
 * @param {string} text - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
function safeParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

// ============================================================================
// POLARITY UTILITIES CLASS
// ============================================================================

/**
 * Utility class for Polarity integration operations
 * Provides shared functionality for Ember service access and integration messaging
 */
class PolarityUtils {
  /**
   * Create a new PolarityUtils instance
   * @returns {void}
   */
  constructor() {
    this.integrationMessenger = null;
  }

  /**
   * Get an Ember service by name
   * @param {string} serviceName - Name of the service to retrieve
   * @returns {Object|null} The service instance or null if not found
   */
  getEmberService(serviceName) {
    const appNamespace = Ember.Namespace.NAMESPACES.find(
      (ns) => ns instanceof Ember.Application
    );

    if (!appNamespace) {
      console.error('Ember application namespace not found');
      return null;
    }

    return appNamespace.__container__.lookup(`service:${serviceName}`);
  }

  /**
   * Send a message to the integration backend
   * @param {Object} payload - The message payload
   * @param {string} payload.action - The action to perform
   * @param {string} integrationId - Optional integration ID (overrides instance integrationId)
   * @returns {Promise} Promise that resolves with the response
   */
  async sendIntegrationMessage(payload, integrationId) {
    if (!integrationId) {
      return Promise.reject(new Error('Integration ID not provided.'));
    }

    if (!this.integrationMessenger) {
      this.integrationMessenger = this.getEmberService('integration-messenger');
    }

    if (!this.integrationMessenger) {
      return Promise.reject(new Error('Integration messenger service not available'));
    }

    // Validate payload before sending
    if (!payload || !payload.action) {
      return Promise.reject(new Error('Invalid payload: action is required'));
    }

    const message = {
      data: {
        type: 'integration-messages',
        attributes: { payload: payload }
      }
    };

    return this.integrationMessenger
      .sendMessage(integrationId, message)
      .catch((error) => {
        this.handleIntegrationError(error, payload.action);
        return Promise.reject(error);
      });
  }

  /**
   * Handle integration errors with appropriate logging
   * @param {Error} error - The error that occurred
   * @param {string} action - The action that failed
   */
  handleIntegrationError(error, action) {
    if (error.status === 422) {
      console.error('Unprocessable Content error:', {
        action: action,
        error: error.response ? error.response : error.message
      });
    } else {
      console.error(`Error sending integration message for action ${action}:`, error);
    }
  }
}

/**
 * Dataminr integration class
 * @param {Object} integration - The integration object
 * @param {Object} userConfig - User configuration object
 * @param {boolean} userConfig.subscribed - Whether user is subscribed to alerts
 * @param {Object} userOptions - User options object
 */
class DataminrIntegration {
  /**
   * Create a new DataminrIntegration instance
   * @param {Object} integration - The integration object
   * @param {Object} userConfig - User configuration object
   * @param {Object} userOptions - User options object
   */
  constructor(integration, userConfig, userOptions) {
    this.integration = integration;
    this.userConfig = userConfig;
    this.userOptions = userOptions;
    this.integrationId = integration.type;
    this.pollingInterval = null;
    this.pollIntervalMs =  10000; // Poll Polarity server every 10 seconds
    this.currentUser = null;
    this.currentAlerts = new Map(); // Map of alertId -> alert object
    this.lastQueryTimestamp = null; // ISO timestamp of last query
    this.maxVisibleTags = 10; // Maximum number of visible alert tags to display

    // Initialize the application
    this.init();
  }

  /**
   * Send a message to the integration backend
   * @param {Object} payload - The message payload
   * @param {string} payload.action - The action to perform
   * @returns {Promise} Promise that resolves with the response
   */
  async sendIntegrationMessage(payload) {
    if (window.PolarityUtils) {
      return window.PolarityUtils.sendIntegrationMessage(payload, this.integrationId);
    }
    return Promise.reject(new Error('PolarityUtils not available'));
  }

  /**
   * Initialize the Dataminr integration
   * @private
   */
  async initPolarityPin() {
    const notificationContainer = byId('notification-overlay-scroll-container');
    if (notificationContainer) {
      const dataminrContainerClass = window.polarity
        ? 'dataminr-container polarity-x-client'
        : 'dataminr-container';

      // Add hello world div before notificationContainer
      const pinnedPolarityContainer = document.createElement('div');
      pinnedPolarityContainer.id = 'polarity-pin-container';
      pinnedPolarityContainer.className = `${this.integrationId}-integration`;
      const dataminrContainer = document.createElement('div');
      dataminrContainer.id = 'dataminr-container';
      dataminrContainer.className = dataminrContainerClass;
      dataminrContainer.innerHTML = `
        <div class="dataminr-content">
          <div class="dataminr-header">
            <div class="dataminr-header-left">
              <span class="dataminr-title">Dataminr Alert</span>
              <div class="dataminr-alert-icons-container">
                <span class="dataminr-alert-icon dataminr-alert-icon-flash" title="Flash" aria-label="Flash" data-alert-type="Flash" style="display: none;">0</span>
                <span class="dataminr-alert-icon dataminr-alert-icon-urgent" title="Urgent" aria-label="Urgent" data-alert-type="Urgent" style="display: none;">0</span>
                <span class="dataminr-alert-icon dataminr-alert-icon-alert" title="Alert" aria-label="Alert" data-alert-type="Alert">0</span>
              </div>
              <button class="dataminr-clear-all-alerts-btn" type="button" aria-label="Clear All Alerts" style="display: none;">Clear All Alerts</button>
            </div>
            <div class="dataminr-show-body-icon">
              <svg class="dataminr-chevron-icon" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <div class="dataminr-body">
          </div>
        </div>
            `;
      pinnedPolarityContainer.appendChild(dataminrContainer);
      notificationContainer.parentNode.insertBefore(
        pinnedPolarityContainer,
        notificationContainer
      );

      // Add click handler to toggle body visibility - entire header is clickable
      const headerElement = dataminrContainer.querySelector('.dataminr-header');
      const bodyElement = dataminrContainer.querySelector('.dataminr-body');
      const chevronIcon = dataminrContainer.querySelector('.dataminr-chevron-icon');
      const clearAllButton = dataminrContainer.querySelector(
        '.dataminr-clear-all-alerts-btn'
      );

      if (headerElement && bodyElement && chevronIcon) {
        headerElement.addEventListener('click', (e) => {
          // Don't toggle if clicking the clear button
          if (e.target === clearAllButton || clearAllButton.contains(e.target)) {
            return;
          }
          const isHidden = bodyElement.style.display === 'none';
          bodyElement.style.display = isHidden ? 'block' : 'none';
          chevronIcon.style.transform = isHidden ? 'rotate(-180deg)' : 'rotate(0deg)';
          
          // If closing the body, hide details and deselect active alert
          if (!isHidden) {
            this.hideAllDetails();
            this.deactivateAllTagButtons();
          }
        });
      }

      // Add click handler for clear all alerts button
      if (clearAllButton) {
        clearAllButton.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent header toggle
          this.clearAllAlerts();
        });
      }
    }
  }

  /**
   * Copy text to clipboard with fallback
   * @private
   * @param {string} textToCopy - Text to copy to clipboard
   * @param {string} logMessage - Message to log on success
   */
  copyToClipboard(textToCopy, logMessage) {
    if (!textToCopy) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(function () {
          console.log(logMessage);
        })
        .catch(function (err) {
          console.error('Failed to copy:', err);
          fallbackCopyTextToClipboard(textToCopy);
        });
    } else {
      fallbackCopyTextToClipboard(textToCopy);
    }
  }

  /**
   * Poll backend for new alerts since last query timestamp
   * @private
   */
  async pollAlerts() {
    try {
      // Fetch new alerts since last query timestamp
      const newAlerts = await this.getAlerts();

      // Add new alerts to current alerts map
      if (newAlerts.length > 0) {
        newAlerts.forEach((newAlert) => {
          const alertId = newAlert.alertId || 'alert-' + newAlerts.indexOf(newAlert);
          this.currentAlerts.set(alertId, newAlert);
        });

        // Update the display with new alerts
        this.updateAlertsDisplay(Array.from(this.currentAlerts.values()));
      }
    } catch (error) {
      console.error('Error polling alerts:', error);
    }
  }

  /**
   * Get full alerts list from backend
   * @private
   * @param {number} [count] - Optional number of alerts to request (for initial query)
   * @returns {Promise<Array>} Array of alert objects
   */
  async getAlerts(count) {
    try {
      // Build payload with timestamp and optional count
      const payload = {
        action: 'getAlerts'
      };

      // If count is provided (from URL parameter), include it (overrides timestamp)
      if (count) {
        payload.count = count;
      } else if (this.lastQueryTimestamp) {
        // Otherwise, send the last query timestamp to get alerts since then
        payload.sinceTimestamp = this.lastQueryTimestamp;
      } else {
        // First query: send current timestamp (will return empty array)
        payload.sinceTimestamp = new Date().toISOString();
      }

      const response = await this.sendIntegrationMessage(payload);

      // Handle response format (could be direct or wrapped in data.attributes.payload)
      let result = response;
      if (
        response &&
        response.data &&
        response.data.attributes &&
        response.data.attributes.payload
      ) {
        result = response.data.attributes.payload;
      }

      // Update last query timestamp from response
      if (result && result.lastQueryTimestamp) {
        this.lastQueryTimestamp = result.lastQueryTimestamp;
      } else if (result && result.alerts && result.alerts.length > 0) {
        // If no timestamp in response, use the most recent alert's timestamp
        const mostRecentAlert = result.alerts[0];
        if (mostRecentAlert && mostRecentAlert.alertTimestamp) {
          this.lastQueryTimestamp = mostRecentAlert.alertTimestamp;
        }
      } else if (!this.lastQueryTimestamp) {
        // First query with no alerts: set timestamp to now
        this.lastQueryTimestamp = new Date().toISOString();
      }

      if (result && result.alerts) {
        return result.alerts;
      }
      return [];
    } catch (error) {
      console.error('Error getting alerts:', error);
      return [];
    }
  }

  /**
   * Clear all alerts from the UI and reset state
   * @private
   */
  clearAllAlerts() {
    // Clear the alerts map
    if (this.currentAlerts && this.currentAlerts instanceof Map) {
      this.currentAlerts.clear();
    }

    // Reset the last query timestamp
    this.lastQueryTimestamp = null;

    // Update alert count to 0
    this.updateAlertCount(0);

    // Clear the display
    this.updateAlertsDisplay([]);

    // Hide all details
    this.hideAllDetails();
  }

  /**
   * Normalize alert type for CSS class
   * @private
   * @param {string} alertType - Alert type name
   * @returns {string} Normalized alert type
   */
  normalizeAlertType(alertType) {
    return alertType.toLowerCase().replace('update', '').trim();
  }

  /**
   * Get alert ID from alert object or generate one
   * @private
   * @param {Object} alert - Alert object
   * @param {number} index - Index of the alert
   * @returns {string} Alert ID
   */
  getAlertId(alert, index) {
    return alert.alertId || 'alert-' + index;
  }

  /**
   * Get alert type from alert object
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} Alert type name
   */
  getAlertType(alert) {
    return alert.alertType && alert.alertType.name ? alert.alertType.name : 'Alert';
  }

  /**
   * Get alert headline from alert object
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} Alert headline
   */
  getAlertHeadline(alert) {
    return alert.headline || 'No headline available';
  }

  /**
   * Hide all alert detail containers
   * @private
   */
  hideAllDetails() {
    const allDetails = qsa('.dataminr-alert-detail');
    allDetails.forEach((detail) => {
      detail.style.display = 'none';
      detail.classList.remove('visible');
    });
  }

  /**
   * Remove active class from all tag buttons
   * @private
   */
  deactivateAllTagButtons() {
    const allTagButtons = qsa('.dataminr-tag');
    allTagButtons.forEach((btn) => {
      btn.classList.remove('active');
    });
  }

  /**
   * Show a specific alert detail container
   * @private
   * @param {string} alertId - Alert ID to show
   */
  async showDetail(alertId) {
    if (alertId && alertId !== 'remaining') {
      let detailContainer = qs(`.dataminr-alert-detail[data-alert-id="${alertId}"]`);

      // If detail container doesn't exist, create it dynamically
      if (!detailContainer) {
        const alert = this.currentAlerts.get(alertId);
        if (!alert) {
          return;
        }

        // Get or create the details container
        let dataminrDetailsContainer = byId('dataminr-details-container');
        const dataminrDetailsClass = window.polarity
          ? 'dataminr-alert-details polarity-x-client'
          : 'dataminr-alert-details';

        if (!dataminrDetailsContainer) {
          const listTopSentinel = byId('list-top-sentinel');
          if (!listTopSentinel) {
            return;
          }
          dataminrDetailsContainer = document.createElement('div');
          dataminrDetailsContainer.id = 'dataminr-details-container';
          dataminrDetailsContainer.className = `${this.integrationId}-integration`;
          const detailsContainer = document.createElement('div');
          detailsContainer.className = dataminrDetailsClass;
          dataminrDetailsContainer.appendChild(detailsContainer);
          listTopSentinel.parentNode.insertBefore(
            dataminrDetailsContainer,
            listTopSentinel
          );
        }

        let detailsContainer = dataminrDetailsContainer.querySelector(
          '.dataminr-alert-details'
        );
        if (!detailsContainer) {
          detailsContainer = document.createElement('div');
          detailsContainer.className = dataminrDetailsClass;
          dataminrDetailsContainer.appendChild(detailsContainer);
        }

        // Create and add the detail element
        detailContainer = document.createElement('div');
        detailContainer.className = 'dataminr-alert-detail';
        detailContainer.setAttribute('data-alert-id', alertId);

        // Build detail HTML (async)
        const detailHtml = await this.buildAlertDetailHtml(alert);
        detailContainer.innerHTML = detailHtml;
        detailsContainer.appendChild(detailContainer);

        // Add click handler for close icon
        const closeIcon = detailContainer.querySelector('.dataminr-alert-close-icon');
        if (closeIcon) {
          closeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const closeAlertId = closeIcon.getAttribute('data-alert-id');
            if (closeAlertId) {
              this.markAlertAsRead(closeAlertId);
            }
          });
        }
      }

      if (detailContainer) {
        detailContainer.style.display = 'block';
        detailContainer.classList.add('visible');
      }
    }
  }

  /**
   * Handle alert tag button click to toggle detail visibility
   * @private
   * @param {string} alertId - Alert ID from the clicked button
   * @param {Element} button - The clicked button element
   */
  handleAlertTagClick(alertId, button) {
    const isActive = button.classList.contains('active');

    if (isActive) {
      button.classList.remove('active');
      this.hideAllDetails();
      return;
    }

    this.deactivateAllTagButtons();
    this.hideAllDetails();
    button.classList.add('active');
    this.showDetail(alertId);
  }

  /**
   * Get count of visible tag buttons (excluding remaining button)
   * @private
   * @returns {number} Count of visible tag buttons
   */
  getVisibleTagButtonCount() {
    return qsa('.dataminr-tag[data-alert-id]:not([data-alert-id="remaining"])').length;
  }

  /**
   * Update remaining button display and count
   * @private
   */
  updateRemainingButton() {
    const remainingButton = qs('.dataminr-tag[data-alert-id="remaining"]');
    const remainingCountElement = qs('#dataminr-remaining-count');

    if (!this.currentAlerts || this.currentAlerts.size === 0) {
      if (remainingButton) {
        remainingButton.remove();
      }
      return;
    }

    const visibleCount = this.getVisibleTagButtonCount();
    const remainingCount = this.currentAlerts.size - visibleCount;

    if (remainingCount > 0) {
      if (remainingButton && remainingCountElement) {
        remainingCountElement.textContent = '+' + remainingCount;
        remainingButton.style.display = 'block';
      } else if (!remainingButton) {
        // Create remaining button if it doesn't exist
        const alertsList = qs('.dataminr-alerts-list');
        if (alertsList) {
          const newRemainingButton = document.createElement('button');
          newRemainingButton.className = 'dataminr-tag dataminr-tag-alert';
          newRemainingButton.setAttribute('data-alert-id', 'remaining');
          newRemainingButton.innerHTML = `
            <div class="dataminr-alert-tag-text">
              <span class="dataminr-tag-acronym">${htmlEscape(
                this.userConfig.acronym
              )}</span> 
              <span id="dataminr-remaining-count" class="dataminr-tag-headline">+${remainingCount}</span>
            </div>
          `;
          newRemainingButton.addEventListener('click', () => {
            this.updateAlertsDisplay(Array.from(this.currentAlerts.values()), true);
          });
          alertsList.appendChild(newRemainingButton);
        }
      }
    } else {
      if (remainingButton) {
        remainingButton.remove();
      }
    }
  }

  /**
   * Build a single alert tag button HTML
   * @private
   * @param {Object} alert - Alert object
   * @param {number} index - Index of the alert
   * @returns {string} HTML string for tag button
   */
  buildSingleAlertTag(alert, index) {
    const alertType = this.getAlertType(alert);
    const headline = this.getAlertHeadline(alert);
    const alertClass = 'dataminr-tag-' + this.normalizeAlertType(alertType);
    const alertId = this.getAlertId(alert, index);

    return `
      <button class="dataminr-tag ${alertClass}" data-alert-id="${htmlEscape(
      alertId
    )}" data-alert-index="${index}" title="${htmlEscape(headline)}">
        <div class="dataminr-alert-tag-text">
          <span class="dataminr-tag-acronym">${htmlEscape(
            this.userConfig.acronym
          )}</span> 
          <span class="dataminr-tag-headline">${htmlEscape(headline)}</span>
        </div>
      </button>
    `;
  }

  /**
   * Add a single alert tag button to the UI
   * @private
   * @param {Object} alert - Alert object to add
   * @param {string} alertId - Alert ID
   */
  addSingleAlertToUI(alert, alertId) {
    const bodyElement = qs('.dataminr-body');
    if (!bodyElement) return;

    const alertsListContainer = qs('.dataminr-alerts-list');
    if (!alertsListContainer) return;

    // Build and add tag button
    const alertType = this.getAlertType(alert);
    const headline = this.getAlertHeadline(alert);
    const alertClass = 'dataminr-tag-' + this.normalizeAlertType(alertType);

    const tagButton = document.createElement('button');
    tagButton.className = `dataminr-tag ${alertClass}`;
    tagButton.setAttribute('data-alert-id', alertId);
    tagButton.setAttribute('title', headline);
    tagButton.innerHTML = `
      <div class="dataminr-alert-tag-text">
        <span class="dataminr-tag-acronym">${htmlEscape(this.userConfig.acronym)}</span> 
        <span class="dataminr-tag-headline">${htmlEscape(headline)}</span>
      </div>
    `;

    // Insert before remaining button if it exists, otherwise append
    const remainingButton = qs('.dataminr-tag[data-alert-id="remaining"]');
    if (remainingButton) {
      alertsListContainer.insertBefore(tagButton, remainingButton);
    } else {
      alertsListContainer.appendChild(tagButton);
    }

    // Add click handler for the tag button
    tagButton.addEventListener('click', () => {
      this.handleAlertTagClick(alertId, tagButton);
    });

    // Note: Detail containers are built dynamically when shown via showDetail()
  }

  /**
   * Mark a single alert as read and remove it from UI
   * @private
   * @param {string} alertId - Alert ID to mark as read
   */
  async markAlertAsRead(alertId) {
    if (!alertId) {
      console.warn('No alertId provided to markAlertAsRead');
      return;
    }

    try {
      // Remove alert from current alerts map
      if (this.currentAlerts && this.currentAlerts instanceof Map) {
        this.currentAlerts.delete(alertId);
      }

      // Remove tag button from UI
      const tagButton = qs(`.dataminr-tag[data-alert-id="${alertId}"]`);
      if (tagButton) {
        tagButton.remove();
      }

      // Remove detail container from UI
      const detailContainer = qs(`.dataminr-alert-detail[data-alert-id="${alertId}"]`);
      if (detailContainer) {
        detailContainer.remove();
      }

      // Get all alerts that aren't currently displayed
      const visibleTagButtons = qsa(
        '.dataminr-tag[data-alert-id]:not([data-alert-id="remaining"])'
      );
      const displayedAlertIds = new Set();
      visibleTagButtons.forEach((btn) => {
        const id = btn.getAttribute('data-alert-id');
        if (id && id !== 'remaining') {
          displayedAlertIds.add(id);
        }
      });

      // Find alerts that aren't displayed yet
      const availableAlerts = Array.from(this.currentAlerts.values()).filter((alert) => {
        const id = alert.alertId || '';
        return id && !displayedAlertIds.has(id);
      });

      // Add next alert(s) up to maxVisibleTags visible tags
      const visibleCount = visibleTagButtons.length;
      const alertsToAdd = Math.min(this.maxVisibleTags - visibleCount, availableAlerts.length);
      for (let i = 0; i < alertsToAdd; i++) {
        const alert = availableAlerts[i];
        if (alert) {
          const alertId = alert.alertId || 'alert-' + i;
          this.addSingleAlertToUI(alert, alertId);
        }
      }

      // Update remaining button
      this.updateRemainingButton();

      // Update alert count
      const newCount = this.currentAlerts ? this.currentAlerts.size : 0;
      this.updateAlertCount(newCount);

      // If no alerts remain, clear the display
      if (newCount === 0) {
        const bodyElement = qs('.dataminr-body');
        if (bodyElement) {
          bodyElement.innerHTML = '';
        }
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  }

  /**
   * Calculate alert counts by type
   * @private
   * @returns {Object} Object with counts for each alert type
   * @returns {number} returns.flash - Count of Flash alerts
   * @returns {number} returns.urgent - Count of Urgent alerts
   * @returns {number} returns.alert - Count of Alert alerts
   * @returns {number} returns.total - Total count of all alerts
   */
  calculateAlertCountsByType() {
    if (!this.currentAlerts || this.currentAlerts.size === 0) {
      return { flash: 0, urgent: 0, alert: 0, total: 0 };
    }

    const counts = { flash: 0, urgent: 0, alert: 0, total: 0 };
    
    this.currentAlerts.forEach((alert) => {
      const alertType = this.getAlertType(alert);
      const normalizedType = alertType.toLowerCase();
      
      if (normalizedType === 'flash') {
        counts.flash++;
      } else if (normalizedType === 'urgent') {
        counts.urgent++;
      } else {
        // Default to 'alert' for any other type or unknown types
        counts.alert++;
      }
      counts.total++;
    });

    return counts;
  }

  /**
   * Update alert counts in UI (by type: Flash, Urgent, Alert)
   * @private
   * @param {number} [count] - Optional total count (if not provided, calculates from currentAlerts)
   */
  updateAlertCount(count) {
    // Calculate counts by type
    const counts = this.calculateAlertCountsByType();
    const totalCount = count !== undefined ? count : counts.total;

    // Update Flash count
    const flashIcon = document.querySelector('.dataminr-alert-icon-flash');
    if (flashIcon) {
      flashIcon.textContent = counts.flash.toString();
      flashIcon.style.display = counts.flash > 0 ? 'inline-block' : 'none';
    }

    // Update Urgent count
    const urgentIcon = document.querySelector('.dataminr-alert-icon-urgent');
    if (urgentIcon) {
      urgentIcon.textContent = counts.urgent.toString();
      urgentIcon.style.display = counts.urgent > 0 ? 'inline-block' : 'none';
    }

    // Update Alert count
    const alertIcon = document.querySelector('.dataminr-alert-icon-alert');
    if (alertIcon) {
      alertIcon.textContent = counts.alert.toString();
      alertIcon.style.display = counts.alert > 0 ? 'inline-block' : 'none';
    }

    // Show/hide clear button based on total alert count
    const clearButton = document.querySelector('.dataminr-clear-all-alerts-btn');
    if (clearButton) {
      clearButton.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }

    // Add visual indicator if there are alerts
    const container = byId('dataminr-container');
    if (container) {
      if (totalCount > 0) {
        container.classList.add('dataminr-has-alerts');
      } else {
        container.classList.remove('dataminr-has-alerts');
      }
    }
  }

  /**
   * Build HTML for alert detail header section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for alert header
   */
  buildAlertDetailHeader(alert) {
    const alertType = this.getAlertType(alert);
    const alertTimestamp = alert.alertTimestamp || '';
    const formattedTimestamp = formatTimestamp(alertTimestamp);
    const alertId = alert.alertId || '';
    const hasAIContent = alert.liveBrief || alert.intelAgents ? true : false;

    let html = '<div class="dataminr-alert-detail-header">';
    const detailTypeClass = this.normalizeAlertType(alertType);
    html += `<span class="dataminr-alert-detail-type dataminr-alert-detail-type-${detailTypeClass}">${htmlEscape(
      alertType
    )}</span>`;
    if (hasAIContent) {
      html += `<span class="dataminr-alert-ai-icon">
        <svg height="18" width="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 9L20.25 6.25L23 5L20.25 3.75L19 1L17.75 3.75L15 5L17.75 6.25L19 9ZM11.5 9.5L9 4L6.5 9.5L1 12L6.5 14.5L9 20L11.5 14.5L17 12L11.5 9.5ZM19 15L17.75 17.75L15 19L17.75 20.25L19 23L20.25 20.25L23 19L20.25 17.75L19 15Z" fill="currentColor"/>
        </svg>
      </span>`;
    }
    html += `<span class="dataminr-alert-detail-timestamp">${htmlEscape(
      formattedTimestamp
    )}</span>`;
    if (alert.dataminrAlertUrl) {
      html += `<span class="dataminr-alert-detail-url-icon">
      <a href="${htmlEscape(
        alert.dataminrAlertUrl
      )}" title="View alert in Dataminr" target="_blank">
      <svg height="18" width="18" viewBox="0 0 24 24" fill="none" class="sc-jsJBEP kwVdvg">
      <path d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z" fill="currentColor"></path>
      </svg>
      </a></span>`;
    }
    html += `<span class="dataminr-alert-close-icon" data-alert-close="true" data-alert-id="${htmlEscape(
      alertId
    )}">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_453_8834)">
        <path d="M21.4163 9.876L20.1238 8.5835L14.9997 13.7077L9.87551 8.5835L8.58301 9.876L13.7072 15.0002L8.58301 20.1243L9.87551 21.4168L14.9997 16.2927L20.1238 21.4168L21.4163 20.1243L16.2922 15.0002L21.4163 9.876Z" fill="#F5F6F9"/>
        </g>
        <defs>
        <clipPath id="clip0_453_8834">
        <rect width="22" height="22" fill="white" transform="translate(4 4)"/>
        </clipPath>
        </defs>
      </svg>
    </span>`;
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail location section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for location section
   */
  buildAlertDetailLocation(alert) {
    if (!alert.estimatedEventLocation || !alert.estimatedEventLocation.name) {
      return '';
    }

    return `<div class="dataminr-alert-detail-location">
      <span class="icon-location">
      <svg height="22" width="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="currentColor"></path>
      </svg>
      </span> <span class="dataminr-alert-detail-location-name">${htmlEscape(
        alert.estimatedEventLocation.name
      )}</span></div>`;
  }

  /**
   * Build HTML for alert detail subHeadline section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for subHeadline section
   */
  buildAlertDetailSubheadline(alert) {
    if (!alert.subHeadline || !alert.subHeadline.title) {
      return '';
    }

    let html = `
      <div class="dataminr-headline-card-section">
        <div class="dataminr-headline-card-section-header">
          <div>
            <span class="dataminr-headline-card-ods-header-copy">
              ${htmlEscape(alert.subHeadline.title)}
            </span>
          </div>
        </div>`;
    if (alert.subHeadline && alert.subHeadline.content) {
      html += `<div class="dataminr-message-card">
        <ul class="dataminr-message-card-bullets-list">
          ${alert.subHeadline.content
            .map((bullet) => `<li>${htmlEscape(bullet)}</li>`)
            .join('')}
        </ul>
        <div class="dataminr-message-card-tweet-heading">
          <div>
            <span class="dataminr-formatted-tweet" dir="auto">
              <span></span>
            </span>
          </div>
        </div>
      </div>
    `;
    }
    html += '</div>';
    return html;
  }

  /**
   * Process intel agents and group summaries by type
   * @private
   * @param {Array} intelAgents - Array of intel agent objects
   * @returns {Array} Array of objects with type and summaries
   */
  processIntelAgents(intelAgents) {
    const groupedSummaries = [];

    intelAgents.forEach((agent) => {
      if (agent.version === 'current' && agent.summary && agent.summary.length > 0) {
        const summariesByType = {};
        agent.summary.forEach((summaryItem) => {
          if (summaryItem.type && summaryItem.type.length > 0) {
            const type = summaryItem.type[0];
            if (!summariesByType[type]) {
              summariesByType[type] = [];
            }
            summariesByType[type].push(summaryItem);
          }
        });

        Object.keys(summariesByType).forEach((type) => {
          groupedSummaries.push({
            type: type,
            summaries: summariesByType[type]
          });
        });
      }
    });

    return groupedSummaries;
  }

  /**
   * Format type header text
   * @private
   * @param {string} type - Type string
   * @returns {string} Formatted type header
   */
  formatTypeHeader(type) {
    if (!type && typeof type !== 'string') {
      return '';
    }
    return type.toTitleCase() + ' context';
  }

  /**
   * Build HTML for alert detail intel agents section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for intel agents section
   */
  buildAlertDetailIntelAgents(alert) {
    if (!alert.intelAgents) {
      return '';
    }

    // Process intel agents once
    const groupedSummaries = this.processIntelAgents(alert.intelAgents);

    // Collect discoveredEntities from current version agents
    const discoveredEntities = [];
    alert.intelAgents.forEach((agent) => {
      if (
        agent.version === 'current' &&
        agent.discoveredEntities &&
        agent.discoveredEntities.length > 0
      ) {
        agent.discoveredEntities.forEach((entity) => {
          if (entity && entity.name) {
            discoveredEntities.push(entity);
          }
        });
      }
    });

    // Build text content for copying
    const copyTextParts = [];
    groupedSummaries.forEach((group) => {
      const typeHeader = this.formatTypeHeader(group.type);
      copyTextParts.push(typeHeader);

      group.summaries.forEach((summaryItem) => {
        const title = summaryItem.title || '';
        const contentArray = summaryItem.content || [];
        const contentText = contentArray.join(' ');

        if (title) {
          copyTextParts.push(title + (contentText ? ': ' + contentText : ''));
        } else if (contentText) {
          copyTextParts.push(contentText);
        }
      });
    });
    const copyText = copyTextParts.join('\n');

    let html = '<div class="dataminr-alert-intel-agents">';
    html += '<div class="dataminr-alert-intel-agents-header">';
    html += '<div class="dataminr-alert-intel-agents-header-left">';
    html += `<h3 class="dataminr-alert-intel-agents-header-title">
      <span class="dataminr-alert-intel-agents-header-icon">
      <svg height="22" width="22" viewBox="0 0 24 24" fill="none">
      <path d="M10.3096 4.33008L6.58984 6.02051L10.2695 7.69043L10.46 8.03027L11.3096 9.91016C11.0097 9.96014 10.72 10.0203 10.5801 10.2402C10.5701 10.26 10.5407 10.2894 10.54 10.29C10.45 10.46 10.3197 10.5804 10.1797 10.6904C10.1598 10.7102 10.1302 10.7302 10.1104 10.75C10.0204 10.9 9.90027 11.0104 9.78027 11.1104C9.73027 11.1504 9.65039 11.2305 9.65039 11.2305C9.46054 11.4003 9.35974 11.5498 9.34961 11.6797C9.32961 11.8197 9.44004 11.9601 9.54004 12.0801C9.64002 12.2001 9.74019 12.3303 9.7002 12.4902C9.67012 12.64 9.51002 12.6997 9.45996 12.7197L9.40039 12.7402L9.33984 12.7197C9.13002 12.6296 8.98991 12.3001 8.91992 11.9902C8.87995 11.8403 8.49049 11.8796 8.32031 11.8896H8.25C7.89011 11.8896 7.88034 12.03 7.86035 12.2998V12.3604C7.91047 12.7299 8.16042 12.6097 8.36035 12.5098C8.46011 12.4599 8.54984 12.4202 8.58984 12.46C8.6498 12.5299 8.67965 12.6299 8.67969 12.7598V12.7803C8.65982 12.9502 8.75042 13.1099 8.86035 13.2998C8.97035 13.4898 9.08984 13.7205 9.08984 13.9805C9.2598 13.7305 9.50988 13.5401 9.92969 13.54C10.0096 13.54 10.0898 13.5496 10.1797 13.5596C10.2697 13.5296 10.37 13.5205 10.46 13.5205C10.9699 13.5205 11.3104 13.9396 11.6104 14.3096C11.8603 14.6295 12.1 14.9297 12.4199 14.9697C12.4699 14.9597 12.5203 14.96 12.5703 14.96C12.8302 14.9601 13.0705 15.0902 13.2305 15.3301C13.4403 15.6301 13.5096 16.0805 13.3896 16.4404V16.4805L13.3604 16.5098C13.2504 16.6197 13.1203 16.6404 13.0303 16.6504H12.9805V16.6904C13.1601 17.2701 12.8696 17.6405 12.6396 17.9404C12.5198 18.1002 12.3996 18.2499 12.3496 18.4297C12.3196 18.8997 12.0198 19.2198 11.7598 19.5098C11.4398 19.8598 11.1603 20.1602 11.3203 20.7002V20.7998C11.3003 20.8598 11.3203 20.96 11.3203 20.96V20.9502C13.9602 20.6701 16.1903 19.0099 17.2803 16.71L18.29 18.9404C16.57 21.3903 13.7199 23 10.5 23C5.25 23 1 18.73 1 13.5C1.00001 8.27001 5.2202 4.03051 10.4502 4.02051L10.3096 4.33008ZM5.5 8.32031C5.34003 8.32031 5.05012 8.36002 4.87012 8.62988L4.84961 8.66016L4.82031 8.67969C4.78031 8.69969 4.74973 8.71973 4.71973 8.71973C3.64973 10.0097 3 11.68 3 13.5L2.99023 13.5205C2.99049 17.5203 6.12047 20.7898 10.0703 21.0098C9.96035 20.6698 9.92048 20.2796 9.98047 19.9297C9.64054 19.2598 9.66044 18.5402 9.69043 17.7803V17.6299C9.6604 17.37 9.43033 17.1699 9.19043 16.96C8.92043 16.72 8.63031 16.4698 8.57031 16.0898V15.6602C8.55031 15.3602 8.53031 14.9797 8.82031 14.7197C8.83032 14.6199 8.84994 14.51 8.87988 14.4102C8.83993 14.4401 8.79994 14.4502 8.75 14.4502C8.59 14.4502 8.19977 14.0398 8.00977 13.8398L7.83008 13.6602C7.75012 13.5002 7.62017 13.4897 7.40039 13.4697C7.18039 13.4497 6.86973 13.4301 6.71973 13.0801C6.59977 13.01 6.38018 12.7603 6.24023 12.6104C6.18263 12.5431 6.12463 12.485 6.12012 12.4805C5.86012 12.2605 5.52977 11.9798 5.50977 11.5898V11.5498C5.53974 11.3298 5.52976 11.0795 5.50977 10.8096C5.47978 10.3597 5.45048 9.90014 5.65039 9.53027V9.5L5.66992 9.48047C5.85992 9.30047 5.98023 9.03957 5.99023 8.80957C6.00013 8.64978 5.9602 8.49975 5.86035 8.37988C5.74035 8.33988 5.62 8.32031 5.5 8.32031ZM19.5898 12.4102L22 13.5L19.5898 14.5898L18.5 17L17.4102 14.5898L15 13.5L17.4102 12.4102L18.5 10L19.5898 12.4102ZM16.7197 6.32031C17.3397 6.85027 17.8799 7.45995 18.3398 8.12988L17.3203 10.3701C16.7403 9.11012 15.8102 8.02977 14.6602 7.25977L16.7197 6.32031ZM12.9404 5.05957L15 6L12.9404 6.94043L12 9L11.0596 6.94043L9 6L11.0596 5.05957L12 3L12.9404 5.05957ZM21.25 3.75L24 5L21.25 6.25L20 9L18.75 6.25L16 5L18.75 3.75L20 1L21.25 3.75Z" fill="currentColor"></path>
      </svg>
      </span>
      <span class="dataminr-alert-intel-agents-header-title-text">Intel agents</span></h3>`;
    html += '</div>';
    html += '<div class="dataminr-alert-intel-agents-actions">';
    html += '<div class="dataminr-alert-intel-agents-copy-container">';
    html +=
      '<button class="dataminr-alert-intel-agents-copy-btn" data-intel-agents-copy="true" data-intel-agents-text="' +
      htmlEscape(copyText) +
      '" aria-label="copy_intel_agents" title="Copy Intel Agents">';
    html += '<svg height="24" width="24" viewBox="0 0 24 24" fill="none">';
    html +=
      '<path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"></path>';
    html += '</svg>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="dataminr-alert-intel-agents-container">';

    // Display summaries grouped by type
    groupedSummaries.forEach((group) => {
      const typeHeader = this.formatTypeHeader(group.type);
      html += '<div class="dataminr-alert-intel-agents-type-group">';
      html += `<div class="dataminr-alert-intel-agents-type-header">${htmlEscape(
        typeHeader
      )}</div>`;
      html += '<ul class="dataminr-alert-intel-agents-summary-list">';

      group.summaries.forEach((summaryItem) => {
        const title = summaryItem.title || '';
        const contentArray = summaryItem.content || [];
        const contentText = contentArray.join(' ');

        html += '<li class="dataminr-alert-intel-agents-summary-item">';
        if (title) {
          html += `<strong>${htmlEscape(title)}</strong>`;
          if (contentText) {
            html += `: ${htmlEscape(contentText)}`;
          }
        } else if (contentText) {
          html += htmlEscape(contentText);
        }
        html += '</li>';
      });

      html += '</ul>';
      html += '</div>';
    });

    // Display discoveredEntities if any exist
    if (discoveredEntities.length > 0) {
      html += '<div class="dataminr-alert-intel-agents-discovered-entities">';
      html += `<div class="dataminr-alert-intel-agents-discovered-entities-header">Discovered Entities (${discoveredEntities.length})</div>`;
      html += '<div class="dataminr-alert-intel-agents-discovered-entities-list">';

      discoveredEntities.forEach((entity) => {
        html += '<span class="dataminr-alert-intel-agents-discovered-entity-item">';
        html += '<svg height="22" width="22" viewBox="0 0 24 24" fill="none">';
        html +=
          '<path d="M6.2625 18.0125C7.77083 20.0875 9.68333 21.4167 12 22C14.3167 21.4167 16.2292 20.0875 17.7375 18.0125C19.2458 15.9375 20 13.6333 20 11.1V5L12 2L4 5V11.1C4 13.6333 4.75417 15.9375 6.2625 18.0125ZM16.3 16.6C15.1667 18.25 13.7333 19.35 12 19.9C10.2667 19.35 8.83333 18.25 7.7 16.6C6.56667 14.95 6 13.1167 6 11.1V6.375L12 4.125L18 6.375V11.1C18 13.1167 17.4333 14.95 16.3 16.6ZM11 14V16H13V14H11ZM11 8V12H13V8H11Z" fill="currentColor"></path>';
        html += '</svg>';
        html += htmlEscape(entity.name || '');
        html += '</span>';
      });

      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail public post text section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for public post text section
   */
  buildAlertDetailPublicPostText(alert) {
    if (!alert.publicPost) {
      return '';
    }

    // Display post text if available
    let html = '<div class="dataminr-public-post-text">';

    if (alert.publicPost.text) {
      // Escape HTML and preserve line breaks
      let escapedText = htmlEscape(alert.publicPost.text);
      // Replace newlines with <br> tags?
      // escapedText = escapedText.replace(/\n/g, '<br>');
      html += '<div class="dataminr-public-post-text-header">';
      html += 'Excerpt from Public Post:';
      html += '</div>';
      html += `<div class="dataminr-public-post-text-content">${escapedText}</div>`;
    }
    if (alert.publicPost.href) {
      html += `<button class="dataminr-public-post-link-btn" onclick="window.open('${htmlEscape(
        alert.publicPost.href
      )}', '_blank')" aria-label="View on Public Post" title="${htmlEscape(
        alert.publicPost.href
      )}">
        <span class="dataminr-public-post-link-text">View on Public Post</span>
        <svg height="22" width="22" viewBox="0 0 24 24" fill="none">
          <path d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z" fill="currentColor"></path>
        </svg>
      </button>`;
    }
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail public post media section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for public post media section
   */
  buildAlertDetailPublicPostMedia(alert) {
    if (!alert.publicPost) {
      return '';
    }

    let html = '<div class="dataminr-public-post-media">';

    if (alert.publicPost.media) {
      html += '<div class="dataminr-public-post-media-header">';
      html += '<h3 class="dataminr-public-post-media-header-title">Media</h3>';
      html += '</div>';

      // Group media by type
      const mediaByType = {};
      alert.publicPost.media.forEach((media) => {
        if (!mediaByType[media.type]) {
          mediaByType[media.type] = [];
        }
        mediaByType[media.type].push(media);
      });

      // Display each type group
      Object.keys(mediaByType).forEach((type) => {
        html += '<div class="dataminr-public-post-media-type-group">';
        const mediaCount = mediaByType[type].length;
        let typeHeader = type.toTitleCase();
        // Append count if more than 1 item
        if (mediaCount > 1) {
          typeHeader += 's (' + mediaCount + ')';
        }
        html += `<h4 class="dataminr-public-post-media-type-header">${htmlEscape(
          typeHeader
        )}</h4>`;
        html += '<div class="dataminr-public-post-media-container">';

        if (type === 'image' || type === 'photo') {
          const imageStyle = mediaCount > 1 ? `grid-template-columns: repeat(${mediaCount}, 1fr);` : "grid-template-columns: 1fr;";
          html += `<div class="dataminr-public-post-media-image-container" style="${imageStyle}">`;
        }

        mediaByType[type].forEach((media) => {
          if (media.type === 'image' || media.type === 'photo') {
            html += `<div class="dataminr-public-post-media-image-item">
            <img class="dataminr-image-modal-trigger" src="${htmlEscape(
              media.href
            )}" data-image-src="${htmlEscape(media.href)}" />
            </div>`;
          } else if (media.type === 'video') {
            html += `<video aria-label="Video player" controls controlslist="nodownload" style="width: 100%;" src="${htmlEscape(
              media.href
            )}" />`;
          } else if (media.type === 'audio') {
            html += `<audio aria-label="Audio player" controls controlslist="nodownload" style="width: 100%;" src="${htmlEscape(
              media.href
            )}" />`;
          }
        });

        if (type === 'image' || type === 'photo') {
          html += '</div>';
        }

        html += '</div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail live brief section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for live brief section
   */
  buildAlertDetailLiveBrief(alert) {
    const liveBriefsArray = alert.liveBrief;

    if (!liveBriefsArray || liveBriefsArray.length === 0) {
      return '';
    }

    // Build combined copy text from all liveBriefs
    const copyTextParts = [];
    liveBriefsArray.forEach(function (liveBrief) {
      if (liveBrief.version === 'current' && liveBrief.summary) {
        copyTextParts.push(liveBrief.summary);
      }
    });
    const combinedCopyText = copyTextParts.join('\n\n');

    let html = '<div class="dataminr-alert-live-brief">';
    // ReGenAI header
    html += '<div class="dataminr-alert-live-brief-regenai-header">';
    html += '<div class="dataminr-alert-live-brief-regenai-container">';
    html += '<div class="dataminr-alert-live-brief-regenai-left">';
    html += '<div class="dataminr-alert-live-brief-regenai-icon-container">';
    html += '<svg height="24" width="24" viewBox="0 0 24 24" fill="none">';
    html +=
      '<path d="M19 9L20.25 6.25L23 5L20.25 3.75L19 1L17.75 3.75L15 5L17.75 6.25L19 9ZM11.5 9.5L9 4L6.5 9.5L1 12L6.5 14.5L9 20L11.5 14.5L17 12L11.5 9.5ZM19 15L17.75 17.75L15 19L17.75 20.25L19 23L20.25 20.25L23 19L20.25 17.75L19 15Z" fill="currentColor"></path>';
    html += '</svg>';
    html += '</div>';
    html += '<div class="dataminr-alert-live-brief-regenai-label">';
    html += '<span>ReGenAI</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="dataminr-alert-live-brief-actions">';
    html += '<div class="dataminr-alert-live-brief-copy-container">';
    html +=
      '<button class="dataminr-alert-live-brief-copy-btn" data-live-brief-copy="true" data-live-brief-text="' +
      htmlEscape(combinedCopyText) +
      '" aria-label="copy_regenai_live_brief" title="Copy Live Brief">';
    html += '<svg height="24" width="24" viewBox="0 0 24 24" fill="none">';
    html +=
      '<path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"></path>';
    html += '</svg>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Display each live brief
    liveBriefsArray.forEach(function (liveBrief, index) {
      if (liveBrief.version !== 'current') {
        return;
      }
      const summary = liveBrief.summary || '';
      const timestamp = liveBrief.timestamp || '';
      const formattedTimestamp = timestamp ? formatTimestamp(timestamp) : '';
      const timestampText = formattedTimestamp
        ? 'Last updated ' + formattedTimestamp
        : '';

      // Live Brief content section
      html += '<div class="dataminr-alert-live-brief-content-section">';
      html += '<div class="dataminr-alert-live-brief-header-row">';
      html += '<div class="dataminr-alert-live-brief-title-row">';
      html += '<div class="dataminr-alert-live-brief-icon-wrapper">';
      html += '<svg height="24" width="24" viewBox="0 0 24 24" fill="none">';
      html +=
        '<path d="M7.41667 13.8333H10.7854L12.1146 12H7.41667V13.8333ZM7.41667 17.5H10V15.6666H7.41667V17.5ZM5.58333 21.1666C5.07917 21.1666 4.64757 20.9871 4.28854 20.6281C3.92951 20.2691 3.75 19.8375 3.75 19.3333V4.66665C3.75 4.16248 3.92951 3.73088 4.28854 3.37185C4.64757 3.01283 5.07917 2.83331 5.58333 2.83331H12.9167L18.4167 8.33331V11.4993L16.5833 10.4993V9.24998H12V4.66665H5.58333V19.3333H11.5L12.5 21.1666H5.58333Z" fill="currentColor"></path>';
      html +=
        '<path d="M20 15L20.625 13.625L22 13L20.625 12.375L20 11L19.375 12.375L18 13L19.375 13.625L20 15ZM16.25 15.25L15 12.5L13.75 15.25L11 16.5L13.75 17.75L15 20.5L16.25 17.75L19 16.5L16.25 15.25ZM20 18L19.375 19.375L18 20L19.375 20.625L20 22L20.625 20.625L22 20L20.625 19.375L20 18Z" fill="currentColor"></path>';
      html += '</svg>';
      html += '</div>';
      html +=
        '<span class="dataminr-alert-live-brief-title">Live Brief' +
        (liveBriefsArray.length > 1 ? ' ' + (index + 1) : '') +
        '</span>';
      html += '</div>';
      if (timestampText) {
        html +=
          '<span class="dataminr-alert-live-brief-timestamp">' +
          htmlEscape(timestampText) +
          '</span>';
      }
      html += '</div>';
      html += '<div class="dataminr-alert-live-brief-summary">';
      html += '<span>' + htmlEscape(summary) + '</span>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail linked alerts section
   * @private
   * @param {Object} alert - Alert object
   * @returns {Promise<string>} HTML string for linked alerts section
   */
  async buildAlertDetailLinkedAlerts(alert) {
    if (
      !alert.linkedAlerts ||
      !isArray(alert.linkedAlerts) ||
      alert.linkedAlerts.length === 0
    ) {
      return '';
    }

    // Fetch full alert details for each linked alert
    const linkedAlertPromises = alert.linkedAlerts.map((linkedAlertItem) => {
      if (linkedAlertItem.parentAlertId) {
        if (alert.alertId !== linkedAlertItem.parentAlertId) {
          return this.getAlertById(linkedAlertItem.parentAlertId);
        }
      }
      return Promise.resolve(null);
    });

    const linkedAlertsResults = await Promise.all(linkedAlertPromises);
    const linkedAlerts = linkedAlertsResults.filter((alert) => alert !== null);

    if (!linkedAlerts || linkedAlerts.length === 0) {
      return '';
    }

    // Sort alerts by timestamp (most recent first)
    linkedAlerts.sort((a, b) => {
      const timeA = a.alertTimestamp ? new Date(a.alertTimestamp).getTime() : 0;
      const timeB = b.alertTimestamp ? new Date(b.alertTimestamp).getTime() : 0;
      return timeB - timeA;
    });

    let html = '<div class="dataminr-alert-linked-alerts">';
    html += '<div class="dataminr-alert-linked-alerts-header">';
    html += '<h3 class="dataminr-alert-linked-alerts-header-title">Event Timeline</h3>';
    html += '</div>';
    html += '<div class="dataminr-alert-linked-alerts-timeline">';

    linkedAlerts.forEach((linkedAlert) => {
      const timestamp = linkedAlert.alertTimestamp
        ? formatTimestamp(linkedAlert.alertTimestamp)
        : '';
      const linkedAlertId = linkedAlert.alertId || '';

      const headline = linkedAlert.headline || 'No headline available';
      const alertType =
        linkedAlert.publicPost && linkedAlert.publicPost.channels
          ? linkedAlert.publicPost.channels[0]
          : '';

      // Get first image/photo from media if available
      let imageUrl = '';
      if (
        linkedAlert.publicPost &&
        linkedAlert.publicPost.media &&
        isArray(linkedAlert.publicPost.media)
      ) {
        const imageMedia = linkedAlert.publicPost.media.find((media) => {
          return media.type === 'image' || media.type === 'photo';
        });
        if (imageMedia && imageMedia.href) {
          imageUrl = imageMedia.href;
        }
      }

      const itemClass = linkedAlertId
        ? 'dataminr-alert-linked-alerts-item dataminr-alert-linked-alerts-item-clickable'
        : 'dataminr-alert-linked-alerts-item';
      const itemAttrs = linkedAlertId
        ? ` data-linked-alert-id="${htmlEscape(
            linkedAlertId
          )}" aria-label="View alert details" title="View alert details"`
        : '';
      html += `<div class="${itemClass}"${itemAttrs}>`;
      html += `<div class="dataminr-alert-linked-alerts-item-time-container">`;
      html += `<span class="dataminr-alert-linked-alerts-item-time">${htmlEscape(
        timestamp
      )}</span>`;
      html += '</div>';
      html += '<div class="dataminr-alert-linked-alerts-item-content">';
      if (imageUrl) {
        html += `<div class="dataminr-alert-linked-alerts-item-image-wrapper">`;
        html += `<img class="dataminr-alert-linked-alerts-item-image" src="${htmlEscape(
          imageUrl
        )}" alt="Alert media" />`;
        html += `</div>`;
      }
      html += `<span class="dataminr-alert-linked-alerts-item-headline">${htmlEscape(
        headline
      )}</span>`;

      if (alertType && typeof alertType === 'string') {
        html += `<div class="dataminr-alert-linked-alerts-item-type">${htmlEscape(
          alertType.toTitleCase()
        )}</div>`;
      }

      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail reference terms section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for reference terms section
   */
  buildAlertDetailReferenceTerms(alert) {
    if (!alert.alertReferenceTerms) {
      return '';
    }

    let html = '<div class="dataminr-alert-reference-terms">';
    html += '<div class="dataminr-alert-reference-terms-header">';
    html +=
      '<h3 class="dataminr-alert-reference-terms-header-title">Alert reference terms</h3>';
    html += '</div>';
    html += '<div class="dataminr-alert-reference-terms-container">';
    alert.alertReferenceTerms.forEach((term) => {
      html += `<div class="dataminr-alert-reference-term">${htmlEscape(term.text)}</div>`;
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail metadata section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for metadata section
   */
  buildAlertDetailMetadata(alert) {
    const metadata = getNested(alert, 'metadata.cyber');
    if (!metadata) {
      return '';
    }

    const hasMetadata =
      (metadata.threatActors && metadata.threatActors.length > 0) ||
      (metadata.URL && metadata.URL.length > 0) ||
      (metadata.addresses && metadata.addresses.length > 0) ||
      (metadata.asOrgs && metadata.asOrgs.length > 0) ||
      (metadata.hashValues && metadata.hashValues.length > 0) ||
      (metadata.malware && metadata.malware.length > 0);

    if (!hasMetadata) {
      return '';
    }

    let html = '<div class="dataminr-alert-metadata">';
    html += '<div class="dataminr-alert-metadata-header">';
    html += '<h3 class="dataminr-alert-metadata-header-title">Key Points</h3>';
    html += '</div>';
    html += '<div class="dataminr-alert-metadata-content">';

    // Threat Actors
    if (metadata.threatActors && metadata.threatActors.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">Threats:</span> ';
      const threatsText = metadata.threatActors
        .map(function (threatActor) {
          return htmlEscape(threatActor.name || '');
        })
        .join(', ');
      html += `<span class="dataminr-alert-metadata-value">${threatsText}</span>`;
      html += '</div>';
    }

    // URLs
    if (metadata.URL && metadata.URL.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">URLs:</span> ';
      const urlsText = metadata.URL.map(function (url) {
        return htmlEscape(url.name || '');
      }).join(', ');
      html += `<span class="dataminr-alert-metadata-value">${urlsText}</span>`;
      html += '</div>';
    }

    // Addresses
    if (metadata.addresses && metadata.addresses.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">Addresses:</span> ';
      const addressesText = metadata.addresses
        .map(function (address) {
          const ip = htmlEscape(address.ip || '');
          const port = address.port ? ':' + address.port : '';
          const version = address.version ? ' (' + htmlEscape(address.version) + ')' : '';
          return ip + port + version;
        })
        .join(', ');
      html += `<span class="dataminr-alert-metadata-value">${addressesText}</span>`;
      html += '</div>';
    }

    // AS Organizations
    if (metadata.asOrgs && metadata.asOrgs.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">AS Organizations:</span> ';
      const asOrgsText = metadata.asOrgs
        .map(function (asOrg) {
          const asn = htmlEscape(asOrg.asn || '');
          const asOrgName = asOrg.asOrg ? ' (' + htmlEscape(asOrg.asOrg) + ')' : '';
          return asn + asOrgName;
        })
        .join(', ');
      html += `<span class="dataminr-alert-metadata-value">${asOrgsText}</span>`;
      html += '</div>';
    }

    // Hash Values
    if (metadata.hashValues && metadata.hashValues.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">Hashes:</span> ';
      const hashesText = metadata.hashValues
        .map(function (hash) {
          const value = htmlEscape(hash.value || '');
          const type = hash.type ? ' (' + htmlEscape(hash.type) + ')' : '';
          return value + type;
        })
        .join(', ');
      html += `<span class="dataminr-alert-metadata-value">${hashesText}</span>`;
      html += '</div>';
    }

    // Malware
    if (metadata.malware && metadata.malware.length > 0) {
      html += '<div class="dataminr-alert-metadata-section">';
      html += '<span class="dataminr-alert-metadata-label">Malware:</span> ';
      const malwareText = metadata.malware
        .map(function (malware) {
          return htmlEscape(malware.name || '');
        })
        .join(', ');
      html += `<span class="dataminr-alert-metadata-value">${malwareText}</span>`;
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail topics section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for topics section
   */
  buildAlertDetailTopics(alert) {
    if (!alert.alertTopics || alert.alertTopics.length === 0) {
      return '';
    }

    const topicsText = alert.alertTopics
      .map((topic) => htmlEscape(topic.name))
      .join(' | ');
    let html = '<div class="dataminr-alert-topics">';
    html += '<span class="dataminr-alert-topics-label">Topics:</span> ';
    html += `<span class="dataminr-alert-topics-list">${topicsText}</span>`;
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail companies section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for companies section
   */
  buildAlertDetailCompanies(alert) {
    if (!alert.alertCompanies || alert.alertCompanies.length === 0) {
      return '';
    }

    const companiesText = alert.alertCompanies
      .map((company) => {
        const name = htmlEscape(company.name || '');
        const ticker = company.ticker ? htmlEscape(company.ticker) : '';
        return ticker ? name + ' (' + ticker + ')' : name;
      })
      .join(' | ');
    let html = '<div class="dataminr-alert-companies">';
    html += '<span class="dataminr-alert-companies-label">Companies:</span> ';
    html += `<span class="dataminr-alert-companies-list">${companiesText}</span>`;
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail sectors section
   * @private
   * @param {Object} alert - Alert object
   * @returns {string} HTML string for sectors section
   */
  buildAlertDetailSectors(alert) {
    if (!alert.alertSectors || alert.alertSectors.length === 0) {
      return '';
    }

    const sectorsText = alert.alertSectors
      .map((sector) => htmlEscape(sector.name))
      .join(' | ');
    let html = '<div class="dataminr-alert-sectors">';
    html += '<span class="dataminr-alert-sectors-label">Sectors:</span> ';
    html += `<span class="dataminr-alert-sectors-list">${sectorsText}</span>`;
    html += '</div>';
    return html;
  }

  /**
   * Build HTML for alert detail container
   * @private
   * @param {Object} alert - Alert object
   * @returns {Promise<string>} HTML string for alert details
   */
  async buildAlertDetailHtml(alert) {
    if (!alert) return '';

    const headline = this.getAlertHeadline(alert);

    let detailHtml = '<div class="dataminr-alert-detail-content">';
    detailHtml += this.buildAlertDetailHeader(alert);
    detailHtml += this.buildAlertDetailLocation(alert);
    detailHtml += this.buildAlertDetailLiveBrief(alert);
    detailHtml += `<h3 class="dataminr-alert-detail-headline">${htmlEscape(
      headline
    )}</h3>`;
    detailHtml += this.buildAlertDetailSubheadline(alert);
    detailHtml += this.buildAlertDetailPublicPostText(alert);
    detailHtml += this.buildAlertDetailIntelAgents(alert);
    detailHtml += this.buildAlertDetailPublicPostMedia(alert);
    detailHtml += this.buildAlertDetailMetadata(alert);

    // Build linked alerts section (async)
    const linkedAlertsHtml = await this.buildAlertDetailLinkedAlerts(alert);
    detailHtml += linkedAlertsHtml;

    detailHtml += this.buildAlertDetailReferenceTerms(alert);
    if (alert.alertCompanies || alert.alertSectors || alert.alertTopics) {
      detailHtml += '<hr />';
      detailHtml += this.buildAlertDetailCompanies(alert);
      detailHtml += this.buildAlertDetailSectors(alert);
      detailHtml += this.buildAlertDetailTopics(alert);
    }
    detailHtml += '</div>';
    return detailHtml;
  }

  /**
   * Update alerts display in UI
   * @private
   */
  async updateAlertsDisplay(alerts, showAll = false) {
    const bodyElement = document.querySelector('.dataminr-body');
    if (!bodyElement) return;

    // Convert alerts array to Map if needed
    if (Array.isArray(alerts)) {
      const alertsMap = new Map();
      alerts.forEach((alert) => {
        const alertId = alert.alertId || 'alert-' + alerts.indexOf(alert);
        alertsMap.set(alertId, alert);
      });
      this.currentAlerts = alertsMap;
    } else if (alerts instanceof Map) {
      this.currentAlerts = alerts;
    }

    // Update alert icon count
    this.updateAlertCount(this.currentAlerts ? this.currentAlerts.size : 0);

    if (!this.currentAlerts || this.currentAlerts.size === 0) {
      bodyElement.innerHTML = '';
      return;
    }

    // Convert Map to array for iteration
    const alertsArray = Array.from(this.currentAlerts.values());

    // Check if alerts list container exists
    let alertsListContainer = bodyElement.querySelector('.dataminr-alerts-list');

    // If container doesn't exist, build it from scratch
    if (!alertsListContainer || showAll) {
      // If there are more than maxVisibleTags alerts, show maxVisibleTags - 1 to leave room for "+ remaining" button
      // Otherwise, show all alerts
      const maxToShow = alertsArray.length > this.maxVisibleTags ? this.maxVisibleTags - 1 : this.maxVisibleTags;
      const alertsToShow = showAll ? alertsArray : alertsArray.slice(0, maxToShow);

      // Build alerts inner HTML - only process first maxToShow
      let alertsHtml = '<div class="dataminr-alerts-list">';
      alertsToShow.forEach((alert) => {
        const alertType = this.getAlertType(alert);
        const headline = this.getAlertHeadline(alert);
        const alertClass = 'dataminr-tag-' + this.normalizeAlertType(alertType);
        const alertId = alert.alertId || 'alert-' + alertsArray.indexOf(alert);

        alertsHtml += `
          <button class="dataminr-tag ${alertClass}" data-alert-id="${htmlEscape(
          alertId
        )}" title="${htmlEscape(headline)}">
            <div class="dataminr-alert-tag-text">
              <span class="dataminr-tag-acronym">${htmlEscape(
                this.userConfig.acronym
              )}</span> 
              <span class="dataminr-tag-headline">${htmlEscape(headline)}</span>
            </div>
          </button>
        `;
      });

      // If there are more than maxVisibleTags alerts, add a "+# remaining" item
      const remainingCount = alertsArray.length - maxToShow;
      const displayRemaining = showAll || remainingCount <= 0 ? 'none' : 'block';
      alertsHtml += `
        <button class="dataminr-tag dataminr-tag-alert" data-alert-id="remaining" title="Remaining alerts" style="display: ${displayRemaining}">
          <div class="dataminr-alert-tag-text">
            <span class="dataminr-tag-acronym">${htmlEscape(
              this.userConfig.acronym
            )}</span> 
            <span id="dataminr-remaining-count" class="dataminr-tag-headline">+${remainingCount}</span>
          </div>
        </button>
      `;
      alertsHtml += '</div>';

      // Ensure details container exists (details are built dynamically when shown)
      let dataminrDetailsContainer = byId('dataminr-details-container');
      const dataminrDetailsClass = window.polarity
        ? 'dataminr-alert-details polarity-x-client'
        : 'dataminr-alert-details';

      if (!dataminrDetailsContainer) {
        const listTopSentinel = byId('list-top-sentinel');
        if (listTopSentinel) {
          dataminrDetailsContainer = document.createElement('div');
          dataminrDetailsContainer.id = 'dataminr-details-container';
          dataminrDetailsContainer.className = `${this.integrationId}-integration`;
          const detailsContainer = document.createElement('div');
          detailsContainer.className = dataminrDetailsClass;
          dataminrDetailsContainer.appendChild(detailsContainer);
          listTopSentinel.parentNode.insertBefore(
            dataminrDetailsContainer,
            listTopSentinel
          );
        }
      } else {
        // Ensure details container div exists
        let detailsContainer = dataminrDetailsContainer.querySelector(
          '.dataminr-alert-details'
        );
        if (!detailsContainer) {
          detailsContainer = document.createElement('div');
          detailsContainer.className = dataminrDetailsClass;
          dataminrDetailsContainer.appendChild(detailsContainer);
        }
      }

      bodyElement.innerHTML = alertsHtml;
      alertsListContainer = bodyElement.querySelector('.dataminr-alerts-list');

      // Add click handlers for alert tag buttons to toggle active state and show details
      const alertTagButtons = bodyElement.querySelectorAll('.dataminr-tag');
      alertTagButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const alertId = button.getAttribute('data-alert-id');

          // Handle remaining button click - show all alerts
          if (alertId === 'remaining') {
            this.updateAlertsDisplay(Array.from(this.currentAlerts.values()), true);
            return;
          }

          this.handleAlertTagClick(alertId, button);
        });
      });

      // Add click handlers for close icons to mark single alert as read
      const closeIcons = qsa('.dataminr-alert-close-icon');
      closeIcons.forEach((closeIcon) => {
        closeIcon.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering tag button click
          const alertId = closeIcon.getAttribute('data-alert-id');
          if (alertId) {
            this.markAlertAsRead(alertId);
          }
        });
      });
    } else {
      // Container exists, check if we need to add more alerts
      const visibleTagButtons = qsa(
        '.dataminr-tag[data-alert-id]:not([data-alert-id="remaining"])',
        bodyElement
      );
      const displayedAlertIds = new Set();
      visibleTagButtons.forEach((btn) => {
        const id = btn.getAttribute('data-alert-id');
        if (id && id !== 'remaining') {
          displayedAlertIds.add(id);
        }
      });

      // Find alerts that aren't displayed yet
      const availableAlerts = alertsArray.filter((alert) => {
        const id = alert.alertId || '';
        return id && !displayedAlertIds.has(id);
      });

      // Add alerts up to maxVisibleTags visible tags total
      const visibleCount = visibleTagButtons.length;
      const alertsToAdd = Math.min(this.maxVisibleTags - visibleCount, availableAlerts.length);
      for (let i = 0; i < alertsToAdd; i++) {
        const alert = availableAlerts[i];
        if (alert) {
          const alertId = alert.alertId || 'alert-' + i;
          this.addSingleAlertToUI(alert, alertId);
        }
      }

      // Update the remaining button count
      this.updateRemainingButton();
    }
  }

  /**
   * Load and display alerts
   * @private
   */
  async loadAlerts() {
    // Check for count parameter in URL (for initial query)
    const countParam = this.getUrlParameter('alertCount');
    const count = countParam ? parseInt(countParam, 10) : null;
    const newAlerts = await this.getAlerts(count);

    // Merge new alerts into currentAlerts Map
    // Update existing alerts or add new ones
    newAlerts.forEach((newAlert) => {
      const alertId = newAlert.alertId || 'alert-' + newAlerts.indexOf(newAlert);
      this.currentAlerts.set(alertId, newAlert);
    });

    if (newAlerts.length > 0) {
      // Update the display with the merged alerts
      this.updateAlertsDisplay(Array.from(this.currentAlerts.values()));
    }
  }

  /**
   * Get URL parameter value by name
   * @private
   * @param {string} name - Parameter name
   * @returns {string|null} Parameter value or null if not found
   */
  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    const lowerName = name.toLowerCase();
    for (const [key, value] of urlParams.entries()) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }

  /**
   * Get a single alert by ID from the backend API
   * @private
   * @param {string} alertId - Alert ID to fetch
   * @returns {Promise<Object|null>} Resolves with alert object or null if not found
   */
  async getAlertById(alertId) {
    if (!alertId) {
      console.error('Alert ID is required');
      return null;
    }

    try {
      const response = await this.sendIntegrationMessage({
        action: 'getAlertById',
        alertId: alertId
      });

      if (response && response.alert) {
        return response.alert;
      }
      return null;
    } catch (error) {
      console.error('Error getting alert by ID:', error);
      return null;
    }
  }

  /**
   * Look up alert by ID from URL parameter and log to console
   * @private
   */
  async lookupAlertFromUrl() {
    const alertId = this.getUrlParameter('alert');
    if (!alertId) {
      return;
    }

    console.log('Looking up alert from URL parameter:', alertId);

    try {
      const alert = await this.getAlertById(alertId);

      if (alert) {
        console.log('Alert found from URL parameter:', alert);

        // Store alert in Map
        this.currentAlerts.set(alertId, alert);

        // Update alert count
        this.updateAlertCount(this.currentAlerts ? this.currentAlerts.size : 0);

        // Update the display with the updated alerts
        this.updateAlertsDisplay(Array.from(this.currentAlerts.values()));

        // Make the alert detail visible and active
        setTimeout(() => {
          // Find and activate the tag button for this alert
          const allTagButtons = qsa('.dataminr-tag[data-alert-id]');
          let tagButton = null;
          for (let i = 0; i < allTagButtons.length; i++) {
            const btn = allTagButtons[i];
            if (btn.getAttribute('data-alert-id') === alertId) {
              tagButton = btn;
              break;
            }
          }

          if (tagButton) {
            this.deactivateAllTagButtons();
            tagButton.classList.add('active');
          }

          this.hideAllDetails();
          this.showDetail(alertId);
        }, 100);
      } else {
        console.log('Alert not found with ID:', alertId);
      }
    } catch (error) {
      console.error('Error looking up alert from URL:', error);
    }
  }

  /**
   * Start polling for alerts
   * @private
   */
  startPolling() {
    // Poll immediately
    this.pollAlerts();
    this.loadAlerts();

    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      this.pollAlerts();
    }, this.pollIntervalMs);

    // Also reload full alerts every 30 seconds
    setInterval(() => {
      this.loadAlerts();
    }, 30000);
  }

  /**
   * Stop polling for alerts
   * @private
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Initialize the Dataminr integration
   * @private
   */
  async init() {
    const wpu = window.PolarityUtils;
    const currentUserService = wpu ? wpu.getEmberService('currentUser') : null;
    this.currentUser = currentUserService ? currentUserService.get('user') : null;

    if (this.userOptions.stickyAlerts) {
      await this.initPolarityPin();

      // Set up event delegation for copy buttons (works with dynamically created content)
      this.setupCopyButtonDelegation();

      // Wait a bit for the UI to be ready, then start polling
      setTimeout(() => {
        this.startPolling();
      }, 1000);
    }

    // Look up alert from URL parameter if present (fire and forget)
    this.lookupAlertFromUrl().catch(function (error) {
      console.error('Error in lookupAlertFromUrl:', error);
    });
  }

  /**
   * Show image modal
   * @private
   * @param {string} imageSrc - Source URL of the image to display
   */
  showImageModal(imageSrc) {
    // Create modal if it doesn't exist
    let modal = byId('dataminr-image-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dataminr-image-modal';
      modal.className = 'dataminr-image-modal';
      modal.innerHTML = `
        <div class="dataminr-image-modal-overlay"></div>
        <div class="dataminr-image-modal-content">
          <img class="dataminr-image-modal-image" src="" alt="Full size image" />
        </div>
      `;
      document.body.appendChild(modal);

      // Get elements and set inline styles for overlay and content to ensure visibility
      const overlay = modal.querySelector('.dataminr-image-modal-overlay');
      const content = modal.querySelector('.dataminr-image-modal-content');

      if (overlay) {
        overlay.style.cssText =
          'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.9); cursor: pointer;';
      }
      if (content) {
        content.style.cssText =
          'position: relative; max-width: 90%; max-height: 90%; z-index: 10001; display: flex; align-items: center; justify-content: center;';
      }

      // Add close handlers

      overlay.addEventListener('click', () => {
        this.hideImageModal();
      });

      // Close on Escape key
      const escapeHandler = (e) => {
        if (
          e.key === 'Escape' &&
          modal.classList.contains('dataminr-image-modal-active')
        ) {
          this.hideImageModal();
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }

    // Set image source and show modal
    const modalImage = modal.querySelector('.dataminr-image-modal-image');
    if (modalImage) {
      modalImage.src = imageSrc;
      modal.classList.add('dataminr-image-modal-active');
      // Ensure modal is visible with inline styles
      modal.style.cssText =
        'display: flex !important; align-items: center !important; justify-content: center !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 99999 !important;';
      document.body.style.overflow = 'hidden'; // Prevent body scroll
    } else {
      console.error('Modal image element not found');
    }
  }

  /**
   * Hide image modal
   * @private
   */
  hideImageModal() {
    const modal = byId('dataminr-image-modal');
    if (modal) {
      modal.classList.remove('dataminr-image-modal-active');
      modal.style.display = 'none';
      document.body.style.overflow = ''; // Restore body scroll
    }
  }

  /**
   * Set up event delegation for copy buttons and image modals
   * @private
   */
  setupCopyButtonDelegation() {
    // Use event delegation on document body to handle dynamically created buttons
    document.body.addEventListener('click', (e) => {
      // Handle live brief copy button
      if (e.target.closest('.dataminr-alert-live-brief-copy-btn')) {
        const button = e.target.closest('.dataminr-alert-live-brief-copy-btn');
        e.stopPropagation();
        const textToCopy = button.getAttribute('data-live-brief-text') || '';
        this.copyToClipboard(textToCopy, 'Live brief copied to clipboard');
        return;
      }

      // Handle intel agents copy button
      if (e.target.closest('.dataminr-alert-intel-agents-copy-btn')) {
        const button = e.target.closest('.dataminr-alert-intel-agents-copy-btn');
        e.stopPropagation();
        const textToCopy = button.getAttribute('data-intel-agents-text') || '';
        this.copyToClipboard(textToCopy, 'Intel agents copied to clipboard');
        return;
      }

      // Handle image modal trigger
      if (e.target.classList.contains('dataminr-image-modal-trigger')) {
        e.preventDefault();
        e.stopPropagation();
        const imageSrc = e.target.getAttribute('data-image-src') || e.target.src;
        if (imageSrc) {
          this.showImageModal(imageSrc);
        }
        return;
      }

      // Also handle clicks on images inside the trigger container
      const imageTrigger = e.target.closest('.dataminr-image-modal-trigger');
      if (imageTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const imageSrc = imageTrigger.getAttribute('data-image-src') || imageTrigger.src;
        if (imageSrc) {
          this.showImageModal(imageSrc);
        }
        return;
      }

      // Handle linked alert item click
      const linkedAlertItem = e.target.closest(
        '.dataminr-alert-linked-alerts-item-clickable'
      );
      if (linkedAlertItem) {
        e.preventDefault();
        e.stopPropagation();
        const linkedAlertId = linkedAlertItem.getAttribute('data-linked-alert-id');
        if (linkedAlertId) {
          // Get the alert from currentAlerts or fetch it
          const linkedAlert = this.currentAlerts.get(linkedAlertId);
          if (linkedAlert) {
            // Alert already in map, show it
            this.hideAllDetails();
            this.showDetail(linkedAlertId);
          } else {
            // Fetch the alert and then show it
            this.getAlertById(linkedAlertId).then((alert) => {
              if (alert) {
                // Store alert in map
                this.currentAlerts.set(linkedAlertId, alert);
                // Show the detail
                this.hideAllDetails();
                this.showDetail(linkedAlertId);
              }
            });
          }
        }
        return;
      }
    });
  }
}

/**
 * Initialize the Dataminr integration (called by onSettingsChange)
 * @param {Object} integration - The integration object
 * @param {Object} userConfig - User configuration object
 * @param {boolean} userConfig.subscribed - Whether user is subscribed to alerts
 * @param {Object} userOptions - User options object
 * @returns {void}
 */
function initDataminr(integration, userConfig, userOptions) {
  if (!userConfig.subscribed) return;

  if (!window.PolarityUtils) {
    window.PolarityUtils = new PolarityUtils();
  }

  if (!window.Dataminr) {
    window.Dataminr = new DataminrIntegration(integration, userConfig, userOptions);
  }
}

// onSettingsChange is called once when the integration loads and then
// anytime the settings are changed
onSettingsChange(initDataminr);
