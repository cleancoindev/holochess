'use strict';

// EXPOSED METHODS

// Creates a holochessEntry
function holochessEntryCreate (entry)
{
  return commit('holochessEntry', entry)
}

// Retrieves a holochessEntry
function holochessEntryRead (hash)
{
  // at the moment, to return the entry as JSON
  // we have to use JSON.parse because the entry is a string
  // soon this will be fixed and the JSON.parse can be removed
  return JSON.parse(get(hash))
}

/**
 * Called only when your source chain is generated
 * @return {boolean} success
 */
function genesis()
{
  return true;
}

// -----------------------------------------------------------------
//  validation functions for every DHT entry change
// -----------------------------------------------------------------

function validateCommit (entryName, entry, header, pkg, sources)
{
  switch (entryName)
  {
    case 'holochessEntry':
      // in order for the 'commit' action to work, validateCommit (given a holochessEntry) must return true
      // there is no special validation that we have to perform for our simple app
      return true
    default:
      // invalid entry name
      return false
  }
}

function validatePut (entryName, entry, header, pkg, sources)
{
  switch (entryName)
  {
    case 'holochessEntry':
      return true
    default:
      // invalid entry name
      return false
  }
}

function validateMod (entryName, entry, header, replaces, pkg, sources)
{
  switch (entryName)
  {
    case "sampleEntry":
      return false;
    default:
      // invalid entry name
      return false;
  }
}

function validateDel (entryName,hash, pkg, sources)
{
  switch (entryName)
  {
    case "sampleEntry":
      return false;
    default:
      // invalid entry name
      return false;
  }
}

function validatePutPkg (entryName) 
{
  return null;
}
function validateModPkg (entryName)
{
  return null;
}
function validateDelPkg (entryName)
{
  return null;
}
