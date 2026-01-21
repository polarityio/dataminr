# Polarity - Dataminr Pulse Integration

Dataminr delivers the earliest warnings on high impact events and critical information far in advance of other sources.

The Polarity Dataminr Pulse integration allows Polarity to search Dataminr by all entities to get related Alerts.  The integration will return the 10 most recent related Alerts.  The integration also includes the ability to pin alerts to the top of Polarity for instant notification.

For more information on Dataminr, please visit [official website](https://www.dataminr.com/).

| <img src="./images/overlay.png" width=50%/> |
|---------------------------------------------|
| *Alerts Example*                            |

## Dataminr Integration Options
### Dataminr API URL
The base URL of the Dataminr API including the schema (i.e., https://)
- Default: `https://api.dataminr.com`
- Admin Only: Yes

### Client ID
Your Client ID Credential
- Admin Only: Yes

### Client Secret
Your Client Secret Credential
- Admin Only: Yes

### Pin Dataminr Alerts
Pin Dataminr Alerts to the top of the Polarity UI
- Default: `false`
- User Editable: Yes

### Filter Lists to Watch
Filter the lists to watch for alerts
- Default: `[]` (all lists)
- User Editable: Yes
- Multiple Selection: Yes

### Filter Alert Types
Filter the type of alert
- Default: [`flash`, `urgent`, `alert`]
- User Editable: Yes
- Multiple Selection: Yes

### Poll Interval
The interval in seconds for the server to poll for new Alerts
- Default: `60` seconds
- Minimum: `30` seconds
- Admin Only: Yes

### Max Requests Per 30 Seconds
Maximum number of requests allowed within any 30-second window (default: 6). This setting implements a sliding window rate limiter to prevent 429 (Too Many Requests) errors from the Dataminr API.

**How it works:**
- The integration tracks all API requests made in the last 30 seconds
- Before sending a new request, it checks if the limit has been reached
- If the limit would be exceeded, the integration automatically waits until the oldest request is more than 30 seconds old
- Allows bursting: you can send all 6 requests immediately if needed
- Example: If you send 6 requests at once, you must wait 30 seconds before the 7th request is sent

**Note:** This rate limiter is applied only to Dataminr API calls, not to authentication token requests. The recommended value is 6 to match Dataminr's default API rate limit.

## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
