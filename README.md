
<h1>QuickInc jQuery Async File Loader 1.0.0</h1>
<h2>Introduction</h2>

QuickInc is meant to be an extremely easy to use lightweight alternative to
RequireJS or any other script loading Javascript library.  Rather than introduce new
Javascript syntax, QuickInc only requires a simple JSON file to start loading the
CSS and Javascript files.  Here are a few things that QuickInc can and cannot do:

<b>QuickInc does:</b>
<ul>
<li>Load CSS files in the document head</li>
<li>Load Javascript files synchronously before page rendering in the document head AND/OR</li>
<li>Load Javascript files asynchronously as soon as head has completed loading</li>
<li>Handle script dependecies (and automatically handle and require dependencies of dependencies)</li>
</ul>

<b>QuickInc does not:</b>
<ul>
<li>Localize a script and export the variable (can be a pro or a con depending on your project)</li>
<li>Stop loading all other files when a dependency is required</li>
<li>work without jQuery being loaded first</li>
</ul>

<h2>How To Use</h2>

In your HTML file, add the script tag for jquery and then for quickinc.js while including the data-include attribute:

<em>index.html</em>
```html
<!doctype html>
<html>
<head>
  <title>My Page</title>
  <script src="scripts/jquery.js"></script>
  <script src="scripts/quickinc.js" data-include="scripts/include.json"></script>
</head>
```

Now add an Array of Objects that contain the information needed to load your scripts in your JSON file.
Make sure to use proper JSON syntax and surround all strings and member names in double quotes.

<em>scripts/include.json</em>
```JSON
[
  {
    "url": "css/jquery-ui.css",
    "css": true
    
  },
  {
    "url": "scripts/jquery-ui.js",
    "head": true
  },
  {
    "url": "scripts/kinetic.js",
    "async": true,
    "slug": "kinetic"
  },
  {
    "url": "scripts/app.js",
    "async": true,
    "slug": "app",
    "dependsOn": ["kinetic"]
  }
]
```

That's it!  The quickinc.js file will take care of everything else.

<h2>JSON File Options</h2>
<ul>
  <li><b>"url"</b> <em>{REQUIRED}</em> : The url of the file to load</li>
  <li><b>"css"</b> : set to true if the file is a css stylesheet</li>
  <li><b>"head"</b> : set to true if the javascript file should be loaded in the document head</li>
  <li>
    <b>"async"</b> : set to true if the javascript file should be loaded asyncronously after head scripts*
    <ul>
      <li>
        <b>"slug"</b> <em>{REQUIRED}</em> : A slug name is required for async scripts to track loading 
        and dependencies
      </li>
      <li><b>"dependsOn"</b> : An Array of slug names that should be loaded before this script loads</li>
      <li><b>"cache"</b> : If true, this script will be loaded from cache (See next section)</li> 
    </ul>
  </li>
</ul>
The JSON file needs to contain an Array of Objects in the general format seen above.  A URL is required for
each Object.  QuickInc has 3 modes: 'css' for loading CSS files in link tags in the head, 'head' for loading
Javascript files in script tags in the head, and the default 'async' for loading scripts asyncronously by
using jQuery.ajax().  As the default is 'async', you could omit the two occurances of <em>"async": true</em> in
the example JSON above and the last two files would be handled as if 'async' were set to true.  When QuickInc loads the
file in 'async' mode, a 'slug' is required so the load can be tracked and dependecies established.  The 
'dependsOn' member is optional, and if present should be an Array of required 'slug' strings.  Please note
that Quickinc will exit and log an error to the console if a dependency cannot be found or if a circular
dependency occurs (ex: a.js needs b.js, b.js needs c.js, and c.js needs a.js - no good)

<h2>Cache Control</h2>
Every file loaded in the head (including CSS files), is loaded by adding a native link or script tag so the
browser will handle caching.  By default, all async files are loaded anew each time the page refreshes so
any code changes are instantly reflected.  You can set the "cache" option to true after you are done working
on a particular file so that a cached version will be used.  To turn off caching on all async loaded scripts,
add the data-no-cache attribute to the quickinc.js script tag:
```html
<script src="scripts/quickinc.js" data-include="scripts/include.json" data-no-cache=""></script>
```

<h2>Troubleshooting</h2>
If nothing seems to be loading, make sure you check your browsers console (usually ctrl+shift+j).  If anything
went wrong, you will likely see an error message.
