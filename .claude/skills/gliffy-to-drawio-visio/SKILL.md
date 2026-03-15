---
name: gliffy-to-drawio-visio
description: Convert Gliffy diagrams (.gliffy/.json) into draw.io (.drawio) and Visio (.vsdx) diagrams with a repeatable workflow, validation checklist, and batch-friendly process guidance.
allowed-tools: Read, Write, Bash
---

# Gliffy to draw.io and Visio Converter

This skill standardizes how to convert Gliffy diagrams into draw.io and Visio outputs while preserving layout, labels, and connector direction whenever possible.

## When to Use This Skill

Use this skill when a user asks to:

- Convert a `.gliffy` file to `.drawio`
- Migrate Gliffy diagrams to Visio (`.vsdx`)
- Bulk-migrate a folder of legacy Gliffy diagrams
- Validate post-conversion fidelity (shapes, text, connectors)

## Input and Output

**Input:**
- Gliffy source files (`.gliffy` or Gliffy JSON exports)

**Output:**
- draw.io diagrams (`.drawio`)
- Visio diagrams (`.vsdx`)

## Preferred Conversion Path

Use diagrams.net (draw.io) as the conversion bridge:

1. Import Gliffy into diagrams.net
2. Save as `.drawio`
3. Export to `.vsdx`

This path is the most reliable because diagrams.net has native Gliffy import support and can export to Visio format.

## Standard Workflow

1. **Collect files**
- Confirm all source Gliffy files and target output folder.
- Keep originals untouched.

2. **Convert Gliffy to draw.io**
- Open diagrams.net (desktop or web).
- Use `File -> Import From -> Device` and select the Gliffy file.
- Immediately save as a `.drawio` file.

3. **Convert draw.io to Visio**
- With the imported diagram open, use `File -> Export as -> VSDX`.
- Save output as `.vsdx`.

4. **Validate fidelity**
- Check shape count and rough positions.
- Verify connector endpoints and arrow directions.
- Verify text labels and multiline formatting.
- Check page size/orientation.

5. **Record migration notes**
- For each converted file, note any manual fixes required.
- Track unsupported shapes or style differences.

## Batch Conversion Guidance

For many files, use an iterative queue:

1. Create a migration checklist (source, drawio output, vsdx output, status).
2. Convert each diagram in the same sequence: import -> save `.drawio` -> export `.vsdx`.
3. Mark each row as `done`, `needs-fix`, or `blocked`.

Suggested CSV columns:

`source_file, drawio_file, vsdx_file, status, notes`

## Quality Checklist

Run this checklist on every converted file:

- All expected pages/tabs exist
- Critical connectors still attached to correct shapes
- No missing labels
- Font sizes are readable and consistent
- Swimlanes/containers preserve grouping
- Final `.drawio` opens cleanly in diagrams.net
- Final `.vsdx` opens cleanly in Visio

## Known Limitations

- Some Gliffy-specific styles may not map perfectly.
- Complex shadows, gradients, or custom icons may require manual cleanup.
- Text wrapping and font fallback may differ between tools.

## Manual Fix Playbook

If conversion quality is off:

1. Fix connector routing first (diagram meaning depends on this).
2. Fix text clipping/wrapping next.
3. Adjust shape styles/colors last.
4. Re-export `.vsdx` after fixes are complete.

## Agent Response Pattern

When invoked, the agent should:

1. Confirm source files and desired output location.
2. Follow the standard workflow for each file.
3. Report converted files and any fidelity issues.
4. Provide a concise post-migration summary with `needs-fix` items.

## Example User Requests

- "Convert these 12 Gliffy diagrams to draw.io and Visio."
- "Migrate this architecture diagram from Gliffy to draw.io."
- "I need a `.vsdx` version of this Gliffy flowchart."
