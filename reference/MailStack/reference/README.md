# Reference

This folder contains **development-only reference materials**.

> **Important:** Nothing inside this folder is part of the actual project source and nothing from this folder should be used directly in the project.

## Rules

- Files and folders inside `reference/` **must never be used directly** in the project.
- The entire `reference/` folder is **development-only** and must **not be included in Git**.
- The `reference/` folder and **all files and subfolders inside it must be ignored by `.gitignore`**.
- Reference materials are kept **only for research and reference purposes**.
- When a specific topic is requested, only the **exact relevant reference** should be extracted from the available materials.
- The extracted reference should then be **adapted and implemented appropriately in the project**, rather than copying or directly using the reference files.
- No reference file, asset, code, design, document, or other material should be treated as an actual project dependency unless explicitly recreated or implemented within the project.
- This folder is **not public** and must never be included in:
    - `git add`
    - `git commit`
    - `git push`
    - project releases
    - project distributions
    - deployment packages

## Purpose

The purpose of this folder is to provide a temporary **development-time reference library** from which specific information, patterns, designs, structures, or other requested references can be studied and followed.

**Reference → Extract relevant information → Adapt → Implement in project**

The original reference materials remain outside the actual project source and are never treated as project files.
