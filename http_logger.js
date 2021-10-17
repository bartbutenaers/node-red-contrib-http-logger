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
    const url = require('url');
    const cloneDeep = require('clone-deep');
    const { createInterceptor } = require('@mswjs/interceptors');
    const nodeInterceptors = require('@mswjs/interceptors/lib/presets/node').default;

    function HttpLoggerNode(config) {
        RED.nodes.createNode(this, config);
        this.filter = config.filter;
        this.returnFormat = config.returnFormat || "txt";
        this.listening = false;

        var node = this;
        
        // Enable request interception in the current process.
        // Using nodeInterceptors is the recommended way to ensure all requests get intercepted, regardless of their origin.
        // Currently following interceptors are supported: ClientRequest, XMLHttpRequest, fetch.
        node.interceptor = createInterceptor({
          modules: nodeInterceptors,
          resolver(request, ref) {
            // Optionally, return a mocked response.
          },
        })
        
        function startListening() {
            // Handle the intercepted responses.
            // This event handler needs to be applied every time again, because the interceptor.restore() will remove the event handler!
            node.interceptor.on('response', function(request, response) {
                var href = request.url.href;
                
                // When a filter is available, check whether the URL (of the the http request) matches the filter.
                if( !node.filter || node.filter.trim() === "" || (href && href.indexOf(node.filter) >= 0)) {      
                    var requestToSend = {
                        url:        request.url.href,
                        port:       request.url.port,
                        path:       request.url.pathname,
                        host:       request.url.host,
                        method:     request.method,
                        headers:    cloneDeep(request.headers._headers),
                        body:       request.body
                    }
                    
                    var responseToSend = {
                        status:     response.status,
                        statusText: response.statusText,
                        headers:    cloneDeep(response.headers._headers),
                        body:       response.body
                    }

                    node.send({request: requestToSend, response: responseToSend, topic: "success"});
                }
            })
        
            node.interceptor.apply();
            node.status({fill:"blue", shape:"dot", text:"listening"});
            node.listening = true;
        }
        
        function stopListening() {
            node.interceptor.restore();
            node.status({});
            node.listening = false;
        }

        node.on("input", function(msg) {
            // Start listening to http requests ...
            if(msg.payload == true) {
                if (node.listening == true) {
                    node.warn("This node is already listening");
                    return;
                }
                
                startListening();
            }

            // Stop listening to http requests ...
            if(msg.payload == false) {
                if (node.listening == false) {
                    node.warn("This node has already stopped listening");
                    return;
                }
                
                stopListening();
            } 
        });

        node.on("close", function() {
            stopListening();
        });
    }

    RED.nodes.registerType("http-logger",HttpLoggerNode);
}
