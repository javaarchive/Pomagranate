
const Endb = require('endb');
module.exports = {
  "brand":"Pomagranate",
  "webexports":{
    "display_brand":"Pomagranate"
  },
  "bufferSize": 5*1024*1024, // Size of chunk. Must be the same as the vine
  "uploadDir":"/tmp/", // Make sure you have a trailing /
  "distDir": __dirname+"/.data/",
  "videodb": new Endb('sqlite://videodb.sqlite')
}
