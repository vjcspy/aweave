# 📋 [SUDOKU-GAME: 2026-02-18] - Sudoku Puzzle Game cho Homepage

## References

- Current homepage: `projects/k/misc/git-relay-vercel/src/app/page.tsx`
- Project root: `projects/k/misc/git-relay-vercel/`
- Git Patch Relay plan: `devdocs/projects/k/misc/plans/260208-git-patch-relay.md`

## User Requirements

- Thay đổi homepage `projects/k/misc/git-relay-vercel` thành game giải đố Sudoku
- Giao diện đẹp, hiện đại
- Có chọn nhiều độ khó (Easy, Medium, Hard, Expert)
- Sử dụng **shadcn/ui** + **TailwindCSS**

## 🎯 Objective

Thay thế trang homepage hiện tại (Next.js Playground status page) bằng một game Sudoku hoàn chỉnh, với giao diện premium, nhiều độ khó, và sử dụng shadcn/ui + TailwindCSS cho styling.

### ⚠️ Key Considerations

1. **API routes giữ nguyên**: Các API relay routes tại `src/app/api/relay/` và helper `src/lib/forward.ts` **KHÔNG được sửa đổi** — chúng vẫn phục vụ cho hệ thống git-patch-relay.

2. **TailwindCSS + shadcn cần setup từ đầu**: Project hiện tại chưa có TailwindCSS hay shadcn. Cần cài đặt và configure cả hai.

3. **Sudoku logic chạy client-side**: Toàn bộ game logic (generate board, validate, solve) chạy trên client — không cần backend API.

4. **TailwindCSS version**: Dùng **TailwindCSS v4** (latest, phù hợp với Next.js 15).

---

## 🔄 Implementation Plan

### Phase 1: Setup TailwindCSS v4 + shadcn/ui

- [x] Cài TailwindCSS v4 cho Next.js 15
  - `pnpm add tailwindcss @tailwindcss/postcss postcss`
  - Tạo `postcss.config.mjs` với plugin `@tailwindcss/postcss`
  - Tạo `src/app/globals.css` với `@import "tailwindcss"`
  - Import `globals.css` trong `layout.tsx`
- [x] Cài shadcn/ui
  - `pnpx shadcn@latest init --defaults --yes`
  - Cài components: `button`, `card`, `select`, `badge`, `dialog`, `separator`

**Kết quả:**

- TailwindCSS v4.1.18, PostCSS 8.5.6
- shadcn tự động merge vào `globals.css` — thêm `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@theme inline` block, `:root`/`.dark` CSS variables
- Dark theme dùng **oklch** color space cho palette indigo/purple premium
- Custom CSS animations: `cell-pop`, `cell-shake`, `fade-in-number`, `glow-pulse`
- Sudoku-specific CSS variables: `--cell-given`, `--cell-user`, `--cell-highlight`, `--cell-selected`, `--cell-same-number`, `--cell-error`, `--cell-error-text`, `--cell-note`

### Phase 2: Sudoku Engine (`src/lib/sudoku/`)

> Core logic thuần TypeScript, không phụ thuộc React.

#### File Structure

```
src/lib/sudoku/
├── types.ts              # ✅ Types: Board, Cell, Difficulty, HistoryEntry
├── generator.ts          # ✅ Sudoku board generation
├── solver.ts             # ✅ Backtracking solver + validation
└── utils.ts              # ✅ Helpers: copy board, check conflicts, format time
```

- [x] **`types.ts`** — Type definitions

  ```typescript
  export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // 0 = empty
  export type Board = CellValue[][];  // 9x9

  export interface Cell {
    value: CellValue;
    isGiven: boolean;       // true = clue ban đầu, không sửa được
    isError: boolean;       // true = conflict với row/col/box
    notes: Set<number>;     // pencil marks (1-9)
  }

  export type CellGrid = Cell[][];
  export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

  export interface DifficultyConfig {
    label: string;
    removedCells: [number, number]; // [min, max] — range thay vì fixed number
    description: string;
    emoji: string;                  // emoji icon cho mỗi level
  }

  export const DIFFICULTIES: Record<Difficulty, DifficultyConfig>; // exported config object

  export type GameState = 'playing' | 'won' | 'paused';

  export interface HistoryEntry {
    row: number;
    col: number;
    prevValue: CellValue;
    prevNotes: Set<number>;
    newValue: CellValue;
    newNotes: Set<number>;
  }
  ```

  **Thay đổi so với plan ban đầu:**
  - `DifficultyConfig.removedCells` dùng `[min, max]` tuple thay vì single number — generator random trong range
  - Thêm `emoji` field cho UI
  - Thêm `DIFFICULTIES` constant object export trực tiếp từ types
  - Thêm `GameState` và `HistoryEntry` types (ban đầu chưa define rõ)

- [x] **`solver.ts`** — Backtracking solver
  - `isValid(board, row, col, num): boolean` — check conflict row/col/box
  - `solve(board): boolean` — giải board in-place, trả về boolean (không phải Board | null)
  - `countSolutions(board, limit=2): number` — đếm solutions tới limit
  - `hasUniqueSolution(board): boolean` — verify chỉ 1 solution

  **Thay đổi so với plan:**
  - `solve()` return `boolean` và mutate in-place thay vì return `Board | null`
  - Thêm `countSolutions()` public function (ban đầu chỉ nêu concept)

- [x] **`generator.ts`** — Board generation
  - `generateSolvedBoard(): Board` — randomized backtracking fill
  - `generatePuzzle(difficulty): { puzzle: Board; solution: Board }` — remove cells, verify unique solution

  Difficulty config:

  | Difficulty | Removed Cells | Description |
  |------------|---------------|-------------|
  | Easy       | 30-35         | Perfect for beginners |
  | Medium     | 36-45         | A balanced challenge |
  | Hard       | 46-52         | For experienced players |
  | Expert     | 53-58         | Only the bravest |

  **Implementation details:**
  - Fisher-Yates shuffle cho randomness
  - Shuffle all 81 positions, try removing each one
  - After each removal, call `hasUniqueSolution()` — nếu fail thì restore cell
  - Đảm bảo puzzle luôn có exactly 1 solution

- [x] **`utils.ts`** — Utilities
  - `copyBoard(board): Board`
  - `createCellGrid(puzzle): CellGrid` — tạo CellGrid từ raw Board
  - `findConflicts(grid): Set<string>` — trả về set `"row-col"` keys
  - `isBoardComplete(grid): boolean`
  - `formatTime(seconds): string` — format "mm:ss"
  - `getNumberCounts(grid): Record<number, number>` — đếm occurrences mỗi số
  - `cloneCellGrid(grid): CellGrid` — deep clone including Sets

  **Thêm so với plan:**
  - `createCellGrid()` — convert raw Board thành CellGrid
  - `getNumberCounts()` — phục vụ number pad remaining count
  - `cloneCellGrid()` — cần cho immutable state updates

### Phase 3: React Components (`src/components/sudoku/`)

#### File Structure

```
src/components/sudoku/
├── sudoku-game.tsx        # ✅ Main game container (state management)
├── sudoku-board.tsx       # ✅ 9x9 board grid
├── sudoku-cell.tsx        # ✅ Individual cell (input, selection, highlight)
├── number-pad.tsx         # ✅ Number input pad (1-9 + erase + notes)
├── game-controls.tsx      # ✅ Controls bar (undo, hint, new game)
├── difficulty-selector.tsx # ✅ Difficulty picker (pill buttons)
├── game-header.tsx        # ✅ Difficulty badge + timer + mistakes counter
└── win-dialog.tsx         # ✅ Congratulations dialog
```

- [x] **`sudoku-game.tsx`** — Main game component (client component, ~280 lines)
  - State: `grid`, `solution`, `selectedCell`, `difficulty`, `timer`, `gameState`, `mistakes`, `isNotesMode`, `history`, `conflicts`, `cellAnimations`, `showDifficultyPicker`, `showWinDialog`, `isGenerating`
  - Features:
    - Cell selection + number input (keyboard + pad)
    - Notes mode toggle (N key hoặc button)
    - Undo (Ctrl/Cmd+Z hoặc button) — full history stack
    - Hint — reveal correct value cho selected/random empty cell
    - Mistakes tracking (max 3 → game over, auto-reveal solution)
    - Timer auto-increment khi playing
    - Win detection khi board complete + no conflicts
    - **Difficulty picker full-screen** khi mới vào hoặc change difficulty
    - **Game over overlay** khi 3 mistakes — show solution + try again
  - Keyboard support: 1-9 input, Delete/Backspace erase, N notes, arrow keys navigate, Ctrl+Z undo
  - Board generation chạy trong `setTimeout(_, 50)` để UI hiển thị "Generating..." state

  **Thay đổi so với plan:**
  - Thêm `mistakes` tracking (3 max) — ban đầu plan ghi "(optional)"
  - Thêm game over screen khi max mistakes
  - Difficulty picker là full-screen thay vì modal/dropdown
  - Puzzle generation có "Generating..." loading state
  - Hint tự động set cell thành `isGiven: true` (permanent)
  - Khi place correct number, auto-remove notes cùng row/col/box

- [x] **`sudoku-board.tsx`** — Board rendering
  - 9×9 CSS Grid layout
  - Bold borders cho 3×3 boxes: `border-2` + `oklch(0.4_0.05_277)` color
  - Rounded corners cho 4 góc board
  - Outer glow shadow: `shadow-[0_0_30px_oklch(0.585_0.233_277_/_0.12)]`
  - Computed highlights: selected cell, same row/col/box, same number

- [x] **`sudoku-cell.tsx`** — Cell component (memoized via `React.memo`)
  - Display: number hoặc pencil marks (3×3 grid notes)
  - Visual states: given (bold white), user-input (indigo), selected (glow pulse), highlighted, error (red bg + text)
  - Dynamic border classes cho 3×3 box edges
  - Corner radius cho 4 board corners
  - Aria labels cho accessibility

- [x] **`number-pad.tsx`** — Number input
  - 9 buttons grid với remaining count (nhỏ bên dưới số)
  - Disable khi number đã đủ 9 lần
  - Notes toggle button (highlight khi ON)
  - Erase button
  - SVG icons cho Notes và Erase

- [x] **`game-controls.tsx`** — Control bar
  - Undo button (disabled khi no history)
  - Hint button
  - New Game button (primary style)
  - SVG icons cho mỗi button

- [x] **`difficulty-selector.tsx`** — Difficulty picker (compact, pill-style)
  - 4 pills: emoji + label
  - Active state: `bg-primary` + shadow
  - Hover: scale effect

- [x] **`game-header.tsx`** — Header bar
  - shadcn Badge cho difficulty (emoji + label)
  - Timer với clock icon (font-mono tabular-nums)
  - Mistakes counter: 3 ✕ markers (red khi used)

- [x] **`win-dialog.tsx`** — Win dialog
  - shadcn Dialog component
  - 🎉 emoji + "Congratulations!"
  - Stats grid: Difficulty, Time, Mistakes
  - Buttons: Play Again (primary), Change Difficulty (outline)

### Phase 4: Update Homepage + Layout

- [x] **`src/app/layout.tsx`** — Updated
  - Import `globals.css`
  - Inter font via `next/font/google` (variable `--font-inter`)
  - `<html lang="en" className="dark">` — always dark mode
  - Body: `font-sans m-0 antialiased`
  - Metadata: `title: 'Sudoku — Challenge Your Mind'`

- [x] **`src/app/page.tsx`** — Replaced hoàn toàn
  - Single import + render `<SudokuGame />`
  - Server component wrapper cho client game component

### Phase 5: UI/UX Polish

- [x] **Dark theme** mặc định — oklch color space, gradient background `from-background to-[oklch(0.14_0.03_280)]`
- [x] **Color palette**:
  - Primary: `oklch(0.585 0.233 277)` — indigo
  - Accent: `oklch(0.68 0.17 277)` — lighter indigo
  - Cell given: `oklch(0.93 0.01 260)` — bright white
  - Cell user: `oklch(0.68 0.17 277)` — indigo tint
  - Cell error: `oklch(0.65 0.2 25)` — warm red
  - Cell highlight: primary @ 8% opacity
  - Cell selected: primary @ 22% opacity
  - Notes: `oklch(0.55 0.02 260)` — muted gray
- [x] **Animations**:
  - `cell-pop`: scale 1→1.08→1 (hint reveal)
  - `cell-shake`: translateX shake (error)
  - `fade-in-number`: opacity 0→1 + scale 0.7→1 (correct input)
  - `glow-pulse`: box-shadow pulse (selected cell)
- [x] **Responsive design**: `max-w-[min(80vw,420px)]` cho board, scale down trên mobile
- [x] **Keyboard support đầy đủ**: Arrow keys navigate, 1-9 input, Delete/Backspace clear, N toggle notes, Ctrl+Z undo

---

## 📊 Summary of Results

### ✅ Completed Achievements

- Game Sudoku hoàn chỉnh thay thế homepage Next.js Playground
- 4 difficulty levels với unique solution guarantee
- Full keyboard + click support
- Notes mode, Undo, Hints
- Mistakes tracking (3 max → game over)
- Timer, difficulty badge, win dialog
- Dark theme premium với oklch colors + animations
- API relay routes không bị ảnh hưởng
- `pnpm build` pass — 0 TypeScript errors
- Homepage bundle: 27kB (optimized)

### Dependencies Added

```json
{
  "dependencies": {
    "tailwindcss": "4.1.18",
    "@tailwindcss/postcss": "4.1.18",
    "postcss": "8.5.6",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^3",
    "tw-animate-css": "^1",
    "lucide-react": "^0.511",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-select": "^2",
    "@radix-ui/react-separator": "^1",
    "@radix-ui/react-slot": "^1"
  }
}
```

### Full File Structure (after implementation)

```
projects/k/misc/git-relay-vercel/
├── package.json                    # ✅ Updated dependencies
├── postcss.config.mjs              # ✅ NEW — @tailwindcss/postcss plugin
├── next.config.ts                  # Unchanged
├── tsconfig.json                   # Auto-updated by Next.js (added .next/types)
├── components.json                 # ✅ NEW — shadcn config (auto-generated)
└── src/
    ├── app/
    │   ├── globals.css             # ✅ REPLACED — Tailwind + shadcn + dark theme + animations
    │   ├── layout.tsx              # ✅ MODIFIED — Inter font, dark class, Sudoku metadata
    │   ├── page.tsx                # ✅ REPLACED — SudokuGame component
    │   └── api/relay/              # Unchanged (chunk, complete, status routes)
    ├── components/
    │   ├── sudoku/
    │   │   ├── sudoku-game.tsx     # ✅ NEW — Main game state manager (~280 lines)
    │   │   ├── sudoku-board.tsx    # ✅ NEW — 9×9 grid rendering
    │   │   ├── sudoku-cell.tsx     # ✅ NEW — Cell with states/animations (memoized)
    │   │   ├── number-pad.tsx      # ✅ NEW — Number input + notes + erase
    │   │   ├── game-controls.tsx   # ✅ NEW — Undo, Hint, New Game
    │   │   ├── difficulty-selector.tsx # ✅ NEW — Pill-style difficulty picker
    │   │   ├── game-header.tsx     # ✅ NEW — Badge + timer + mistakes
    │   │   └── win-dialog.tsx      # ✅ NEW — Congratulations dialog
    │   └── ui/                     # ✅ NEW — shadcn components (auto-generated)
    │       ├── badge.tsx
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── dialog.tsx
    │       ├── select.tsx
    │       └── separator.tsx
    └── lib/
        ├── forward.ts              # Unchanged (relay helper)
        ├── utils.ts                # ✅ NEW — shadcn cn() utility (auto-generated)
        └── sudoku/
            ├── types.ts            # ✅ NEW — Board, Cell, Difficulty, HistoryEntry types
            ├── solver.ts           # ✅ NEW — Backtracking solver + unique solution check
            ├── generator.ts        # ✅ NEW — Randomized puzzle generation
            └── utils.ts            # ✅ NEW — Conflict detection, grid helpers
```

## Verification Plan

### Browser Testing

Sau khi implement xong, verify bằng cách:

1. **Chạy dev server:**

   ```bash
   cd projects/k/misc/git-relay-vercel && pnpm dev
   ```

2. **Kiểm tra trên browser** tại `http://localhost:3000`:
   - [x] Homepage hiển thị Sudoku game thay vì Next.js Playground
   - [x] Có thể chọn difficulty (Easy/Medium/Hard/Expert)
   - [x] Board render đúng 9x9, có bold borders cho 3x3 boxes
   - [x] Click cell → highlight cell + row/col/box
   - [x] Nhập số qua keyboard (1-9) và number pad
   - [x] Given cells (clues) không sửa được
   - [x] Conflict detection: highlight cells lỗi khi nhập số trùng
   - [x] Notes mode: toggle on → input thành pencil marks nhỏ
   - [x] Undo hoạt động
   - [x] Timer chạy khi playing
   - [x] Win dialog hiện khi hoàn thành đúng
   - [x] New Game tạo board mới
   - [x] Responsive: thu nhỏ browser → layout vẫn ok
   - [x] API relay routes vẫn hoạt động: `GET /api/relay/status/test` trả về response (không bị ảnh hưởng)

3. **Build check:**

   ```bash
   cd projects/k/misc/git-relay-vercel && pnpm build
   ```

   - [x] Build thành công, không lỗi TypeScript
   - [x] Build output:

     ```
     Route (app)                                 Size  First Load JS
     ┌ ○ /                                      27 kB         129 kB
     ├ ○ /_not-found                            996 B         103 kB
     ├ ƒ /api/relay/chunk                       130 B         102 kB
     ├ ƒ /api/relay/complete                    130 B         102 kB
     └ ƒ /api/relay/status/[sessionId]          130 B         102 kB
     ```
