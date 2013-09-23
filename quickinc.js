'use strict';
/**
 * QuickInc Asynchronous File Loader
 * 
 * If jQuery is loaded, this Javascript file will read the JSON data file
 * indicated by the data-include attribute on the script tag used to include
 * this file.  Depending on the contents of the JSON file, QuickInc will add
 * script or link tags for files (js and css) to be loaded in the head, and
 * loads all other javascript files asynchronously, while minding dependency
 * requirements.  Please see the documentation in the README file, or on
 * github.
 * 
 * @package QuickInc_Async_Loader
 * @version 1.0.0
 * @author James D. Lucas Jr.
 * @link https://github.com/anderos/quickinc
 */


var quickIncWrapper = function(){
    (function($){

        /*
         * All members used are indicated in this object
         */
        var quickinc = {
            beingLoaded : {},   // Object of async scripts being loaded currently
            cacheEnabled: true, // this can be changed by setting attribute data-no-cache="false" on quickinc.js script tag
            clearLock   : false, // puts a lock on the script clearer so we cant lose a clear if fired at same time
            data        : [],   // contents of {includefile}.json go here
            dependencyCleared: false,    // track if script clearing affected dependency so we dont overtrigger
                                         // quickinc.loadFreeScripts();
            error       : false,  // halt event handling if error occurs
            files       : {
                css         :   [],     // css files to load
                head        :   [],     // js files to load in the HEAD of the document in a script tag
                async       :   []      // js files to load async
            },
            loadLock    : false, // put load lock so scripts cannot be accidentily loaded twice as script loads complete
            stats       : {
                start       : new Date(),   // Time that script starts
                end         : '',           // Time after all files have been loaded
                total       : '',            // Total completion time in ms
                filesLoaded : 0             // Number of files loaded
            }
        },
            self = quickinc; // to use instead of 'this'

        /**
         * Loads the JSON data file
         */
        quickinc.init = function(){
            var jsonfile = self.findAttributes();
            self.data = self.getIncluder( jsonfile );
        };

        /**
         * Clears a script from the load array, and from dependency lists of other
         * scripts.  This loads after a scriptLoaded event has fired.
         * @param {String} slug Name of script to remove
         */
        quickinc.clearAsyncScript = function( slug ){
            // if this method is currently in use, wait 10 ms
            if( true === self.clearLock ){
                setTimeout(function(){
                    self.clearAsyncScript(slug);
                }, 10);
                return;
            }
            self.clearLock = true;  // put lock on method
            var d = self.files.async,
                dcopy = $.extend([],d),
                i,
                index = false,  // index of script to cut
                depIndex,       // index of dependency to cut, if found
                ln = d.length;
            for( i = 0; i < ln; i++ ){
                // if slugs match, mark for deletion
                if( d[i].slug === slug ) index = i;
                else {
                    // see if this script is in dependency list
                    depIndex = d[i].dependsOn.indexOf(slug);
                    if( depIndex !== -1 ){
                        // if so delete it
                        dcopy[i].dependsOn.splice( depIndex, 1 );
                        // update so we know a dependency has been cleared
                        self.dependencyCleared = true;
                    }
                }
            }
            dcopy.splice( index, 1 );   // delete this script
            self.files.async = dcopy;   // reassign to master
        };
        
        /**
         * Computes how long script loading took
         */
        quickinc.computeStats = function(){
            self.stats.end = new Date();
            self.stats.total = self.stats.end.getTime() - self.stats.start.getTime();
        };

        /**
         * Calls a method after an event has been fired
         * @param {String} event Event name that has fired
         * @param {mixed optional} arg Arguments to Pass to eventComplete method
         * @returns {Boolean} Is false on error.
         */
        quickinc.eventComplete = function( event, arg ){
            // if there was an error somewhere, stop handling events
            if( true === self.error ) return false;

            var events = {
                
                /**
                 * Called when everything is finished
                 */
                finished : function(){
                    self.computeStats();
                    console.info("Quickinc has finished!");
                    console.info(self.stats.filesLoaded+ " Files loaded in "+self.stats.total+"ms.");
                },
                        
                /**
                 * After JS files in head and css files are loaded and DOM ready
                 */
                headLoaded : function(){
                    self.loadFreeScripts();
                },
                       
                /**
                 * After JSON file has been loaded
                 */
                includerLoaded : function(){
                    self.parseJSON();
                    self.loadHead();
                },
                        
                /**
                 * After async script has been loaded
                 * @param {String} slug Slugname of loaded script
                 */
                scriptLoaded : function( slug ){
                    self.stats.filesLoaded++;
                    self.clearAsyncScript( slug ); // clear script and dependencies
                    if( true === self.dependencyCleared ){
                        self.loadFreeScripts();
                        self.dependencyCleared = false;
                    }
                    else if( self.files.async.length === 0 ){
                        self.eventComplete("finished");
                    }
                    self.clearLock = false;     // remove lock on clearAsyncScript method
                }
            };

            if( events[event] ) return events[event](arg);
            else { 
                self.error = true;
                $.error("quickinc.eventComplete("+event+") does not exist!");            
            }
        };
        
        /**
         * Finds scripts which require no outstanding dependencies
         * @returns {Array} Script objects which can safely be loaded
         */
        quickinc.findFreeScripts = function(){
            var d = self.files.async,
                i,
                ln = d.length,
                free = [];
            for( i = 0; i < ln; i++ ){
                // if no dependencies and this script is not currently be loaded
                if( d[i].dependsOn.length === 0 && typeof self.beingLoaded[ d[i].slug ] === "undefined" ){
                    free[free.length] = d[i];
                }
            }
            return free;
        };
        
        /**
         * Reads the scripts to get the data-include attribute and check for no-cache
         * @returns {String} JSON file to load
         */
        quickinc.findAttributes = function(){
            var check,
                found = false,
                cache = false;
            // run through scripts
            $('script').each(function(){
                check = $(this).data('include');
                if( typeof check !== "undefined" ){
                    found = check;
                    // grab no cache and set cacheEnabled if it exists
                    cache = $(this).data('no-cache');
                    if( typeof cache !== "undefined" ) self.cacheEnabled = false;
                    return false; // break
                }
            });
            if( false === found ){
                self.error = true;
                $.error("data-include='{includefile}.json' must be an attribute of quickinc.js script tag!");
            }
            return found;
        };
        
        /**
         * Begins loading a single JS Script
         * @param {object} file Contains information on file to load
         */
        quickinc.getAsyncScript = function( file ){
            // register this script as being loaded
            self.beingLoaded[ file.slug ] = 1;
            $.ajax({
                url         : file.url,
                dataType    : 'script',
                cache       : (true === self.cacheEnabled) ? file.cache : false,
                complete    : function( data, status ){
                    if( "error" === status ){
                        self.error = true;
                        $.error(file.url+" could not be loaded in quickinc.js!");
                    }
                    // remove this script from beingLoaded object and let eventComplete handler
                    // know this script is loaded
                    delete self.beingLoaded[ file.slug ];
                    self.eventComplete("scriptLoaded", file.slug);
                }
            });
        };
        
        /**
         * Runs through scripts that are safe to load, one by one
         * @param {Array} files Contains file Objects
         */
        quickinc.getAsyncScripts = function( files ){
            var i, ln = files.length;
            for( i = 0; i < ln; i++ ) self.getAsyncScript( files[i] );
        };
        
        /**
         * Loads the JSON data file synchronously that drives the quickinc load process.
         * @param {String} jsonfile
         */
        quickinc.getIncluder = function( jsonfile ){
            $.ajax({
                url         : jsonfile,
                dataType    : 'json',
                async       : false,  // we need the script to stop so the HEAD does not
                                      // finish without us!
                complete    : function( data, status ){
                    if( status === "error" ){
                        self.error = true;
                        $.error(jsonfile+" could not be loaded in quickinc.js!");
                    }
                    self.data = data.responseJSON;
                    self.eventComplete("includerLoaded");
                }
            });
        };

        /**
         * Discovers what scripts are safe to load, and then loads them.  Runs
         * everytime a script returns.
         * TODO: change this so it ONLY runs when a dependency has been matched and
         * removed so it fires only when needed
         */
        quickinc.loadFreeScripts = function(){
            // ensures method does not run in parallel, and delays execution
            // by 10ms locked out
            if( true === self.loadLock ){
                console.info('loadLock Encountered');
                setTimeout(function(){
                    self.loadFreeScripts();
                }, 10);
                return;
            }
            var freeScripts = self.findFreeScripts();
            // if no scripts are currently safe to load, we need to do some
            // checks
            if( freeScripts.length === 0 ){
                if( Object.keys(self.beingLoaded).length === 0 ){
                    if( self.files.async.length !== 0 ){
                        // we have an issue here, circular dependency :(
                        self.error = true;
                        $.error("Not all scripts could be loaded.  There is either a circular dependency, or a missing dependency");
                        return;
                    }
                    // Looks like we are done, everything loaded, nothin remaining
                    self.eventComplete("finished");
                    return;
                }
                else{
                    // if we still have scripts being loaded, the load finished event will retrigger this method
                    // when needed so just return
                    return;
                }
                
            } // none survive if
            self.loadLock = true;
            self.getAsyncScripts( freeScripts );
            self.loadLock = false;
        };

        /**
         * Loads CSS or JS files in the head
         */
        quickinc.loadHead = function(){
            self.write('css');
            self.write('head');
        };
        
        /**
         * Parses JSON object and splits it into the files object member Arrays,
         * adding defaults.
         */
        quickinc.parseJSON = function(){
            var d = self.data,
                i,
                ln = d.length,
                settings;
            if( false === Array.isArray( d ) ) {
                self.error = true;
                $.error("json data must be an array of objects!");
                return;
            }
            for( i = 0; i < ln; i++ ){
                settings = $.extend(true, {
                    head        :   false,
                    cache       :   false,
                    dependsOn   :   [],
                    css         :   false,
                    url         :   false,
                    slug        :   false
                }, d[i]); // apply defaults
                // we need a URL, so no go if it is missing
                if( false === settings.url ){
                    self.error = true;
                    $.error("No URL specified in load object! quickinc.js");
                }
                // this is a js file to be loaded in the head
                if( true === settings.head ){
                    self.files.head[self.files.head.length] = settings.url;
                }
                // this is a css file to be loaded in the head
                else if( true === settings.css ){
                    self.files.css[self.files.css.length] = settings.url;
                }
                else {
                    // we are loading this script async so we need a slug to track
                    // dependencies and events
                    if( false === settings.slug ){
                        self.error = true;
                        $.error("You must set a script slug name for async loaded scripts in quickinc.js");
                    }
                    self.files.async[self.files.async.length] = {
                        url         : settings.url,
                        dependsOn   : settings.dependsOn,
                        slug        : settings.slug
                    };
                }
            }

        };
        
        /**
         * Writes CSS or JS tags to head depending on mode set
         * @param {String} mode Either 'head' or 'css'
         */
        quickinc.write = function( mode ){
            var d = self.files[mode],
                ln = d.length,
                i;
            for( i = 0; i < ln; i++ ){
                self.stats.filesLoaded++;
                switch( mode ){
                    case 'css':
                        $('<link rel="stylesheet" href="'+d[i]+'">').appendTo('head');
                        break;
                    case 'head':
                        $('<script src="'+d[i]+'"></script>').appendTo('head');
                        break;
                }
            }
        };

        quickinc.init(); // autostart class

        // issue headLoaded event once DOM is ready
        $(function(){
            quickinc.eventComplete("headLoaded");
        });

        // For crap browsers
        if (!Object.keys) {
            Object.keys = function (obj) {
                var keys = [],
                    k;
                for (k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        keys.push(k);
                    }
                }
                return keys;
            };
        }
        if (!Array.isArray) {
            Array.isArray = function(vArg) {
                return Object.prototype.toString.call(vArg) === "[object Array]";
            };
        }

    })(jQuery);
}; // end of quickinc function


// this is a dev tool, we log completion stats, and ie sucks so:
if( typeof console === "undefined" ){
    console = {
        log : function(){},
        error : function(){},
        info : function(){},
        warn : function(){}
    };
}


if( typeof jQuery === "undefined" ){
    console.error("jQuery must be loaded before quickinc.js will fire.");
} else quickIncWrapper();
