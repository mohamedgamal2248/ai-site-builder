/**
 * Runs first thing in <head>: catches errors from before the app is interactive (hydration
 * errors happen then, before any effect could listen) and React's own logged errors.
 * They wait in window.__bpErr until ErrorReporter mounts and takes over the queue.
 */
export const EARLY_ERRORS = `window.__bpErr=window.__bpErr||[];(function(){var ce=console.error;function add(m,s){try{window.__bpErr.push([String(m),s||""])}catch(x){}}addEventListener("error",function(e){add(e.message||"error",e.error&&e.error.stack)});console.error=function(){try{var a=arguments[0],m=a&&a.message?a.message:String(a);if(/Minified React error|hydrat|did not match/i.test(m))add(m,a&&a.stack)}catch(x){}return ce.apply(console,arguments)}})();`;
