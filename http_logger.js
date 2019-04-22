/**
 * Copyright 2018 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 module.exports = function(RED) {
    var Http = require("http");
    var Https = require("https");
    var Mitm = require("mitm");
    var _ = require('lodash');
    var events = require('events');
    var cloneDeep = require('clone-deep');
    
    // ================================================================================================
    // Originally this node was based on the 'global-request-logger' library.  However since that 
    // doesn't work anymore on more recent NodeJs version, I switched to the 'mitm' library (man in 
    // the middle).  Some extra work is required to accomplish this:
    // 1. Enable the mitm interceptor.
    // 2. Another node (e.g. http-request) triggers a http request.
    // 3. Mitm intercepts the connection being created, and triggers its 'connection' event.
    // 4. Mitm triggers its 'request' event, where we can generate our custom response data.  However
    //    we don't want to generate custom response data, but we want to have the response from the 
    //    host (which is specified in the original http request).
    // 5. So we will forward the original request to the specified host, by creating a new request.
    // 6. However mitm will also intercept this new request, which is not what we want.  Therefore
    //    we will 'bypass' mitm, which means the 'request' event is not triggered (but instead the
    //    http request is send to the specified host).  To determine that this is a forwarded request
    //    (which needs to be bypassed), a parameter 'bypass_mitm' will be send by step 4.
    // 7. As soon as the response (for the forwarded request) has arrived, we will pipe this response
    //    to the original request.
    // 8. Moreover a new event 'request_response' will be triggered.  Every http-logger node will
    //    handle this event, and send the request/response information as an output message (if the
    //    specified url matches the node's filter).
    // 9. The node (e.g. http-request) that has triggered the original request, will receive the 
    //    response without knowing that the request has been forwarded.
    // See https://github.com/moll/node-mitm/issues/58#issuecomment-482810784 for more information.
    // ================================================================================================
    
    // It is allowed only to executed 1 Mitm constructor, otherwise we will get a infinite event loop.
    // See my mitm issue (https://github.com/moll/node-mitm/issues/58#issuecomment-484269749).
    // So create 1 mitm instance, which all http-logger nodes will share.
    // (see https://discourse.nodered.org/t/sharing-a-single-instance/10342)
    var mitm_singleton = new Mitm();
    
    // Keep track which http-logger nodes are listening to the mitm_singleton.
    // Indeed the event emitter in mitm isn't accessible outside the instance, so we will workaround that ...
    var mitm_emitter = new events.EventEmitter();
    
    // Make sure mitm doesn't affect performance, when no http-logger nodes are active.
    // So we will disable the mitm intercepting by default.
    mitm_singleton.disable();
    
    // Since mitm's request-event will forward the request (as a proxy), we are only allowed to have 1 listener for both events (connection & request).
    // Otherwise the request would be forwarded multiple times (to the same host).
    // But to make sure MULTIPLE http-logger nodes can read the request/response information, the request handler needs to trigger a custom event 
    // ('request_response') to every http-logger node that is listening.
    mitm_singleton.on("connect", function(socket, options) {
        if (options.bypass_mitm) {
            // Make sure that mitm doesn't intercept this request
            socket.bypass();
        }
        else {
            // For the requests that will be intercepted by mitm, the connect options should be available in the requestListener.
            // Indeed those connect options are required to determine all the required information.
            // See issue https://github.com/moll/node-mitm/issues/14
            socket._handle.remote._mitm = { client: socket, options };
        }
    });
    
    mitm_singleton.on("request", function(request, response) {      
        // Get the connect options, which have been registered in the above 'connect' handler
        var { client, options } = request.connection._handle._mitm;
        
        var logInfo = {
            request: {},
            response: {}
        };
        
        if (typeof options === 'string') {
            options = url.parse(options);
        }
                
        // Extract request logging details from the connect options
        _.assign(logInfo.request, _.pick(options, 'port', 'path', 'host', 'protocol', 'auth', 'hostname', 'hash', 'search', 'query', 'pathname', 'href'));

        // Extract extra request logging details from the request itself
        logInfo.request.method = request.method || 'get';
        logInfo.request.headers = request.headers;

        // Extract the request body (in case of request.method = 'post').  You cannot simply get the body, so we will need to append
        // the body chunks, until the entire body has arrived...
        logInfo.request.body = [];
        request.on('data', function (chunk) {
            logInfo.request.body.push(chunk);
        });
        request.on('end', () => {
            // The entire request body has been intercepted, so store it (after concatenating all the buffer chunks)
            logInfo.request.body = Buffer.concat(logInfo.request.body);
        });      

        // Forward the original request, which means we create a new request.  As soon as the response arrives, we 
        // will pass that to the original request.
        (request.connection.encrypted ? Https : Http).get({
            protocol: request.connection.encrypted ? "https:" : "http:",
            host: request.headers.host,
            path: request.url,
            encoding: null,  // Force NodeJs to return a Buffer (instead of a string)
            bypass_mitm: true // Proxying
        }, function(newRes) {
            response.writeHead(newRes.statusCode, newRes.headers);
            newRes.pipe(response);
            
            _.assign(logInfo.response, _.pick(newRes, 'statusCode', 'headers', 'trailers', 'httpVersion', 'url', 'method'));
            
            // Get the response body.  You cannot simply get the body, so we will need to append
            // the body chunks, until the entire body has arrived...
            logInfo.response.body = [];
            newRes.on('data', function(chunk) {
                logInfo.response.body.push(chunk);
            });
            newRes.on('end', function() {
                // The entire response body has been intercepted, so store it (after concatenating all the buffer chunks)
                logInfo.response.body = Buffer.concat(logInfo.response.body);
                
                // At this moment both the request and response information are complete, so inform all http-logger nodes
                mitm_emitter.emit('request_response', logInfo);
            });
        })
    });

    function HttpLoggerNode(config) {
        RED.nodes.createNode(this, config);
        this.filter = config.filter;
        this.returnFormat = config.returnFormat || "txt";

        var node = this;
        
        // This listener will be called by mitm, as soon as mitm has received a http response.
        node.requestResponseListener = function(logInfo) {
            var href = logInfo.request.href;
            
            // When a filter is available, check whether the URL (of the the http request) matches the filter.
            if( !node.filter || node.filter.trim() === "" || (href && href.indexOf(node.filter) >= 0)) {
                // Clone the logInfo, because it 'could' be send in multiple output messages (in case multiple http-logger nodes are 
                // filtering the same URL).  And we need to avoid contention conflicts...
                let logInfoClone = cloneDeep(logInfo);
                
                try {
                    // Convert the (request/response) body to the required return type
                    switch (node.returnFormat) {
                        case "txt":
                            logInfoClone.request.body = logInfoClone.request.body.toString('utf8');
                            logInfoClone.response.body = logInfoClone.response.body.toString('utf8');
                            break;
                        case "bin":
                            // Do nothing because NodeJs offers (request/response) bodies as buffers already
                            break;
                        case "obj":
                            // Empty strings cannot be parsed (Unexpected end of input ...), so convert them to something valid.
                            // See https://stackoverflow.com/questions/30621802/why-does-json-parse-fail-with-the-empty-string
                            if (!logInfoClone.request.body || logInfoClone.request.body.length === 0) {
                                logInfoClone.request.body = '{}';
                            }
                            if (!logInfoClone.response.body || logInfoClone.response.body.length === 0) {
                                logInfoClone.response.body = '{}';
                            }
                        
                            logInfoClone.request.body = JSON.parse(logInfoClone.request.body);
                            logInfoClone.response.body = JSON.parse(logInfoClone.response.body);
                            break;
                    }
                }
                catch(e) { 
                    node.warn("Cannot convert body to the specified type"); 
                }
                
                // Send an output message containing both the request and response
                node.send({request: logInfoClone.request, response: logInfoClone.response, topic: "success"});
            }
        }
        
        function startListening() {
            // Only start listening, when this node isn't listening yet
            if (!mitm_emitter.listeners('request_response').includes(node.requestResponseListener)) {
                mitm_emitter.addListener('request_response', node.requestResponseListener);
                
                // As soon as the first listener has been added, mitm should be enabled.
                if (mitm_emitter.listenerCount('request_response') === 1) {
                    mitm_singleton.enable();
                }
                
                node.status({fill:"blue", shape:"dot", text:"listening"});
            }
        }
        
        function stopListening() {
            // Only stop listening, when this node is listening already
            if (mitm_emitter.listeners('request_response').includes(node.requestResponseListener)) {
                mitm_emitter.removeListener('request_response', node.requestResponseListener);
                
                // As soon as the last listener has been removed, mitm should be disabled.
                if (mitm_emitter.listenerCount('request_response') === 0) {
                    mitm_singleton.disable();
                }
                
                node.status({});
            }
        }

        node.on("input", function(msg) {
            // Start listening to http requests ...
            if(msg.payload == true) {
               startListening();
            }

            // Stop listening to http requests ...
            if(msg.payload == false) {                
                stopListening();
            } 
        });

        node.on("close", function() {
            // Stop listening to http requests when the node is closed.
            // Otherwise we would end up with multiple listeners for this node (e.g. after a deploy), which would
            // result in duplicate output messages...
            stopListening();
        });
    }

    RED.nodes.registerType("http-logger",HttpLoggerNode);
}
