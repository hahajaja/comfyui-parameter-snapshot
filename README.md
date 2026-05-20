# ComfyUI Parameter Snapshot

Save and restore widget parameters across ComfyUI nodes. Provides per-node snapshot management via right-click context menu and a dedicated Snapshot Manager node for bundled multi-node snapshots.

## Nodes

### Parameter Snapshot Saver

Connects to upstream nodes and saves their widget values as a **Bundle Snapshot** (a single snapshot that captures multiple nodes at once). Wire upstream node outputs to the inputs, enter a `snapshot_name`, and click `Save Snapshot`. Re-saving with the same name overwrites the existing bundle.

### Snapshot Manager

Displays all saved snapshots in an embedded widget panel. Provides four operations per snapshot:

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

Right-click Apply/Overwrite operates directly on the **target node instance**, bypassing subgraph scope limitations.

## Storage

All snapshots are stored in a single JSON file at the ComfyUI user directory:

```
ComfyUI/user/default/comfyui-parameter-snapshot.json
```

## Known Issues

### Snapshot Manager panel and subgraph container nodes

| Entry | Subgraph container node | Normal node |
|-------|------------------------|-------------|
| Right-click Snapshots > Apply | Works | Works |
| Snapshot Manager **A** / **O** buttons | May fail | Works |

**Symptoms**: Right-click Snapshots > Manage Snapshots can Apply to subgraph container nodes correctly, but the Snapshot Manager widget panel's A/O buttons cannot affect subgraph container nodes. Normal nodes (e.g., CLIPTextEncode) work fine from both entry points.

**Root Cause**: The right-click menu holds a direct reference to the target node (`node`) and operates on it directly. The Snapshot Manager panel uses `node.graph._nodes` to iterate all nodes in the SnapshotManager's graph. When the SnapshotManager is placed **inside** a subgraph, `node.graph` points to the subgraph's internal graph, which does not contain the outer subgraph container node (the container lives in the parent graph).

**Workaround**: For subgraph container nodes, use the right-click menu's Snapshots > Manage Snapshots (both Apply and Overwrite work correctly). The Snapshot Manager panel is currently recommended for non-subgraph scenarios only.
