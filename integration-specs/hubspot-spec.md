# HubSpot

Structured CRM integration — syncs contacts, companies, and deals into queryable SQLite tables. No parse or vector index steps (all source data is structured).

# Authentication

OAuth App — user authorizes via browser redirect.

Scopes: `oauth`, `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`

Store `BUN_PUBLIC_HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` as integration env vars.

# OAuth Endpoints

## Authorization URL

```
https://app.hubspot.com/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=oauth%20crm.objects.contacts.read%20crm.objects.companies.read%20crm.objects.deals.read
```

## Access Token Exchange

```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
client_id={client_id}
client_secret={client_secret}
code={code}
redirect_uri={redirect_uri}
```

Response:
```json
{
  "token_type": "bearer",
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 1800,
  "hub_id": 1234567,
  "scopes": ["oauth", "crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"]
}
```

## Refresh Token

```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
client_id={client_id}
client_secret={client_secret}
refresh_token={refresh_token}
```

HubSpot rotates refresh tokens — always persist the latest `refresh_token` from each response.

# Sync Data Sources

All requests use `Authorization: Bearer {access_token}`.

Base URL: `https://api.hubapi.com`

## Contacts

**Full sync** — cursor pagination, no filter:

```
GET /crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,company,jobtitle,lifecyclestage,createdate,lastmodifieddate&after={after}
```

**Incremental sync** — search API filtered by `lastmodifieddate`:

```
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [{
      "propertyName": "lastmodifieddate",
      "operator": "GTE",
      "value": "{unix_ms}"
    }]
  }],
  "sorts": [{ "propertyName": "lastmodifieddate", "direction": "ASCENDING" }],
  "properties": ["firstname", "lastname", "email", "phone", "company", "jobtitle", "lifecyclestage", "createdate", "lastmodifieddate"],
  "limit": 100,
  "after": "{after}"
}
```

**Storage:** `hubspotContact` table — one row per contact with key fields denormalized and full `properties` JSON.

## Companies

**Full sync:**

```
GET /crm/v3/objects/companies?limit=100&properties=name,domain,industry,phone,city,state,country,createdate,hs_lastmodifieddate&after={after}
```

**Incremental sync** — search API filtered by `hs_lastmodifieddate`:

```
POST /crm/v3/objects/companies/search
```

Same search body shape as contacts, but `propertyName` is `hs_lastmodifieddate` for filter and sort.

**Storage:** `hubspotCompany` table.

## Deals

**Full sync:**

```
GET /crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate&after={after}
```

**Incremental sync** — search API filtered by `hs_lastmodifieddate`:

```
POST /crm/v3/objects/deals/search
```

**Storage:** `hubspotDeal` table.

# Pipeline

```
sync-contacts + sync-companies + sync-deals (parallel) → agent-explore
```

No parse or index-vector steps — CRM records are structured and queried via SQL (`run_sql_query` MCP tool).

# Incremental sync notes

- Search API caps at 10,000 results per query. When a 400 is returned past the cap, restart the search from the latest saved `lastmodifieddate` / `hs_lastmodifieddate` watermark.
- Full sync uses the list endpoint (no 10k cap).
- `GTE` watermark filter may return the boundary record twice — upserts are idempotent on `hubspotId`.
