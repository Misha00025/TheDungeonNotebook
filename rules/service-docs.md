# API Documentation Conventions

## Location
`docs/api/` — static HTML/JS/CSS, no server required.

## Structure
```
docs/api/
├── index.html              # Landing page
├── css/style.css           # Dark theme
├── js/
│   ├── data.js             # ENDPOINTS array (all endpoints)
│   ├── sidebar.js          # Sidebar nav generator + search
│   └── renderer.js         # Endpoint card renderer
├── auth.html               # Auth endpoints
├── users.html              # Users endpoints
├── system.html             # System endpoints
└── groups/
    ├── general.html        # Group CRUD + members
    ├── items.html          # Group items
    ├── notes.html          # Group notes
    ├── skills.html         # Group skills
    ├── schemas.html        # Group schemas
    ├── export-import.html  # Export/Import
    └── characters/
        ├── main.html       # Characters
        ├── templates.html  # Character templates
        ├── items.html      # Character items
        ├── notes.html      # Character notes
        └── skills.html     # Character skills
```

## How to Add a New Endpoint
1. Open `docs/api/js/data.js`.
2. Add a new object to the `ENDPOINTS` array (in the correct category).
3. Required fields: `id`, `method`, `url`, `category`, `categoryTitle`, `page`, `auth`, `access`, `description`, `requestBody`, `responseSchema`, `responseStatuses`, `params`, `special`.
4. Open the corresponding HTML page (by `page` field) and add an endpoint card with the same `id`.

## JSON Schema Format
```
"fieldName": "string"           # Required field
"fieldName"?: "string"          # Optional field
"fieldName": "int | null"       # Nullable
```

## Important
- All JSON schemas must contain **actual fields** from C# models, not outdated names from old tests.
- When changing backend models → update schemas in `data.js` and corresponding HTML.
- If an endpoint moves to another page: update `page` in `data.js` and move the HTML card.

## SCHEMAS Object
Common schemas are defined in `var SCHEMAS = { ... }` at the top of `data.js` for reuse across endpoints. Add new schemas here when multiple endpoints share the same response shape.
