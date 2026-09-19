# Prompt: restructure a vendor card list for import

Paste everything below the line into Claude, and attach the vendor's spreadsheet.
It asks for a `.xlsx` back that this app's importer can read without guessing.

The important part is the **Lookup #** column. It carries the number already
written on the card sleeves. If it is dropped, the app assigns its own numbers
and they will not match the physical cards — which is the whole problem this
avoids.

---

I'm attaching a trading-card inventory spreadsheet from a vendor. Restructure it
into a clean `.xlsx` I can import into my card shop app. Please give me the file
itself, not instructions for making it.

**Output exactly one sheet named `Inventory`, with the header on row 1, and these
columns in this order:**

| Column | Required | What goes in it |
|---|---|---|
| `Lookup #` | **yes, if the source has any numbering** | The vendor's own card number, copied exactly. Do not renumber, do not close gaps, do not invent numbers for rows that lack one. |
| `Category` | **yes** | Must be one of: `NBA`, `Football`. Infer it from the player or set. If you genuinely cannot tell, put `NBA` and flag that row in your summary. |
| `Name` | **yes** | The player's full, correctly spelled name — e.g. `Cooper Flagg`, not `Copper Flagg`; `Manu Ginobili`, not `Manu Ginobli`. For sealed product (boxes, packs, envelopes), use the product name, e.g. `Panini Prizm NBA 2023-24 Hobby Box`. |
| `Series/Set` | no | The set and parallel, e.g. `Panini Prizm (Silver)`, `Topps Midnight (Constellations)`, `Panini Immaculate (MW)`. |
| `Year` | no | Four digits, e.g. `2023`. Leave blank if the source doesn't say — do not guess. |
| `Card Number` | no | The number **printed on the card** by the manufacturer. This is *not* the same as `Lookup #`. Leave blank unless the source clearly has it. |
| `Card Type` | no | `Base`, `Rookie`, `Insert`, `Auto`, `Relic`, `Parallel`, or `Sealed`. |
| `Rarity` | no | The print run as written, e.g. `/99`, `1/1`, `/35`. |
| `Grade` | no | `Raw`, or a grader and score like `PSA 10`, `BGS 9.5`. Use `Raw` when ungraded. |
| `Team` | no | Club or franchise, e.g. `Lakers`, `Inter Miami`. Blank for sealed product. |
| `Cost Basis` | no | What the vendor paid, digits only — strip currency symbols and commas. |
| `Asking Price` | no | Sale price, digits only. |
| `Quantity` | no | Whole number. Default `1`. |
| `Status` | no | `In Stock`, `Sold`, `Reserved`, or `On Hold`. Default `In Stock`. |

**Rules for reading the source, which is usually messy:**

1. **Find the real header row.** It is often not row 1 — there may be a title
   above it, or the number column may have no header at all.
2. **The unheaded left-hand column is almost always the vendor's card number.**
   Map it to `Lookup #`.
3. **Split the free-text description.** A cell like
   `Prizm Cole Palmer 1 of 1` becomes `Name` = `Cole Palmer`,
   `Series/Set` = `Panini Prizm`, `Rarity` = `1/1`.
   `Victor imaculate MW 98` becomes `Name` = `Victor Wembanyama`,
   `Series/Set` = `Panini Immaculate (MW)`, `Card Number` = `98`.
4. **Fix obvious misspellings of player names**, but never change numbers,
   prices or print runs.
5. **Expand nicknames**: `Wemby` → `Victor Wembanyama`, `Kon` → `Kon Knueppel`,
   `J.Mac` → `Jalen McDaniels` *(check against the set — if unsure, keep the
   original text and flag it)*.
6. **Thai headers**: `รายการ` = item/description, `ทุน` = cost basis,
   `ราคา` = price, `จำนวน` = quantity, `ขายแล้ว` = sold.
7. **Multiple sheets or side-by-side tables**: merge everything into the one
   `Inventory` sheet. If two blocks use separate numbering that would collide in
   `Lookup #`, tell me and stop rather than renumbering to fix it.
8. **One card per row.** Never merge two cards, never split one across rows.
9. **Do not drop rows.** If a row is unusable, keep it with whatever is legible
   and list it in your summary.

**Then tell me, in a short summary:**

- How many rows you produced, and the range of `Lookup #` values, including any
  gaps you preserved.
- Every row whose category, name, or number you were unsure about, by
  `Lookup #`.
- Anything you corrected, so I can check you didn't "fix" something real.

---

## After you get the file back

**If the app is empty**, import normally — the importer will pick up `Lookup #`
and keep the vendor's numbering.

**If the cards are already in the app with wrong numbers**, go to Import, tick
**"Re-align numbers only"**, and upload the restructured file. That matches rows
to cards you already have and changes nothing except their lookup numbers, with
a preview first.
