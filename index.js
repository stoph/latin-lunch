
/*
TestIntent what is for lunch
TestIntent what's for lunch

HelloWorld - arn:aws:lambda:us-east-1:452114835050:function:HelloWorld
Latin-lunch - arn:aws:lambda:us-east-1:452114835050:function:latin-lunch
{
  "intents": [
      {
      "intent": "TestIntent"
    },
    {
      "intent": "GetLunchIntent",
      "slots": [
        {
          "name": "Date",
          "type": "AMAZON.DATE"
        }
      ]
    }
  ]
}


*/

var moment = require('moment');
var request = require('request');
var cheerio = require('cheerio');

var url = "http://www.myschooldining.com/Latin/calendarWeek";
var headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
    'Content-Type' : 'application/x-www-form-urlencoded'
};


exports.handler = function (event, context) {
    try {
        // console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        console.log("Event: ");
            console.log(event);
        console.log("context: ")
            console.log(context);

        /*
        if (event.session.application.applicationId !== "amzn1.ask.skill.8f4a426c-1ff3-45a5-aa58-8994da82c293") {
             context.fail("Invalid Application ID");
         }
        */

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId + ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    console.log("Called intent: " + intentName)
    // Dispatch to your skill's intent handlers
    if ("GetLunchIntent" === intentName) {
        getLunchResponse(intent, session, callback);
    }  else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to Charlotte Latin's lunch menu.  Ask me what's for lunch, or what's for lunch tomorrow."
    var repromptText = "Are you not hungry?";
    var shouldEndSession = false;

    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}


function getLunchResponse(intent, session, callback) {
    var cardTitle = intent.name;
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "Latin lunch";

    var d = new Date();
    var requestedDate = d.toISOString();
    
    if (intent.slots.Date.value) {
        console.log("Date passed in as: " + intent.slots.Date.value)
        requestedDate = intent.slots.Date.value;
        var current_day = moment(requestedDate).format("YYYY-MM-DD");
        var date_id = moment(requestedDate).format("MDYY");
        var when = moment(requestedDate).format("dddd");

    } else {

        console.log("Actual full date is: " + moment().format("MMMM Do YYYY, h:mm:ss a (HH)") )

        if ( parseInt( moment().format("HH") ) < 12) {
            var current_day = moment().format("YYYY-MM-DD");
            var date_id = moment().format("MDYY");
            var when = "today";
        } else {
            var current_day = moment(new Date()).add(1, 'days').format("YYYY-MM-DD");
            var date_id = moment(new Date()).add(1, 'days').format("MDYY");
            var when = moment(new Date()).add(1, 'days').format("dddd");//"tomorrow";
        }

        console.log("when:" + when + ", current_day:" + current_day + ", date_id:" + date_id)

}

    var form = {
        current_day: current_day,
        adj: 0
    };


    request.post({ url: url, form: form, headers: headers }, function(err, resp, data) {
        var $ = cheerio.load(data);
        var lunch_source = $('#' + date_id + ' #lowerschool_lunch_hotmeal .item');
        var lunch = lunch_source.text();

        // Remove multi new lines and leading/trailing spaces, as well as indicators for vegetarian, gluten free, etc.
        lunch = lunch.replace(/^\s+|\s*$|\s?\*.*$/mg, "").replace(/(\r\n|\n|\r)/gm,", ");
        lunch = "Lunch for " + when + " is " + lunch;
        callback(sessionAttributes, buildSpeechletResponse(intent.name, lunch, repromptText, shouldEndSession));
    })


    // Setting repromptText to null signifies that we do not want to reprompt the user.
    // If the user does not respond or says something that is not understood, the session
    // will end.
    
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    }
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    }
}
