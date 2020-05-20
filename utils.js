const fs = require("fs");
function countDir(directory, cb) {
  fs.readdir(directory, (err, files) => {
    cb(files.length);
  });
}
function setResizeArr(pos,item, arr){
  if(pos >= arr.length){
    for(let i =0 ;i < (pos-arr.length);  i++){
      arr.push(undefined);
    }
  }
  arr[pos] = item;
  return arr;
}
module.exports = { countDir: countDir ,setResizeArr:setResizeArr};
