const fs = require('fs');
const filePath = 'src/app/admin/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sidebar button
const sidebarSettingsBtn = `          <button 
            onClick={() => setActiveMenu("pengaturan")}
            className={\`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors \${activeMenu === "pengaturan" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}\`}
          >
            <i className="fa-solid fa-cog w-5"></i>
            <span>Pengaturan</span>
          </button>`;
const newSidebarBtn = `          <button 
            onClick={() => setActiveMenu("shift")}
            className={\`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors \${activeMenu === "shift" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}\`}
          >
            <i className="fa-solid fa-clock w-5"></i>
            <span>Shift</span>
          </button>
` + sidebarSettingsBtn;

if (content.includes(sidebarSettingsBtn)) {
  content = content.replace(sidebarSettingsBtn, newSidebarBtn);
}

// 2. Add header title logic
const headerTitleSettings = `activeMenu === "pengaturan" ? "Pengaturan Sistem" :`;
const newHeaderTitle = `activeMenu === "shift" ? "Manajemen Shift Global" :\n             ` + headerTitleSettings;

if (content.includes(headerTitleSettings)) {
  content = content.replace(headerTitleSettings, newHeaderTitle);
}

// 3. Extract Global Shifts block
const startMarker = '{/* GLOBAL SHIFTS SETTINGS */}';
const endMarker = '</div>\n                </div>\n              </div>\n            </div>\n          )}';

if (content.includes(startMarker)) {
  const startIndex = content.indexOf(startMarker);
  // Find the end of the shift settings block. It's a div holding the global shifts UI.
  const endOfShiftDiv = content.indexOf('</div>', content.indexOf('</button>', startIndex)) + 6;
  
  // Actually, let's extract the exact block I injected.
  // The block starts at `{/* GLOBAL SHIFTS SETTINGS */}` and ends after its outer `</div>`.
  
  let blockToExtract = content.substring(startIndex, endOfShiftDiv);
  
  // Remove from existing location
  content = content.replace(blockToExtract, '');
  
  // Create the new tab section
  const newTab = `
          {/* TAB SHIFT */}
          {activeMenu === "shift" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Manajemen Shift Global</h2>
                  <p className="text-gray-500 text-sm mt-1">Atur jadwal shift standar yang akan dipilih karyawan.</p>
                </div>
              </div>
              
              \${blockToExtract}
            </div>
          )}
  `;
  
  // Replace ${blockToExtract} with actual content
  const finalNewTab = newTab.replace('${blockToExtract}', blockToExtract);
  
  // Insert new tab right before TAB PENGATURAN
  const pengaturanTabMarker = '{activeMenu === "pengaturan" && (';
  if (content.includes(pengaturanTabMarker)) {
    content = content.replace(pengaturanTabMarker, finalNewTab + '\n          ' + pengaturanTabMarker);
  }
}

fs.writeFileSync(filePath, content);
console.log("Tab shift created successfully");
