// server.js
// where your node app starts
// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");
var session = require("express-session");
const exphbs = require("express-handlebars");
const config = require("./config");
app.engine(".html", exphbs({ extname: ".html" }));
app.set("view engine", ".html");
var SQLiteStore = require("connect-sqlite3")(session);
let sess = session({
  store: new SQLiteStore(),
  secret: process.env.SECRET,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  resave: true,
  saveUninitialized: false
});
app.use(sess);
var bodyParser = require("body-parser");
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var http = require("http").createServer(app);
//var server = http.Server(app);
var io = require("socket.io")(http);
// Setup sessions for socketio
var ios = require("socket.io-express-session");
io.use(ios(sess));
// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
var busboy = require("connect-busboy");

// default options, no immediate parsing
app.use(busboy());
const fileUpload = require("express-fileupload");
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: config.uploadDir,
    safeFileNames: true,
    abortOnLimit: true,
    createParentPath: true,
    debug: true
  })
);
// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (req, res) => {
  res.render(__dirname + "/views/index.html", config.webexports);
});
app.get("/upload", (req, res) => {
  res.render(__dirname + "/views/upload.html", config.webexports);
});
const crypto = require("crypto");
var socket = require("socket.io-client")("http://pomagranate-vine.glitch.me");
socket.on("connect", function() {
  console.log("Established connection to Vine Server");
});
socket.on("distribution", function(data) {
  let h = crypto.createHash("sha1");
  console.log(data.rawdata);
  h.update(data.rawdata);
  if (h.digest("hex") != data.hash) {
    console.log("Corrupt file detected");
    return;
  }
  console.log("Downloaded " + data.hash);
  fs.writeFile(config.distDir + data.hash + ".buf", data.rawdata, function(
    err
  ) {
    console.log(err);
  });
});
socket.on("disconnect", function() {
  console.warn("Lost connection to Vine Serve...reconnecting");
  socket = require("socket.io-client")("http://pomagranate-vine.glitch.me");
});
const shortid = require('shortid');
 
console.log(shortid.generate());
app.post("/upload", (req, res) => {
  // Upload and process file
  console.log("File Uploaded");
  console.log(req.files);
  console.log(req.files.targetfile.name);
  console.log(req.files.targetfile.tempFilePath);

  var buffer = Buffer.alloc(config.bufferSize),
    filePath = req.files.targetfile.tempFilePath;

  fs.open(filePath, "r", function(err, fd) {
    if (err) throw err;
    function readNextChunk() {
      fs.read(fd, buffer, 0, config.bufferSize, null, function(err, nread) {
        if (err) throw err;

        if (nread === 0) {
          // done reading file, do any necessary finalization steps

          fs.close(fd, function(err) {
            if (err) throw err;
          });
          return;
        }

        var data;
        if (nread < config.bufferSize) data = buffer.slice(0, nread);
        else data = buffer;
        let h = crypto.createHash("sha1");
        h.update(data);
        var hash = h.digest("hex");
        console.log("A chunk! ");
        socket.emit("distchunk", { hash: hash, rawdata: data });
        console.log("Sent chunk to vine!");
        readNextChunk();
        // do something with `data`, then call `readNextChunk();`
      });
    }
    readNextChunk();
  });

  res.render(__dirname + "/views/finish.html", config.webexports);
});
// listen for requests :)
const listener = http.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
