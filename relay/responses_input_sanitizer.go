package relay

import (
	"encoding/json"
	"strings"
)

// sanitizeResponsesInput removes response item IDs that are incompatible with
// their concrete item type. Codex can persist malformed IDs in rollout history;
// forwarding those IDs makes the next request fail validation.
//
// The request is deep-copied before this function is called, so persisted
// client history and the original request remain unchanged.
func sanitizeResponsesInput(input json.RawMessage) (json.RawMessage, bool, error) {
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(input, &items); err != nil {
		// Responses also permits a scalar input form. There are no item IDs to
		// sanitize in that form.
		return input, false, nil
	}

	changed := false
	kept := items[:0]
	for _, item := range items {
		var itemType, id string
		_ = json.Unmarshal(item["type"], &itemType)
		_ = json.Unmarshal(item["id"], &id)

		expected, known := responsesItemIDPrefixes[itemType]
		if !known || id == "" || strings.HasPrefix(id, expected) {
			kept = append(kept, item)
			continue
		}

		changed = true
		switch itemType {
		case "reasoning", "compaction":
			// Provider-specific encrypted state cannot be safely replayed.
			continue
		default:
			// Keep portable content and linkage fields, but omit the invalid
			// historical ID so the upstream API can handle the item normally.
			delete(item, "id")
			kept = append(kept, item)
		}
	}

	if !changed {
		return input, false, nil
	}
	result, err := json.Marshal(kept)
	if err != nil {
		return nil, false, err
	}
	return result, true, nil
}

var responsesItemIDPrefixes = map[string]string{
	"message":                 "msg_",
	"function_call":           "fc_",
	"function_call_output":    "fco_",
	"custom_tool_call":        "ctc_",
	"custom_tool_call_output": "ctco_",
	"reasoning":               "rs_",
	"compaction":              "rs_",
	"web_search_call":         "ws_",
	"file_search_call":        "fs_",
	"computer_call":           "cu_",
	"computer_call_output":    "cuo_",
	"image_generation_call":   "ig_",
}
