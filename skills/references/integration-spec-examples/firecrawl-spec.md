# Authentication

* API Key based, ask user to input API key from the frontend
* Store these in IntegrationCredential options - ask the user for:
    1. a list of URLs (separated by a comma) 
    2. a max depth to crawl 
    3. a max limit of pages to crawl

# Sync Markdown from URL Scrawl

For each URL

1. initiate a crawl
2. Check Crawl results on a 10 second poll until crawl status === "completed" or "failed"

## Initiate Crawl

```bash
curl --request POST \
  --url https://api.firecrawl.dev/v2/crawl \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '
{
  "url": "<string>",
  "maxDiscoveryDepth": 10,
  "limit": 10000,
}
'
```

Response: 

```
{
  "success": true,
  "id": "<string>",
  "url": "<string>"
}
```

## Check Crawl Results

```bash
curl --request GET \
  --url https://api.firecrawl.dev/v2/crawl/{id} \
  --header 'Authorization: Bearer <token>'
```

Response:

```
        status:
          type: string
          description: >-
            The current status of the crawl. Can be `scraping`, `completed`, or
            `failed`.
        total:
          type: integer
          description: The total number of pages that were attempted to be crawled.
        completed:
          type: integer
          description: The number of pages that have been successfully crawled.
        creditsUsed:
          type: integer
          description: The number of credits used for the crawl.
        expiresAt:
          type: string
          format: date-time
          description: The date and time when the crawl will expire.
        createdAt:
          type: string
          format: date-time
          description: The date and time when the crawl was started.
        completedAt:
          type: string
          format: date-time
          description: >-
            The date and time when the crawl finished. Present only when the
            crawl is in a terminal state (`completed`, `failed`, or
            `cancelled`).
        duration:
          type: number
          description: >-
            Crawl duration in seconds. For terminal crawls, this is the elapsed
            time from `createdAt` to `completedAt`. For in-progress crawls, it
            is the elapsed time from `createdAt` to now.
        next:
          type: string
          nullable: true
          description: >-
            The URL to retrieve the next 10MB of data. Returned if the crawl is
            not completed or if the response is larger than 10MB.
        data:
          type: array
          description: The data of the crawl.
          items:
            type: object
            properties:
              markdown:
                type: string
              html:
                type: string
                nullable: true
                description: HTML version of the content on page if `includeHtml`  is true
              rawHtml:
                type: string
                nullable: true
                description: Raw HTML content of the page if `includeRawHtml`  is true
              links:
                type: array
                items:
                  type: string
                description: List of links on the page if `includeLinks` is true
              screenshot:
                type: string
                nullable: true
                description: Screenshot of the page if `includeScreenshot` is true
              metadata:
                type: object
                properties:
                  title:
                    oneOf:
                      - type: string
                      - type: array
                        items:
                          type: string
                    description: >-
                      Title extracted from the page, can be a string or array of
                      strings
                  description:
                    oneOf:
                      - type: string
                      - type: array
                        items:
                          type: string
                    description: >-
                      Description extracted from the page, can be a string or
                      array of strings
                  language:
                    oneOf:
                      - type: string
                      - type: array
                        items:
                          type: string
                    nullable: true
                    description: >-
                      Language extracted from the page, can be a string or array
                      of strings
                  sourceURL:
                    type: string
                    format: uri
                    description: >-
                      The original URL that was requested. May differ from the
                      page's final URL if redirects occurred.
                  url:
                    type: string
                    format: uri
                    description: >-
                      The final URL of the page after all redirects have been
                      followed.
                  keywords:
                    oneOf:
                      - type: string
                      - type: array
                        items:
                          type: string
                    description: >-
                      Keywords extracted from the page, can be a string or array
                      of strings
                  ogLocaleAlternate:
                    type: array
                    items:
                      type: string
                    description: Alternative locales for the page
                  '<any other metadata> ':
                    type: string
                  statusCode:
                    type: integer
                    description: The status code of the page
                  error:
                    type: string
                    nullable: true
                    description: The error message of the page
                  concurrencyLimited:
                    type: boolean
                    description: >-
                      Whether this scrape was throttled due to team concurrency
                      limits
                  concurrencyQueueDurationMs:
                    type: number
                    description: >-
                      Time in milliseconds the request waited in the concurrency
                      queue. Only present when concurrencyLimited is true.
```
