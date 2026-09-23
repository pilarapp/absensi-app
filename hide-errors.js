const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync('src');
const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

let changedFiles = 0;

tsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Replace `error.message || "Message"` with `"Message"`
  newContent = newContent.replace(/error\.message\s*\|\|\s*(['"`][^'"`]+['"`])/g, '$1');
  // Replace `err.message || "Message"` with `"Message"`
  newContent = newContent.replace(/err\.message\s*\|\|\s*(['"`][^'"`]+['"`])/g, '$1');
  // Replace `error?.message || "Message"` with `"Message"`
  newContent = newContent.replace(/error\?\.message\s*\|\|\s*(['"`][^'"`]+['"`])/g, '$1');
  // Replace `err?.message || "Message"` with `"Message"`
  newContent = newContent.replace(/err\?\.message\s*\|\|\s*(['"`][^'"`]+['"`])/g, '$1');

  // Specific for login/page.tsx and admin/page.tsx where string concat is used:
  // e.g. "Gagal login: " + (err.message || "Terjadi kesalahan.")
  // We can just rely on the above regex changing it to "Gagal login: " + ("Terjadi kesalahan.")

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Finished processing. Changed ${changedFiles} files.`);
