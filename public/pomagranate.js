// Ready Sockets
if(!io){var io = null; console.warn("SocketIO not loaded correctly")} // Linter Satsifacation
var socket = io();
if(!window.localStorage.getItem("prefferedmethod")){
  console.log("Setting method to localstorage by default")
  window.localStorage.setItem("prefferedmethod","localStorage");
}
var method = window.localStorage.getItem("prefferedmethod");
socket.on("requestchunk", function(data){
  console.log("Checking if I've got "+data.chunkhash)
  if(window.localStorage.getItem(data.chunkhash) != null){
    console.log("Got one")
    socket.emit("gotchunk",{hash: data.chunkhash, stringdata: window.localStorage.getItem(data.chunkhash)});
  }
  if(window.sessionStorage.getItem(data.chunkhash) != null){
    console.log("Got one")
    socket.emit("gotchunk",{hash: data.chunkhash, stringdata: window.sessionStorage.getItem(data.chunkhash)});
  }
});
socket.on("distribution", function(data){
  console.log("Downloading "+data.hash);
  if(method == "localStorage"){
    window.localStorage.setItem(data.hash, data.stringdata);
  }else if(method == "sessionStorage"){
    window.sessionStorage.setItem(data.hash, data.stringdata);
  }
});