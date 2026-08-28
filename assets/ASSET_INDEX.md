# Asset Library Index

This branch is dedicated to game art assets only.

## Rules

- Do not modify `main` or `dev` from this branch.
- Do not modify HTML, CSS, or JavaScript game code here.
- Do not delete or overwrite existing game assets.
- If a filename already exists, create a new unique filename instead of overwriting it.
- Use lowercase English filenames with hyphens, for example: `fire-phoenix-skill-icon-01.png`.
- Prefer descriptive names that identify category, purpose, variant, and sequence.
- Each uploaded asset batch should be committed and pushed only to `assets-library`.
- Other development branches should selectively copy only required assets from this branch. Do not merge the entire `assets-library` branch into `main` or `dev`.

## Folder Structure

- `assets/characters/players/male/`
- `assets/characters/players/female/`
- `assets/characters/npcs/`
- `assets/characters/enemies/`
- `assets/characters/bosses/`
- `assets/skills/fire/`
- `assets/skills/water/`
- `assets/skills/earth/`
- `assets/skills/wind/`
- `assets/skills/neutral/`
- `assets/skills/ex/`
- `assets/equipment/weapons/`
- `assets/equipment/armor/`
- `assets/equipment/accessories/`
- `assets/equipment/sets/`
- `assets/items/consumables/`
- `assets/items/materials/`
- `assets/items/quest/`
- `assets/items/treasure/`
- `assets/maps/town/`
- `assets/maps/dungeons/`
- `assets/maps/abyss/`
- `assets/maps/boss/`
- `assets/maps/backgrounds/`
- `assets/ui/navigation/`
- `assets/ui/buttons/`
- `assets/ui/icons/`
- `assets/ui/panels/`
- `assets/ui/portraits/`
- `assets/ui/loading/elemental/`
- `assets/effects/battle/`
- `assets/effects/status/`
- `assets/effects/buffs/`
- `assets/effects/debuffs/`
- `assets/effects/environment/`

## Asset Mapping

| Original purpose | New filename | GitHub path |
| --- | --- | --- |
| _No binary assets imported yet_ | — | — |

## Pending Binary Import

The following images were supplied in chat and classified. Their target names and paths are reserved, but the current GitHub connector cannot stream chat-attachment binary bytes into repository blobs. Do not reuse these filenames for other assets. When binary upload capability is available, import the exact supplied files to these target paths and then move these rows into **Asset Mapping**.

| Original purpose | New filename | Target GitHub path | SHA-256 of supplied file |
| --- | --- | --- | --- |
| 火元素轉場載入美術圖 | `loading-element-fire.jpg` | `assets/ui/loading/elemental/loading-element-fire.jpg` | `bcfca98f97020c01f4d112ea8d072efdd06b37f4198f17815b71550090e105d7` |
| 水元素轉場載入美術圖 | `loading-element-water.jpg` | `assets/ui/loading/elemental/loading-element-water.jpg` | `8e1d8d0233ba4c6c386cc67f3d55e9acaaac38395ecb6859d76e1ea9b6cde7dd` |
| 土元素轉場載入美術圖 | `loading-element-earth.jpg` | `assets/ui/loading/elemental/loading-element-earth.jpg` | `4be47f50505cc723ecf3a1228607f4dc16e44d6ed3e53ffdfb2a2792d7e84cc4` |
| 風元素轉場載入美術圖 | `loading-element-wind.jpg` | `assets/ui/loading/elemental/loading-element-wind.jpg` | `c53424a8e9f06090d03d9efbc8a509733d665277c5ac3793e93fad87d4a88114` |

## Handoff Note

After V146 finishes its original pending release flow and is confirmed safe, read this `assets-library` branch and `assets/ASSET_INDEX.md`. When a new image is needed, selectively copy only the required asset(s) into the active development branch. Do not merge or overwrite `main` with the entire asset branch.
