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
    const { BatchInterceptor } = require('@mswjs/interceptors');
    const { ClientRequestInterceptor } = require('@mswjs/interceptors/lib/interceptors/ClientRequest');
    const { XMLHttpRequestInterceptor } = require('@mswjs/interceptors/lib/interceptors/XMLHttpRequest');
    const { FetchInterceptor } = require('@mswjs/interceptors/lib/interceptors/fetch');
    
    // Shared object between N instances of this node
    var sharedMswjsInterceptor;

    function HttpLoggerNode(config) {
        RED.nodes.createNode(this, config);
        this.filter = config.filter;
        this.returnFormat = config.returnFormat || "txt";

        var node = this;
        
        node.status({});
        
        // Only the first HttpLoggerNode will create the shared object once
        if(!sharedMswjsInterceptor) {
            sharedMswjsInterceptor = {
                // Using nodeInterceptors is the recommended way to ensure all requests get intercepted, regardless of their origin.
                // Currently following interceptors are supported: ClientRequest, XMLHttpRequest, fetch.
                interceptor: new BatchInterceptor({
                    name: 'node-red-interceptor',
                    interceptors: [
                        new ClientRequestInterceptor(),
                        new XMLHttpRequestInterceptor(),
                        new FetchInterceptor()
                    ],
                }),
                listeners: new Map(),
                startListening: function(nodeId, callback) {
                    if(this.listeners.size === 0) {
                        var that = this;
                        // Handle the intercepted responses.
                        // This event handler needs to be applied every time again, because the interceptor.restore() will remove the event handler!
                        this.interceptor.on('response', async function(response, request) {
                            // Forward the request to all the callback functions of HttpLogger nodes that are currently listening to requests
                            that.listeners.forEach(function(listener, index, array) {
                                listener(response, request);
                            })
                        })
                
                        // Enable request interception in the current process, when the first callback function has been registered
                        this.interceptor.apply();
                    }
                    
                    this.listeners.set(nodeId, callback);
                },
                stopListening: function(nodeId) {
                    this.listeners.delete(nodeId);
                    
                    if(this.listeners.size === 0) {
                        // Disable request interception in the current process, when the no callback function have been registered
                        node.interceptor.dispose();
                    }
                },
                isListening: function(nodeId) {
                    return this.listeners.has(nodeId);
                }
            }
        }

        async function startListening() {
            // Register a callback function for this node, which will handle the request
            sharedMswjsInterceptor.startListening(node.id, async function(response, request) {
                // When a filter is available, check whether the URL (of the the http request) matches the filter.
                if( !node.filter || node.filter.trim() === "" || (request.url && request.url.indexOf(node.filter) >= 0)) {
                    // Get all the required information from the url (as string)
                    var parsedUrl = url.parse(request.url);
                    
                    var requestToSend = {
                        href:       parsedUrl.href,
                        port:       parsedUrl.port,
                        path:       parsedUrl.path,
                        host:       parsedUrl.host,
                        method:     request.method,
                        headers:    {}
                    }
                    
                    // When no port has been specified explicit, the default port is being used (based on the protocol)
                    if(requestToSend.port == null) {
                        var protocol = parsedUrl.protocol.replace(":", "");
                        
                        if(protocol === "https") {
                            requestToSend.port = 443;
                        }
                        else {
                            requestToSend.port = 80;
                        }
                    }

                    request.headers.forEach(function(headerValue, headerName) {
                        requestToSend.headers[headerName] = headerValue;
                    })

                    var responseToSend = {
                        statusCode: response.status,
                        statusText: response.statusText,
                        headers:    {}
                    }
                    
                    response.headers.forEach(function(headerValue, headerName) {
                        responseToSend.headers[headerName] = headerValue;
                    })
                    
                    var requestBody = null;
                    
                    if(request.body) {
                        // The request body is an Uint8Array
                        var requestBodyReader = request.clone().body.getReader();
                        
                        var requestLength = request.headers.get("content-length");
                        var requestOffset = 0;
                        var requestBody = new Uint8Array(requestLength);

                        // Insert the chunks at their offset into the requestBody Uint8Array, to restore the original body again
                        while (true) {
                            var { done, value } = await requestBodyReader.read();

                           if (value) {
                                requestBody.set(value, requestOffset);
                                requestOffset += value.byteLength;
                            }
                            
                            if (done) break;
                        }
                    }

                    if(!requestBody) {
                        requestBody = new Uint8Array();
                    }

                    var responseBody = null;
                    
                    if(response.body) {
                        // The response body is an Uint8Array
                        var responseBodyReader = response.clone().body.getReader();
                        
                        var responseLength = response.headers.get("content-length");
                        var responseOffset = 0;                      
                        var responseBody = new Uint8Array(responseLength);

                        // Insert the chunks at their offset into the responseBody Uint8Array, to restore the original body again
                        while (true) {
                            var { done, value } = await responseBodyReader.read();

                            if (value) {
                                responseBody.set(value, responseOffset);
                                responseOffset += value.byteLength;
                            }
                            
                            if (done) break;
                        }
                    }
                    
                    if(!responseBody) {
                        responseBody = new Uint8Array();
                    }

                    // Convert the (request/response) body to the required return type
                    switch (node.returnFormat) {
                        case "txt":
                            requestToSend.body = requestBody.toString('utf8');
                            responseToSend.body = responseBody.toString('utf8');
                            break;
                        case "bin":
                            requestToSend.body = Buffer.from(requestBody);
                            responseToSend.body = Buffer.from(responseBody);
                            break;
                        case "obj":
                            if(requestBody.length > 0) {
                                requestToSend.body = JSON.parse(requestBody);
                            }
                            else {
                                requestToSend.body = {};
                            }
                            
                            if(responseBody.length > 0) {
                                responseToSend.body = JSON.parse(responseBody);
                            }
                            else {
                                responseToSend.body = {};
                            }
                            break;
                    }

                    node.send({request: requestToSend, response: responseToSend, topic: "success"});
                }
            })

            node.status({fill:"blue", shape:"dot", text:"listening"});
            node.listening = true;
        }
        
        function stopListening() {
            sharedMswjsInterceptor.stopListening(node.id);
            node.status({});
            node.listening = false;
        }

        node.on("input", function(msg) {
            // Start listening to http requests ...
            if(msg.payload == true) {
                if (sharedMswjsInterceptor.isListening(node.id)) {
                    node.warn("This node is already listening");
                    return;
                }
                
                startListening();
            }

            // Stop listening to http requests ...
            if(msg.payload == false) {
                if (!sharedMswjsInterceptor.isListening(node.id)) {
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
