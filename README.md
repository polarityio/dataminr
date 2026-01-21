# Polarity - Dataminr Integration

Dataminr delivers the earliest warnings on high impact events and critical information far in advance of other sources.

The Polarity Dataminr integration allows Polarity to search Dataminr by all entities to get related Alerts.  The integration will return the 10 most recent related Alerts.

For more information on Dataminr, please visit [official website](https://www.dataminr.com/).

| <img src="./images/overlay.png" width=50%/> |
|---------------------------------------------|
| *Alerts Example*                            |

## Dataminr Integration Options
### Dataminr API URL
The base URL of the Dataminr API including the schema (i.e., https://)

### Client ID
Your Client ID Credential

### Client Secret
Your Client Secret Credential

### Max Concurrent Requests
Maximum number of concurrent requests to send to the Dataminr API at once. This setting helps prevent rate limit errors (HTTP 429).

**Default:** 5 requests

**Range:** 1-10 requests

**Note:** Dataminr's standard rate limit is 6 requests per 30 seconds. The default of 5 concurrent requests with a 5-second delay between batches ensures you stay well within this limit.

### Request Delay (milliseconds)
Delay in milliseconds between batches of concurrent requests. This setting works together with Max Concurrent Requests to respect API rate limits.

**Default:** 5000ms (5 seconds)

**Recommended:** 5000ms or higher

**Rate Limit Calculation:**
- With 5 concurrent requests and 5000ms (5 second) delay: ~6 requests per 10 seconds = well within 6 per 30 seconds
- With 6 concurrent requests and 5000ms delay: exactly 6 requests per 5 seconds = may approach limit under heavy load

**Important:** If you receive HTTP 429 errors (rate limit exceeded), increase the Request Delay or decrease Max Concurrent Requests.

## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
