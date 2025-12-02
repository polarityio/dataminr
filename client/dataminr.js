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
    this._settingsChangeCallbacks = new Map(); // Map name -> callback
    this._settingsChangeObserverInitialized = false;
    this._enterSettings = false;
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
   * Get the search data service
   * @returns {Object|null} The search data service instance or null if not found
   */
  getSearchData() {
    return this.getEmberService('search-data');
  }

  /**
   * Get the current user
   * @returns {Object|null} The current user or null if not found
   */
  getCurrentUser() {
    const currentUserService = this.getEmberService('currentUser');
    return currentUserService ? currentUserService.get('user') : null;
  }

  /**
   * Get the integrations
   * @returns {Object|null} The integrations or null if not found
   */
  getIntegrations() {
    const integrationLoader = this.getEmberService('integration-loader');
    return integrationLoader ? integrationLoader.get('integrations') : null;
  }

  /**
   * Get an integration by ID
   * @param {string} integrationId - ID of the integration to retrieve
   * @returns {Object|null} The integration or null if not found
   */
  getIntegrationById(integrationId) {
    const integrations = this.getIntegrations();
    return integrations ? integrations[integrationId] : null;
  }

  /**
   * Get the notification list
   * @returns {Array|null} The notification list or null if not found
   */
  getNotificationList() {
    const notificationsData = this.getEmberService('notificationsData');
    return notificationsData ? notificationsData.getNotificationList() : null;
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

  /**
   * Setup observer for settings window changes - hacky but more reliable for web/client than the global function
   * @param {Function} callback - Callback function to trigger on changes - enterSettings (true/false)
   * @param {string} name - Unique name identifier for this callback (prevents duplicates from same class)
   * @returns {void}
   */
  onSettingsChange(callback, name) {
    if (typeof callback !== 'function' || !name) {
      console.error(
        'Invalid callback or name provided to PolarityUtils.onSettingsChange'
      );
      return;
    }

    // Store the callback by name (will override if name already exists)
    this._settingsChangeCallbacks.set(name, callback);

    if (this._settingsChangeObserverInitialized) return;

    const markRemovedFlag = async (mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        // Detect removals - entering settings
        if (mutation.removedNodes && mutation.removedNodes.length > 0) {
          for (let r = 0; r < mutation.removedNodes.length; r++) {
            const removed = mutation.removedNodes[r];
            if (removed.nodeType === 1) {
              if (
                (removed.id && removed.id === 'notification-window') ||
                (removed.querySelector && removed.querySelector('#search-query'))
              ) {
                this._enterSettings = true;
                this._settingsChangeCallbacks.forEach((cb) => cb(this._enterSettings));
                return;
              }
            }
          }
        }

        // Detect additions - exiting settings
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (let a = 0; a < mutation.addedNodes.length; a++) {
            const added = mutation.addedNodes[a];
            if (added.nodeType === 1) {
              const isNotificationWindow =
                (added.id && added.id === 'notification-window') ||
                (added.querySelector && added.querySelector('#search-query'));
              if (isNotificationWindow && this._enterSettings) {
                this._enterSettings = false;
                this._settingsChangeCallbacks.forEach((cb) => cb(this._enterSettings));
                return;
              }
            }
          }
        }
      }
    };

    const attachObserverToContainer = (container) => {
      try {
        const observer = new MutationObserver(markRemovedFlag);
        observer.observe(container, { childList: true, subtree: true });
        this._settingsChangeObserverInitialized = true;
      } catch (e) {
        // Silently ignore observer errors
      }
    };

    const container = document.getElementsByClassName('liquid-container')[0];
    if (container) {
      attachObserverToContainer(container);
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
    this.integrationId = integration.type;
    this.userConfig = userConfig;
    this.userOptions = userOptions;
    this.pollingInterval = null;
    this.pollIntervalMs = 10000; // Poll Polarity server every 10 seconds
    this.currentUser = null;
    this.currentAlertCache = new Map(); // Map of alertId -> full alert object (# macCacheSize)
    this.currentAlertIds = new Map(); // Map of alertId -> { id, headline, type, alertTimestamp }
    this.maxCacheSize = 100;
    this.lastQueryTimestamp = null; // ISO timestamp of last query
    this.maxVisibleTags = 10; // Maximum number of visible alert tags to display
    this.currentFilter = null; // Current alert type filter: null (all), 'Flash', 'Urgent', or 'Alert'

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
   * Build a class name with polarity-x-client and dm-jewel-theme classes if applicable
   * @private
   * @param {string} baseClassName - The base class name
   * @returns {string} The complete class name with conditional classes added
   */
  buildClassName(baseClassName) {
    let className = baseClassName;

    if (window.polarity) {
      className += ' polarity-x-client';
    }

    const hasJewelTheme =
      document.body &&
      document.body.classList &&
      document.body.classList.contains('dm-jewel-theme');
    if (hasJewelTheme) {
      className += ' dm-jewel-theme';
    }

    return className;
  }

  /**
   * Initialize the Dataminr integration
   * @private
   */
  async initPolarityPin() {
    const notificationContainer = byId('notification-overlay-scroll-container');
    if (notificationContainer) {
      // Add pinned polarity container div before notificationContainer
      let pinnedPolarityContainer = byId('polarity-pin-container');
      if (!pinnedPolarityContainer) {
        pinnedPolarityContainer = document.createElement('div');
        pinnedPolarityContainer.id = 'polarity-pin-container';
      }

      // Add dataminr class div before dataminr container
      const dataminrIntegrationClass = document.createElement('div');
      dataminrIntegrationClass.className = `${this.integrationId}-integration`;
      const dataminrContainer = document.createElement('div');
      dataminrContainer.id = 'dataminr-container';
      dataminrContainer.className = this.buildClassName('dataminr-container');

      // Load notification HTML from backend template
      try {
        const result = await this.sendIntegrationMessage({
          action: 'renderAlertNotification'
        });

        dataminrContainer.innerHTML = result.html || '';
      } catch (error) {
        console.error('Error rendering alert notification template:', error);
        // Fallback to empty content if template rendering fails
        dataminrContainer.innerHTML =
          '<div class="dataminr-content"><div class="dataminr-header"><div class="dataminr-header-left"><span class="dataminr-notification-header-title">Dataminr Pulse</span></div></div><div class="dataminr-body"></div></div>';
      }
      dataminrIntegrationClass.appendChild(dataminrContainer);
      pinnedPolarityContainer.appendChild(dataminrIntegrationClass);
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

      // Set up event delegation for alert type filter buttons
      const alertIconsContainer = dataminrContainer.querySelector(
        '.dataminr-alert-icons-container'
      );
      if (alertIconsContainer) {
        alertIconsContainer.addEventListener('click', (e) => {
          const icon = e.target.closest('.dataminr-alert-icon');
          if (icon) {
            e.stopPropagation(); // Prevent header toggle
            // Don't allow filtering if count is 0 or icon is hidden
            if (icon.style.display === 'none' || parseInt(icon.textContent, 10) === 0) {
              return;
            }
            const alertType = icon.getAttribute('data-alert-type');
            if (alertType) {
              this.filterAlertsByType(alertType);
            }
          }
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
          this.processNewAlert(newAlert, true);
        });

        // Update the display with new alerts
        this.updateAlertsDisplay(Array.from(this.currentAlertIds.values()));
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

      // Add listIds if setListsToWatch is configured and not empty
      if (
        this.userOptions &&
        this.userOptions.setListsToWatch &&
        Array.isArray(this.userOptions.setListsToWatch) &&
        this.userOptions.setListsToWatch.length > 0
      ) {
        const listIds = this.userOptions.setListsToWatch
          .map((list) => list.value)
          .filter((id) => id && id !== '0');
        if (listIds.length > 0) {
          payload.listIds = listIds.join(',');
        }
      }

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

      const result = await this.sendIntegrationMessage(payload);
      let listsMatched = new Map();
      for (const alert of result.alerts) {
        for (const list of alert.listsMatched) {
          listsMatched.set(list.id, list.name);
        }
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
    // Clear the alerts maps
    if (this.currentAlertCache) {
      this.currentAlertCache.clear();
    }
    if (this.currentAlertIds) {
      this.currentAlertIds.clear();
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
        let alert = this.currentAlertCache.get(alertId);

        // If not in cache, fetch full alert data
        if (!alert) {
          try {
            alert = await this.getAlertById(alertId);
            if (alert) {
              this.processNewAlert(alert);
            }
          } catch (e) {
            console.error('Error fetching alert details:', e);
          }
        }

        if (!alert) {
          return;
        }

        // Get or create the details container
        let dataminrDetailsContainer = byId('dataminr-details-container');
        const dataminrDetailsClass = this.buildClassName('dataminr-alert-details');

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

        // Extract only the dataminr-alert-detail-content element to avoid extra containers from block.hbs
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = detailHtml;
        const contentElement = tempDiv.querySelector('.dataminr-alert-detail');
        detailContainer.innerHTML = contentElement
          ? contentElement.innerHTML
          : detailHtml;
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

    if (!this.currentAlertIds || this.currentAlertIds.size === 0) {
      if (remainingButton) {
        remainingButton.remove();
      }
      return;
    }

    const visibleCount = this.getVisibleTagButtonCount();
    const remainingCount = this.currentAlertIds.size - visibleCount;

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
            this.updateAlertsDisplay(Array.from(this.currentAlertIds.values()), true);
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
      // Remove alert from current alerts maps
      if (this.currentAlertCache) {
        this.currentAlertCache.delete(alertId);
      }
      if (this.currentAlertIds) {
        this.currentAlertIds.delete(alertId);
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
      const availableAlerts = Array.from(this.currentAlertIds.values()).filter(
        (alert) => {
          const id = alert.alertId || '';
          return id && !displayedAlertIds.has(id);
        }
      );

      // Add next alert(s) up to maxVisibleTags visible tags
      const visibleCount = visibleTagButtons.length;
      const alertsToAdd = Math.min(
        this.maxVisibleTags - visibleCount,
        availableAlerts.length
      );
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
      const newCount = this.currentAlertIds ? this.currentAlertIds.size : 0;
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
    if (!this.currentAlertIds || this.currentAlertIds.size === 0) {
      return { flash: 0, urgent: 0, alert: 0, total: 0 };
    }

    const counts = { flash: 0, urgent: 0, alert: 0, total: 0 };

    this.currentAlertIds.forEach((alert) => {
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
   * @param {number} [count] - Optional total count (if not provided, calculates from currentAlertIds)
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
      // Make it clickable and update opacity based on filter
      flashIcon.style.cursor = 'pointer';
      flashIcon.style.opacity =
        this.currentFilter === null || this.currentFilter === 'Flash' ? '1' : '0.5';
    }

    // Update Urgent count
    const urgentIcon = document.querySelector('.dataminr-alert-icon-urgent');
    if (urgentIcon) {
      urgentIcon.textContent = counts.urgent.toString();
      urgentIcon.style.display = counts.urgent > 0 ? 'inline-block' : 'none';
      // Make it clickable and update opacity based on filter
      urgentIcon.style.cursor = 'pointer';
      urgentIcon.style.opacity =
        this.currentFilter === null || this.currentFilter === 'Urgent' ? '1' : '0.5';
    }

    // Update Alert count
    const alertIcon = document.querySelector('.dataminr-alert-icon-alert');
    if (alertIcon) {
      alertIcon.textContent = counts.alert.toString();
      alertIcon.style.display = counts.alert > 0 ? 'inline-block' : 'none';
      // Make it clickable and update opacity based on filter
      alertIcon.style.cursor = 'pointer';
      alertIcon.style.opacity =
        this.currentFilter === null || this.currentFilter === 'Alert' ? '1' : '0.5';
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
   * Get the browser's timezone
   * @private
   * @returns {string|undefined} Timezone string (e.g., 'America/New_York') or undefined
   */
  getBrowserTimezone() {
    try {
      // Use Intl.DateTimeFormat().resolvedOptions() to get the IANA timezone name
      const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
      if (resolvedOptions && resolvedOptions.timeZone) {
        return resolvedOptions.timeZone;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting browser timezone:', error);
      return undefined;
    }
  }

  /**
   * Build HTML for alert detail container using backend template
   * @private
   * @param {Object} alert - Alert object
   * @returns {Promise<string>} HTML string for alert details
   */
  async buildAlertDetailHtml(alert) {
    if (!alert) return '';

    try {
      // Get browser timezone
      const timezone = this.getBrowserTimezone();

      // Request rendered HTML from backend
      const payload = {
        action: 'renderAlertDetail',
        alert: alert
      };

      // Add timezone to payload if available
      if (timezone) {
        payload.timezone = timezone;
      }

      const result = await this.sendIntegrationMessage(payload);
      return result.html || '';
    } catch (error) {
      console.error('Error rendering alert detail template:', error);
      // Fallback to empty string or error message
      return '<div class="dataminr-alert-detail-content"><p>Error loading alert details</p></div>';
    }
  }

  /**
   * Filter alerts by type and update display
   * @private
   * @param {string|null} alertType - Alert type to filter by ('Flash', 'Urgent', 'Alert'), or null for all
   */
  filterAlertsByType(alertType) {
    // Toggle filter: if clicking the same type, show all
    if (this.currentFilter === alertType) {
      this.currentFilter = null;
    } else {
      this.currentFilter = alertType;
    }

    // Update display with current alerts and filter
    this.updateAlertsDisplay(this.currentAlertIds, false);

    // Update button opacities
    this.updateAlertCount();
  }

  /**
   * Update alerts display in UI
   * @private
   * @param {Array|Map} alerts - Alerts to display
   * @param {boolean} showAll - Whether to show all alerts
   * @returns {Promise<void>}
   */
  async updateAlertsDisplay(alerts, showAll = false) {
    const bodyElement = document.querySelector('.dataminr-body');
    if (!bodyElement) return;

    // Convert alerts array to Map if needed
    let alertsMap;
    if (Array.isArray(alerts)) {
      alertsMap = new Map();
      alerts.forEach((alert) => {
        const alertId = alert.alertId || 'alert-' + alerts.indexOf(alert);
        alertsMap.set(alertId, alert);
      });
    } else if (alerts instanceof Map) {
      alertsMap = alerts;
    } else {
      return;
    }

    // Update alert icon count
    this.updateAlertCount(this.currentAlertIds ? this.currentAlertIds.size : 0);

    if (!alertsMap || alertsMap.size === 0) {
      bodyElement.innerHTML = '';
      return;
    }

    // Convert Map to array for iteration
    let alertsArray = Array.from(alertsMap.values());

    // Apply filter if one is active
    if (this.currentFilter) {
      alertsArray = alertsArray.filter((alert) => {
        const alertType = this.getAlertType(alert);
        return alertType === this.currentFilter;
      });
    }

    // Check if alerts list container exists
    let alertsListContainer = bodyElement.querySelector('.dataminr-alerts-list');

    // Always rebuild if filtering is active or container doesn't exist or showAll is true
    // This ensures filtered alerts are properly displayed
    if (!alertsListContainer || showAll || this.currentFilter !== null) {
      // Clear existing container if it exists
      if (alertsListContainer) {
        alertsListContainer.remove();
      }
      // If there are more than maxVisibleTags alerts, show maxVisibleTags - 1 to leave room for "+ remaining" button
      // Otherwise, show all alerts
      const maxToShow =
        alertsArray.length > this.maxVisibleTags
          ? this.maxVisibleTags - 1
          : this.maxVisibleTags;
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
      const dataminrDetailsClass = this.buildClassName('dataminr-alert-details');

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
            this.updateAlertsDisplay(Array.from(this.currentAlertIds.values()), true);
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
      const alertsToAdd = Math.min(
        this.maxVisibleTags - visibleCount,
        availableAlerts.length
      );
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
      this.processNewAlert(newAlert);
    });

    if (newAlerts.length > 0) {
      // Update the display with the merged alerts
      this.updateAlertsDisplay(Array.from(this.currentAlertIds.values()));
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

    try {
      const alert = await this.getAlertById(alertId);

      if (alert) {
        console.log(
          `Note: the API response for a single alert may not be cosnistant with the result returned from the alerts list.\nFor example, the listsMatched array is not included in the single alert response, but is included in the alerts list response like getAlerts().`
        );
        console.log('Looking up alert from URL parameter:', alertId, alert);

        // Store alert in Maps
        this.processNewAlert(alert);

        // Update alert count
        this.updateAlertCount(this.currentAlertIds ? this.currentAlertIds.size : 0);

        // Update the display with the updated alerts
        this.updateAlertsDisplay(Array.from(this.currentAlertIds.values()));

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
   * Update the configuration options for the Dataminr available lists
   * @private
   */
  async updateListsToWatch() {
    try {
      // Fetch lists from backend
      const response = await this.sendIntegrationMessage({
        action: 'getLists'
      });

      if (!response || !response.lists) {
        return [{ value: '0', display: 'All Lists' }];
      }

      // Filter out any lists without value or display (already in correct format from backend)
      const choices = response.lists.filter((list) => list.value && list.display);

      const integrationOptions = this.userConfig.integrationOptions;

      if (integrationOptions) {
        const opt = integrationOptions.findBy('key', 'setListsToWatch');
        if (opt) {
          Ember.set(opt, 'options', choices);
        }
      }
    } catch (error) {
      console.error('Error updating lists to watch:', error);
      return [{ value: '0', display: 'All Lists' }];
    }
  }

  /**
   * Initialize the Dataminr integration
   * @private
   */
  async init() {
    setTimeout(() => {
      // The user options seem to have a delayed update, so we need to check again
      if (this.userOptions !== this.integration['userOptions']) {
        this.userOptions = this.integration['userOptions'];
        this.init();
      }
    }, 1000);

    // Update lists to watch asynchronously
    this.updateListsToWatch().catch((error) => {
      console.error('Error updating lists to watch:', error);
    });

    const dataminrContainer = byId('dataminr-container');
    if (!dataminrContainer && this.userOptions && this.userOptions.stickyAlerts) {
      this.currentUser = window.PolarityUtils.getCurrentUser();
      await this.initPolarityPin();

      // Set up event delegation for copy buttons (works with dynamically created content)
      this.setupCopyButtonDelegation();

      // Wait a bit for the UI to be ready, then start polling
      setTimeout(() => {
        this.startPolling();
      }, 1000);

      // Look up alert from URL parameter if present (fire and forget)
      this.lookupAlertFromUrl().catch(function (error) {
        console.error('Error in lookupAlertFromUrl:', error);
      });
    } else if (this.userOptions && !this.userOptions.stickyAlerts) {
      if (dataminrContainer) {
        dataminrContainer.remove();
      }
      this.stopPolling();
    }
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
      const linkedAlertItem = e.target.closest('.dataminr-alert-linked-alerts-item');
      if (linkedAlertItem) {
        e.preventDefault();
        e.stopPropagation();
        const linkedAlertId = linkedAlertItem.getAttribute('data-linked-alert-id');
        if (linkedAlertId) {
          // Get the alert from currentAlertCache or fetch it
          const linkedAlert = this.currentAlertCache.get(linkedAlertId);
          if (linkedAlert) {
            // Alert already in cache, show it
            this.hideAllDetails();
            this.showDetail(linkedAlertId);
          } else {
            // Fetch the alert and then show it
            this.getAlertById(linkedAlertId).then((alert) => {
              if (alert) {
                // Store alert in maps
                this.processNewAlert(alert);
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

  /**
   * Process a new alert: add to cache and IDs map
   * @private
   * @param {Object} alert - Alert object
   */
  processNewAlert(alert, poll = false) {
    if (!alert) return;

    const alertId = alert.alertId;
    if (!alertId) return;

    // Keeping older alerts from poll (top of notifications)
    if (!poll || this.currentAlertCache.size < this.maxCacheSize) {
      // Add to full alert cache
      this.currentAlertCache.set(alertId, alert);

      // Enforce cache limit (remove oldest if > maxCacheSize)
      if (this.currentAlertCache.size > this.maxCacheSize) {
        const firstKey = this.currentAlertCache.keys().next().value;
        this.currentAlertCache.delete(firstKey);
      }
    }

    // Add to lightweight IDs map
    this.currentAlertIds.set(alertId, {
      alertId: alert.alertId,
      headline: alert.headline,
      alertType: alert.alertType,
      alertTimestamp: alert.alertTimestamp
    });
  }
}

/**
 * Initialize the Dataminr integration (called by onSettingsChange)
 * @param {Object} integration - The integration object
 * @param {Object} userConfig - User configuration object
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
    // Set up observer to re-init onSettingsChange
    window.PolarityUtils.onSettingsChange((enterSettings) => {
      if (!enterSettings) {
        window.Dataminr.init();
      }
    }, 'DataminrIntegration');
  }
}

// onSettingsChange is called once when the integration loads and then
// anytime the settings are changed (settings change is web-client only)
onSettingsChange(initDataminr);
