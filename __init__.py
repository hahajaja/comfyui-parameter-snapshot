WEB_DIRECTORY = "./web/js"


class ParameterSnapshotSaver:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "snapshot_name": ("STRING", {"default": "", "multiline": False}),
            },
            "optional": {
                "node_1": ("*", {}),
                "node_2": ("*", {}),
                "node_3": ("*", {}),
                "node_4": ("*", {}),
                "node_5": ("*", {}),
                "node_6": ("*", {}),
                "node_7": ("*", {}),
                "node_8": ("*", {}),
            },
        }

    CATEGORY = "parameter-snapshot"
    FUNCTION = "noop"
    RETURN_TYPES = ()

    def noop(self, snapshot_name, node_1=None, node_2=None, node_3=None, node_4=None, node_5=None, node_6=None, node_7=None, node_8=None):
        return ()


class SnapshotManager:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {}}

    CATEGORY = "parameter-snapshot"
    FUNCTION = "noop"
    RETURN_TYPES = ()
    OUTPUT_NODE = True

    def noop(self):
        return {}


NODE_CLASS_MAPPINGS = {
    "ParameterSnapshotSaver": ParameterSnapshotSaver,
    "SnapshotManager": SnapshotManager,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ParameterSnapshotSaver": "Parameter Snapshot Saver",
    "SnapshotManager": "Snapshot Manager",
}

__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

from . import snapshot_api
