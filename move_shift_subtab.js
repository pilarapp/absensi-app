const fs = require('fs');
const filePath = 'src/app/admin/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove from sidebar
const shiftBtnRegex = /<button\s+onClick=\{\(\) => setActiveMenu\("shift"\)\}[\s\S]*?<\/button>/;
if (shiftBtnRegex.test(content)) {
  content = content.replace(shiftBtnRegex, '');
}

// 2. Remove header logic
const shiftHeaderRegex = /activeMenu === "shift" \? "Manajemen Shift Global" :\s+/;
if (shiftHeaderRegex.test(content)) {
  content = content.replace(shiftHeaderRegex, '');
}

// 3. Extract the shift block
const tabShiftStart = '{/* TAB SHIFT */}';
const tabShiftEndRegex = /\{\/\* TAB SHIFT \*\/\}\s*\{activeMenu === "shift" && \(\s*<div className="space-y-6">[\s\S]*?<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">([\s\S]*?<div className="flex justify-end mt-6">[\s\S]*?<\/button>\s*<\/div>\s*<\/div>)\s*<\/div>\s*\)}/;

let innerShiftBlock = '';
const match = content.match(tabShiftEndRegex);
if (match) {
  innerShiftBlock = match[1];
  // Remove the old tab
  content = content.replace(match[0], '');
} else {
  console.log("Could not find the exact TAB SHIFT block. It might have been modified.");
}

// 4. Inject sub-tab button
const subTabLokasiButtonStr = `<button
                  type="button"
                  onClick={() => setPengaturanSubTab("lokasi")}`;

const subTabShiftButton = `<button
                  type="button"
                  onClick={() => setPengaturanSubTab("shift")}
                  className={\`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 \${
                    pengaturanSubTab === "shift"
                      ? "bg-pilar-darker text-pilar-gold shadow-md"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }\`}
                >
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Jam Shift</span>
                </button>
                `;

if (content.includes(subTabLokasiButtonStr)) {
  content = content.replace(subTabLokasiButtonStr, subTabShiftButton + '\n                ' + subTabLokasiButtonStr);
}

// 5. Inject sub-tab content
const subTabLokasiContentStr = `{/* Sub-tab 1: LOKASI */}`;

const newSubTabShiftContent = `
              {/* Sub-tab 0: SHIFT */}
              {pengaturanSubTab === "shift" && (
                <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-slide-up">
                  <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-extrabold text-gray-800 text-xl tracking-tight">Manajemen Shift Global</h3>
                    <p className="text-sm text-gray-500 mt-1">Atur jadwal shift standar yang akan dipilih karyawan.</p>
                  </div>
                  
                  <div className="p-8">
                  \${innerShiftBlock}
                  </div>
                </div>
              )}
`;

if (innerShiftBlock && content.includes(subTabLokasiContentStr)) {
  content = content.replace(subTabLokasiContentStr, newSubTabShiftContent.replace('${innerShiftBlock}', innerShiftBlock) + '\n              ' + subTabLokasiContentStr);
}

fs.writeFileSync(filePath, content);
console.log("Moved Shift back to sub-tab successfully");
