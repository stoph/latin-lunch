
var moment = require('moment');
var request = require('request');
var cheerio = require('cheerio');

//curl 'http://www.myschooldining.com/Latin/calendarWeek' -H 'Pragma: no-cache' -H 'Origin: http://www.myschooldining.com' -H 'Accept-Encoding: gzip, deflate' -H 'Accept-Language: en-US,en;q=0.8,de;q=0.6,fr;q=0.4,ar;q=0.2' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36' -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -H 'Accept: */*' -H 'Cache-Control: no-cache' -H 'X-Requested-With: XMLHttpRequest' -H 'Connection: keep-alive' -H 'Referer: http://www.myschooldining.com/Latin' -H 'DNT: 1' --data 'current_day=Wed+Dec+07+2016+14%3A32%3A01+GMT-0500+(EST)&adj=0' --compressed

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

    switch(intentName) {
        case "GetLunchIntent":
            getLunchResponse(intent, session, callback);
            break;
        case "GetLunchWeekIntent":
            getLunchWeekIntent(intent, session, callback);
            break;
        default:
            throw "Invalid intent";
    }

}

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

function getDateInfo(intent) {
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

    var dateInfo = {
        current_day: current_day,
        date_id: date_id,
        when: when
    }

    return dateInfo;

}

function getLunchResponse(intent, session, callback) {
    var cardTitle = intent.name;
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "Latin lunch";

    var dateInfo = getDateInfo(intent);

    var form = {
        current_day: dateInfo.current_day,
        adj: 0
    }

    request.post({ url: url, form: form, headers: headers }, function(err, resp, data) {
        var $ = cheerio.load(data, {
            normalizeWhitespace: true
        });
        var lunch_source = $('#' + dateInfo.date_id + ' #lowerschool_lunch_hotmeal .item');
        var lunch = lunch_source.text();

        // Remove multi new lines and leading/trailing spaces, as well as indicators for vegetarian, gluten free, etc.
        lunch = lunch.replace(/^\s+|\s*$|\s?\*.*$/mg, "").replace(/(\r\n|\n|\r)/gm,", ");
        lunch = "Lunch for " + dateInfo.when + " is " + lunch;
        callback(sessionAttributes, buildSpeechletResponse(intent.name, lunch, repromptText, shouldEndSession));
    })
    
}

function getLunchWeekIntent(intent, session, callback) {
    var cardTitle = intent.name;
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "Latin lunch";

    var thisWednesdayFullDate = moment().startOf("week").add(3, 'days').format("YYYY-MM-DD")

    var form = {
        current_day: thisWednesdayFullDate,
        adj: 0
    }

    request.post({ url: url, form: form, headers: headers }, function(err, resp, data) {
        var $ = cheerio.load(data, {
            normalizeWhitespace: true
        });
        var lunchWeek = "Lunch for this week is: ";
        for (i = 1; i < 6; i++) { 
            
            //var fullDate =moment().startOf("week").add(i, 'days').format("YYYY-MM-DD")
            var dateId = moment().startOf("week").add(i, 'days').format("MDYY");
            var day = moment().startOf("week").add(i, 'days').format("dddd");

            var lunch = $('#' + dateId + ' #lowerschool_lunch_hotmeal .item').first().text();
            if (lunch) {
                // Remove multi new lines and leading/trailing spaces, as well as indicators for vegetarian, gluten free, etc.
                lunch = lunch.replace(/^\s+|\s*$|\s?\*.*$/mg, "").replace(/(\r\n|\n|\r)/gm,", ");
                lunchWeek = lunchWeek + day + ", " + lunch + ". ";
            }

        }
        callback(sessionAttributes, buildSpeechletResponse(intent.name, lunchWeek, repromptText, shouldEndSession));
    })
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
