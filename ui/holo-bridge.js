// Copyright (C) 2018, Damien Douté
// Use of this source code is governed by GPLv3 found in the LICENSE file
//---------------------------------------------------------------------------------------

// holo-bridge.js
// Responsible only for communication with holochain zome
//      Doesn't know anything about html / css
// Called by holochain.js

//===============================================================================
// GLOBALS
// ==============================================================================

var g_myHash              = null; // Cached hash of this Agent
var g_myHandle            = null; // Cached Handle of this Agent
var g_loadedChallengeHash = null; // Hash of latest loaded Challenge
var g_myGames             = null; // View-model for Challenges


//===============================================================================
// HOLOCHAIN PROMISE - HCP
// ==============================================================================


/**
 * Promise of AJAX request to Holochain
 */
function hcp(fn, data)
{
  return new Promise(function(resolve, reject)
                    {
                      // Do the usual XHR stuff
                      let req = new XMLHttpRequest();
                      req.open('POST', "/fn/Holochess/" + fn, true);

                      // req.setRequestHeader('Content-type', 'application/json')

                      req.onload = function()
                                  {
                                    // 'load' triggers for 404s etc
                                    // so check the status
                                    if (req.status === 200)
                                    {
                                      // Resolve the promise with the response text
                                      resolve(req.response);
                                    }
                                    else
                                    {
                                      // Otherwise reject with the status text
                                      reject(Error(req.statusText));
                                    }
                                  };

                      // Handle network errors
                      req.onerror = function() { reject(Error("HCP Error")); };

                      // Make the request
                      req.send(data);
                    });
}


/**
 * HC Promise for JSON DataFormat
 */
function hcpJson(fn, data)
{
  return hcp(fn, data).then(JSON.parse);
}


//============================================================================
// GET HANDLES / AGENTS
//============================================================================

/**
 * Get this Agent's Hash
 * Tries to get cache first
 */
function hcpGetMyHash()
{
  if(g_myHash)
  {
    return Promise.resolve(g_myHash);
  }
  return hcp("getMyHash").then(
          function(str)
          {
            g_myHash = str;
            return g_myHash;
          });
}


/**
 * Get an Agent's handle
 */
function hcpGetHandle(agentHash)
{
  // console.log("hcpGetHandle called: " + agentHash);
  if (agentHash === undefined)
  {
    console.log("hcpGetHandle abort: bad arguments");
    return Promise.reject(null);
  }
  return hcp("getHandle", agentHash);
}


/**
 * Get this Agent's Handle
 * Tries to get cache first
 */
function hcpGetMyHandle()
{
  if(g_myHandle)
  {
    return Promise.resolve(g_myHandle);
  }
  return hcpGetMyHash().then(
          function(hash)
          {
            return hcpGetHandle(hash).then(
                     function(str)
                      {
                        g_myHandle = str;
                        return g_myHandle;
                      },
                      function(err)
                      {
                        console.log("hcpGetMyHandle failed: " + err);
                      });
          });
}


/**
 *
 */
function hcpGetAllHandles()
{
  return hcpJson("getAllHandles");
}


//============================================================================
// GET CHALLENGES / MOVES
//============================================================================

/**
 * Get all Moves related to a Challenge
 */
function hcpGetMoves(challengeHash)
{
  console.log("hcpGetMoves called: " + challengeHash);

  g_loadedChallengeHash = challengeHash;

  let promise = hcpJson("getMoves", JSON.stringify(challengeHash)); // because getMoves "CallingType" is "json"

  return promise.then(
          function(moveArray)
          {
            return moveArray;
          },
          function(err)
          {
            console.log("hcpGetMoves failed: " + err);
            g_loadedChallengeHash = null;
            return [];
          });
}


/**
 * Generate Game from Challenge (view-model data)
 * and add Game to global Game Array
 */
function challenge2Game(challengeResponse)
{
  //console.log("hcp_getChallengeHandles called: " + JSON.stringify(challengeResponse));
  if (challengeResponse === undefined)
  {
    console.log("processChallenge abort: bad arguments");
    return Promise.reject(null);
  }
  // Get challenger's handle
  return hcpGetHandle(challengeResponse.Entry.challenger).then(
          function(str)
          {
            g_myGames[challengeResponse.Hash].challengerHandle = str;
            // Get challengee's handle
            return hcpGetHandle(challengeResponse.Entry.challengee).then(
                    function(str)
                    {
                      g_myGames[challengeResponse.Hash].challengeeHandle = str;

                      // Compute Game state
                      // assert(g_myHash);
                      let game = g_myGames[challengeResponse.Hash];
                      g_myGames[challengeResponse.Hash].iAmChallenger = (game.challenger === g_myHash);
                      const iAmChallenger = g_myGames[challengeResponse.Hash].iAmChallenger;
                      g_myGames[challengeResponse.Hash].iPlayWhite =
                        (iAmChallenger && game.challengerPlaysWhite || !iAmChallenger && !game.challengerPlaysWhite);

                      // generate name
                      const whiteHandle = (game.challengerPlaysWhite?
                                            game.challengerHandle
                                          : game.challengeeHandle);
                      const blackHandle = (game.challengerPlaysWhite? game.challengeeHandle : game.challengerHandle);

                      let date = new Date();
                      date.setTime(game.timestamp);
                      const dateString = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
                      //+ " " + date.toLocaleTimeString();

                      g_myGames[challengeResponse.Hash].name = whiteHandle + " vs. " + blackHandle + " (" + dateString + ")";
                    });
        });
}


/**
 * Get all Challenges related to this Agent.
 * For each Challenge get player's handles and setup view-model data.
 */
function hcpGetMyGames()
{
  return hcpJson("getMyGames").then(
            function(challengeEntries)
            {
              // console.log("hcpGetMyGames response:\n" + JSON.stringify(challengeEntries) + "\n");
              // Create Games associated array with challenge's hash as key
              g_myGames = new Object();
              for(let i = 0; i < challengeEntries.length; i++)
              {
                g_myGames[challengeEntries[i].Hash] = challengeEntries[i].Entry;
              }
              return Promise.all(challengeEntries.map(challenge2Game));
            }).catch(
                function(err)
                 {
                  console.log("hcpGetMyGames failed: ", err);
                 });
}


//============================================================================
// COMMITS
//============================================================================

/**
 * Submit Challenge Entry to Holochain
 */
function hcpCommitChallenge(challengeeHash)
{
  // Check pre-conditions
  if (!challengeeHash || challengeeHash === undefined)
  {
    alert("pick a player first!");
    return Promise.reject(null);
  }
  // Create Holochain Entry
  const challengeEntry = {
    timestamp           : new Date().valueOf(),
    challengee          : challengeeHash,
    challengerPlaysWhite: true,                  // FIXME: hardcoded
    isGamePublic        : true                   // FIXME: hardcoded
  };
  // Create Promise
  return hcpJson("commitChallenge", JSON.stringify(challengeEntry));
}


/**
 * Submit Move Entry to Holochain
 */
function hcpCommitMove(challengeHash, sanMove, index)
{
  // Check pre-conditions
  if (   !challengeHash || challengeHash === undefined
      || !sanMove || sanMove === undefined
      || index === undefined)
  {
    alert("Failed committing move!");
    return Promise.reject(null);
  }
  // Create Holochain Entry
  const moveEntry = {
    challengeHash : challengeHash,
    san           : sanMove,
    index         : index
  };
  // Create Promise
  return hcp("commitMove", JSON.stringify(moveEntry));
}


//============================================================================
// INIT
//============================================================================

/**
 * Once page is loaded, get my local info
 */
$(window).ready(function()
{
  console.log("holo-bridge.js INIT");

  hcpGetMyHash();
  hcpGetMyHandle();
});