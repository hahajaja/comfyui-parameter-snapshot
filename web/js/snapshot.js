import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const API_BASE = "/param_snapshot";

function getWidgetValues(node) {
    const values = {};

    if (node.widgets && node.widgets.length > 0) {
        for (const w of node.widgets) {
            if (!w.name || w.type === "control_after_generate" || w.options?.isControlWidget) {
                continue;
            }
            values[w.name] = w.value;
        }
    }

    return values;
}

function applyWidgetValues(node, values) {
    const keys = Object.keys(values);
    if (keys.length === 0) return;

    if (node.widgets && node.widgets.length > 0) {
        for (const w of node.widgets) {
            if (!w.name) continue;
            if (w.name in values) {
                const newVal = values[w.name];
                if (w.value !== newVal) {
                    w.value = newVal;
                    if (w.callback) w.callback(newVal);
                }
            }
        }
    }

    if (node.inputs && node.inputs.length > 0) {
        for (const inp of node.inputs) {
            if (!inp.widget) continue;
            const wName = inp.widget.name;
            if (!wName) continue;

            let matchedVal = undefined;
            let matched = false;

            if (wName in values) {
                matchedVal = values[wName];
                matched = true;
            } else if (inp.name && inp.name in values) {
                matchedVal = values[inp.name];
                matched = true;
            } else if (inp.label && inp.label in values) {
                matchedVal = values[inp.label];
                matched = true;
            }

            if (matched && inp.value !== matchedVal) {
                inp.value = matchedVal;
            }
        }
    }

    node.graph?.change();
    app.canvas?.setDirty(true, true);
}

function resolveNodeType(n) {
    return typeof n.comfyClass === "string" ? n.comfyClass :
           typeof n.type === "string" ? n.type :
           n.constructor?.comfyClass || n.comfyClass?.name || n.type?.name || "";
}

async function fetchSnapshots(nodeType) {
    const resp = await api.fetchApi(`${API_BASE}/list/${encodeURIComponent(nodeType)}`);
    if (!resp.ok) return [];
    return await resp.json();
}

async function fetchAllSnapshots() {
    const resp = await api.fetchApi(`${API_BASE}/all`);
    if (!resp.ok) return {};
    return await resp.json();
}

async function apiSave(nodeType, name, values) {
    const resp = await api.fetchApi(`${API_BASE}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_type: nodeType, name, values }),
    });
    return resp.ok ? await resp.json() : null;
}

async function apiGetSnapshot(snapshotId) {
    const resp = await api.fetchApi(`${API_BASE}/get/${snapshotId}`);
    return resp.ok ? await resp.json() : null;
}

async function apiDeleteSnapshot(snapshotId) {
    const resp = await api.fetchApi(`${API_BASE}/delete/${snapshotId}`, { method: "POST" });
    return resp.ok;
}

async function apiUpdateSnapshot(nodeType, snapshotId, updates) {
    const resp = await api.fetchApi(`${API_BASE}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_type: nodeType, snapshot_id: snapshotId, ...updates }),
    });
    return resp.ok;
}

async function apiOverwriteSnapshot(snapshotId, values, name) {
    const resp = await api.fetchApi(`${API_BASE}/overwrite/${snapshotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, ...(name ? { name } : {}) }),
    });
    return resp.ok ? await resp.json() : null;
}

async function saveSnapshotWithOverwrite(nodeType, name, values) {
    const snapshots = await fetchSnapshots(nodeType);
    const existing = snapshots.find(s => s.name === name);
    if (existing) {
        const result = await apiOverwriteSnapshot(existing.id, values, name);
        if (!result) return null;
        return existing;
    }
    return await apiSave(nodeType, name, values);
}

function showToast(severity, summary, detail) {
    try {
        app.extensionManager.toast.add({ severity, summary, detail, life: 2000 });
    } catch (e) {
        console.log(`[ParamSnapshot] ${summary}: ${detail}`);
    }
}

function mkButton(text, color, onClick, small) {
    const btn = document.createElement("button");
    btn.style.cssText = `background:${color}22;border:1px solid ${color};border-radius:4px;color:${color};cursor:pointer;padding:${small ? "2px 6px" : "4px 10px"};font-size:12px;white-space:nowrap;`;
    btn.textContent = text;
    btn.onclick = (e) => { e.stopPropagation(); onClick(); };
    return btn;
}

function buildManageDialog(node) {
    const nodeType = node.comfyClass || node.type;

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;";

    const panel = document.createElement("div");
    panel.style.cssText = "background:#2a2a2a;border:1px solid #555;border-radius:8px;padding:16px;min-width:500px;max-height:500px;display:flex;flex-direction:column;color:#ccc;font-family:sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-shrink:0;";

    const title = document.createElement("h3");
    title.textContent = `Snapshots - ${nodeType}`;
    title.style.cssText = "margin:0;color:#fff;font-size:15px;";

    const headerRight = document.createElement("div");
    headerRight.style.cssText = "display:flex;align-items:center;gap:6px;";

    const saveNewBtn = mkButton("+ Save New", "#4a9", async () => {
        const values = getWidgetValues(node);
        if (Object.keys(values).length === 0) {
            showToast("warn", "No Parameters", "This node has no widget values to save");
            return;
        }
        const name = prompt("Enter snapshot name:", `Snapshot ${new Date().toLocaleTimeString()}`);
        if (!name) return;
        const result = await saveSnapshotWithOverwrite(nodeType, name, values);
        if (result) {
            showToast("success", "Snapshot Saved", `"${name}" saved`);
            renderList();
        }
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.style.cssText = "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 4px;";
    closeBtn.onclick = () => overlay.remove();

    headerRight.appendChild(saveNewBtn);
    headerRight.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(headerRight);
    panel.appendChild(header);

    const listContainer = document.createElement("div");
    listContainer.style.cssText = "overflow-y:auto;flex:1;";

    async function renderList() {
        while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);

        const [typeSnapshots, allData] = await Promise.all([
            fetchSnapshots(nodeType),
            fetchAllSnapshots(),
        ]);

        const merged = [...typeSnapshots];
        for (const [nt, snaps] of Object.entries(allData)) {
            if (nt === nodeType) continue;
            for (const s of snaps) {
                const bt = s.__bundle_types__;
                if (bt && bt.includes(nodeType)) {
                    merged.push({ ...s, _bundle_parent: nt });
                }
            }
        }

        if (merged.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No snapshots saved for this node type.";
            empty.style.cssText = "padding:20px;text-align:center;color:#888;";
            listContainer.appendChild(empty);
            return;
        }

        for (const s of merged) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid #3a3a3a;";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = s._bundle_parent ? `${s.name} [bundle]` : s.name;
            nameSpan.title = s.name;
            nameSpan.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;";

            const dateSpan = document.createElement("span");
            const created = s.created ? new Date(s.created).toLocaleDateString() : "";
            dateSpan.textContent = created;
            dateSpan.style.cssText = "color:#666;font-size:11px;min-width:60px;text-align:right;";

            const applyBtn = mkButton("Apply", "#4a9", () => {
                overlay.remove();
                apiGetSnapshot(s.id).then(snapshot => {
                    if (!snapshot) return;
                    const vals = snapshot.values;
                    if (vals?.__bundle__) {
                        const wv = vals[nodeType];
                        if (wv) applyWidgetValues(node, wv);
                    } else {
                        applyWidgetValues(node, vals);
                    }
                });
            });

            const overwriteBtn = mkButton("Overwrite", "#a90", async () => {
                if (!confirm(`Overwrite "${s.name}" with current values?`)) return;
                let result;
                if (s._bundle_parent) {
                    const snapshot = await apiGetSnapshot(s.id);
                    if (snapshot?.values?.__bundle__) {
                        snapshot.values[nodeType] = getWidgetValues(node);
                        result = await apiOverwriteSnapshot(s.id, snapshot.values);
                    }
                } else {
                    result = await apiOverwriteSnapshot(s.id, getWidgetValues(node));
                }
                if (result) {
                    showToast("success", "Snapshot Overwritten", `"${s.name}" updated`);
                } else {
                    showToast("error", "Overwrite Failed", `Failed to overwrite "${s.name}"`);
                }
                renderList();
            });

            const renameBtn = mkButton("Rename", "#67a", async () => {
                const name = prompt("New name:", s.name);
                if (!name || name === s.name) return;
                const nt = s._bundle_parent || nodeType;
                const ok = await apiUpdateSnapshot(nt, s.id, { name });
                if (ok) {
                    showToast("info", "Snapshot Renamed", `Renamed to "${name}"`);
                } else {
                    showToast("error", "Rename Failed", `Failed to rename "${s.name}"`);
                }
                renderList();
            });

            const delBtn = mkButton("X", "#c44", async () => {
                if (!confirm(`Delete snapshot "${s.name}"?`)) return;
                const ok = await apiDeleteSnapshot(s.id);
                if (ok) {
                    showToast("info", "Snapshot Deleted", `"${s.name}" deleted`);
                } else {
                    showToast("error", "Delete Failed", `Failed to delete "${s.name}"`);
                }
                renderList();
            }, true);

            row.appendChild(nameSpan);
            row.appendChild(dateSpan);
            row.appendChild(applyBtn);
            row.appendChild(overwriteBtn);
            row.appendChild(renameBtn);
            row.appendChild(delBtn);
            listContainer.appendChild(row);
        }
    }

    panel.appendChild(listContainer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    renderList();

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
    });
}



function collectWidgetValues(n, targetMapping) {
    if (!n.widgets) return;
    const nt = resolveNodeType(n);
    if (!nt) return;
    for (const w of n.widgets) {
        if (!w.name || w.type === "control_after_generate" || w.options?.isControlWidget) continue;
        targetMapping[nt] = targetMapping[nt] || {};
        targetMapping[nt][w.name] = w.value;
    }
}

function collectLiveWidgets(graph, targetMapping, seen) {
    for (const n of graph._nodes || []) {
        if (seen.has(n) || n.isVirtualNode) continue;
        seen.add(n);
        collectWidgetValues(n, targetMapping);
        if (n.subgraph) collectLiveWidgets(n.subgraph, targetMapping, seen);
        if (n.graph && n.graph !== graph && n.graph !== app.graph) {
            collectLiveWidgets(n.graph, targetMapping, seen);
        }
    }
}

function collectAllLiveNodes() {
    const allNodes = [];
    const seen = new Set();
    function walk(nodes) {
        for (const n of nodes || []) {
            if (seen.has(n)) continue;
            seen.add(n);
            if (n.isVirtualNode) continue;
            allNodes.push(n);
            if (n.subgraph) walk(n.subgraph._nodes);
            if (n.graph && n.graph !== app.graph) walk(n.graph._nodes);
        }
    }
    walk(app.graph._nodes);
    const canvasGraph = app.canvas?.graph;
    if (canvasGraph && canvasGraph !== app.graph) walk(canvasGraph._nodes);
    return allNodes;
}

function applyValuesToLiveNode(liveNode, vals) {
    if (!liveNode.widgets) return false;
    let changed = false;
    for (const w of liveNode.widgets) {
        if (!w.name || w.type === "control_after_generate" || w.options?.isControlWidget) continue;
        if (w.name in vals && w.value !== vals[w.name]) {
            w.value = vals[w.name];
            if (w.callback) w.callback(vals[w.name]);
            changed = true;
        }
    }
    if (liveNode.inputs) {
        for (const inp of liveNode.inputs) {
            if (!inp.widget) continue;
            const wName = inp.widget.name || inp.name;
            if (!wName || !(wName in vals)) continue;
            if (inp.value !== vals[wName]) {
                inp.value = vals[wName];
                changed = true;
            }
        }
    }
    return changed;
}

function applySnapshotDirect(snapshotVals, nodeType) {
    const isBundle = !!snapshotVals.__bundle__;
    const nodes = collectAllLiveNodes();
    let applied = 0;

    for (const n of nodes) {
        const nt = resolveNodeType(n);
        if (!nt) continue;

        let targetVals = null;
        if (isBundle) {
            targetVals = snapshotVals[nt] || null;
        } else if (nt === nodeType) {
            targetVals = snapshotVals;
        }

        if (!targetVals) continue;
        if (applyValuesToLiveNode(n, targetVals)) applied++;
    }

    if (applied > 0) {
        app.graph.change();
        app.canvas?.setDirty(true, true);
    }
    return applied;
}

async function buildSidebar(el) {
    el.innerHTML = "";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 10px;flex-shrink:0;border-bottom:1px solid var(--border-color,#444);";
    const title = document.createElement("span");
    title.textContent = "Parameter Snapshots";
    title.style.cssText = "color:var(--input-text,#ddd);font-size:14px;font-weight:bold;";
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "R";
    refreshBtn.title = "Refresh";
    refreshBtn.style.cssText = "background:var(--comfy-menu-bg,#444);border:1px solid var(--border-color,#666);border-radius:3px;color:var(--input-text,#ccc);cursor:pointer;padding:2px 8px;font-size:12px;";
    header.appendChild(title);
    header.appendChild(refreshBtn);
    container.appendChild(header);

    const listWrap = document.createElement("div");
    listWrap.style.cssText = "flex:1;overflow-y:auto;";
    container.appendChild(listWrap);
    el.appendChild(container);

    async function render() {
        while (listWrap.firstChild) listWrap.firstChild.remove();

        const allData = await fetchAllSnapshots();
        const flat = [];
        for (const [nt, snaps] of Object.entries(allData)) {
            for (const s of snaps) {
                flat.push({ ...s, nodeType: nt });
            }
        }

        if (flat.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No snapshots yet";
            empty.style.cssText = "padding:20px;text-align:center;color:var(--descrip-text,#666);font-size:12px;";
            listWrap.appendChild(empty);
            return;
        }

        for (const s of flat) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 10px;border-bottom:1px solid var(--border-color,#333);font-size:11px;";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = s.name;
            nameSpan.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--input-text,#ddd);";

            const aBtn = mkButton("A", "#4a9", async () => {
                const snapshot = await apiGetSnapshot(s.id);
                if (!snapshot) { showToast("warn", "Not Found", `Snapshot ${s.id} not found`); render(); return; }
                const vals = snapshot.values;
                if (!vals) { showToast("warn", "No Data", "Snapshot has no values"); render(); return; }
                const applied = applySnapshotDirect(vals, s.nodeType);
                if (applied > 0) {
                    showToast("info", "Applied", `"${s.name}" applied to ${applied} node(s)`);
                } else {
                    showToast("warn", "No Match", `No matching nodes found in graph`);
                }
                render();
            }, true);

            const oBtn = mkButton("O", "#a90", async () => {
                const snapshot = await apiGetSnapshot(s.id);
                if (!snapshot) { showToast("warn", "Not Found", `Snapshot ${s.id} not found`); render(); return; }
                const vals = snapshot.values;
                if (!vals) { showToast("warn", "No Data", "Snapshot has no values"); render(); return; }
                if (!confirm(`Overwrite "${s.name}"?`)) { render(); return; }

                const target = {};
                const seen = new Set();
                if (vals.__bundle__) {
                    for (const [nt] of Object.entries(vals)) {
                        if (nt === "__bundle__") continue;
                        target[nt] = {};
                    }
                    collectLiveWidgets(app.graph, target, seen);
                } else {
                    target[s.nodeType] = {};
                    collectLiveWidgets(app.graph, target, seen);
                }

                const result = await apiOverwriteSnapshot(s.id, vals.__bundle__
                    ? { __bundle__: true, ...target }
                    : target[s.nodeType]);
                if (result) {
                    showToast("success", "Overwritten", `"${s.name}" updated`);
                } else {
                    showToast("error", "Overwrite Failed", `Failed to overwrite "${s.name}"`);
                }
                render();
            }, true);

            const rBtn = mkButton("R", "#67a", async () => {
                const name = prompt("Rename to:", s.name);
                if (!name || name === s.name) return;
                const ok = await apiUpdateSnapshot(s.nodeType, s.id, { name });
                if (ok) {
                    showToast("info", "Renamed", `"${s.name}" -> "${name}"`);
                } else {
                    showToast("error", "Rename Failed", `Failed to rename "${s.name}"`);
                }
                render();
            }, true);

            const dBtn = mkButton("X", "#c44", async () => {
                if (!confirm(`Delete "${s.name}"?`)) return;
                const ok = await apiDeleteSnapshot(s.id);
                if (ok) {
                    showToast("info", "Deleted", `"${s.name}" deleted`);
                } else {
                    showToast("error", "Delete Failed", `Failed to delete "${s.name}"`);
                }
                render();
            }, true);

            row.appendChild(nameSpan);
            row.appendChild(aBtn);
            row.appendChild(oBtn);
            row.appendChild(rBtn);
            row.appendChild(dBtn);
            listWrap.appendChild(row);
        }
    }

    refreshBtn.onclick = (e) => { e.stopPropagation(); render(); };
    await render();
}

function getConnectedUpstreamNodes(node) {
    const nodes = [];
    for (const input of node.inputs || []) {
        if (!input.link) continue;
        const link = node.graph.links[input.link];
        if (!link) continue;
        const source = node.graph._nodes.find(n => n.id === link.origin_id);
        if (source) nodes.push(source);
    }
    return nodes;
}

app.registerExtension({
    name: "comfyui.parameter_snapshot",

    init() {
        if (window.__COMFYUI_FRONTEND_VERSION__) {
            app.extensionManager.registerSidebarTab({
                id: "parameter-snapshot",
                icon: "pi pi-bookmark",
                title: "Snapshots",
                tooltip: "Manage parameter snapshots",
                type: "custom",
                render: async (el) => {
                    await buildSidebar(el);
                },
            });
        }
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ParameterSnapshotSaver") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const node = this;
                node.addWidget("button", "Save Snapshot", "save", async function () {
                    const sources = getConnectedUpstreamNodes(node);
                    if (sources.length === 0) {
                        showToast("warn", "Not Connected", "Connect this node to one or more node outputs");
                        return;
                    }

                    const nameWidget = node.widgets.find(w => w.name === "snapshot_name");
                    const name = nameWidget?.value?.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;

                    const bundle = { "__bundle__": true };
                    for (const sourceNode of sources) {
                        const values = getWidgetValues(sourceNode);
                        if (Object.keys(values).length === 0) continue;
                        const srcType = resolveNodeType(sourceNode);
                        bundle[srcType] = values;
                    }
                    const count = Object.keys(bundle).length - 1;

                    if (count === 0) {
                        showToast("warn", "No Parameters", "Connected nodes have no widget values to save");
                        return;
                    }

                    const result = await saveSnapshotWithOverwrite("SnapshotBundle", name, bundle);
                    if (result) {
                        showToast("success", "Snapshot Saved", `"${name}" (${count} node(s))`);
                    }
                });
            };
        }

    },

    getNodeMenuItems(node) {
        const nodeType = node.comfyClass || node.type;
        if (!nodeType) return [];
        if (nodeType === "ParameterSnapshotSaver") return [];

        return [
            {
                content: "Snapshots",
                has_submenu: true,
                submenu: {
                    options: [
                        { content: "Save Current Values...", callback: async () => {
                            const values = getWidgetValues(node);
                            if (Object.keys(values).length === 0) {
                                showToast("warn", "No Parameters", "This node has no widget values to save");
                                return;
                            }
                            const name = prompt("Enter snapshot name:", `Snapshot ${new Date().toLocaleTimeString()}`);
                            if (!name) return;
                            const result = await saveSnapshotWithOverwrite(nodeType, name, values);
                            if (result) showToast("success", "Snapshot Saved", `"${name}" saved`);
                        }},
                        { content: "Manage Snapshots...", callback: () => buildManageDialog(node) },
                    ],
                },
            },
        ];
    },
});
