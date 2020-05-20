
const Endb = require('endb');
module.exports = {
  "brand":"Pomagranate",
  "webexports":{
    "display_brand":"Pomagranate"
  },
  "bufferSize": 5*1024*1024, // Size of chunk. Must be the same as the vine
  "uploadDir":"/tmp/", // Make sure you have a trailing /
  "distDir": __dirname+"/.data/",
  "videodb": new Endb('sqlite://videodb.sqlite'),
  "maxFiles": 25, // Maximum amount of files before we stop saving to server
  "jucingtototal":1/2 // Basically saying 1/3 of the total users juice each video

}
