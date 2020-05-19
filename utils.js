const fs = require("fs");
function countDir(directory, cb) {
  fs.readdir(directory, (err, files) => {
    cb(files.length);
  });
}
module.exports = { countDir: countDir };
