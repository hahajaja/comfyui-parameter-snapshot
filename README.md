# ComfyUI Parameter Snapshot

Save and restore widget parameters across ComfyUI nodes. Provides per-node snapshot management via right-click context menu and a sidebar panel for managing all snapshots.

## Nodes

### Parameter Snapshot Saver

Connects to upstream nodes and saves their widget values as a **Bundle Snapshot** (a single snapshot that captures multiple nodes at once). Wire upstream node outputs to the inputs, enter a `snapshot_name`, and click `Save Snapshot`. Re-saving with the same name overwrites the existing bundle.

## Sidebar Panel

The **Snapshots** sidebar tab displays all saved snapshots. Provides four operations per snapshot:

| Button | Action |
|--------|--------|
| **A** | Apply snapshot values to matching nodes in the graph |
| **O** | Overwrite snapshot with current widget values |
| **R** | Rename snapshot |
| **X** | Delete snapshot |

## Right-click Menu

Right-click any node to access two snapshot operations:

- **Snapshots > Save Current Values** — Save the node's current widget values as a new snapshot (type-specific, not bundled).
- **Snapshots > Manage Snapshots** — Open a dedicated dialog showing snapshots for this node type. Supports Apply, Overwrite, Rename, and Delete.

## Storage

All snapshots are stored in a single JSON file at the ComfyUI user directory:

```
ComfyUI/user/default/comfyui-parameter-snapshot.json
```

