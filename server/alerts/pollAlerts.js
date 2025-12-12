const {
  logging: { getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { getAlerts } = require('./getAlerts');
const { getPollingState, updatePollingState } = require('./stateManager');
const { processAlerts } = require('./alertProcessor');

/**
 * Poll the API for new alerts and process them
 * Uses timestamp-based filtering to get all alerts since last poll.
 * For first poll, fetches MAX_PAGE_SIZE (10) alerts. For subsequent polls, fetches all alerts
 * since lastPollTime by paginating through all pages.
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Resolves with polling result object
 * @returns {boolean} returns.success - Whether polling was successful
 * @returns {number} returns.alertsProcessed - Number of alerts processed
 * @returns {boolean} returns.hasMore - Whether there are more alerts to fetch
 * @returns {string} [returns.error] - Error message if polling failed
 */
const pollAlerts = async (options) => {
  const Logger = getLogger();

  try {
    Logger.debug('Starting Dataminr API poll');

    const state = getPollingState();
    const isFirstPoll = !state.lastPollTime;
    
    let totalAlertsProcessed = 0;
    let paginationCursor = null;
    let hasMore = false;
    const lastPollTimestamp = state.lastPollTime;

    // First poll: get 10 alerts to start
    // Subsequent polls: get all alerts since lastPollTime by paginating through all pages
    if (isFirstPoll) {
      Logger.debug('First poll: fetching 10 alerts');
      const { alerts, nextPage } = await getAlerts(options, null, 10, null);
      
      if (alerts.length > 0) {
        await processAlerts(alerts, options);
        totalAlertsProcessed = alerts.length;
      }
      
      hasMore = !!nextPage;
    } else {
      // Subsequent polls: fetch all alerts since lastPollTime
      // Since Dataminr returns alerts newest first, we paginate until we've gotten everything
      // We stop when a page returns 0 alerts after timestamp filtering (all alerts are older)
      Logger.debug(
        { lastPollTime: lastPollTimestamp },
        'Subsequent poll: fetching all alerts since last poll time'
      );

      let continuePaging = true;
      let pageCount = 0;
      const maxPages = 1000; // Safety limit to prevent infinite loops

      while (continuePaging && pageCount < maxPages) {
        pageCount++;
        
        // Fetch a page of alerts (getAlerts will filter by timestamp client-side)
        const { alerts, nextPage } = await getAlerts(
          options,
          paginationCursor,
          null, // No count limit - use timestamp filtering
          lastPollTimestamp
        );

        // Process alerts from this page
        if (alerts.length > 0) {
          await processAlerts(alerts, options);
          totalAlertsProcessed += alerts.length;
        }

        // Extract cursor from nextPage URL for next iteration
        // nextPage format: /v1/alerts?lists=12345&from=2wVWwq3bBSqy%2FtkFROaX2wUysoSh&pageSize=10
        paginationCursor = null;
        if (nextPage) {
          try {
            const urlParts = nextPage.split('?');
            if (urlParts.length > 1) {
              const urlParams = new URLSearchParams(urlParts[1]);
              paginationCursor = urlParams.get('from');
            }
          } catch (error) {
            Logger.warn({ error, nextPage }, 'Failed to parse nextPage URL for cursor');
          }
        }

        // Continue paging if:
        // 1. There's a nextPage AND
        // 2. We got alerts from this page (meaning there might be more newer alerts)
        // Stop if we got 0 alerts (all alerts on this page are older than lastPollTime)
        // Since alerts are sorted newest first, if a page has 0 matching alerts,
        // all subsequent pages will also be older
        continuePaging = !!nextPage && alerts.length > 0;
        
        Logger.debug(
          {
            page: pageCount,
            alertsThisPage: alerts.length,
            totalAlertsProcessed,
            hasNextPage: !!nextPage,
            continuePaging
          },
          'Processed page of alerts'
        );
      }

      if (pageCount >= maxPages) {
        Logger.warn(
          { pageCount, totalAlertsProcessed },
          'Reached max pages limit during polling - there may be more alerts'
        );
      }

      hasMore = continuePaging;
    }

    // Update polling state with current timestamp
    updatePollingState({
      lastPollTime: new Date().toISOString(),
      alertCount: totalAlertsProcessed,
      totalAlertsProcessed: state.totalAlertsProcessed + totalAlertsProcessed
    });

    Logger.debug(
      {
        isFirstPoll,
        totalAlertsProcessed,
        totalProcessed: state.totalAlertsProcessed + totalAlertsProcessed,
        hasMore
      },
      'Polling cycle completed'
    );

    return {
      success: true,
      alertsProcessed: totalAlertsProcessed,
      hasMore: hasMore
    };
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error(
      {
        formattedError: err,
        error
      },
      'Polling Dataminr API Failed'
    );

    // Don't throw - allow polling to continue on next interval
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = pollAlerts;
