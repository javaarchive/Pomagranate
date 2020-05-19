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
    createParentPath: true
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
const shortid = require("shortid");
var videodb = config.videodb;
console.log(shortid.generate());
app.get("/watch", async function(req, res) {
  if (!req.query.v) {
    res.send("Specifu a video.");
    return;
  }
  if (await videodb.has(req.query.v)) {
    //res.send("Complete");
    res.render(__dirname + "/views/video.html", {
      ...config.webexports,
      ...{ id: req.query.v }
    });
  } else {
    res.send(
      "I couldn't find " +
        req.query.v +
        " in the database. Videos like " +
        JSON.stringify(await videodb.all())
    );
    return;
  }
});
app.get("/raw/:id", async function(req, res) {
  let id = req.params.id;
  console.log("ID: " + id);
  if (await videodb.has(id)) {
    //res.send("Complete");
    console.log("Retrieving");
    let counter = 0;
    let video = await videodb.get(id);
    let hashList = video["hashList"];
    let reverseLookup = {};
    for (var i = 0; i < hashList.length; i++) {
      reverseLookup[hashList[i]] = i;
      socket.emit("askforchunk", { chunkhash: hashList[i] });
    }
    let waittoendrequest = setInterval(function() {
      if (counter == hashList.length) {
        socket.off("hashretrieved");
        res.end(null, "binary");
        console.log("Finished");
        clearInterval(waittoendrequest);
      }
    }, 500);
    setTimeout(function() {
      counter = hashList.length;
      // Auto stop
    }, 10000);
    socket.on("hashretrieved", function(data) {
      let thisinterval = setInterval(function() {
        if (counter == reverseLookup[data.hash]) {
          console.log("Sending " + counter);
          res.write(data.rawdata, null);
          clearInterval(thisinterval);
          counter++;
        }
      }, 500);
    });
  } else {
    res.redirect(
      301,
      "https://github.com/esc0rtd3w/blank-intro-videos/raw/master/blank.mp4"
    );
    // Show blank
    return;
  }
});

socket.on("requestchunk", function(data) {
  console.log("Checking for chunk " + data.hash);
  if (fs.existsSync(config.distDir + data.hash + ".buf")) {
    fs.readFile(config.distDir + data.hash + ".buf", function(err, rawdata) {
      console.log("I've got an " + data.hash);
      socket.emit("gotchunk", { hash: data.hash, rawdata: rawdata });
    });
    //socket.emit("gotchunk", { hash: data.hash });
  }
});
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
    let hashes = [];
    function readNextChunk() {
      fs.read(fd, buffer, 0, config.bufferSize, null, async function(
        err,
        nread
      ) {
        if (err) throw err;

        if (nread === 0) {
          // done reading file, do any necessary finalization steps
          let id = shortid.generate();
          await videodb.set(id, { hashList: hashes });
          res.render(__dirname + "/views/finish.html", {
            ...config.webexports,
            ...{ output_link: "/watch?v=" + id }
          });
          fs.close(fd, function(err) {
            if (err) throw err;
          });

          return;
        }

        let data;
        if (nread < config.bufferSize) data = buffer.slice(0, nread);
        else data = buffer;
        /*
         let h2 = crypto.createHash("sha1");
        h2.update(data);
        console.log("Verifacation: "+h2.digest("hex"));
        */
        console.log("A chunk! ");
        //console.log(data);
        console.log(data.length);
        let h = crypto.createHash("sha1");
        h.update(data);
        let hash = h.digest("hex");
        socket.emit("distchunk", { hash: hash, rawdata: data });
        console.log(data);
        console.log("Sent chunk to vine with hash " + hash);
        hashes.push(hash);
        readNextChunk();
        // do something with `data`, then call `readNextChunk();`
      });
    }
    readNextChunk();
  });
});
// listen for requests :)
const listener = http.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
