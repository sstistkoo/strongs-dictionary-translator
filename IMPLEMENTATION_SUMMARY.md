# Implementation Summary: Topic-Specific Secondary Prompts

## Changes Made

**File: `js/promptLibrary.js`**

### New Functions Added:

1. **`getStoredTopicSpecificSecondaryPrompt(topicId)`** - Retrieves topic-specific secondary prompt data from localStorage under key `strong_topic_specific_secondary_${topicId}`

2. **`saveStoredTopicSpecificSecondaryPrompt(topicId, data)`** - Saves topic-specific secondary prompt for a specific topic

3. **`deleteStoredTopicSpecificSecondaryPrompt(topicId)`** - Deletes topic-specific secondary prompt for a specific topic

4. **`getTopicSpecificPromptForEdit(topicId)`** - Returns `{system, user}` prompt for editing, loading stored data or falling back to defaults from `getModelTestPromptCatalog()`

### Modified Functions:

1. **`showPromptLibraryModal()`** - Now generates 5 topic-specific tabs (Definice/Vyznam/Kjv/Puvod/Specialista) under the "secondary" category instead of a single generic "Sekundární" tab

2. **`renderPromptList()`** - When on a topic-specific secondary tab, displays the single topic prompt using `getTopicSpecificPromptForEdit()`

3. **`loadDualEditorForCurrentSelection()`** - When on a topic-specific secondary tab, loads the prompt using `getTopicSpecificPromptForEdit()` instead of generic secondary prompts

4. **`applySelectedPrompt()`** - When on a topic-specific secondary tab, saves using `saveStoredTopicSpecificSecondaryPrompt()` instead of the old `getStoredTopicSecondaryPrompts()` array

5. **`deleteTopicSecondaryPrompt()`** - Updated to use `deleteStoredTopicSpecificSecondaryPrompt()` instead of the old array-based storage

6. **`updatePromptActions()`** - When on a topic-specific secondary tab, shows simplified action buttons (Uložit prompt, Použít, Smazat prompt pro toto téma) since there's no list to navigate

### Configuration Variables Added:
- `TOPIC_SECONDARY_PROMPTS_KEY` - Storage key constant
- `TOPIC_LABELS_CS` - Czech labels for the 5 topics
- `TOPIC_IDS_ORDER` - Canonical ordering of topics

### API Exports Added:
- `getStoredTopicSpecificSecondaryPrompt()`
- `saveStoredTopicSpecificSecondaryPrompt()`
- `deleteStoredTopicSpecificSecondaryPrompt()`
- `getTopicSpecificPromptForEdit()`

## Storage Format

Each topic-specific secondary prompt is stored separately in localStorage:
```
strong_topic_specific_secondary_definice  → { system: "...", user: "..." }
strong_topic_specific_secondary_vyznam    → { system: "...", user: "..." }
strong_topic_specific_secondary_kjv       → { system: "...", user: "..." }
strong_topic_specific_secondary_puvod     → { system: "...", user: "..." }
strong_topic_specific_secondary_specialista → { system: "...", user: "..." }
```

## Default Prompts

Default prompts for each topic are loaded from `getModelTestPromptCatalog()` via the mapping in `getDefaultTopicPrompt()`:
- `definice` → `preset_topic_definice_batch`
- `vyznam` → `preset_topic_vyznam_batch`
- `kjv` → `preset_topic_kjv_batch`
- `puvod` → `preset_topic_puvod_batch`
- `specialista` → `preset_topic_specialista_batch`

## UI Behavior

1. Clicking the **"Sekundární"** card (inside the "Default" tab) now shows 5 sub-tabs: **Význam (V)**, **Definice (D)**, **Původ (P)**, **KJV (K)**, **Specialista (S)**

2. Each sub-tab opens a dual-editor (system + user prompt) pre-loaded with:
   - System prompt: Active system message (or stored system prompt)
   - User prompt: Default topic-specific batch prompt from catalog (or stored user prompt)

3. **Uložit prompt** saves the current dual-editor content for that specific topic

4. **Použít** applies the current dual-editor content as active prompts

5. **Smazat prompt pro toto téma** deletes the stored prompt and resets to defaults

## Backward Compatibility

The old generic "Sekundární" list functionality (in `getStoredSecondaryPrompts` / `saveStoredSecondaryPrompts`) remains unchanged and accessible via the regular "secondary" tab (without a topic ID).

The old `getStoredTopicSecondaryPrompts` / `saveStoredTopicSecondaryPrompts` array-based functions are preserved but no longer used by the new topic-specific UI.
