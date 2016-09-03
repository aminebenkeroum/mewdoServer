let express = require("express");
let app = express();
let server = require('http').Server(app);

let Wit = require('node-wit').Wit;
let log = require('node-wit').log;


// Setting up socket.io
let io = require('socket.io')(server,{origins:"localhost:*",'transports': ['websocket', 'polling']});

// start the server on port 3000
server.listen(3000,function () {
  console.log('Chatbot server listening on port 3000!');
});


// user's session for each conversation
const sessions = {};

// Getting first entity value by name
const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};


// Setting up our bot
// chat bot actions
const actions = {
  send(request, response) {
    const {sessionId, context, entities} = request;
    const {text, quickreplies} = response;
    return new Promise(function(resolve, reject) {

      // sending back the message from the bot using the socket in our session
      sessions[sessionId].socket.emit("bot-response",{message: JSON.stringify(response)});
      return resolve();
    });
  },
  setEmail({sessionId, context, text, entities}){

    let email = firstEntityValue(entities,"email");
    context.email = email;

    return Promise.resolve(context);
  },
  setName({sessionId, context, text, entities}){
    //let name = entities.name.value;
    let name = firstEntityValue(entities,"contact");
    context.name = name;

    return Promise.resolve(context);
  },
  setInterests({sessionId, context, text, entities}){

    let interests = firstEntityValue(entities,"interests");
    context.interests = interests;

    return Promise.resolve(context);
  },
  saveData({sessionId, context, text, entities}){

    console.log("trying to save data ...");
    console.log(context);

    context.done = true;

    return Promise.resolve(context);
  }
};


const wit = new Wit({
  accessToken: "MR7RH67ZQSMJMZBZEDZXMHXSHV7EX64A",
  actions,
  logger: new log.Logger(log.INFO)
});

app.get('/', function (req, res) {
  res.send('Hey Tajine !');
});


const createSession = function(socket){
  let sessionId;
  // verify if the session already exist
  Object.keys(sessions).forEach(k => {
    if (sessions[k].socket === socket) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if(!sessionId){
    sessionId = new Date().toISOString();
    sessions[sessionId] = {socket: socket, context: {}};
  }
  return sessionId;
};



io.on('connection', function (socket) {

  let sessionId = createSession(socket);

  console.log("Connecting new user " + sessionId);

  socket.on('talk-chatbot', function (data) {

    let text = data.message;

    // This will run all actions until our bot has nothing left to do
    wit.runActions(
      sessionId, // the user's current session
      text, // the user's message
      sessions[sessionId].context // the user's current session state
    ).then((context) => {
      // Our bot did everything it has to do.
      // Now it's waiting for further messages to proceed.
      console.log('Waiting for next user messages');


      sessions[sessionId].context = context;
    })
    .catch((err) => {
      console.error('Oops! Got an error from Wit: ', err.stack || err);
    });

    socket.on('disconnect', function () {
      io.emit('user disconnected');
      // delete session
      delete sessions[sessionId];
    });


  });

});
