# Pilar Absensi UI Guidelines

When adding new features or modifying the UI for this application, you MUST strictly follow these specific design standards to ensure consistency. A premium, modern, and cohesive look is the absolute priority.

## 1. Color Palette (3-Color Rule)
Strictly use the following 3 colors (and their Tailwind shades) for all UI components. Do NOT use generic vibrant colors like `green-500`, `red-500`, or `blue-500` unless explicitly requested.
- **Pilar Darker**: `pilar-dark`, `pilar-darker`, `gray-800`, `gray-900`, `black`. (Use for primary text, active states, dark backgrounds, and primary buttons).
- **Pilar Gold**: `pilar-gold`, `pilar-goldHover`. (Use for accents, highlights, active icons, and text inside dark buttons).
- **White / Gray**: `white`, `gray-50`, `gray-100`, `gray-200`, `gray-300`, `gray-400`, `gray-500`, `gray-600`. (Use for card backgrounds, borders, inactive states, secondary text, and soft backgrounds).

## 2. Standard Shapes & Layout
- **Main Wrappers/Containers**: Use `rounded-[2rem]` with `shadow-[0_8px_30px_rgb(0,0,0,0.04)]` and `border border-gray-100/60`.
- **Inputs & Search Bars**: Use `rounded-xl` with `border-gray-200`, soft `shadow-sm`, and `focus:ring-1 focus:ring-pilar-darker focus:border-pilar-darker`.
- **Primary Buttons (e.g. Export, Tambah)**: Use `bg-pilar-darker text-pilar-gold font-bold rounded-xl shadow-md hover:bg-black hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all`. Do not use standard green or blue for actions.

## 3. Data Tables (Floating Card Style)
We DO NOT use standard flat HTML tables. All tables must be formatted as **Floating Card Grids** using `border-separate`.
**Implementation details for Tables:**
- **Table Element**: `<table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>`
- **Table Row (`<tr>`)**: `<tr className="group transition-all duration-300 hover:-translate-y-1 relative z-10">`
- **First Table Cell (`<td>`)**: `bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40`
- **Middle Table Cells (`<td>`)**: Same as above but only `border-y` (no `border-l` or `border-r`).
- **Last Table Cell (`<td>`)**: Same as above but `rounded-r-2xl` and `border-y border-r`.

## 4. Micro-interactions & Glassmorphism
- **Hover Effects on Standard Cards**: Interactive standalone cards should use `hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300`.
- **Icon Boxes**: Wrapper for icons should be `w-14 h-14 rounded-2xl bg-gray-100 text-pilar-darker group-hover:bg-pilar-darker group-hover:text-pilar-gold group-hover:scale-105 transition-all duration-300`.
- **Ambient Glow (Glassmorphism)**: For premium cards, place an absolute blurred background shape in the top-right corner. Example: `<div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-pilar-gold/15 transition-colors duration-500 pointer-events-none"></div>`. Ensure the parent has `relative overflow-hidden` and inner content has `relative z-10`.

## 5. Status Badges
Badges should look like high-end labels, not standard Bootstrap pills.
- **Base Style**: `px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border`
- **Active / Hadir**: `bg-pilar-darker text-pilar-gold border-black`
- **Warning / Terlambat**: `bg-gray-100 text-pilar-darker border-gray-300`
- **Neutral / Izin**: `bg-white text-gray-600 border-gray-200`
- **Inactive / Empty**: `bg-gray-50 text-gray-400 border-gray-200`

## 6. Action Buttons in Rows (Edit/Delete)
Use discrete action buttons inside table rows or cards instead of bare text links.
- **Base**: `w-9 h-9 rounded-xl bg-gray-50 text-gray-500 border border-gray-100 shadow-sm flex items-center justify-center transition-all`
- **Edit Hover**: `hover:text-pilar-darker hover:bg-white hover:border-gray-200`
- **Delete Hover**: `hover:text-red-500 hover:bg-white hover:border-red-100`

## 7. Avatars / Initials
For lists displaying people, use a square rounded box for initials.
- **Style**: `w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:bg-pilar-darker group-hover:text-pilar-gold transition-colors`.

## 8. Typography
- Use `font-extrabold tracking-tight text-gray-800` or `text-gray-900` for important titles and headers.
- Use `font-bold` for table cell primary values.
- Empty states should have a bold encouraging message and a clear call to action button.
