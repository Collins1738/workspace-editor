# workspace-editor

A lightweight browser-based file editor built for OpenClaw agents. Monaco editor, dark theme, file tree with create/delete/rename support.

## Setup

```bash
npm install
```

## Run

```bash
WORKSPACE_ROOT=/path/to/your/.openclaw/workspace \
EXTRA_ROOT=/path/to/your/development \
EDITOR_TOKEN=yourtoken \
npm start
```

Then open: `http://localhost:3000?token=yourtoken`

## Environment Variables

| Variable         | Description                              | Default                                    |
|------------------|------------------------------------------|--------------------------------------------|
| `WORKSPACE_ROOT` | Path shown as "workspace" in the sidebar | `/Users/collinsc/.openclaw/workspace`      |
| `EXTRA_ROOT`     | Path shown as "extra" in the sidebar     | `/Users/collinsc/Development`              |
| `EDITOR_TOKEN`   | Auth token required in URL or header     | `dravon123`                                |
| `PORT`           | Port to listen on                        | `3000`                                     |

## Features

- Monaco editor (VS Code engine) with syntax highlighting
- File tree with folders, create file/folder, delete
- Image viewer for png/jpg/gif/webp/svg
- Mobile-friendly (hamburger sidebar)
- Cmd/Ctrl+S to save
- Token auth on all routes
