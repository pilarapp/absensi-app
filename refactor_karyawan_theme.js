const fs = require('fs');
const path = require('path');

// globals.css
const cssPath = path.join(__dirname, 'src/app/globals.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');
cssContent = cssContent.replace(
  'background-color: var(--color-pilar-dark);',
  'background-color: #f9fafb;'
);
fs.writeFileSync(cssPath, cssContent);

// page.tsx (Dashboard)
const pagePath = path.join(__dirname, 'src/app/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

// Root wrapper text color
pageContent = pageContent.replace(
  'className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl"',
  'className="mobile-container flex flex-col text-gray-900 mx-auto shadow-2xl bg-gray-50"'
);

// Header text color (force white since root is now gray-900)
pageContent = pageContent.replace(
  '<header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">',
  '<header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative text-white">'
);

// Main Body Title
pageContent = pageContent.replace(
  '<h2 className="text-2xl font-bold font-heading text-pilar-textPrimary mt-1">',
  '<h2 className="text-2xl font-bold font-heading text-gray-900 mt-1">'
);
pageContent = pageContent.replace(
  '<h1 className="text-sm text-pilar-textSecondary uppercase tracking-wider">',
  '<h1 className="text-sm text-gray-500 uppercase tracking-wider">'
);

// Time Widget (currentDate text)
pageContent = pageContent.replace(
  '<div className="text-sm text-pilar-textSecondary font-medium">',
  '<div className="text-sm text-gray-500 font-medium">'
);

// "Status Hari Ini" Container
pageContent = pageContent.replace(
  '<div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8 relative overflow-hidden">',
  '<div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6 mb-8 relative overflow-hidden">'
);
pageContent = pageContent.replace(
  '<h3 className="text-center text-sm font-semibold mb-6 text-pilar-textSecondary uppercase tracking-wider">',
  '<h3 className="text-center text-sm font-semibold mb-6 text-gray-500 uppercase tracking-wider">'
);
pageContent = pageContent.replace(
  '<div className="w-px h-16 bg-white/10"></div>',
  '<div className="w-px h-16 bg-gray-200"></div>'
);
pageContent = pageContent.replace(
  '<div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center text-xs text-pilar-textSecondary">',
  '<div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center text-xs text-gray-500">'
);
pageContent = pageContent.replace(
  /bg-gray-700 text-pilar-textSecondary opacity-50/g,
  'bg-gray-200 text-gray-400'
);

// Time checkin/checkout below buttons
pageContent = pageContent.replace(
  /<span className="text-xs mt-3 text-pilar-textSecondary">/g,
  '<span className="text-xs mt-3 text-gray-500 font-medium">'
);

// Quick Stats
pageContent = pageContent.replace(
  /<div className="bg-white\/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white\/5">/g,
  '<div className="bg-white rounded-xl shadow-sm p-3 flex flex-col items-center justify-center border border-gray-100">'
);
pageContent = pageContent.replace(
  /<span className="text-\[10px\] text-pilar-textSecondary uppercase text-center">/g,
  '<span className="text-[10px] text-gray-500 font-semibold uppercase text-center">'
);
pageContent = pageContent.replace(
  '<span className="text-pilar-textPrimary font-bold text-lg mb-1">',
  '<span className="text-gray-900 font-bold text-lg mb-1">'
);

// Riwayat Minggu Ini Title
pageContent = pageContent.replace(
  '<h3 className="font-semibold text-pilar-textPrimary">',
  '<h3 className="font-bold text-gray-900">'
);

// Riwayat Card item
pageContent = pageContent.replace(
  /<div className="bg-pilar-darker p-3 rounded-xl flex items-center border border-white\/5">/g,
  '<div className="bg-white p-3 rounded-xl flex items-center border border-gray-100 shadow-sm">'
);
pageContent = pageContent.replace(
  /<div className="flex text-xs text-pilar-textSecondary mt-1 space-x-3">/g,
  '<div className="flex text-xs text-gray-500 mt-1 space-x-3">'
);
pageContent = pageContent.replace(
  /<p className="text-sm font-medium">/g,
  '<p className="text-sm font-bold text-gray-800">'
);
pageContent = pageContent.replace(
  /<span className="text-xs text-pilar-textSecondary">/g,
  '<span className="text-xs text-gray-500">'
);
pageContent = pageContent.replace(
  /<div className="text-right flex flex-col items-end">/g,
  '<div className="text-right flex flex-col items-end text-gray-800">'
);

// Bottom Nav
pageContent = pageContent.replace(
  '<nav className="bg-pilar-darker/95 backdrop-blur-md rounded-t-3xl border-t border-white/5 shadow-2xl relative z-10 pb-4 pt-2">',
  '<nav className="bg-pilar-darker/95 backdrop-blur-md rounded-t-3xl border-t border-white/10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.3)] relative z-10 pb-4 pt-2 text-white">'
);
pageContent = pageContent.replace(
  /text-pilar-textSecondary hover:text-pilar-gold/g,
  'text-gray-400 hover:text-pilar-gold'
);

fs.writeFileSync(pagePath, pageContent);
console.log("Refactored page.tsx and globals.css to light theme!");
