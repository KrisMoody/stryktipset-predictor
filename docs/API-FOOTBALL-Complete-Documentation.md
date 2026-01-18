# API-FOOTBALL Complete Documentation (v3.9.3)

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting & Response Headers](#rate-limiting--response-headers)
- [Common Response Format](#common-response-format)
- [HTTP Status Codes](#http-status-codes)
- [Entity Relationships](#entity-relationships)
- [Complete Endpoint Reference](#complete-endpoint-reference)
  - [Status](#status)
  - [Timezone](#timezone)
  - [Countries](#countries)
  - [Leagues](#leagues)
  - [Leagues Seasons](#leagues-seasons)
  - [Teams](#teams)
  - [Team Statistics](#team-statistics)
  - [Team Seasons](#team-seasons)
  - [Team Countries](#team-countries)
  - [Venues](#venues)
  - [Standings](#standings)
  - [Fixtures Rounds](#fixtures-rounds)
  - [Fixtures](#fixtures)
  - [Fixtures Head to Head](#fixtures-head-to-head)
  - [Fixtures Statistics](#fixtures-statistics)
  - [Fixtures Events](#fixtures-events)
  - [Fixtures Lineups](#fixtures-lineups)
  - [Fixtures Players](#fixtures-players)
  - [Injuries](#injuries)
  - [Predictions](#predictions)
  - [Coaches](#coaches)
  - [Players Seasons](#players-seasons)
  - [Players Profiles](#players-profiles)
  - [Players](#players)
  - [Players Squads](#players-squads)
  - [Players Teams](#players-teams)
  - [Players Top Scorers](#players-top-scorers)
  - [Players Top Assists](#players-top-assists)
  - [Players Top Yellow Cards](#players-top-yellow-cards)
  - [Players Top Red Cards](#players-top-red-cards)
  - [Transfers](#transfers)
  - [Trophies](#trophies)
  - [Sidelined](#sidelined)
  - [Odds Live](#odds-live)
  - [Odds Live Bets](#odds-live-bets)
  - [Odds](#odds)
  - [Odds Mapping](#odds-mapping)
  - [Odds Bookmakers](#odds-bookmakers)
  - [Odds Bets](#odds-bets)

---

## Overview

**Base URL:** `https://v3.football.api-sports.io/`

**Version:** 3.9.3

**Support:** https://dashboard.api-football.com

**Documentation:** https://www.api-football.com

API-Football provides comprehensive football (soccer) data including leagues, teams, players, fixtures, statistics, odds, and more from competitions worldwide.

---

## Authentication

All API requests require authentication using an API key passed in the request header.

### Header Required

```
x-apisports-key: YOUR_API_KEY
```

### Getting Your API Key

1. Register at https://dashboard.api-football.com
2. Generate your API key from the dashboard
3. Include the key in all requests

### Example Request

```bash
curl --request GET \
  --url 'https://v3.football.api-sports.io/leagues' \
  --header 'x-apisports-key: YOUR_API_KEY'
```

---

## Rate Limiting & Response Headers

### Rate Limits

API-Football implements rate limiting based on your subscription plan:
- Daily request quota
- Per-minute request limit

### Response Headers

Every API response includes:

| Header | Description |
|--------|-------------|
| `x-ratelimit-requests-limit` | Total daily requests allowed |
| `x-ratelimit-requests-remaining` | Remaining daily requests |
| `X-RateLimit-Limit` | Requests per minute limit |
| `X-RateLimit-Remaining` | Remaining requests this minute |

### Rate Limiting Policy

Exceeding rate limits may result in temporary or permanent API access suspension. Implement proper caching and request management to stay within limits.

---

## Common Response Format

All endpoints return data in the following JSON structure:

```json
{
  "get": "endpoint_name",
  "parameters": {
    "param1": "value1"
  },
  "errors": [],
  "results": 10,
  "paging": {
    "current": 1,
    "total": 5
  },
  "response": [
    // Array of response objects
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `get` | string | The endpoint that was called |
| `parameters` | object | Query parameters used in the request |
| `errors` | array | Array of error messages (empty if successful) |
| `results` | integer | Number of results returned |
| `paging` | object | Pagination information (if applicable) |
| `response` | array/object | The actual response data |

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 204 | No Content - No data available for the request |
| 499 | Time Out - Request timeout |
| 500 | Internal Server Error - Server error occurred |

---

## Entity Relationships

### Primary Entity Relationship Diagram

```mermaid
erDiagram
    COUNTRY ||--o{ LEAGUE : contains
    COUNTRY ||--o{ TEAM : based_in
    COUNTRY ||--o{ PLAYER : born_in
    
    LEAGUE ||--o{ SEASON : has
    LEAGUE ||--o{ TEAM : participates
    LEAGUE ||--o{ FIXTURE : schedules
    LEAGUE ||--o{ STANDING : maintains
    LEAGUE }o--|| COUNTRY : located_in
    
    SEASON ||--o{ FIXTURE : contains
    SEASON ||--o{ STANDING : tracks
    SEASON ||--o{ PLAYER_STATISTICS : records
    
    TEAM ||--o{ PLAYER : employs
    TEAM ||--o{ COACH : employs
    TEAM }o--|| VENUE : plays_at
    TEAM ||--o{ FIXTURE_HOME : hosts
    TEAM ||--o{ FIXTURE_AWAY : visits
    TEAM ||--o{ TEAM_STATISTICS : generates
    TEAM ||--o{ TRANSFER : involved_in
    
    FIXTURE ||--o{ FIXTURE_EVENT : contains
    FIXTURE ||--o{ FIXTURE_LINEUP : has
    FIXTURE ||--o{ FIXTURE_STATISTICS : produces
    FIXTURE ||--o{ FIXTURE_PLAYER_STATS : records
    FIXTURE ||--o{ INJURY : causes
    FIXTURE ||--|| PREDICTION : has
    FIXTURE ||--o{ ODDS : offers
    FIXTURE }o--|| LEAGUE : part_of
    FIXTURE }o--|| SEASON : in
    FIXTURE }o--|| VENUE : played_at
    FIXTURE }o--|| TEAM_HOME : home_team
    FIXTURE }o--|| TEAM_AWAY : away_team
    
    PLAYER ||--o{ PLAYER_STATISTICS : generates
    PLAYER ||--o{ INJURY : suffers
    PLAYER ||--o{ TRANSFER : participates
    PLAYER ||--o{ TROPHY : wins
    PLAYER ||--o{ SIDELINED : has
    PLAYER ||--o{ FIXTURE_PLAYER_STATS : performs_in
    PLAYER }o--|| TEAM : plays_for
    
    COACH ||--o{ TEAM : manages
    COACH ||--o{ TROPHY : wins
    COACH ||--o{ SIDELINED : has
    
    VENUE ||--o{ FIXTURE : hosts
    VENUE }o--|| COUNTRY : located_in
    
    STANDING }o--|| LEAGUE : for
    STANDING }o--|| SEASON : in
    STANDING }o--|| TEAM : ranks
    
    INJURY }o--|| PLAYER : affects
    INJURY }o--|| TEAM : impacts
    INJURY }o--|| FIXTURE : caused_in
    
    ODDS }o--|| FIXTURE : for
    ODDS }o--|| BOOKMAKER : provided_by
    ODDS }o--|| BET_TYPE : categorized_as
    
    PREDICTION }o--|| FIXTURE : for
    
    TRANSFER }o--|| PLAYER : involves
    TRANSFER }o--|| TEAM_FROM : from
    TRANSFER }o--|| TEAM_TO : to
```

---

## Complete Endpoint Reference

---

## Status

### Endpoint
```
GET /status
```

### Description
Get your account information and usage statistics. This endpoint does not count against your daily quota.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

### Query Parameters
None

### Response Structure

```json
{
  "get": "status",
  "parameters": [],
  "errors": [],
  "results": 1,
  "response": {
    "account": {
      "firstname": "string",
      "lastname": "string",
      "email": "string"
    },
    "subscription": {
      "plan": "string",
      "end": "datetime",
      "active": boolean
    },
    "requests": {
      "current": integer,
      "limit_day": integer
    }
  }
}
```

#### Response Object Fields

##### account
| Field | Type | Description |
|-------|------|-------------|
| `firstname` | string | Account holder's first name |
| `lastname` | string | Account holder's last name |
| `email` | string | Account email address |

##### subscription
| Field | Type | Description |
|-------|------|-------------|
| `plan` | string | Current subscription plan name |
| `end` | string (datetime) | Subscription end date (ISO 8601) |
| `active` | boolean | Subscription active status |

##### requests
| Field | Type | Description |
|-------|------|-------------|
| `current` | integer | Requests made today |
| `limit_day` | integer | Daily request limit |

### Update Frequency
Real-time

### Recommended Calls
As needed (does not count against quota)

### Example Response

```json
{
  "get": "status",
  "parameters": [],
  "errors": [],
  "results": 1,
  "response": {
    "account": {
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com"
    },
    "subscription": {
      "plan": "Free",
      "end": "2025-04-10T23:24:27+00:00",
      "active": true
    },
    "requests": {
      "current": 45,
      "limit_day": 100
    }
  }
}
```

---

## Timezone

### Endpoint
```
GET /timezone
```

### Description
Get the list of all available timezones to be used in the fixtures endpoint.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

### Query Parameters
None

### Response Structure

```json
{
  "get": "timezone",
  "parameters": [],
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    "string"
  ]
}
```

#### Response Array
Array of timezone strings (e.g., "Europe/London", "America/New_York", "Asia/Tokyo")

### Update Frequency
Static (not updated)

### Recommended Calls
Once when needed

### Example Response

```json
{
  "get": "timezone",
  "parameters": [],
  "errors": [],
  "results": 425,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    "Africa/Abidjan",
    "Africa/Accra",
    "Africa/Addis_Ababa",
    "Africa/Algiers",
    "Africa/Asmara",
    "Africa/Bamako",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Dubai"
  ]
}
```

---

## Countries

### Endpoint
```
GET /countries
```

### Description
Get the list of available countries for leagues, teams, and competitions.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | - | Search by country name |
| `code` | string | No | - | Filter by country code (2 or 3 letters) |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "countries",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "name": "string",
      "code": "string",
      "flag": "string (url)"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Country name |
| `code` | string | ISO country code (2-3 letters) |
| `flag` | string | URL to country flag image (SVG format) |

### Update Frequency
Rarely updated

### Recommended Calls
Once per week

### Example Response

```json
{
  "get": "countries",
  "parameters": {},
  "errors": [],
  "results": 163,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "name": "England",
      "code": "GB",
      "flag": "https://media.api-sports.io/flags/gb.svg"
    },
    {
      "name": "Spain",
      "code": "ES",
      "flag": "https://media.api-sports.io/flags/es.svg"
    },
    {
      "name": "Italy",
      "code": "IT",
      "flag": "https://media.api-sports.io/flags/it.svg"
    }
  ]
}
```

---

## Leagues

### Endpoint
```
GET /leagues
```

### Description
Get all available leagues and cups with detailed information including coverage data.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | League ID |
| `name` | string | No | - | League name |
| `country` | string | No | - | Country name |
| `code` | string | No | - | Country code (2 letters) |
| `season` | integer | No | - | Season year (YYYY format) |
| `team` | integer | No | - | Team ID |
| `type` | string | No | - | "league" or "cup" |
| `current` | boolean | No | - | "true" for current season leagues |
| `search` | string | No | - | Search term (minimum 3 characters) |
| `last` | integer | No | - | Number of last leagues added |

### Response Structure

```json
{
  "get": "leagues",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "league": {
        "id": integer,
        "name": "string",
        "type": "string",
        "logo": "string (url)"
      },
      "country": {
        "name": "string",
        "code": "string",
        "flag": "string (url)"
      },
      "seasons": [
        {
          "year": integer,
          "start": "string (date)",
          "end": "string (date)",
          "current": boolean,
          "coverage": {
            "fixtures": {
              "events": boolean,
              "lineups": boolean,
              "statistics_fixtures": boolean,
              "statistics_players": boolean
            },
            "standings": boolean,
            "players": boolean,
            "top_scorers": boolean,
            "top_assists": boolean,
            "top_cards": boolean,
            "injuries": boolean,
            "predictions": boolean,
            "odds": boolean
          }
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique league identifier |
| `name` | string | League name |
| `type` | string | "League" or "Cup" |
| `logo` | string | URL to league logo image |

##### country
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Country name |
| `code` | string | ISO country code |
| `flag` | string | URL to country flag |

##### seasons
Array of season objects containing:

| Field | Type | Description |
|-------|------|-------------|
| `year` | integer | Season year |
| `start` | string | Season start date (YYYY-MM-DD) |
| `end` | string | Season end date (YYYY-MM-DD) |
| `current` | boolean | Whether this is the current season |
| `coverage` | object | Data coverage information |

##### coverage.fixtures
| Field | Type | Description |
|-------|------|-------------|
| `events` | boolean | Match events available |
| `lineups` | boolean | Match lineups available |
| `statistics_fixtures` | boolean | Match statistics available |
| `statistics_players` | boolean | Player statistics available |

##### coverage (root level)
| Field | Type | Description |
|-------|------|-------------|
| `standings` | boolean | League standings available |
| `players` | boolean | Player data available |
| `top_scorers` | boolean | Top scorers data available |
| `top_assists` | boolean | Top assists data available |
| `top_cards` | boolean | Top cards data available |
| `injuries` | boolean | Injury data available |
| `predictions` | boolean | Match predictions available |
| `odds` | boolean | Betting odds available |

### Update Frequency
Daily

### Recommended Calls
Once per day

### Example Response

```json
{
  "get": "leagues",
  "parameters": {
    "id": "39"
  },
  "errors": [],
  "results": 1,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "league": {
        "id": 39,
        "name": "Premier League",
        "type": "League",
        "logo": "https://media.api-sports.io/football/leagues/39.png"
      },
      "country": {
        "name": "England",
        "code": "GB",
        "flag": "https://media.api-sports.io/flags/gb.svg"
      },
      "seasons": [
        {
          "year": 2024,
          "start": "2024-08-16",
          "end": "2025-05-25",
          "current": true,
          "coverage": {
            "fixtures": {
              "events": true,
              "lineups": true,
              "statistics_fixtures": true,
              "statistics_players": true
            },
            "standings": true,
            "players": true,
            "top_scorers": true,
            "top_assists": true,
            "top_cards": true,
            "injuries": true,
            "predictions": true,
            "odds": true
          }
        }
      ]
    }
  ]
}
```

---

## Leagues Seasons

### Endpoint
```
GET /leagues/seasons
```

### Description
Get all available seasons for leagues across all competitions.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

### Query Parameters
None

### Response Structure

```json
{
  "get": "leagues/seasons",
  "parameters": [],
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    integer
  ]
}
```

#### Response Array
Array of integers representing season years (YYYY format)

### Update Frequency
Once per year

### Recommended Calls
Once per month

### Example Response

```json
{
  "get": "leagues/seasons",
  "parameters": [],
  "errors": [],
  "results": 15,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    2010,
    2011,
    2012,
    2013,
    2014,
    2015,
    2016,
    2017,
    2018,
    2019,
    2020,
    2021,
    2022,
    2023,
    2024,
    2025
  ]
}
```

---

## Teams

### Endpoint
```
GET /teams
```

### Description
Get team information. Requires at least one of: id, name, league, or search parameters.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | Team ID |
| `name` | string | No | - | Team name |
| `league` | integer | Required* | - | League ID (*required if season provided) |
| `season` | integer | Required* | - | Season year (*required if league provided) |
| `country` | string | No | - | Country name |
| `code` | string | No | - | Team code (3 characters) |
| `venue` | integer | No | - | Venue ID |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "teams",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "code": "string",
        "country": "string",
        "founded": integer,
        "national": boolean,
        "logo": "string (url)"
      },
      "venue": {
        "id": integer,
        "name": "string",
        "address": "string",
        "city": "string",
        "capacity": integer,
        "surface": "string",
        "image": "string (url)"
      }
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique team identifier |
| `name` | string | Team name |
| `code` | string | Team code (3 letters) |
| `country` | string | Team's country |
| `founded` | integer | Year the team was founded |
| `national` | boolean | True if national team |
| `logo` | string | URL to team logo |

##### venue
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Venue ID |
| `name` | string | Venue name |
| `address` | string | Street address |
| `city` | string | City name |
| `capacity` | integer | Seating capacity |
| `surface` | string | Playing surface type (e.g., "grass") |
| `image` | string | URL to venue image |

### Update Frequency
Daily

### Recommended Calls
Once when needed

### Example Response

```json
{
  "get": "teams",
  "parameters": {
    "id": "33"
  },
  "errors": [],
  "results": 1,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": 33,
        "name": "Manchester United",
        "code": "MUN",
        "country": "England",
        "founded": 1878,
        "national": false,
        "logo": "https://media.api-sports.io/football/teams/33.png"
      },
      "venue": {
        "id": 556,
        "name": "Old Trafford",
        "address": "Sir Matt Busby Way",
        "city": "Manchester",
        "capacity": 76212,
        "surface": "grass",
        "image": "https://media.api-sports.io/football/venues/556.png"
      }
    }
  ]
}
```

---

## Team Statistics

### Endpoint
```
GET /teams/statistics
```

### Description
Get comprehensive statistics for a team in a specific league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |
| `team` | integer | Yes | - | Team ID |
| `date` | string | No | - | Specific date (YYYY-MM-DD) |

### Response Structure

```json
{
  "get": "teams/statistics",
  "parameters": {
    "league": "39",
    "team": "33",
    "season": "2024"
  },
  "errors": [],
  "results": 1,
  "response": {
    "league": {
      "id": integer,
      "name": "string",
      "country": "string",
      "logo": "string (url)",
      "flag": "string (url)",
      "season": integer
    },
    "team": {
      "id": integer,
      "name": "string",
      "logo": "string (url)"
    },
    "form": "string",
    "fixtures": {
      "played": {
        "home": integer,
        "away": integer,
        "total": integer
      },
      "wins": {
        "home": integer,
        "away": integer,
        "total": integer
      },
      "draws": {
        "home": integer,
        "away": integer,
        "total": integer
      },
      "loses": {
        "home": integer,
        "away": integer,
        "total": integer
      }
    },
    "goals": {
      "for": {
        "total": {
          "home": integer,
          "away": integer,
          "total": integer
        },
        "average": {
          "home": "string (decimal)",
          "away": "string (decimal)",
          "total": "string (decimal)"
        },
        "minute": {
          "0-15": {
            "total": integer,
            "percentage": "string"
          },
          "16-30": {
            "total": integer,
            "percentage": "string"
          },
          "31-45": {
            "total": integer,
            "percentage": "string"
          },
          "46-60": {
            "total": integer,
            "percentage": "string"
          },
          "61-75": {
            "total": integer,
            "percentage": "string"
          },
          "76-90": {
            "total": integer,
            "percentage": "string"
          },
          "91-105": {
            "total": integer,
            "percentage": "string"
          },
          "106-120": {
            "total": integer,
            "percentage": "string"
          }
        }
      },
      "against": {
        "total": {
          "home": integer,
          "away": integer,
          "total": integer
        },
        "average": {
          "home": "string (decimal)",
          "away": "string (decimal)",
          "total": "string (decimal)"
        },
        "minute": {
          "0-15": {
            "total": integer,
            "percentage": "string"
          }
        }
      }
    },
    "biggest": {
      "streak": {
        "wins": integer,
        "draws": integer,
        "loses": integer
      },
      "wins": {
        "home": "string (score)",
        "away": "string (score)"
      },
      "loses": {
        "home": "string (score)",
        "away": "string (score)"
      },
      "goals": {
        "for": {
          "home": integer,
          "away": integer
        },
        "against": {
          "home": integer,
          "away": integer
        }
      }
    },
    "clean_sheet": {
      "home": integer,
      "away": integer,
      "total": integer
    },
    "failed_to_score": {
      "home": integer,
      "away": integer,
      "total": integer
    },
    "penalty": {
      "scored": {
        "total": integer,
        "percentage": "string"
      },
      "missed": {
        "total": integer,
        "percentage": "string"
      },
      "total": integer
    },
    "lineups": [
      {
        "formation": "string",
        "played": integer
      }
    ],
    "cards": {
      "yellow": {
        "0-15": {
          "total": integer,
          "percentage": "string"
        }
      },
      "red": {
        "0-15": {
          "total": integer,
          "percentage": "string"
        }
      }
    }
  }
}
```

#### Response Object Fields

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `name` | string | League name |
| `country` | string | Country name |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |
| `season` | integer | Season year |

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### form
| Field | Type | Description |
|-------|------|-------------|
| `form` | string | Recent form (e.g., "WWDLW") |

##### fixtures
Contains played, wins, draws, loses with home/away/total breakdowns

| Field | Type | Description |
|-------|------|-------------|
| `played` | object | Games played statistics |
| `wins` | object | Games won statistics |
| `draws` | object | Games drawn statistics |
| `loses` | object | Games lost statistics |

Each contains:
- `home`: integer - Home statistics
- `away`: integer - Away statistics
- `total`: integer - Total statistics

##### goals.for / goals.against
| Field | Type | Description |
|-------|------|-------------|
| `total` | object | Total goals (home/away/total) |
| `average` | object | Average goals per game |
| `minute` | object | Goals by time period |

##### biggest
| Field | Type | Description |
|-------|------|-------------|
| `streak` | object | Longest streaks (wins/draws/loses) |
| `wins` | object | Biggest wins (home/away) |
| `loses` | object | Biggest losses (home/away) |
| `goals` | object | Most goals for/against |

##### clean_sheet
| Field | Type | Description |
|-------|------|-------------|
| `home` | integer | Clean sheets at home |
| `away` | integer | Clean sheets away |
| `total` | integer | Total clean sheets |

##### failed_to_score
| Field | Type | Description |
|-------|------|-------------|
| `home` | integer | Failed to score at home |
| `away` | integer | Failed to score away |
| `total` | integer | Total failed to score |

##### penalty
| Field | Type | Description |
|-------|------|-------------|
| `scored` | object | Penalties scored (total, percentage) |
| `missed` | object | Penalties missed (total, percentage) |
| `total` | integer | Total penalties |

##### lineups
Array of formation objects:
| Field | Type | Description |
|-------|------|-------------|
| `formation` | string | Formation (e.g., "4-3-3") |
| `played` | integer | Times played |

##### cards
Contains yellow and red cards by time period with total and percentage

### Update Frequency
After each fixture

### Recommended Calls
Once per day per team

### Example Response

```json
{
  "get": "teams/statistics",
  "parameters": {
    "league": "39",
    "team": "33",
    "season": "2024"
  },
  "errors": [],
  "results": 1,
  "response": {
    "league": {
      "id": 39,
      "name": "Premier League",
      "country": "England",
      "logo": "https://media.api-sports.io/football/leagues/39.png",
      "flag": "https://media.api-sports.io/flags/gb.svg",
      "season": 2024
    },
    "team": {
      "id": 33,
      "name": "Manchester United",
      "logo": "https://media.api-sports.io/football/teams/33.png"
    },
    "form": "DWLWW",
    "fixtures": {
      "played": {
        "home": 10,
        "away": 10,
        "total": 20
      },
      "wins": {
        "home": 6,
        "away": 4,
        "total": 10
      },
      "draws": {
        "home": 2,
        "away": 3,
        "total": 5
      },
      "loses": {
        "home": 2,
        "away": 3,
        "total": 5
      }
    },
    "goals": {
      "for": {
        "total": {
          "home": 25,
          "away": 18,
          "total": 43
        },
        "average": {
          "home": "2.5",
          "away": "1.8",
          "total": "2.2"
        }
      }
    }
  }
}
```

---

## Team Seasons

### Endpoint
```
GET /teams/seasons
```

### Description
Get all seasons for a specific team.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `team` | integer | Yes | - | Team ID |

### Response Structure

```json
{
  "get": "teams/seasons",
  "parameters": {
    "team": "33"
  },
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    integer
  ]
}
```

#### Response Array
Array of integers representing season years (YYYY format)

### Update Frequency
At end of season

### Recommended Calls
Once when needed

### Example Response

```json
{
  "get": "teams/seasons",
  "parameters": {
    "team": "33"
  },
  "errors": [],
  "results": 10,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    2015,
    2016,
    2017,
    2018,
    2019,
    2020,
    2021,
    2022,
    2023,
    2024
  ]
}
```

---

## Team Countries

### Endpoint
```
GET /teams/countries
```

### Description
Get all countries that have available teams in the API.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

### Query Parameters
None

### Response Structure

```json
{
  "get": "teams/countries",
  "parameters": [],
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "name": "string",
      "code": "string",
      "flag": "string (url)"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Country name |
| `code` | string | ISO country code |
| `flag` | string | URL to country flag |

### Update Frequency
Rarely updated

### Recommended Calls
Once per week

### Example Response

```json
{
  "get": "teams/countries",
  "parameters": [],
  "errors": [],
  "results": 150,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "name": "England",
      "code": "GB",
      "flag": "https://media.api-sports.io/flags/gb.svg"
    },
    {
      "name": "Spain",
      "code": "ES",
      "flag": "https://media.api-sports.io/flags/es.svg"
    }
  ]
}
```

---

## Venues

### Endpoint
```
GET /venues
```

### Description
Get venue (stadium) information.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | Venue ID |
| `name` | string | No | - | Venue name |
| `city` | string | No | - | City name |
| `country` | string | No | - | Country name |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "venues",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": integer,
      "name": "string",
      "address": "string",
      "city": "string",
      "country": "string",
      "capacity": integer,
      "surface": "string",
      "image": "string (url)"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique venue identifier |
| `name` | string | Venue name |
| `address` | string | Street address |
| `city` | string | City name |
| `country` | string | Country name |
| `capacity` | integer | Seating capacity |
| `surface` | string | Playing surface type (e.g., "grass", "artificial turf") |
| `image` | string | URL to venue image |

### Update Frequency
Rarely updated

### Recommended Calls
Once when needed

### Example Response

```json
{
  "get": "venues",
  "parameters": {
    "id": "556"
  },
  "errors": [],
  "results": 1,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": 556,
      "name": "Old Trafford",
      "address": "Sir Matt Busby Way",
      "city": "Manchester",
      "country": "England",
      "capacity": 76212,
      "surface": "grass",
      "image": "https://media.api-sports.io/football/venues/556.png"
    }
  ]
}
```

---

## Standings

### Endpoint
```
GET /standings
```

### Description
Get league standings and rankings for a specific season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `season` | integer | Yes | - | Season year (YYYY) |
| `league` | integer | No | - | League ID |
| `team` | integer | No | - | Team ID |

### Response Structure

```json
{
  "get": "standings",
  "parameters": {
    "league": "39",
    "season": "2024"
  },
  "errors": [],
  "results": 1,
  "response": [
    {
      "league": {
        "id": integer,
        "name": "string",
        "country": "string",
        "logo": "string (url)",
        "flag": "string (url)",
        "season": integer,
        "standings": [
          [
            {
              "rank": integer,
              "team": {
                "id": integer,
                "name": "string",
                "logo": "string (url)"
              },
              "points": integer,
              "goalsDiff": integer,
              "group": "string",
              "form": "string",
              "status": "string",
              "description": "string",
              "all": {
                "played": integer,
                "win": integer,
                "draw": integer,
                "lose": integer,
                "goals": {
                  "for": integer,
                  "against": integer
                }
              },
              "home": {
                "played": integer,
                "win": integer,
                "draw": integer,
                "lose": integer,
                "goals": {
                  "for": integer,
                  "against": integer
                }
              },
              "away": {
                "played": integer,
                "win": integer,
                "draw": integer,
                "lose": integer,
                "goals": {
                  "for": integer,
                  "against": integer
                }
              },
              "update": "string (datetime)"
            }
          ]
        ]
      }
    }
  ]
}
```

#### Response Object Fields

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `name` | string | League name |
| `country` | string | Country name |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |
| `season` | integer | Season year |
| `standings` | array | Array of standings groups |

##### standings (each entry)
| Field | Type | Description |
|-------|------|-------------|
| `rank` | integer | Current position |
| `team` | object | Team information (id, name, logo) |
| `points` | integer | Total points |
| `goalsDiff` | integer | Goal difference |
| `group` | string | Group name (for tournaments) |
| `form` | string | Recent form (e.g., "WWDLW") |
| `status` | string | Promotion/relegation status |
| `description` | string | Status description |
| `all` | object | Overall statistics |
| `home` | object | Home statistics |
| `away` | object | Away statistics |
| `update` | string | Last update timestamp |

##### all / home / away
| Field | Type | Description |
|-------|------|-------------|
| `played` | integer | Games played |
| `win` | integer | Games won |
| `draw` | integer | Games drawn |
| `lose` | integer | Games lost |
| `goals` | object | Goals for/against |

### Update Frequency
After each fixture

### Recommended Calls
Once per day

### Example Response

```json
{
  "get": "standings",
  "parameters": {
    "league": "39",
    "season": "2024"
  },
  "errors": [],
  "results": 1,
  "response": [
    {
      "league": {
        "id": 39,
        "name": "Premier League",
        "country": "England",
        "logo": "https://media.api-sports.io/football/leagues/39.png",
        "flag": "https://media.api-sports.io/flags/gb.svg",
        "season": 2024,
        "standings": [
          [
            {
              "rank": 1,
              "team": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png"
              },
              "points": 52,
              "goalsDiff": 28,
              "group": "Premier League",
              "form": "WWDWW",
              "status": "same",
              "description": "Promotion - Champions League (Group Stage: )",
              "all": {
                "played": 20,
                "win": 16,
                "draw": 4,
                "lose": 0,
                "goals": {
                  "for": 45,
                  "against": 17
                }
              },
              "home": {
                "played": 10,
                "win": 8,
                "draw": 2,
                "lose": 0,
                "goals": {
                  "for": 24,
                  "against": 8
                }
              },
              "away": {
                "played": 10,
                "win": 8,
                "draw": 2,
                "lose": 0,
                "goals": {
                  "for": 21,
                  "against": 9
                }
              },
              "update": "2024-12-15T00:00:00+00:00"
            }
          ]
        ]
      }
    }
  ]
}
```

---

## Fixtures Rounds

### Endpoint
```
GET /fixtures/rounds
```

### Description
Get all rounds for a league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |
| `current` | boolean | No | false | "true" to get only current round |
| `dates` | boolean | No | false | "true" to include round dates |

### Response Structure

```json
{
  "get": "fixtures/rounds",
  "parameters": {
    "league": "39",
    "season": "2024"
  },
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    "string"
  ]
}
```

#### Response Array
Array of round names (e.g., "Regular Season - 1", "Regular Season - 2")

When `dates=true`:
```json
{
  "response": [
    {
      "name": "string",
      "start": "string (date)",
      "end": "string (date)"
    }
  ]
}
```

### Update Frequency
Once per season (or when rounds are updated)

### Recommended Calls
Once per season

### Example Response

```json
{
  "get": "fixtures/rounds",
  "parameters": {
    "league": "39",
    "season": "2024"
  },
  "errors": [],
  "results": 38,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    "Regular Season - 1",
    "Regular Season - 2",
    "Regular Season - 3",
    "Regular Season - 4",
    "Regular Season - 5"
  ]
}
```

---

## Fixtures

### Endpoint
```
GET /fixtures
```

### Description
Get fixture information with comprehensive filtering options. This is the main endpoint for retrieving match data.

### Match Status Values

| Short | Long | In Play | Description |
|-------|------|---------|-------------|
| TBD | Time To Be Defined | No | Date/time not yet defined |
| NS | Not Started | No | Match not started |
| 1H | First Half, Kick Off | Yes | First half in progress |
| HT | Halftime | Yes | Halftime break |
| 2H | Second Half, 2nd Half Started | Yes | Second half in progress |
| ET | Extra Time | Yes | Extra time in progress |
| BT | Break Time | Yes | Break before extra time |
| P | Penalty In Progress | Yes | Penalties in progress |
| SUSP | Match Suspended | Yes | Match suspended |
| INT | Match Interrupted | Yes | Match interrupted |
| FT | Match Finished | No | Full time |
| AET | Match Finished After Extra Time | No | Finished after extra time |
| PEN | Match Finished After Penalty | No | Finished after penalties |
| PST | Match Postponed | No | Match postponed |
| CANC | Match Cancelled | No | Match cancelled |
| ABD | Match Abandoned | No | Match abandoned |
| AWA | Technical Loss | No | Walkover |
| WO | WalkOver | No | Victory by forfeit |
| LIVE | In Progress | Yes | Rare - progress without half/elapsed data |

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `id` | integer | No | - | - | The ID of the fixture |
| `ids` | string | No | - | Max 20 IDs | One or more fixture IDs (format: "id-id-id") |
| `live` | string | No | - | "all" or league IDs | All fixtures or specific league IDs in progress |
| `date` | string | No | - | YYYY-MM-DD | A valid date |
| `league` | integer | No | - | - | The ID of the league |
| `season` | integer | No | - | YYYY (4 chars) | The season year |
| `team` | integer | No | - | - | The ID of the team |
| `last` | integer | No | - | Max 99 | Last X fixtures |
| `next` | integer | No | - | Max 99 | Next X fixtures |
| `from` | string | No | - | YYYY-MM-DD | Start date |
| `to` | string | No | - | YYYY-MM-DD | End date |
| `round` | string | No | - | - | The round of the fixture |
| `status` | string | No | - | Valid status codes | One or more fixture status (format: "NS" or "NS-PST-FT") |
| `venue` | integer | No | - | - | The venue ID |
| `timezone` | string | No | UTC | Valid timezone | A valid timezone from /timezone endpoint |

### Response Structure

```json
{
  "get": "fixtures",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "fixture": {
        "id": integer,
        "referee": "string",
        "timezone": "string",
        "date": "string (datetime)",
        "timestamp": integer,
        "periods": {
          "first": integer,
          "second": integer
        },
        "venue": {
          "id": integer,
          "name": "string",
          "city": "string"
        },
        "status": {
          "long": "string",
          "short": "string",
          "elapsed": integer,
          "extra": integer
        }
      },
      "league": {
        "id": integer,
        "name": "string",
        "country": "string",
        "logo": "string (url)",
        "flag": "string (url)",
        "season": integer,
        "round": "string",
        "standings": boolean
      },
      "teams": {
        "home": {
          "id": integer,
          "name": "string",
          "logo": "string (url)",
          "winner": boolean
        },
        "away": {
          "id": integer,
          "name": "string",
          "logo": "string (url)",
          "winner": boolean
        }
      },
      "goals": {
        "home": integer,
        "away": integer
      },
      "score": {
        "halftime": {
          "home": integer,
          "away": integer
        },
        "fulltime": {
          "home": integer,
          "away": integer
        },
        "extratime": {
          "home": integer,
          "away": integer
        },
        "penalty": {
          "home": integer,
          "away": integer
        }
      }
    }
  ]
}
```

#### Response Object Fields

##### fixture
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique fixture identifier |
| `referee` | string | Match referee name |
| `timezone` | string | Timezone for the match |
| `date` | string | Match date and time (ISO 8601) |
| `timestamp` | integer | Unix timestamp |
| `periods` | object | Period timestamps |
| `venue` | object | Venue information |
| `status` | object | Match status |

##### fixture.periods
| Field | Type | Description |
|-------|------|-------------|
| `first` | integer | First half start timestamp |
| `second` | integer | Second half start timestamp |

##### fixture.venue
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Venue ID |
| `name` | string | Venue name |
| `city` | string | City name |

##### fixture.status
| Field | Type | Description |
|-------|------|-------------|
| `long` | string | Full status description |
| `short` | string | Abbreviated status code |
| `elapsed` | integer | Minutes elapsed |
| `extra` | integer | Extra time played in current half |

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `name` | string | League name |
| `country` | string | Country name |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |
| `season` | integer | Season year |
| `round` | string | Round name |
| `standings` | boolean | Whether league has standings |

##### teams.home / teams.away
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |
| `winner` | boolean | True if team won (null if draw/ongoing) |

##### goals
| Field | Type | Description |
|-------|------|-------------|
| `home` | integer | Home team goals |
| `away` | integer | Away team goals |

##### score
Contains halftime, fulltime, extratime, and penalty scores:
| Field | Type | Description |
|-------|------|-------------|
| `halftime` | object | Score at halftime |
| `fulltime` | object | Score at full time |
| `extratime` | object | Score after extra time |
| `penalty` | object | Penalty shootout score |

Each contains:
- `home`: integer - Home team score
- `away`: integer - Away team score

### Update Frequency
Updated every 15 seconds

### Recommended Calls
- Upcoming fixtures: 1 call per day
- Live fixtures: 1 call per minute
- Finished fixtures: Once after completion

### Example Response

```json
{
  "get": "fixtures",
  "parameters": {
    "live": "all"
  },
  "errors": [],
  "results": 4,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "fixture": {
        "id": 239625,
        "referee": "Michael Oliver",
        "timezone": "UTC",
        "date": "2024-02-06T14:00:00+00:00",
        "timestamp": 1580997600,
        "periods": {
          "first": 1580997600,
          "second": 1581001200
        },
        "venue": {
          "id": 556,
          "name": "Old Trafford",
          "city": "Manchester"
        },
        "status": {
          "long": "Halftime",
          "short": "HT",
          "elapsed": 45,
          "extra": 2
        }
      },
      "league": {
        "id": 39,
        "name": "Premier League",
        "country": "England",
        "logo": "https://media.api-sports.io/football/leagues/39.png",
        "flag": "https://media.api-sports.io/flags/gb.svg",
        "season": 2024,
        "round": "Regular Season - 14",
        "standings": true
      },
      "teams": {
        "home": {
          "id": 33,
          "name": "Manchester United",
          "logo": "https://media.api-sports.io/football/teams/33.png",
          "winner": false
        },
        "away": {
          "id": 34,
          "name": "Newcastle",
          "logo": "https://media.api-sports.io/football/teams/34.png",
          "winner": true
        }
      },
      "goals": {
        "home": 0,
        "away": 1
      },
      "score": {
        "halftime": {
          "home": 0,
          "away": 1
        },
        "fulltime": {
          "home": null,
          "away": null
        },
        "extratime": {
          "home": null,
          "away": null
        },
        "penalty": {
          "home": null,
          "away": null
        }
      }
    }
  ]
}
```

---

## Fixtures Head to Head

### Endpoint
```
GET /fixtures/headtohead
```

### Description
Get head-to-head matches between two teams.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `h2h` | string | Yes | - | Format: "ID-ID" | The IDs of the two teams (e.g., "33-34") |
| `date` | string | No | - | YYYY-MM-DD | A valid date |
| `league` | integer | No | - | - | League ID |
| `season` | integer | No | - | YYYY | Season year |
| `last` | integer | No | - | - | Last X fixtures |
| `next` | integer | No | - | - | Next X fixtures |
| `from` | string | No | - | YYYY-MM-DD | Start date |
| `to` | string | No | - | YYYY-MM-DD | End date |
| `status` | string | No | - | Valid status codes | One or more fixture status short codes |
| `venue` | integer | No | - | - | Venue ID |
| `timezone` | string | No | UTC | Valid timezone | Valid timezone from /timezone |

### Response Structure

Same as `/fixtures` endpoint - returns array of fixture objects.

### Update Frequency
Updated every 15 seconds

### Recommended Calls
- 1 call per minute for live matches
- 1 call per day otherwise

### Example Response

Same format as `/fixtures` endpoint.

---

## Fixtures Statistics

### Endpoint
```
GET /fixtures/statistics
```

### Description
Get detailed match statistics for a specific fixture.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | Yes | - | Fixture ID |
| `team` | integer | No | - | Team ID (for specific team stats) |
| `type` | string | No | - | Statistic type filter |
| `half` | string | No | - | "1" for first half, "2" for second half |

### Available Statistics

- Shots on Goal
- Shots off Goal
- Total Shots
- Blocked Shots
- Shots insidebox
- Shots outsidebox
- Fouls
- Corner Kicks
- Offsides
- Ball Possession
- Yellow Cards
- Red Cards
- Goalkeeper Saves
- Total passes
- Passes accurate
- Passes %

### Response Structure

```json
{
  "get": "fixtures/statistics",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "statistics": [
        {
          "type": "string",
          "value": "string/integer"
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### statistics
Array of statistic objects:
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Statistic name |
| `value` | mixed | Statistic value (integer, percentage string, or null) |

### Update Frequency
After fixture completion

### Recommended Calls
Once after fixture ends

### Example Response

```json
{
  "get": "fixtures/statistics",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": 33,
        "name": "Manchester United",
        "logo": "https://media.api-sports.io/football/teams/33.png"
      },
      "statistics": [
        {
          "type": "Shots on Goal",
          "value": 8
        },
        {
          "type": "Shots off Goal",
          "value": 5
        },
        {
          "type": "Total Shots",
          "value": 15
        },
        {
          "type": "Blocked Shots",
          "value": 2
        },
        {
          "type": "Shots insidebox",
          "value": 10
        },
        {
          "type": "Shots outsidebox",
          "value": 5
        },
        {
          "type": "Fouls",
          "value": 12
        },
        {
          "type": "Corner Kicks",
          "value": 7
        },
        {
          "type": "Offsides",
          "value": 2
        },
        {
          "type": "Ball Possession",
          "value": "58%"
        },
        {
          "type": "Yellow Cards",
          "value": 2
        },
        {
          "type": "Red Cards",
          "value": 0
        },
        {
          "type": "Goalkeeper Saves",
          "value": 4
        },
        {
          "type": "Total passes",
          "value": 520
        },
        {
          "type": "Passes accurate",
          "value": 456
        },
        {
          "type": "Passes %",
          "value": "88%"
        }
      ]
    }
  ]
}
```

---

## Fixtures Events

### Endpoint
```
GET /fixtures/events
```

### Description
Get all events from a fixture including goals, cards, substitutions, and VAR decisions.

### Event Types

**Goals:**
- Goal
- Own Goal
- Penalty
- Missed Penalty

**Cards:**
- Yellow Card
- Red Card

**Substitutions:**
- Subst (Substitution)

**VAR:**
- VAR - cancelled goal
- VAR - penalty
- VAR - goal confirmed
- VAR - card upgrade

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | Yes | - | Fixture ID |
| `team` | integer | No | - | Team ID filter |
| `player` | integer | No | - | Player ID filter |
| `type` | string | No | - | Event type filter |

### Response Structure

```json
{
  "get": "fixtures/events",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "time": {
        "elapsed": integer,
        "extra": integer
      },
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "player": {
        "id": integer,
        "name": "string"
      },
      "assist": {
        "id": integer,
        "name": "string"
      },
      "type": "string",
      "detail": "string",
      "comments": "string"
    }
  ]
}
```

#### Response Object Fields

##### time
| Field | Type | Description |
|-------|------|-------------|
| `elapsed` | integer | Minute when event occurred |
| `extra` | integer | Extra time (if applicable) |

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### player
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |

##### assist
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Assisting player ID |
| `name` | string | Assisting player name |

##### event
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Event type (Goal, Card, subst, VAR) |
| `detail` | string | Event detail (Normal Goal, Yellow Card, etc.) |
| `comments` | string | Additional comments |

### Update Frequency
Real-time during match

### Recommended Calls
1 call per minute during live matches

### Example Response

```json
{
  "get": "fixtures/events",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 8,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "time": {
        "elapsed": 12,
        "extra": null
      },
      "team": {
        "id": 33,
        "name": "Manchester United",
        "logo": "https://media.api-sports.io/football/teams/33.png"
      },
      "player": {
        "id": 889,
        "name": "Bruno Fernandes"
      },
      "assist": {
        "id": 903,
        "name": "Marcus Rashford"
      },
      "type": "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time": {
        "elapsed": 28,
        "extra": null
      },
      "team": {
        "id": 34,
        "name": "Newcastle",
        "logo": "https://media.api-sports.io/football/teams/34.png"
      },
      "player": {
        "id": 2935,
        "name": "Callum Wilson"
      },
      "assist": {
        "id": null,
        "name": null
      },
      "type": "Card",
      "detail": "Yellow Card",
      "comments": null
    }
  ]
}
```

---

## Fixtures Lineups

### Endpoint
```
GET /fixtures/lineups
```

### Description
Get match lineups including starting XI, substitutes, formation, and player positions.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | Yes | - | Fixture ID |
| `team` | integer | No | - | Team ID filter |
| `player` | integer | No | - | Player ID filter |
| `type` | string | No | - | "lineup" or "substitute" |

### Response Structure

```json
{
  "get": "fixtures/lineups",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)",
        "colors": {
          "player": {
            "primary": "string (hex)",
            "number": "string (hex)",
            "border": "string (hex)"
          },
          "goalkeeper": {
            "primary": "string (hex)",
            "number": "string (hex)",
            "border": "string (hex)"
          }
        }
      },
      "coach": {
        "id": integer,
        "name": "string",
        "photo": "string (url)"
      },
      "formation": "string",
      "startXI": [
        {
          "player": {
            "id": integer,
            "name": "string",
            "number": integer,
            "pos": "string",
            "grid": "string"
          }
        }
      ],
      "substitutes": [
        {
          "player": {
            "id": integer,
            "name": "string",
            "number": integer,
            "pos": "string",
            "grid": null
          }
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |
| `colors` | object | Jersey colors |

##### team.colors.player / goalkeeper
| Field | Type | Description |
|-------|------|-------------|
| `primary` | string | Primary jersey color (hex) |
| `number` | string | Number color (hex) |
| `border` | string | Border color (hex) |

##### coach
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Coach ID |
| `name` | string | Coach name |
| `photo` | string | Coach photo URL |

##### formation
| Field | Type | Description |
|-------|------|-------------|
| `formation` | string | Team formation (e.g., "4-3-3", "4-4-2") |

##### startXI / substitutes
Array of player objects:
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |
| `number` | integer | Jersey number |
| `pos` | string | Position (G, D, M, F) |
| `grid` | string | Position on grid (e.g., "1:1", "2:1") - null for substitutes |

### Update Frequency
1 hour before kick-off and updated if changes occur

### Recommended Calls
Once when available

### Example Response

```json
{
  "get": "fixtures/lineups",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": 33,
        "name": "Manchester United",
        "logo": "https://media.api-sports.io/football/teams/33.png",
        "colors": {
          "player": {
            "primary": "ff0000",
            "number": "ffffff",
            "border": "ff0000"
          },
          "goalkeeper": {
            "primary": "000000",
            "number": "ffffff",
            "border": "000000"
          }
        }
      },
      "coach": {
        "id": 10,
        "name": "Erik ten Hag",
        "photo": "https://media.api-sports.io/football/coachs/10.png"
      },
      "formation": "4-2-3-1",
      "startXI": [
        {
          "player": {
            "id": 891,
            "name": "A. Onana",
            "number": 24,
            "pos": "G",
            "grid": "1:1"
          }
        },
        {
          "player": {
            "id": 903,
            "name": "M. Rashford",
            "number": 10,
            "pos": "F",
            "grid": "4:1"
          }
        }
      ],
      "substitutes": [
        {
          "player": {
            "id": 895,
            "name": "A. Martial",
            "number": 9,
            "pos": "F",
            "grid": null
          }
        }
      ]
    }
  ]
}
```

---

## Fixtures Players

### Endpoint
```
GET /fixtures/players
```

### Description
Get detailed player statistics for a specific fixture.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | Yes | - | Fixture ID |
| `team` | integer | No | - | Team ID filter |

### Response Structure

```json
{
  "get": "fixtures/players",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)",
        "update": "string (datetime)"
      },
      "players": [
        {
          "player": {
            "id": integer,
            "name": "string",
            "photo": "string (url)"
          },
          "statistics": [
            {
              "games": {
                "minutes": integer,
                "number": integer,
                "position": "string",
                "rating": "string (decimal)",
                "captain": boolean,
                "substitute": boolean
              },
              "offsides": integer,
              "shots": {
                "total": integer,
                "on": integer
              },
              "goals": {
                "total": integer,
                "conceded": integer,
                "assists": integer,
                "saves": integer
              },
              "passes": {
                "total": integer,
                "key": integer,
                "accuracy": "string (integer)"
              },
              "tackles": {
                "total": integer,
                "blocks": integer,
                "interceptions": integer
              },
              "duels": {
                "total": integer,
                "won": integer
              },
              "dribbles": {
                "attempts": integer,
                "success": integer,
                "past": integer
              },
              "fouls": {
                "drawn": integer,
                "committed": integer
              },
              "cards": {
                "yellow": integer,
                "red": integer
              },
              "penalty": {
                "won": integer,
                "commited": integer,
                "scored": integer,
                "missed": integer,
                "saved": integer
              }
            }
          ]
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |
| `update` | string | Last update timestamp |

##### players
Array containing:

##### player
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |
| `photo` | string | Player photo URL |

##### statistics[].games
| Field | Type | Description |
|-------|------|-------------|
| `minutes` | integer | Minutes played |
| `number` | integer | Jersey number |
| `position` | string | Position (G, D, M, F) |
| `rating` | string | Player rating (0-10) |
| `captain` | boolean | Team captain |
| `substitute` | boolean | Started as substitute |

##### statistics[]
| Field | Type | Description |
|-------|------|-------------|
| `offsides` | integer | Offsides count |

##### statistics[].shots
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total shots |
| `on` | integer | Shots on target |

##### statistics[].goals
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Goals scored |
| `conceded` | integer | Goals conceded (goalkeepers) |
| `assists` | integer | Assists provided |
| `saves` | integer | Saves (goalkeepers) |

##### statistics[].passes
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total passes |
| `key` | integer | Key passes |
| `accuracy` | string | Pass accuracy percentage |

##### statistics[].tackles
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total tackles |
| `blocks` | integer | Blocks |
| `interceptions` | integer | Interceptions |

##### statistics[].duels
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total duels |
| `won` | integer | Duels won |

##### statistics[].dribbles
| Field | Type | Description |
|-------|------|-------------|
| `attempts` | integer | Dribble attempts |
| `success` | integer | Successful dribbles |
| `past` | integer | Players dribbled past |

##### statistics[].fouls
| Field | Type | Description |
|-------|------|-------------|
| `drawn` | integer | Fouls drawn |
| `committed` | integer | Fouls committed |

##### statistics[].cards
| Field | Type | Description |
|-------|------|-------------|
| `yellow` | integer | Yellow cards |
| `red` | integer | Red cards |

##### statistics[].penalty
| Field | Type | Description |
|-------|------|-------------|
| `won` | integer | Penalties won |
| `commited` | integer | Penalties conceded |
| `scored` | integer | Penalties scored |
| `missed` | integer | Penalties missed |
| `saved` | integer | Penalties saved (goalkeepers) |

### Update Frequency
After fixture completion

### Recommended Calls
Once after fixture ends

### Example Response

```json
{
  "get": "fixtures/players",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 2,
  "response": [
    {
      "team": {
        "id": 33,
        "name": "Manchester United",
        "logo": "https://media.api-sports.io/football/teams/33.png",
        "update": "2024-02-10T18:45:00+00:00"
      },
      "players": [
        {
          "player": {
            "id": 889,
            "name": "Bruno Fernandes",
            "photo": "https://media.api-sports.io/football/players/889.png"
          },
          "statistics": [
            {
              "games": {
                "minutes": 90,
                "number": 8,
                "position": "M",
                "rating": "8.2",
                "captain": true,
                "substitute": false
              },
              "offsides": 0,
              "shots": {
                "total": 4,
                "on": 2
              },
              "goals": {
                "total": 1,
                "conceded": 0,
                "assists": 1,
                "saves": null
              },
              "passes": {
                "total": 62,
                "key": 4,
                "accuracy": "85"
              },
              "tackles": {
                "total": 3,
                "blocks": 0,
                "interceptions": 1
              },
              "duels": {
                "total": 12,
                "won": 7
              },
              "dribbles": {
                "attempts": 5,
                "success": 3,
                "past": null
              },
              "fouls": {
                "drawn": 2,
                "committed": 1
              },
              "cards": {
                "yellow": 1,
                "red": 0
              },
              "penalty": {
                "won": 0,
                "commited": 0,
                "scored": 0,
                "missed": 0,
                "saved": null
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Injuries

### Endpoint
```
GET /injuries
```

### Description
Get player injury information for leagues, teams, fixtures, or specific players.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | No | - | League ID |
| `season` | integer | No | - | Season year (YYYY) |
| `fixture` | integer | No | - | Fixture ID |
| `team` | integer | No | - | Team ID |
| `player` | integer | No | - | Player ID |
| `date` | string | No | - | Date (YYYY-MM-DD) |
| `timezone` | string | No | UTC | Valid timezone |
| `ids` | string | No | - | Multiple fixture IDs (max 20, format: "id-id-id") |

### Response Structure

```json
{
  "get": "injuries",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "player": {
        "id": integer,
        "name": "string",
        "photo": "string (url)",
        "type": "string",
        "reason": "string"
      },
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "fixture": {
        "id": integer,
        "timezone": "string",
        "date": "string (datetime)",
        "timestamp": integer
      },
      "league": {
        "id": integer,
        "season": integer,
        "name": "string",
        "country": "string",
        "logo": "string (url)",
        "flag": "string (url)"
      }
    }
  ]
}
```

#### Response Object Fields

##### player
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |
| `photo` | string | Player photo URL |
| `type` | string | Injury type (e.g., "Muscle Injury", "Knee Injury") |
| `reason` | string | Detailed injury description |

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### fixture
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Fixture ID where injury occurred |
| `timezone` | string | Timezone |
| `date` | string | Fixture date (ISO 8601) |
| `timestamp` | integer | Unix timestamp |

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `season` | integer | Season year |
| `name` | string | League name |
| `country` | string | Country name |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |

### Update Frequency
Daily

### Recommended Calls
Once per day

### Example Response

```json
{
  "get": "injuries",
  "parameters": {
    "team": "33"
  },
  "errors": [],
  "results": 3,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "player": {
        "id": 903,
        "name": "Marcus Rashford",
        "photo": "https://media.api-sports.io/football/players/903.png",
        "type": "Muscle Injury",
        "reason": "Hamstring"
      },
      "team": {
        "id": 33,
        "name": "Manchester United",
        "logo": "https://media.api-sports.io/football/teams/33.png"
      },
      "fixture": {
        "id": 215662,
        "timezone": "UTC",
        "date": "2024-02-10T15:00:00+00:00",
        "timestamp": 1707577200
      },
      "league": {
        "id": 39,
        "season": 2024,
        "name": "Premier League",
        "country": "England",
        "logo": "https://media.api-sports.io/football/leagues/39.png",
        "flag": "https://media.api-sports.io/flags/gb.svg"
      }
    }
  ]
}
```

---

## Predictions

### Endpoint
```
GET /predictions
```

### Description
Get AI-powered predictions and analysis for upcoming fixtures.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | Yes | - | Fixture ID |

### Response Structure

```json
{
  "get": "predictions",
  "parameters": {
    "fixture": "215662"
  },
  "errors": [],
  "results": 1,
  "response": [
    {
      "predictions": {
        "winner": {
          "id": integer,
          "name": "string",
          "comment": "string"
        },
        "win_or_draw": boolean,
        "under_over": "string",
        "goals": {
          "home": "string (decimal)",
          "away": "string (decimal)"
        },
        "advice": "string",
        "percent": {
          "home": "string",
          "draw": "string",
          "away": "string"
        }
      },
      "league": {
        "id": integer,
        "name": "string",
        "country": "string",
        "logo": "string (url)",
        "flag": "string (url)",
        "season": integer,
        "standings": {
          "home": integer,
          "away": integer
        },
        "form": {
          "home": "string",
          "away": "string"
        },
        "att": {
          "home": "string",
          "away": "string"
        },
        "def": {
          "home": "string",
          "away": "string"
        },
        "fish_law": {
          "home": "string",
          "away": "string"
        },
        "h2h": {
          "home": "string",
          "away": "string"
        },
        "goals_h2h": {
          "home": "string",
          "away": "string"
        }
      },
      "teams": {
        "home": {
          "id": integer,
          "name": "string",
          "logo": "string (url)",
          "last_5": {
            "form": "string",
            "att": "string",
            "def": "string",
            "goals": {
              "for": {
                "total": integer,
                "average": "string (decimal)"
              },
              "against": {
                "total": integer,
                "average": "string (decimal)"
              }
            }
          },
          "league": {
            "form": "string",
            "fixtures": {
              "played": {
                "home": integer,
                "away": integer,
                "total": integer
              },
              "wins": {
                "home": integer,
                "away": integer,
                "total": integer
              },
              "draws": {
                "home": integer,
                "away": integer,
                "total": integer
              },
              "loses": {
                "home": integer,
                "away": integer,
                "total": integer
              }
            },
            "goals": {
              "for": {
                "total": {
                  "home": integer,
                  "away": integer,
                  "total": integer
                },
                "average": {
                  "home": "string (decimal)",
                  "away": "string (decimal)",
                  "total": "string (decimal)"
                }
              },
              "against": {
                "total": {
                  "home": integer,
                  "away": integer,
                  "total": integer
                },
                "average": {
                  "home": "string (decimal)",
                  "away": "string (decimal)",
                  "total": "string (decimal)"
                }
              }
            },
            "biggest": {
              "streak": {
                "wins": integer,
                "draws": integer,
                "loses": integer
              },
              "wins": {
                "home": "string (score)",
                "away": "string (score)"
              },
              "loses": {
                "home": "string (score)",
                "away": "string (score)"
              },
              "goals": {
                "for": {
                  "home": integer,
                  "away": integer
                },
                "against": {
                  "home": integer,
                  "away": integer
                }
              }
            },
            "clean_sheet": {
              "home": integer,
              "away": integer,
              "total": integer
            },
            "failed_to_score": {
              "home": integer,
              "away": integer,
              "total": integer
            },
            "penalty": {
              "scored": {
                "total": integer,
                "percentage": "string"
              },
              "missed": {
                "total": integer,
                "percentage": "string"
              },
              "total": integer
            },
            "lineups": [
              {
                "formation": "string",
                "played": integer
              }
            ],
            "cards": {
              "yellow": {
                "0-15": {
                  "total": integer,
                  "percentage": "string"
                }
              },
              "red": {
                "0-15": {
                  "total": integer,
                  "percentage": "string"
                }
              }
            }
          }
        },
        "away": {
          // Same structure as "home"
        }
      },
      "comparison": {
        "form": {
          "home": "string",
          "away": "string"
        },
        "att": {
          "home": "string",
          "away": "string"
        },
        "def": {
          "home": "string",
          "away": "string"
        },
        "poisson_distribution": {
          "home": "string",
          "away": "string"
        },
        "h2h": {
          "home": "string",
          "away": "string"
        },
        "goals_h2h": {
          "home": "string",
          "away": "string"
        },
        "total": {
          "home": "string",
          "away": "string"
        }
      },
      "h2h": [
        {
          // Fixture objects - same structure as /fixtures endpoint
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### predictions
| Field | Type | Description |
|-------|------|-------------|
| `winner` | object | Predicted winner with comment |
| `win_or_draw` | boolean | Win or draw prediction |
| `under_over` | string | Over/under goal prediction |
| `goals` | object | Predicted goals for home/away |
| `advice` | string | Betting advice |
| `percent` | object | Win/draw/loss percentages |

##### league
Contains league statistics and comparisons:
| Field | Type | Description |
|-------|------|-------------|
| `standings` | object | Home/away position in standings |
| `form` | object | Form comparison |
| `att` | object | Attack strength comparison |
| `def` | object | Defense strength comparison |
| `fish_law` | object | Poisson distribution |
| `h2h` | object | Head-to-head comparison |
| `goals_h2h` | object | Goals in head-to-head |

##### teams.home / teams.away
Contains comprehensive team statistics including:
- `last_5`: Last 5 matches statistics
- `league`: Full season statistics
- All fields match the team statistics structure

##### comparison
Direct comparison metrics between teams

##### h2h
Array of historical head-to-head fixtures

### Update Frequency
2 hours before kick-off

### Recommended Calls
Once per fixture

---

## Coaches

### Endpoint
```
GET /coachs
```

### Description
Get coach information and career history.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | Coach ID |
| `team` | integer | No | - | Team ID |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "coachs",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": integer,
      "name": "string",
      "firstname": "string",
      "lastname": "string",
      "age": integer,
      "birth": {
        "date": "string (date)",
        "place": "string",
        "country": "string"
      },
      "nationality": "string",
      "height": "string",
      "weight": "string",
      "photo": "string (url)",
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "career": [
        {
          "team": {
            "id": integer,
            "name": "string",
            "logo": "string (url)"
          },
          "start": "string (date)",
          "end": "string (date)"
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### Coach Information
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Coach ID |
| `name` | string | Full name |
| `firstname` | string | First name |
| `lastname` | string | Last name |
| `age` | integer | Current age |
| `nationality` | string | Nationality |
| `height` | string | Height |
| `weight` | string | Weight |
| `photo` | string | Photo URL |

##### birth
| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Birth date (YYYY-MM-DD) |
| `place` | string | Birth place |
| `country` | string | Birth country |

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Current team ID |
| `name` | string | Current team name |
| `logo` | string | Current team logo URL |

##### career
Array of career entries:
| Field | Type | Description |
|-------|------|-------------|
| `team` | object | Team (id, name, logo) |
| `start` | string | Start date |
| `end` | string | End date (null if current) |

### Update Frequency
Weekly

### Recommended Calls
Once when needed

---

## Players Seasons

### Endpoint
```
GET /players/seasons
```

### Description
Get all available seasons for player statistics for a specific player.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player` | integer | Yes | - | Player ID |

### Response Structure

```json
{
  "get": "players/seasons",
  "parameters": {
    "player": "276"
  },
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    integer
  ]
}
```

#### Response Array
Array of integers representing season years (YYYY format)

### Update Frequency
Once per year

### Recommended Calls
Once when needed

---

## Players Profiles

### Endpoint
```
GET /players/profiles
```

### Description
Get the list of all available players in the API.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number for pagination |

### Response Structure

```json
{
  "get": "players/profiles",
  "parameters": {
    "page": "1"
  },
  "errors": [],
  "results": 100,
  "paging": {
    "current": 1,
    "total": 5000
  },
  "response": [
    {
      "id": integer,
      "name": "string"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |

### Pagination
100 results per page

### Update Frequency
Daily

### Recommended Calls
Once when building database

---

## Players

### Endpoint
```
GET /players
```

### Description
Get player information and comprehensive statistics for a season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `season` | integer | Yes | - | Season year (YYYY) |
| `id` | integer | No | - | Player ID |
| `team` | integer | No | - | Team ID |
| `league` | integer | No | - | League ID |
| `page` | integer | No | 1 | Page number |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "players",
  "parameters": {
    "season": "2024",
    "id": "276"
  },
  "errors": [],
  "results": 1,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "player": {
        "id": integer,
        "name": "string",
        "firstname": "string",
        "lastname": "string",
        "age": integer,
        "birth": {
          "date": "string (date)",
          "place": "string",
          "country": "string"
        },
        "nationality": "string",
        "height": "string",
        "weight": "string",
        "injured": boolean,
        "photo": "string (url)"
      },
      "statistics": [
        {
          "team": {
            "id": integer,
            "name": "string",
            "logo": "string (url)"
          },
          "league": {
            "id": integer,
            "name": "string",
            "country": "string",
            "logo": "string (url)",
            "flag": "string (url)",
            "season": integer
          },
          "games": {
            "appearences": integer,
            "lineups": integer,
            "minutes": integer,
            "number": integer,
            "position": "string",
            "rating": "string (decimal)",
            "captain": boolean
          },
          "substitutes": {
            "in": integer,
            "out": integer,
            "bench": integer
          },
          "shots": {
            "total": integer,
            "on": integer
          },
          "goals": {
            "total": integer,
            "conceded": integer,
            "assists": integer,
            "saves": integer
          },
          "passes": {
            "total": integer,
            "key": integer,
            "accuracy": integer
          },
          "tackles": {
            "total": integer,
            "blocks": integer,
            "interceptions": integer
          },
          "duels": {
            "total": integer,
            "won": integer
          },
          "dribbles": {
            "attempts": integer,
            "success": integer,
            "past": integer
          },
          "fouls": {
            "drawn": integer,
            "committed": integer
          },
          "cards": {
            "yellow": integer,
            "yellowred": integer,
            "red": integer
          },
          "penalty": {
            "won": integer,
            "commited": integer,
            "scored": integer,
            "missed": integer,
            "saved": integer
          }
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### player
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Full name |
| `firstname` | string | First name |
| `lastname` | string | Last name |
| `age` | integer | Current age |
| `nationality` | string | Nationality |
| `height` | string | Height (e.g., "185 cm") |
| `weight` | string | Weight (e.g., "78 kg") |
| `injured` | boolean | Injury status |
| `photo` | string | Player photo URL |

##### player.birth
| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Birth date (YYYY-MM-DD) |
| `place` | string | Birth place |
| `country` | string | Birth country |

##### statistics (array, can have multiple entries for different teams/leagues)

##### statistics[].team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### statistics[].league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `name` | string | League name |
| `country` | string | Country |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |
| `season` | integer | Season year |

##### statistics[].games
| Field | Type | Description |
|-------|------|-------------|
| `appearences` | integer | Total appearances |
| `lineups` | integer | Starting lineup appearances |
| `minutes` | integer | Total minutes played |
| `number` | integer | Jersey number |
| `position` | string | Position (Attacker, Midfielder, Defender, Goalkeeper) |
| `rating` | string | Average rating |
| `captain` | boolean | Captain status |

##### statistics[].substitutes
| Field | Type | Description |
|-------|------|-------------|
| `in` | integer | Substitutions in |
| `out` | integer | Substitutions out |
| `bench` | integer | Times on bench |

##### statistics[].shots
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total shots |
| `on` | integer | Shots on target |

##### statistics[].goals
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Goals scored |
| `conceded` | integer | Goals conceded (GK) |
| `assists` | integer | Assists |
| `saves` | integer | Saves (GK) |

##### statistics[].passes
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total passes |
| `key` | integer | Key passes |
| `accuracy` | integer | Pass accuracy % |

##### statistics[].tackles
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total tackles |
| `blocks` | integer | Blocks |
| `interceptions` | integer | Interceptions |

##### statistics[].duels
| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total duels |
| `won` | integer | Duels won |

##### statistics[].dribbles
| Field | Type | Description |
|-------|------|-------------|
| `attempts` | integer | Dribble attempts |
| `success` | integer | Successful dribbles |
| `past` | integer | Players dribbled past |

##### statistics[].fouls
| Field | Type | Description |
|-------|------|-------------|
| `drawn` | integer | Fouls drawn |
| `committed` | integer | Fouls committed |

##### statistics[].cards
| Field | Type | Description |
|-------|------|-------------|
| `yellow` | integer | Yellow cards |
| `yellowred` | integer | Second yellow (red) cards |
| `red` | integer | Direct red cards |

##### statistics[].penalty
| Field | Type | Description |
|-------|------|-------------|
| `won` | integer | Penalties won |
| `commited` | integer | Penalties conceded |
| `scored` | integer | Penalties scored |
| `missed` | integer | Penalties missed |
| `saved` | integer | Penalties saved (GK) |

### Pagination
20 results per page

### Update Frequency
After each fixture

### Recommended Calls
Once per day

---

## Players Squads

### Endpoint
```
GET /players/squads
```

### Description
Get team squad composition or teams where a player has played.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `team` | integer | No* | - | Team ID (*required if player not provided) |
| `player` | integer | No* | - | Player ID (*required if team not provided) |

### Response Structure

```json
{
  "get": "players/squads",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "players": [
        {
          "id": integer,
          "name": "string",
          "age": integer,
          "number": integer,
          "position": "string",
          "photo": "string (url)"
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### players
Array of player objects:
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |
| `age` | integer | Player age |
| `number` | integer | Jersey number |
| `position` | string | Position |
| `photo` | string | Player photo URL |

### Update Frequency
Several times per week (transfer windows)

### Recommended Calls
Once per week

---

## Players Teams

### Endpoint
```
GET /players/teams
```

### Description
Get the list of teams and seasons where a player has played during their career.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player` | integer | Yes | - | Player ID |

### Response Structure

```json
{
  "get": "players/teams",
  "parameters": {
    "player": "276"
  },
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "team": {
        "id": integer,
        "name": "string",
        "logo": "string (url)"
      },
      "seasons": [
        integer
      ]
    }
  ]
}
```

#### Response Object Fields

##### team
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Team ID |
| `name` | string | Team name |
| `logo` | string | Team logo URL |

##### seasons
Array of integers representing season years (YYYY format)

### Update Frequency
At end of season

### Recommended Calls
Once when needed

---

## Players Top Scorers

### Endpoint
```
GET /players/topscorers
```

### Description
Get the top scorers for a league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |

### Response Structure

Same structure as `/players` endpoint - returns array of player objects with statistics, sorted by goals scored.

### Update Frequency
After each fixture

### Recommended Calls
Once per day

---

## Players Top Assists

### Endpoint
```
GET /players/topassists
```

### Description
Get the top assist providers for a league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |

### Response Structure

Same structure as `/players` endpoint - returns array of player objects with statistics, sorted by assists.

### Update Frequency
After each fixture

### Recommended Calls
Once per day

---

## Players Top Yellow Cards

### Endpoint
```
GET /players/topyellowcards
```

### Description
Get players with the most yellow cards for a league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |

### Response Structure

Same structure as `/players` endpoint - returns array of player objects with statistics, sorted by yellow cards.

### Update Frequency
After each fixture

### Recommended Calls
Once per day

---

## Players Top Red Cards

### Endpoint
```
GET /players/topredcards
```

### Description
Get players with the most red cards for a league and season.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | integer | Yes | - | League ID |
| `season` | integer | Yes | - | Season year (YYYY) |

### Response Structure

Same structure as `/players` endpoint - returns array of player objects with statistics, sorted by red cards.

### Update Frequency
After each fixture

### Recommended Calls
Once per day

---

## Transfers

### Endpoint
```
GET /transfers
```

### Description
Get player transfer history.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player` | integer | No | - | Player ID |
| `team` | integer | No | - | Team ID |

### Response Structure

```json
{
  "get": "transfers",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "player": {
        "id": integer,
        "name": "string"
      },
      "update": "string (date)",
      "transfers": [
        {
          "date": "string (date)",
          "type": "string",
          "teams": {
            "in": {
              "id": integer,
              "name": "string",
              "logo": "string (url)"
            },
            "out": {
              "id": integer,
              "name": "string",
              "logo": "string (url)"
            }
          }
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### player
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Player ID |
| `name` | string | Player name |

##### update
| Field | Type | Description |
|-------|------|-------------|
| `update` | string | Last update date |

##### transfers
Array of transfer records:
| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Transfer date |
| `type` | string | Transfer type (e.g., "€25M", "Free Transfer", "Loan", "N/A") |

##### transfers[].teams
| Field | Type | Description |
|-------|------|-------------|
| `in` | object | Destination team (id, name, logo) |
| `out` | object | Origin team (id, name, logo) |

### Update Frequency
During transfer windows

### Recommended Calls
Once per day during transfer windows

### Example Response

```json
{
  "get": "transfers",
  "parameters": {
    "player": "276"
  },
  "errors": [],
  "results": 1,
  "response": [
    {
      "player": {
        "id": 276,
        "name": "Cristiano Ronaldo"
      },
      "update": "2024-01-15",
      "transfers": [
        {
          "date": "2021-08-31",
          "type": "€15M",
          "teams": {
            "in": {
              "id": 33,
              "name": "Manchester United",
              "logo": "https://media.api-sports.io/football/teams/33.png"
            },
            "out": {
              "id": 496,
              "name": "Juventus",
              "logo": "https://media.api-sports.io/football/teams/496.png"
            }
          }
        }
      ]
    }
  ]
}
```

---

## Trophies

### Endpoint
```
GET /trophies
```

### Description
Get player or coach trophies and achievements.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player` | integer | No | - | Player ID |
| `coach` | integer | No | - | Coach ID |
| `players` | string | No | - | Multiple player IDs (comma-separated) |
| `coachs` | string | No | - | Multiple coach IDs (comma-separated) |

### Response Structure

```json
{
  "get": "trophies",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "league": "string",
      "country": "string",
      "season": "string",
      "place": "string"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `league` | string | Competition name |
| `country` | string | Country |
| `season` | string | Season won |
| `place` | string | Final position/achievement (e.g., "Winner", "Runner-up") |

### Update Frequency
At end of season

### Recommended Calls
Once when needed

### Example Response

```json
{
  "get": "trophies",
  "parameters": {
    "player": "276"
  },
  "errors": [],
  "results": 30,
  "response": [
    {
      "league": "UEFA Champions League",
      "country": "World",
      "season": "2017-2018",
      "place": "Winner"
    },
    {
      "league": "Premier League",
      "country": "England",
      "season": "2008-2009",
      "place": "Winner"
    }
  ]
}
```

---

## Sidelined

### Endpoint
```
GET /sidelined
```

### Description
Get information about sidelined players or coaches (injuries, suspensions, etc.).

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player` | integer | No | - | Player ID |
| `coach` | integer | No | - | Coach ID |
| `players` | string | No | - | Multiple player IDs (comma-separated) |
| `coachs` | string | No | - | Multiple coach IDs (comma-separated) |

### Response Structure

```json
{
  "get": "sidelined",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "type": "string",
      "start": "string (date)",
      "end": "string (date)"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Reason type (e.g., "Injury", "Suspension", "Missing") |
| `start` | string | Start date (YYYY-MM-DD) |
| `end` | string | End date (YYYY-MM-DD), null if ongoing |

### Update Frequency
Daily

### Recommended Calls
Once per day

### Example Response

```json
{
  "get": "sidelined",
  "parameters": {
    "player": "276"
  },
  "errors": [],
  "results": 2,
  "response": [
    {
      "type": "Injury",
      "start": "2024-01-15",
      "end": "2024-02-10"
    },
    {
      "type": "Suspension",
      "start": "2024-03-01",
      "end": "2024-03-08"
    }
  ]
}
```

---

## Odds Live

### Endpoint
```
GET /odds/live
```

### Description
Get live in-play odds from multiple bookmakers during ongoing matches.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | No | - | Fixture ID |
| `league` | integer | No | - | League ID |
| `bet` | integer | No | - | Bet type ID (from /odds/live/bets) |

### Response Structure

```json
{
  "get": "odds/live",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "league": {
        "id": integer,
        "name": "string",
        "country": "string",
        "logo": "string (url)",
        "flag": "string (url)",
        "season": integer
      },
      "fixture": {
        "id": integer,
        "timezone": "string",
        "date": "string (datetime)",
        "timestamp": integer
      },
      "update": "string (datetime)",
      "bookmakers": [
        {
          "id": integer,
          "name": "string",
          "bets": [
            {
              "id": integer,
              "name": "string",
              "values": [
                {
                  "value": "string",
                  "odd": "string (decimal)"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### Response Object Fields

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `name` | string | League name |
| `country` | string | Country name |
| `logo` | string | League logo URL |
| `flag` | string | Country flag URL |
| `season` | integer | Season year |

##### fixture
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Fixture ID |
| `timezone` | string | Timezone |
| `date` | string | Match date (ISO 8601) |
| `timestamp` | integer | Unix timestamp |

##### update
| Field | Type | Description |
|-------|------|-------------|
| `update` | string | Last odds update timestamp |

##### bookmakers
Array of bookmaker objects:
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Bookmaker ID |
| `name` | string | Bookmaker name |
| `bets` | array | Array of bet types |

##### bookmakers[].bets
Array of bet objects:
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Bet type ID |
| `name` | string | Bet type name |
| `values` | array | Array of betting options |

##### bookmakers[].bets[].values
Array of value objects:
| Field | Type | Description |
|-------|------|-------------|
| `value` | string | Betting option (e.g., "Home", "Over 2.5") |
| `odd` | string | Decimal odds value |

### Update Frequency
Real-time during match

### Recommended Calls
Once per minute during live matches

---

## Odds Live Bets

### Endpoint
```
GET /odds/live/bets
```

### Description
Get available bet types for live in-play odds.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | Bet type ID |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "odds/live/bets",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": integer,
      "name": "string"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Bet type ID |
| `name` | string | Bet type name |

### Update Frequency
Weekly

### Recommended Calls
Once per week

---

## Odds

### Endpoint
```
GET /odds
```

### Description
Get pre-match odds from multiple bookmakers.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fixture` | integer | No | - | Fixture ID |
| `league` | integer | No | - | League ID |
| `season` | integer | No | - | Season year (YYYY) |
| `date` | string | No | - | Date (YYYY-MM-DD) |
| `timezone` | string | No | UTC | Valid timezone |
| `page` | integer | No | 1 | Page number |
| `bookmaker` | integer | No | - | Bookmaker ID filter |
| `bet` | integer | No | - | Bet type ID filter |

### Response Structure

Same structure as `/odds/live` endpoint.

### Pagination
25 results per page

### Update Frequency
Real-time before match

### Recommended Calls
Every 15 minutes before match

---

## Odds Mapping

### Endpoint
```
GET /odds/mapping
```

### Description
Get the list of available fixtures with odds data.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |

### Response Structure

```json
{
  "get": "odds/mapping",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": integer
  },
  "response": [
    {
      "league": {
        "id": integer,
        "season": integer
      },
      "fixture": {
        "id": integer,
        "date": "string (datetime)",
        "timestamp": integer
      },
      "update": "string (datetime)"
    }
  ]
}
```

#### Response Object Fields

##### league
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | League ID |
| `season` | integer | Season year |

##### fixture
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Fixture ID |
| `date` | string | Fixture date (ISO 8601) |
| `timestamp` | integer | Unix timestamp |

##### update
| Field | Type | Description |
|-------|------|-------------|
| `update` | string | Last odds update timestamp |

### Pagination
100 results per page

### Update Frequency
Daily

### Recommended Calls
Once per day

---

## Odds Bookmakers

### Endpoint
```
GET /odds/bookmakers
```

### Description
Get all available bookmakers.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | No | - | Bookmaker ID |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "odds/bookmakers",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": integer,
      "name": "string"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Bookmaker ID |
| `name` | string | Bookmaker name |

### Available Bookmakers

Common bookmakers include:
- 10Bet
- Marathonbet
- Betfair
- Pinnacle
- Sport Betting Online
- Bwin
- William Hill
- Bet365
- Dafabet
- Ladbrokes
- 1xBet
- BetFred
- 188Bet
- Interwetten
- Unibet

### Update Frequency
Weekly

### Recommended Calls
Once per day

---

## Odds Bets

### Endpoint
```
GET /odds/bets
```

### Description
Get all available bet types for pre-match odds.

### Parameters

#### Header Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `x-apisports-key` | string | Yes | Your API key |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | No | - | Bet type ID |
| `search` | string | No | - | Search term (minimum 3 characters) |

### Response Structure

```json
{
  "get": "odds/bets",
  "parameters": {},
  "errors": [],
  "results": integer,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    {
      "id": integer,
      "name": "string"
    }
  ]
}
```

#### Response Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Bet type ID |
| `name` | string | Bet type name |

### Common Bet Types

- Match Winner
- Home/Away
- Goals Over/Under
- Goals Over/Under First Half
- Goals Over/Under Second Half
- Both Teams Score
- Double Chance
- Correct Score
- Asian Handicap
- European Handicap
- Corners Over/Under
- Cards Over/Under

### Update Frequency
Weekly

### Recommended Calls
Once per day

---

## Best Practices

### 1. Caching Strategy

Cache static data aggressively:
```javascript
// Cache for extended periods
- Timezones: 30 days
- Countries: 7 days
- Leagues: 1 day
- Teams: 1 day
- Bookmakers: 1 day
- Bet types: 1 day

// Cache dynamic data strategically
- Upcoming fixtures: 1 hour
- Standings: 6 hours
- Team statistics: 12 hours
```

### 2. Rate Limit Management

```javascript
// Track usage
const headers = response.headers;
const remaining = headers['x-ratelimit-requests-remaining'];
const limit = headers['x-ratelimit-requests-limit'];

if (remaining < 10) {
  console.warn('Low API quota remaining');
}
```

### 3. Error Handling

```javascript
try {
  const response = await fetch(url, options);
  
  if (response.status === 204) {
    console.log('No data available');
    return null;
  }
  
  if (response.status === 499) {
    console.log('Request timeout - retry');
    // Implement retry logic
  }
  
  if (response.status === 500) {
    console.log('Server error');
    return null;
  }
  
  return await response.json();
} catch (error) {
  console.error('API Error:', error);
}
```

### 4. Efficient Filtering

```javascript
// Use specific filters to reduce response size
const params = {
  league: 39,
  season: 2024,
  team: 33,
  last: 10  // Only last 10 fixtures
};

// Instead of fetching all and filtering client-side
```

### 5. Batch Requests

```javascript
// For fixtures with events, lineups, and statistics
const fixtureIds = '215662-215663-215664';
const response = await fetch(`${baseURL}/fixtures?ids=${fixtureIds}`);

// Single request returns all data for multiple fixtures
```

### 6. Timezone Handling

Always specify timezone for consistent timestamps:
```javascript
const params = {
  league: 39,
  season: 2024,
  timezone: 'Europe/Stockholm'  // User's timezone
};
```

### 7. Live Data Strategy

For live matches:
```javascript
// Update every 60 seconds
setInterval(async () => {
  const liveFixtures = await fetchFixtures({ live: 'all' });
  updateUI(liveFixtures);
}, 60000);

// Update statistics after match ends
if (fixture.status.short === 'FT') {
  await fetchStatistics(fixture.id);
}
```

---

## Code Examples

### JavaScript (Fetch)

```javascript
const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://v3.football.api-sports.io';

async function getLeagues() {
  try {
    const response = await fetch(`${BASE_URL}/leagues?country=England`, {
      headers: {
        'x-apisports-key': API_KEY
      }
    });
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Python (Requests)

```python
import requests

API_KEY = 'YOUR_API_KEY'
BASE_URL = 'https://v3.football.api-sports.io'

headers = {
    'x-apisports-key': API_KEY
}

response = requests.get(
    f'{BASE_URL}/leagues',
    headers=headers,
    params={'country': 'England'}
)

data = response.json()
leagues = data['response']
```

### PHP (cURL)

```php
<?php
$apiKey = 'YOUR_API_KEY';
$url = 'https://v3.football.api-sports.io/leagues?country=England';

$curl = curl_init();
curl_setopt_array($curl, array(
  CURLOPT_URL => $url,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => array(
    'x-apisports-key: ' . $apiKey
  ),
));

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response, true);
$leagues = $data['response'];
?>
```

---

## Legal & Usage

### Logos and Images

- Logos and images are provided for identification purposes only
- No intellectual property rights are claimed
- May be subject to third-party trademark rights
- User is responsible for legal compliance

### Rate Limiting

- Exceeding limits may result in temporary or permanent suspension
- Implement proper caching and request management
- Monitor rate limit headers

### Fair Use

- Cache appropriately to reduce API calls
- Respect rate limits
- Provide attribution where required
- Comply with local laws

---

## Support & Resources

- **Dashboard:** https://dashboard.api-football.com
- **Documentation:** https://www.api-football.com/documentation-v3
- **Support:** Available through dashboard
- **Blog:** Tutorials and guides

---

**Version:** 3.9.3

**Last Updated:** 2026-01-17

**Documentation Type:** Complete API Reference
