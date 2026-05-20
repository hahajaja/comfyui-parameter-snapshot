import json
import os
import uuid
from datetime import datetime

from aiohttp import web
from server import PromptServer
import folder_paths

SNAPSHOT_DIR = os.path.join(folder_paths.get_user_directory(), "default")
SNAPSHOT_FILE = os.path.join(SNAPSHOT_DIR, "comfyui-parameter-snapshot.json")


def load_snapshots():
    if not os.path.exists(SNAPSHOT_FILE):
        return {}
    try:
        with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_snapshots(data):
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


PREFIX = "/param_snapshot"


@PromptServer.instance.routes.get(PREFIX + "/list/{node_type:.+}")
async def list_snapshots(request):
    node_type = request.match_info["node_type"]
    data = load_snapshots()
    snapshots = data.get(node_type, {}).get("snapshots", [])
    for s in snapshots:
        s.pop("values", None)
    return web.json_response(snapshots)


@PromptServer.instance.routes.get(PREFIX + "/get/{snapshot_id}")
async def get_snapshot(request):
    snapshot_id = request.match_info["snapshot_id"]
    data = load_snapshots()
    for node_data in data.values():
        for s in node_data.get("snapshots", []):
            if s["id"] == snapshot_id:
                return web.json_response(s)
    return web.json_response({"error": "Snapshot not found"}, status=404)


@PromptServer.instance.routes.post(PREFIX + "/save")
async def save_snapshot(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    node_type = body.get("node_type")
    name = body.get("name", "Unnamed")
    values = body.get("values", {})

    if not node_type or not values:
        return web.json_response({"error": "Missing node_type or values"}, status=400)

    data = load_snapshots()
    if node_type not in data:
        data[node_type] = {"snapshots": []}

    snapshot = {
        "id": str(uuid.uuid4()),
        "name": name,
        "created": datetime.now().isoformat(),
        "values": values,
    }
    data[node_type]["snapshots"].append(snapshot)
    save_snapshots(data)

    resp = {k: v for k, v in snapshot.items() if k != "values"}
    return web.json_response(resp)


@PromptServer.instance.routes.post(PREFIX + "/update")
async def update_snapshot(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    node_type = body.get("node_type")
    snapshot_id = body.get("snapshot_id")
    name = body.get("name")
    values = body.get("values")

    if not node_type or not snapshot_id:
        return web.json_response({"error": "Missing node_type or snapshot_id"}, status=400)

    data = load_snapshots()
    snapshots = data.get(node_type, {}).get("snapshots", [])
    for s in snapshots:
        if s["id"] == snapshot_id:
            if name is not None:
                s["name"] = name
            if values is not None:
                s["values"] = values
            s["updated"] = datetime.now().isoformat()
            save_snapshots(data)
            resp = {k: v for k, v in s.items() if k != "values"}
            return web.json_response(resp)

    return web.json_response({"error": "Snapshot not found"}, status=404)


@PromptServer.instance.routes.post(PREFIX + "/delete/{snapshot_id}")
async def delete_snapshot(request):
    snapshot_id = request.match_info["snapshot_id"]
    data = load_snapshots()

    for node_type, node_data in data.items():
        snapshots = node_data.get("snapshots", [])
        before = len(snapshots)
        node_data["snapshots"] = [s for s in snapshots if s["id"] != snapshot_id]
        if len(node_data["snapshots"]) < before:
            save_snapshots(data)
            return web.json_response({"status": "deleted"})

    return web.json_response({"error": "Snapshot not found"}, status=404)


@PromptServer.instance.routes.post(PREFIX + "/overwrite/{snapshot_id}")
async def overwrite_snapshot(request):
    snapshot_id = request.match_info["snapshot_id"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    values = body.get("values", {})
    name = body.get("name")

    data = load_snapshots()
    for node_type, node_data in data.items():
        for s in node_data.get("snapshots", []):
            if s["id"] == snapshot_id:
                if values is not None:
                    s["values"] = values
                if name is not None:
                    s["name"] = name
                s["updated"] = datetime.now().isoformat()
                save_snapshots(data)
                resp = {k: v for k, v in s.items() if k != "values"}
                return web.json_response(resp)

    return web.json_response({"error": "Snapshot not found"}, status=404)


@PromptServer.instance.routes.get(PREFIX + "/types")
async def list_types(request):
    data = load_snapshots()
    types = [{"node_type": k, "count": len(v.get("snapshots", []))} for k, v in data.items()]
    return web.json_response(types)


@PromptServer.instance.routes.get(PREFIX + "/all")
async def list_all_snapshots(request):
    data = load_snapshots()
    result = {}
    for node_type, node_data in data.items():
        snapshots = []
        for s in node_data.get("snapshots", []):
            entry = {}
            for k, v in s.items():
                if k == "values":
                    if isinstance(v, dict) and v.get("__bundle__"):
                        entry["__bundle_types__"] = [t for t in v.keys() if t != "__bundle__"]
                else:
                    entry[k] = v
            snapshots.append(entry)
        result[node_type] = snapshots
    return web.json_response(result)
