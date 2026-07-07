"use client";

import { useState } from "react";
import {
  useFilterPresets,
  useCreateFilterPreset,
  useDeleteFilterPreset,
  type FilterPresetValues,
} from "@/lib/data/filterPresets";

export function FilterPresetsBar({
  category,
  currentFilters,
  onApply,
}: {
  category: string | null;
  currentFilters: FilterPresetValues;
  onApply: (filters: FilterPresetValues) => void;
}) {
  const { data: presets } = useFilterPresets(category ?? undefined);
  const createPreset = useCreateFilterPreset();
  const deletePreset = useDeleteFilterPreset();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-foreground/50">Presets:</span>
      {presets?.map((preset) => (
        <span key={preset.id} className="flex items-center gap-1 rounded-full border border-border-1 px-2 py-1">
          <button onClick={() => onApply(preset.filterJson)} className="hover:underline">
            {preset.name}
          </button>
          <button
            onClick={() => deletePreset.mutate(preset.id)}
            aria-label={`Delete preset ${preset.name}`}
            className="text-foreground/40 hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}
      {!naming ? (
        <button onClick={() => setNaming(true)} className="rounded-full border border-dashed border-border-1 px-2 py-1 hover:bg-surface-1">
          + Save current filters
        </button>
      ) : (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name"
            className="rounded-md border border-border-1 px-2 py-1"
          />
          <button
            onClick={async () => {
              if (!name.trim()) return;
              await createPreset.mutateAsync({ name: name.trim(), category, filterJson: currentFilters });
              setName("");
              setNaming(false);
            }}
            className="rounded-md bg-accent px-2 py-1 text-white"
          >
            Save
          </button>
          <button onClick={() => setNaming(false)} className="rounded-md px-2 py-1 hover:bg-surface-1">
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
