const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

let templateCache = null;
let notificationTemplateCache = null;

/**
 * Load and compile the alert detail template
 * @returns {HandlebarsTemplateDelegate} Compiled template
 */
function loadTemplate() {
  if (templateCache) {
    return templateCache;
  }

  const templatePath = path.join(__dirname, '..', 'client', 'block.hbs');
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  templateCache = Handlebars.compile(templateSource);
  return templateCache;
}

/**
 * Load and compile the alert notification template
 * @returns {HandlebarsTemplateDelegate} Compiled template
 */
function loadNotificationTemplate() {
  if (notificationTemplateCache) {
    return notificationTemplateCache;
  }

  const templatePath = path.join(__dirname, '..', 'client', 'notifications.hbs');
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  notificationTemplateCache = Handlebars.compile(templateSource);
  return notificationTemplateCache;
}

/**
 * Register Handlebars helpers
 */
function registerHelpers() {
  // Helper to normalize alert type for CSS class
  Handlebars.registerHelper('normalizeAlertType', function (alertType) {
    if (!alertType || typeof alertType !== 'string') {
      return 'alert';
    }
    return alertType.toLowerCase().replace('update', '').trim();
  });

  // Helper to format timestamp
  Handlebars.registerHelper('formatTimestamp', function (timestamp) {
    if (!timestamp) return '';

    let date;
    if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
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
  });

  // Helper to convert string to title case
  Handlebars.registerHelper('toTitleCase', function (str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    let s = str.toLowerCase();
    return s.replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  });

  // Helper to format type header
  Handlebars.registerHelper('formatTypeHeader', function (type) {
    if (!type || typeof type !== 'string') {
      return '';
    }
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() + ' context';
  });

  // Helper to join array with property access
  Handlebars.registerHelper('join', function (array, separator, property) {
    if (!Array.isArray(array) || array.length === 0) {
      return '';
    }
    return array
      .map(function (item) {
        return property ? (item[property] || '') : item;
      })
      .filter(function (item) {
        return item !== '';
      })
      .join(separator || ', ');
  });

  // Helper to format addresses
  Handlebars.registerHelper('formatAddresses', function (addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return '';
    }
    return addresses
      .map(function (address) {
        const ip = address.ip || '';
        const port = address.port ? ':' + address.port : '';
        const version = address.version ? ' (' + address.version + ')' : '';
        return ip + port + version;
      })
      .join(', ');
  });

  // Helper to format AS organizations
  Handlebars.registerHelper('formatAsOrgs', function (asOrgs) {
    if (!Array.isArray(asOrgs) || asOrgs.length === 0) {
      return '';
    }
    return asOrgs
      .map(function (asOrg) {
        const asn = asOrg.asn || '';
        const asOrgName = asOrg.asOrg ? ' (' + asOrg.asOrg + ')' : '';
        return asn + asOrgName;
      })
      .join(', ');
  });

  // Helper to format hashes
  Handlebars.registerHelper('formatHashes', function (hashes) {
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return '';
    }
    return hashes
      .map(function (hash) {
        const value = hash.value || '';
        const type = hash.type ? ' (' + hash.type + ')' : '';
        return value + type;
      })
      .join(', ');
  });

  // Helper to format companies
  Handlebars.registerHelper('formatCompanies', function (companies) {
    if (!Array.isArray(companies) || companies.length === 0) {
      return '';
    }
    return companies
      .map(function (company) {
        const name = company.name || '';
        const ticker = company.ticker ? ' (' + company.ticker + ')' : '';
        return name + ticker;
      })
      .join(' | ');
  });

  // Helper to format sectors
  Handlebars.registerHelper('formatSectors', function (sectors) {
    if (!Array.isArray(sectors) || sectors.length === 0) {
      return '';
    }
    return sectors.map(function (sector) {
      return sector.name || '';
    }).join(' | ');
  });

  // Helper to format topics
  Handlebars.registerHelper('formatTopics', function (topics) {
    if (!Array.isArray(topics) || topics.length === 0) {
      return '';
    }
    return topics.map(function (topic) {
      return topic.name || '';
    }).join(' | ');
  });

  // Equality helper
  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  // Greater than helper
  Handlebars.registerHelper('gt', function (a, b) {
    return a > b;
  });

  // Logical OR helper - returns true if any argument is truthy
  Handlebars.registerHelper('or', function () {
    // Get all arguments except the last one (which is the options object)
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.some(function (arg) {
      return !!arg;
    });
  });
}

// Register helpers on module load
registerHelpers();

/**
 * Format timestamp helper function (used in preprocessing)
 * @param {string|number} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp
 */
function formatTimestampValue(timestamp) {
  if (!timestamp) return '';

  let date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return '';
  }

  if (isNaN(date.getTime())) {
    return '';
  }

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
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
 * Normalize alert type for CSS class
 * @param {string} alertType - Alert type name
 * @returns {string} Normalized alert type
 */
function normalizeAlertTypeValue(alertType) {
  if (!alertType || typeof alertType !== 'string') {
    return 'alert';
  }
  return alertType.toLowerCase().replace('update', '').trim();
}

/**
 * Convert string to title case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
function toTitleCaseValue(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  let s = str.toLowerCase();
  return s.replace(/\b\w/g, function (char) {
    return char.toUpperCase();
  });
}

/**
 * Format type header text
 * @param {string} type - Type string
 * @returns {string} Formatted type header
 */
function formatTypeHeaderValue(type) {
  if (!type || typeof type !== 'string') {
    return '';
  }
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() + ' context';
}

/**
 * Join array with property access
 * @param {Array} array - Array to join
 * @param {string} separator - Separator string
 * @param {string} property - Property name to access
 * @returns {string} Joined string
 */
function joinArray(array, separator, property) {
  if (!Array.isArray(array) || array.length === 0) {
    return '';
  }
  return array
    .map(function (item) {
      return property ? (item[property] || '') : item;
    })
    .filter(function (item) {
      return item !== '';
    })
    .join(separator || ', ');
}

/**
 * Format addresses array
 * @param {Array} addresses - Array of address objects
 * @returns {string} Formatted addresses string
 */
function formatAddressesValue(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return '';
  }
  return addresses
    .map(function (address) {
      const ip = address.ip || '';
      const port = address.port ? ':' + address.port : '';
      const version = address.version ? ' (' + address.version + ')' : '';
      return ip + port + version;
    })
    .join(', ');
}

/**
 * Format AS organizations array
 * @param {Array} asOrgs - Array of AS org objects
 * @returns {string} Formatted AS orgs string
 */
function formatAsOrgsValue(asOrgs) {
  if (!Array.isArray(asOrgs) || asOrgs.length === 0) {
    return '';
  }
  return asOrgs
    .map(function (asOrg) {
      const asn = asOrg.asn || '';
      const asOrgName = asOrg.asOrg ? ' (' + asOrg.asOrg + ')' : '';
      return asn + asOrgName;
    })
    .join(', ');
}

/**
 * Format hashes array
 * @param {Array} hashes - Array of hash objects
 * @returns {string} Formatted hashes string
 */
function formatHashesValue(hashes) {
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return '';
  }
  return hashes
    .map(function (hash) {
      const value = hash.value || '';
      const type = hash.type ? ' (' + hash.type + ')' : '';
      return value + type;
    })
    .join(', ');
}

/**
 * Format companies array
 * @param {Array} companies - Array of company objects
 * @returns {string} Formatted companies string
 */
function formatCompaniesValue(companies) {
  if (!Array.isArray(companies) || companies.length === 0) {
    return '';
  }
  return companies
    .map(function (company) {
      const name = company.name || '';
      const ticker = company.ticker ? ' (' + company.ticker + ')' : '';
      return name + ticker;
    })
    .join(' | ');
}

/**
 * Format sectors array
 * @param {Array} sectors - Array of sector objects
 * @returns {string} Formatted sectors string
 */
function formatSectorsValue(sectors) {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return '';
  }
  return sectors.map(function (sector) {
    return sector.name || '';
  }).join(' | ');
}

/**
 * Format topics array
 * @param {Array} topics - Array of topic objects
 * @returns {string} Formatted topics string
 */
function formatTopicsValue(topics) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return '';
  }
  return topics.map(function (topic) {
    return topic.name || '';
  }).join(' | ');
}

/**
 * Process alert data for template rendering (preprocesses all helper-dependent values)
 * @param {Object} alert - Alert object
 * @returns {Object} Processed alert data for template
 */
function processAlertData(alert) {
  if (!alert) {
    return null;
  }

  const alertTypeName = alert.alertType && alert.alertType.name ? alert.alertType.name : 'Alert';

  const processed = {
    alertId: alert.alertId || '',
    alertType: alertTypeName,
    alertTypeNormalized: normalizeAlertTypeValue(alertTypeName),
    alertTimestamp: alert.alertTimestamp || '',
    alertTimestampFormatted: formatTimestampValue(alert.alertTimestamp),
    headline: alert.headline || 'No headline available',
    dataminrAlertUrl: alert.dataminrAlertUrl || null,
    hasAIContent: !!(alert.liveBrief || alert.intelAgents),
    estimatedEventLocation: alert.estimatedEventLocation || null,
    subHeadline: alert.subHeadline || null,
    publicPost: alert.publicPost || null,
    alertReferenceTerms: alert.alertReferenceTerms || null,
    alertCompanies: alert.alertCompanies || null,
    alertCompaniesFormatted: alert.alertCompanies ? formatCompaniesValue(alert.alertCompanies) : '',
    alertSectors: alert.alertSectors || null,
    alertSectorsFormatted: alert.alertSectors ? formatSectorsValue(alert.alertSectors) : '',
    alertTopics: alert.alertTopics || null,
    alertTopicsFormatted: alert.alertTopics ? formatTopicsValue(alert.alertTopics) : '',
    metadata: null
  };

  // Process metadata
  if (alert.metadata && alert.metadata.cyber) {
    const metadata = alert.metadata.cyber;
    const hasMetadata =
      (metadata.threatActors && metadata.threatActors.length > 0) ||
      (metadata.URL && metadata.URL.length > 0) ||
      (metadata.addresses && metadata.addresses.length > 0) ||
      (metadata.asOrgs && metadata.asOrgs.length > 0) ||
      (metadata.hashValues && metadata.hashValues.length > 0) ||
      (metadata.malware && metadata.malware.length > 0);

    if (hasMetadata) {
      processed.metadata = {
        threatActors: metadata.threatActors || [],
        threatActorsFormatted: metadata.threatActors ? joinArray(metadata.threatActors, ', ', 'name') : '',
        URL: metadata.URL || [],
        URLFormatted: metadata.URL ? joinArray(metadata.URL, ', ', 'name') : '',
        addresses: metadata.addresses || [],
        addressesFormatted: metadata.addresses ? formatAddressesValue(metadata.addresses) : '',
        asOrgs: metadata.asOrgs || [],
        asOrgsFormatted: metadata.asOrgs ? formatAsOrgsValue(metadata.asOrgs) : '',
        hashValues: metadata.hashValues || [],
        hashValuesFormatted: metadata.hashValues ? formatHashesValue(metadata.hashValues) : '',
        malware: metadata.malware || [],
        malwareFormatted: metadata.malware ? joinArray(metadata.malware, ', ', 'name') : ''
      };
    }
  }

  // Process live brief
  if (alert.liveBrief && Array.isArray(alert.liveBrief)) {
    const liveBriefs = alert.liveBrief.filter(function (lb) {
      return lb.version === 'current';
    });

    if (liveBriefs.length > 0) {
      const hasMultipleLiveBriefs = liveBriefs.length > 1;
      processed.liveBrief = liveBriefs.map(function (lb, index) {
        const title = hasMultipleLiveBriefs ? 'Live Brief ' + index : 'Live Brief';
        return {
          version: lb.version,
          summary: lb.summary || '',
          timestamp: lb.timestamp || '',
          timestampFormatted: formatTimestampValue(lb.timestamp),
          title: title
        };
      });

      // Build copy text
      processed.liveBriefCopyText = liveBriefs
        .map(function (lb) {
          return lb.summary || '';
        })
        .filter(function (summary) {
          return summary !== '';
        })
        .join('\n\n');
    }
  }

  // Process intel agents
  if (alert.intelAgents && Array.isArray(alert.intelAgents)) {
    const groupedSummaries = [];
    const discoveredEntities = [];

    alert.intelAgents.forEach(function (agent) {
      if (agent.version === 'current' && agent.summary && agent.summary.length > 0) {
        const summariesByType = {};
        agent.summary.forEach(function (summaryItem) {
          if (summaryItem.type && summaryItem.type.length > 0) {
            const type = summaryItem.type[0];
            if (!summariesByType[type]) {
              summariesByType[type] = [];
            }
            summariesByType[type].push({
              type: type,
              title: summaryItem.title || '',
              content: summaryItem.content || [],
              contentText: Array.isArray(summaryItem.content)
                ? summaryItem.content.join(' ')
                : ''
            });
          }
        });

        Object.keys(summariesByType).forEach(function (type) {
          groupedSummaries.push({
            type: type,
            typeHeader: formatTypeHeaderValue(type),
            summaries: summariesByType[type]
          });
        });
      }

      if (
        agent.version === 'current' &&
        agent.discoveredEntities &&
        agent.discoveredEntities.length > 0
      ) {
        agent.discoveredEntities.forEach(function (entity) {
          if (entity && entity.name) {
            discoveredEntities.push({ name: entity.name });
          }
        });
      }
    });

    if (groupedSummaries.length > 0 || discoveredEntities.length > 0) {
      processed.intelAgentsGrouped = groupedSummaries;

      if (discoveredEntities.length > 0) {
        processed.discoveredEntities = discoveredEntities;
      }

      // Build copy text for intel agents
      const copyTextParts = [];
      groupedSummaries.forEach(function (group) {
        const typeHeader = group.type.charAt(0).toUpperCase() + group.type.slice(1).toLowerCase() + ' context';
        copyTextParts.push(typeHeader);

        group.summaries.forEach(function (summaryItem) {
          const title = summaryItem.title || '';
          const contentText = summaryItem.contentText || '';

          if (title) {
            copyTextParts.push(title + (contentText ? ': ' + contentText : ''));
          } else if (contentText) {
            copyTextParts.push(contentText);
          }
        });
      });
      processed.intelAgentsCopyText = copyTextParts.join('\n');
    }
  }

  // Process public post media
  if (alert.publicPost && alert.publicPost.media && Array.isArray(alert.publicPost.media)) {
    const mediaByType = {};
    alert.publicPost.media.forEach(function (media) {
      const type = media.type || 'unknown';
      if (!mediaByType[type]) {
        mediaByType[type] = [];
      }
      mediaByType[type].push(media);
    });

    processed.mediaByType = Object.keys(mediaByType).map(function (type) {
      const media = mediaByType[type];
      const mediaCount = media.length;
      let typeHeader = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      if (mediaCount > 1) {
        typeHeader += 's (' + mediaCount + ')';
      }

      let gridStyle = null;
      if (type === 'image' || type === 'photo') {
        gridStyle = mediaCount > 1
          ? 'grid-template-columns: repeat(' + mediaCount + ', 1fr);'
          : 'grid-template-columns: 1fr;';
      }

      let fullStyleAttribute = '';
      if (gridStyle) {
        fullStyleAttribute = ' style="' + gridStyle + '"';
      }

      return {
        type: type,
        typeHeader: typeHeader,
        media: media,
        gridStyle: gridStyle || '',
        styleAttribute: fullStyleAttribute
      };
    });
  }

  // Process linked alerts
  if (alert.linkedAlerts && Array.isArray(alert.linkedAlerts)) {
    processed.linkedAlerts = alert.linkedAlerts.map(function (linkedAlert) {
      const alertType =
        linkedAlert.publicPost && linkedAlert.publicPost.channels
          ? linkedAlert.publicPost.channels[0]
          : '';

      // Get first image/photo from media if available
      let imageUrl = '';
      if (
        linkedAlert.publicPost &&
        linkedAlert.publicPost.media &&
        Array.isArray(linkedAlert.publicPost.media)
      ) {
        const imageMedia = linkedAlert.publicPost.media.find(function (media) {
          return media.type === 'image' || media.type === 'photo';
        });
        if (imageMedia && imageMedia.href) {
          imageUrl = imageMedia.href;
        }
      }

      const hasAlertId = !!(linkedAlert.alertId);
      const className = hasAlertId
        ? 'dataminr-alert-linked-alerts-item dataminr-alert-linked-alerts-item-clickable'
        : 'dataminr-alert-linked-alerts-item';
      const dataAttributes = hasAlertId
        ? ' data-linked-alert-id="' + (linkedAlert.alertId || '') + '" aria-label="View alert details" title="View alert details"'
        : '';

      return {
        alertId: linkedAlert.alertId || '',
        alertTimestamp: linkedAlert.alertTimestamp || '',
        alertTimestampFormatted: formatTimestampValue(linkedAlert.alertTimestamp),
        headline: linkedAlert.headline || 'No headline available',
        alertType: alertType,
        alertTypeFormatted: toTitleCaseValue(alertType),
        imageUrl: imageUrl,
        className: className,
        dataAttributes: dataAttributes
      };
    });
  }

  return processed;
}

/**
 * Render alert detail template with alert data
 * @param {Object} alert - Alert object
 * @returns {string} Rendered HTML string
 */
function renderAlertDetail(alert) {
  const template = loadTemplate();
  const processedData = processAlertData(alert);

  if (!processedData) {
    return '';
  }

  // Format as {details: {alerts: [alert]}} to match block.hbs structure
  // Preprocess the container class name
  return template({ details: { alerts: [processedData] } });
}

/**
 * Render alert notification template (no data needed)
 * @returns {string} Rendered HTML string
 */
function renderAlertNotification() {
  const template = loadNotificationTemplate();
  return template({});
}

module.exports = {
  renderAlertDetail,
  renderAlertNotification,
  processAlertData
};

