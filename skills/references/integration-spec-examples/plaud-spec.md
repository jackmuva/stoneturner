# Auth Endpoints

## Authorization URL

`https://app.plaud.ai/platform/oauth?client_id=client_f5f4b7f1-ff22-4cbb-9278-69139c007d5f&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fplaud&response_type=code`

## Access Token

```
curl 'https://platform.plaud.ai/developer/api/oauth/third-party/access-token' \
                -H 'accept: application/json' \
                -H 'content-type: application/x-www-form-urlencoded' \
                -H 'Authorization: Basic {{base64(client_id:client_secret)}}' \
                --data-raw 'code={{code}}&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fplaud'
              
```

## Refresh Token

```
curl 'https://platform.plaud.ai/developer/api/oauth/third-party/access-token/refresh' \
                -H 'accept: application/json' \
                -H 'content-type: application/x-www-form-urlencoded' \
                --data-raw 'refresh_token={{refresh_token}}'
              
```

# Get Meeting Transcript Endpoints

## Get Meetings List

`GET https://platform.plaud.ai/developer/api/oauth/open/third-party/files/`

Get file list of current user, return file model list with pagination support.
### Headers
Authorization Required
Bearer token obtained from OAuth flow
Query Parameters
page: integer //Page number for pagination (default: 1)
page_size: integer //Number of items per page (default: 20)

### Response
```
{
  "type": "list",
  "data": [
    {
      "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "name": "Meeting Recording 2024-01-15",
      "created_at": "2024-01-15T10:05:55",
      "serial_number": "1705315555000",
      "start_at": "2024-01-15T10:04:27.052000",
      "duration": 83000
    },
    {
      "id": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7",
      "name": "Project Discussion",
      "created_at": "2024-01-15T09:29:55",
      "serial_number": "1a4d0eeb-0920-4721-b94f-8f87def9ff39",
      "start_at": "2024-01-15T09:29:52.547000",
      "duration": 151380
    }
  ],
  "page": 1,
  "page_size": 10
}
```

## Get Meeting Trnascript By ID
`https://platform.plaud.ai/developer/api/oauth/open/third-party/files/{file_id}`

### Headers
Authorization Required Bearer token obtained from OAuth flow

### Path Parameters
file_id string The unique identifier of the file

### Response
```
{
  "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "name": "Meeting Recording 2024-01-15",
  "created_at": "2024-01-15T10:05:55",
  "serial_number": "1705315555000",
  "start_at": "2024-01-15T10:04:27.052000",
  "duration": 83000,
  "presigned_url": null,
  "source_list": [
    {
      "data_id": "source_transaction:xxx:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "data_type": "transaction",
      "data_title": "",
      "data_content": "[{\"start_time\": 0, \"end_time\": 33740, \"content\": \"Example transcription content...\", \"speaker\": \"Speaker 1\"}]",
      "data_link": ""
    },
    {
      "data_id": "source_outline:xxx:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "data_type": "outline",
      "data_title": "",
      "data_content": "[{\"start_time\": 0, \"end_time\": 34600, \"topic\": \"Discussion Topic\"}]",
      "data_link": ""
    }
  ],
  "note_list": [
    {
      "data_id": "auto_sum:xxx:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "data_type": "auto_sum_note",
      "data_title": "Summary",
      "data_tab_name": "Summary",
      "data_content": "{\"ai_content\": \"AI generated summary...\", \"category\": \"Summary\", \"state\": 10}",
      "data_link": "",
      "data_error_code": 10
    }
  ]
}
```
