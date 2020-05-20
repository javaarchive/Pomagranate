// Pomagranate Imports
const express = require("express");
const app = express();
const path = require("path");
const utils = require("./utils");
const fs = require("fs");
var session = require("express-session");
const exphbs = require("express-handlebars");
const config = require("./config");
const fileUpload = require("express-fileupload");
var busboy = require("connect-busboy");
var bodyParser = require("body-parser");
app.engine(".html", exphbs({ extname: ".html" }));
app.set("view engine", ".html");
var connected = [];
var SQLiteStore = require("connect-sqlite3")(session);
let sess = session({
  store: new SQLiteStore(),
  secret: process.env.SECRET,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  resave: true,
  saveUninitialized: false
});
app.use(sess);
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var http = require("http").createServer(app);
var io = require("socket.io")(http);
// Setup sessions for socketio
var ios = require("socket.io-express-session");
io.use(ios(sess));
// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));


// default options, no immediate parsing
app.use(busboy());
app.use(
  fileUpload({
    limits: { fileSize: 150 * 1024 * 1024 },
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
var socket = require("socket.io-client")("http://pomagranate-vine.glitch.me");
// Client Distribution Setup
io.on("connection", function(clientsocket) {
  connected.push(clientsocket);
  clientsocket.on("gotchunk", function(data) {
    let buffer = Buffer.from(data.stringdata, "base64");
    let h = crypto.createHash("sha1");
    h.update(buffer);
    let hash = h.digest("hex");
    if (hash != data.hash) {
      console.warn(
        "Corrupted client-sent chunk for " + data.hash + " detected. "
      );
      return;
    }
    console.log("Client has got a " + data.hash);
    socket.emit("gotchunk", { hash: data.hash, rawdata: buffer });
  });
  clientsocket.on("disconnect", () => {
    connected = connected.filter(x => x != clientsocket); // Remove from connected;
  });
});
// End Client Distribution
var crypto = require("crypto");

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
  utils.countDir(config.distDir, function(count) {
    if (count <= config.maxFiles) {
      fs.writeFile(config.distDir + data.hash + ".buf", data.rawdata, function(
        err
      ) {
        console.log(err);
      });
    }
    let peopleToPick = Math.ceil(config.jucingtototal * connected.length);
    console.log("Distributing " + data.hash + " " + peopleToPick + " times");
    for (let i = 0; i < peopleToPick; i++) {
      connected[Math.floor(Math.random() * connected.length)].emit(
        "distribution",
        { hash: data.hash, stringdata: data.rawdata.toString("base64") }
      );
    }
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
    res.send("Specify a video.");
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
    }, 30000);
    socket.on("hashretrieved", function(data) {
      let thisinterval = setInterval(function() {
        if (counter == reverseLookup[data.hash]) {
          console.log("Sending " + counter);
          res.write(data.rawdata, null);
          clearInterval(thisinterval);
          counter++;
        }
      }, 200);
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
  io.sockets.emit("requestchunk", { chunkhash: data.hash });
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
  let hashes = [];
  var readStream = fs.createReadStream(filePath, {
    highWaterMark: config.bufferSize,
    encoding: "binary"
  });

  readStream
    .on("data", function(chunk) {
      let data = Buffer.from(chunk, "binary");
      console.log(data.length);
      let h = crypto.createHash("sha1");
      console.log(data);
      h.update(data);
      console.log("hashed");
      let hash = h.digest("hex");
      console.log(data);
      let prep = { hash: hash, rawdata: data };
      socket.emit("distchunk", prep);
      console.log(data);
      console.log("Sent chunk to vine with hash " + hash);
      hashes.push(hash);
      console.log("chunk Data : ");
      //console.log(chunk); // your processing chunk logic will go here
    })
    .on("end", async function() {
      console.log("################### finished");
      let id = shortid.generate();
      await videodb.set(id, { hashList: hashes });
      res.render(__dirname + "/views/finish.html", {
        ...config.webexports,
        ...{ output_link: "/watch?v=" + id }
      });
      //console.log(data);
      // here you see all data processed at end of file
    });
});
// listen for requests :)
const listener = http.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
