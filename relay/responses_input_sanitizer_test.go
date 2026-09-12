package relay

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizeResponsesInputInvalidCustomToolID(t *testing.T) {
	input := json.RawMessage(`[{"type":"custom_tool_call","id":"fc_bad","call_id":"call_1","name":"exec","input":"{}"}]`)

	got, changed, err := sanitizeResponsesInput(input)

	require.NoError(t, err)
	require.True(t, changed)
	require.JSONEq(t, `[{"type":"custom_tool_call","call_id":"call_1","name":"exec","input":"{}"}]`, string(got))
	require.JSONEq(t, string(input), string(input))
}

func TestSanitizeResponsesInputDropsInvalidReasoningItem(t *testing.T) {
	input := json.RawMessage(`[{"type":"reasoning","id":"fc_bad","encrypted_content":"opaque"},{"type":"message","id":"msg_ok","role":"user"}]`)

	got, changed, err := sanitizeResponsesInput(input)

	require.NoError(t, err)
	require.True(t, changed)
	require.JSONEq(t, `[{"type":"message","id":"msg_ok","role":"user"}]`, string(got))
}

func TestSanitizeResponsesInputKeepsValidAndScalarInput(t *testing.T) {
	valid := json.RawMessage(`[{"type":"custom_tool_call","id":"ctc_ok","name":"exec"}]`)
	got, changed, err := sanitizeResponsesInput(valid)
	require.NoError(t, err)
	require.False(t, changed)
	require.JSONEq(t, string(valid), string(got))

	scalar := json.RawMessage(`"hello"`)
	got, changed, err = sanitizeResponsesInput(scalar)
	require.NoError(t, err)
	require.False(t, changed)
	require.Equal(t, string(scalar), string(got))
}
